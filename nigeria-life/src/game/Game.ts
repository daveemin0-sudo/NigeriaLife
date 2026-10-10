import * as THREE from 'three';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { GameCamera } from './Camera';
import { InputManager } from './Input';
import { PointerScope } from './PointerScope';
import { HUD } from '../ui/HUD';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { ChatBox } from '../ui/ChatBox';
import { PostProcessingManager } from '../graphics/PostProcessingManager';
import { FlightExperience } from '../transit/FlightExperience';
import { RoadRideExperience } from '../transit/RoadRideExperience';
import { TransitHUD } from '../transit/TransitHUD';
import type { FlightDetails, RideDetails } from '../transit/TransitTypes';
import { PhotoModeModal } from '../ui/PhotoModeModal';
import { BackendService } from '../backend/BackendService';
import { showGameToast } from '../ui/GameToast';
import { UIStateManager } from '../ui/UIStateManager';
import { PlaceCard } from '../ui/PlaceCard';
import { InteractionDirector } from '../interactions/InteractionDirector';
import { BukaOrderUI } from '../ui/BukaOrderUI';
import { ShopUI } from '../ui/ShopUI';
import { VendorUI } from '../ui/VendorUI';
import { ActivityStatusUI } from '../ui/ActivityStatusUI';
import { emitGameEvent } from './GameEvents';
import type { CityId } from '../cities/CityTypes';
import type { SavedCityId } from '../backend/types';
import { WorldDataManager } from '../world/data/WorldDataManager';
import { HouseDecorationSystem, CATALOGUE_ITEMS } from '../housing/HouseDecorationSystem';

/** How often the player's position, the time of day and their vitals are written to the save */
const AUTOSAVE_SECONDS = 5;

export class Game {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public cameraManager: GameCamera;
  public world: World;
  public player: Player;
  public input: InputManager;
  public hud: HUD;
  public network: NetworkManager;
  public chatBox: ChatBox;
  public postProcessing: PostProcessingManager;
  public photoMode: PhotoModeModal;
  public bukaUI!: BukaOrderUI;
  public shopUI!: ShopUI;
  public vendorUI!: VendorUI;
  /** Scripted interactions, exposed for the browser tests and for debugging in the console */
  public interactions = InteractionDirector.get();
  /** Game data the browser tests read, reachable the same way from a dev server and from a built game */
  public readonly modules = { WorldDataManager, HouseDecorationSystem, CATALOGUE_ITEMS };
  private lastStepDelta: number = 0;
  public placeCard: PlaceCard;

  // In-Transit Simulations (In-Flight Airliner & First-Person Road Ride)
  public flightExperience: FlightExperience;
  public roadRideExperience: RoadRideExperience;
  public transitHUD: TransitHUD;

  private clock: THREE.Clock;
  private savedStreetFog: THREE.Fog | THREE.FogExp2 | null = null;
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFPS: number = 60;
  private lastAutosaveAt: number = performance.now();
  private onJourneyCompleted: (() => void) | null = null;

  constructor() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera Manager
    this.cameraManager = new GameCamera();

    // 3. Renderer (Phase 1: High-Fidelity Color & Tone Pipeline)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
    PointerScope.init(this.renderer.domElement);

    // 3b. Post-Processing Pipeline (Phase 6: Bloom, Lagos Atmosphere Grade, OutputPass)
    this.postProcessing = new PostProcessingManager(
      this.scene,
      this.cameraManager.camera,
      this.renderer
    );

    // 4. World & Environment
    this.world = new World(this.scene, this.renderer);
    this.cameraManager.collisionObjects = [this.world.buildings.group, this.world.districts.group];
    this.world.viewCamera = this.cameraManager.camera;

    // 5. Player Character
    this.player = new Player();
    this.player.cameraManager = this.cameraManager;
    this.scene.add(this.player.mesh);

    // 6. UI / HUD
    this.hud = new HUD();
    this.hud.init(this.player, this.world);
    this.hud.onRotateCamera = (deltaYaw: number) => {
      this.cameraManager.rotate(deltaYaw);
    };
    this.hud.onResetCamera = () => {
      this.cameraManager.resetOrientation();
    };
    this.hud.onCycleCameraPreset = () => {
      return this.cameraManager.cyclePreset();
    };

    // 6b. Cinematic Photo Studio Mode
    this.photoMode = new PhotoModeModal(this.cameraManager, this.renderer.domElement);
    this.hud.onOpenPhotoMode = () => {
      this.photoMode.open();
    };
    this.hud.phoneModal.onOpenPhotoMode = () => {
      this.photoMode.open();
    };

    // 7. Input & Cursor Interaction
    this.input = new InputManager(
      this.cameraManager.camera,
      this.scene,
      this.player,
      this.world,
      this.hud,
      this.cameraManager
    );

    // 8. Vehicle Control Wiring
    this.hud.onEnterVehicle = (vehId: string) => {
      const v = this.world.vehicles.getVehicleById(vehId);
      if (v) this.walkToVehicleAndGetIn(v);
    };

    this.hud.onExitVehicle = () => {
      this.exitVehicle();
    };

    this.hud.onHonkVehicle = () => {
      if (this.player.isDriving && this.player.currentVehicle) {
        this.player.currentVehicle.honk();
      }
    };

    this.input.onToggleVehicle = () => {
      if (this.player.isDriving) {
        this.exitVehicle();
      } else {
        const v = this.world.vehicles.getNearestDrivableVehicle(this.player.position, 6.0);
        if (v) {
          this.walkToVehicleAndGetIn(v);
        }
      }
    };

    this.input.onHonkVehicle = () => {
      if (this.player.isDriving && this.player.currentVehicle) {
        this.player.currentVehicle.honk();
      }
    };

    // 9. Travel Modal Inter-District Arrival Warp
    this.hud.travelModal.onTravelArrived = (destId: string) => {
      if (destId === 'dest_lekki') {
        this.player.mesh.position.set(55, 0, 0);
      } else if (destId === 'dest_oshodi') {
        this.player.mesh.position.set(12, 0, -85);
      } else if (destId === 'dest_vi') {
        this.player.mesh.position.set(0, 0, 85);
      } else if (destId === 'dest_ikeja') {
        this.player.mesh.position.set(0, 0, -25);
      }
    };

    // 9b. Inter-State Flights & Cross-Country Travel (Lagos <-> Abuja FCT <-> Port Harcourt)
    this.hud.interstateModal.onInterStateTravelCompleted = (destId) => {
      this.arriveInCity(destId);
    };

    // 9b-2. Full 3D Commercial In-Flight & First-Person Road Ride Simulation (Nigeria Life Standard)
    this.flightExperience = new FlightExperience();
    this.scene.add(this.flightExperience.group);

    this.roadRideExperience = new RoadRideExperience();
    this.scene.add(this.roadRideExperience.group);

    this.transitHUD = new TransitHUD();

    // Wire Transit HUD Camera Switches & Skips
    this.transitHUD.onSelectFlightCamera = (view) => {
      this.flightExperience.setCameraView(view);
      this.transitHUD.setFlightCameraActive(view);
    };

    this.transitHUD.onSelectRideCamera = (view) => {
      this.roadRideExperience.setCameraView(view);
      this.transitHUD.setRideCameraActive(view);
    };

    this.transitHUD.onSkipFlight = () => {
      this.flightExperience.skipFlight();
    };

    this.transitHUD.onSkipRide = () => {
      this.roadRideExperience.skipRide();
    };

    // Wire Flight Progression & Landing
    this.flightExperience.onFlightPhaseChanged = (phase, timeRemaining, announcement) => {
      this.transitHUD.updateFlightProgress(phase, timeRemaining, announcement);
    };

    this.flightExperience.onFlightCompleted = (flight) => {
      this.transitHUD.hideFlightHUD();

      // Launch Authentic Airport Road Ride into city center (Screenshot 1: G-Wagon in Port Harcourt/Lagos/Abuja)
      const destName = flight.destinationId === 'port_harcourt'
        ? 'Trans-Amadi Oil Base'
        : flight.destinationId === 'abuja'
        ? 'Three Arms Zone / Maitama'
        : 'Victoria Island / Marina';

      const rideDetails: RideDetails = {
        vehicleName: 'Mercedes G-Wagon',
        vehicleType: 'suv',
        originName: flight.destinationName,
        destinationName: destName,
        durationSeconds: 16,
        trafficCondition: 'Go-slow',
        weatherCondition: 'Sunny',
        destinationCityId: flight.destinationId,
      };

      this.roadRideExperience.startRide(rideDetails);
      this.transitHUD.showRideHUD(rideDetails);
    };

    // Wire Road Ride Arrival & City Activation
    this.roadRideExperience.onRideCompleted = (ride) => {
      this.transitHUD.hideRideHUD();
      this.world.setStreetModeVisibility(true);
      this.player.mesh.visible = true;

      this.arriveInCity(ride.destinationCityId);

      const journeyCompleted = this.onJourneyCompleted;
      this.onJourneyCompleted = null;
      journeyCompleted?.();
    };

    // Wire InterState Modal to trigger the 3D Flight Experience
    this.hud.interstateModal.onStartTravelSimulation = (route, _fare, onCompleted) => {
      const destAirportNames: Record<string, { code: string; name: string }> = {
        lagos: { code: 'LOS', name: 'Murtala Muhammed Int. Airport (LOS)' },
        abuja: { code: 'ABV', name: 'Nnamdi Azikiwe Int. Airport (ABV)' },
        port_harcourt: { code: 'PHC', name: 'Port Harcourt Int. Airport Omagwa (PHC)' },
      };

      const currOrigin = this.hud.interstateModal.currentOriginCityId;
      const currCode = currOrigin === 'lagos' ? 'LOS' : currOrigin === 'abuja' ? 'ABV' : 'PHC';
      const currName = currOrigin === 'lagos' ? 'Lagos MMIA' : currOrigin === 'abuja' ? 'Abuja NAIA' : 'Port Harcourt Omagwa';
      const targetMeta = destAirportNames[route.destinationId] || { code: 'DEST', name: 'Destination Airport' };

      const flightDetails: FlightDetails = {
        flightCode: route.flightOrBusCode || 'NL 526',
        airlineName: route.airlineOrOperator || 'Nigeria Life Air',
        travelClass: 'Economy',
        tailNumber: '5N-LLD',
        originId: currOrigin,
        destinationId: route.destinationId,
        originCode: currCode,
        destinationCode: targetMeta.code,
        originName: currName,
        destinationName: targetMeta.name,
        durationSeconds: 22,
      };

      // The ticket is already paid for: if the game closes mid-journey, the player resumes at the destination
      this.saveArrivalInTransit(route.destinationId);

      // Temporarily hide street mode while in-flight
      this.world.setStreetModeVisibility(false);
      this.player.mesh.visible = false;

      this.flightExperience.startFlight(flightDetails);
      this.transitHUD.showFlightHUD(flightDetails);

      // Signal the modal once the road ride from the airport has finished
      this.onJourneyCompleted = () => onCompleted(route.destinationId);
    };

    // 9c. Camera Navigation Modes (Home Flat | Street Walk | Aerial World Map)
    this.hud.onNavigateMode = (mode: 'street' | 'home' | 'map') => {
      if (mode === 'home') {
        if (!this.canGoHome()) return;
        this.world.worldMap.deactivate();
        this.world.interiorManager.enterInterior('residence', this.player, this.cameraManager, this.hud, this.world);
        return;
      }

      if (this.world.interiorManager.isPlayerInside()) {
        this.world.interiorManager.exitCurrentInterior(this.player, this.cameraManager, this.hud, this.world);
      }

      this.cameraManager.setMode(mode);
      this.cameraManager.setLayerMode(mode);

      if (mode === 'street') {
        if (this.savedStreetFog) {
          this.scene.fog = this.savedStreetFog;
        }
        this.world.worldMap.deactivate();
        this.world.setStreetModeVisibility(true);
        if (!this.player.isDriving) this.player.mesh.visible = true;
      } else if (mode === 'map') {
        if (this.scene.fog) {
          this.savedStreetFog = this.scene.fog;
        }
        this.scene.fog = null; // 100% clear crisp view for world map without blurry haze
        this.world.setStreetModeVisibility(false);
        this.player.mesh.visible = false;
        this.world.worldMap.activate();
      }
    };

    // 9d. Street Distance Radar Fast Navigation
    this.hud.onRadarNavigate = (destId: string) => {
      if (destId === 'dest_cchub') this.player.mesh.position.set(-15, 0, -20);
      else if (destId === 'dest_quilox') this.player.mesh.position.set(22, 0, 75);
      else if (destId === 'dest_amala') this.player.mesh.position.set(-18, 0, 15);
      else if (destId === 'dest_lekki') this.player.mesh.position.set(55, 0, 0);
      else if (destId === 'dest_ikeja') this.player.mesh.position.set(0, 0, -25);
    };

    // 9e. 3-Tier Interior Destination System (Hospital, Bank, Buka, Police, Residence)
    // The player walks in and out through the door wherever the place has one
    this.hud.onEnterInterior = (buildingId: string) => {
      const target = this.world.interiorManager.getInteriorByBuildingId(buildingId);
      if (target?.type === 'residence' && !this.canGoHome()) return;
      this.world.interiorManager.enterThroughDoor(buildingId, this.player, this.cameraManager, this.hud, this.world);
    };

    this.hud.onExitInterior = () => {
      this.world.interiorManager.leaveThroughDoor(this.player, this.cameraManager, this.hud, this.world);
    };

    // 9e-2. The buka's menu and order status
    this.bukaUI = new BukaOrderUI(this.world.interiorManager.restaurant.service);
    this.hud.onOpenBukaMenu = (preferTable) => this.bukaUI.open(preferTable);
    const bukaService = this.world.interiorManager.restaurant.service;
    this.hud.canSitWith = (objectId) => this.world.interiorManager.currentInterior?.type === 'restaurant' && bukaService.canSitWith(objectId);
    this.hud.onSitWith = (objectId) => {
      const sat = bukaService.sitWith(objectId);
      if (!sat.ok && sat.reason) showGameToast(sat.reason, 'warning', 3600);
    };

    // 9e-2b. The supermarket's shelves, basket and till
    this.shopUI = new ShopUI(this.world.interiorManager.shop.service);
    this.hud.onShopAction = (objectId) => {
      if (objectId.startsWith('shop_shelf_')) this.shopUI.openShelf(objectId.replace('shop_shelf_', ''));
      else this.shopUI.openBasket();
    };

    // 9e-2c. Street sellers who hand over what is bought
    this.vendorUI = new VendorUI(() => this.player.actor);
    this.hud.onVendorAction = (objectId) => this.vendorUI.open(objectId);

    // 9e-3. Home life: bed, sofa and TV, fridge, bath
    const homeLife = this.world.interiorManager.residence.life;
    const homeStatus = new ActivityStatusUI('home-activity-status', () => homeLife.status(), () => homeLife.stop());
    homeLife.onChange = () => homeStatus.render();
    this.hud.onHomeActivity = (objectId) => {
      if (objectId === 'flat-bed') homeLife.sleep();
      else if (objectId === 'flat-tv') homeLife.watchTv();
      else if (objectId === 'flat-drum') homeLife.bathe();
      else if (objectId === 'flat-fridge') {
        const ate = homeLife.eatFromFridge();
        if (!ate.ok && ate.reason) showGameToast(ate.reason, 'warning', 3600);
      }
    };

    // 9f. On-screen shortcuts to everything inside the current building
    this.placeCard = new PlaceCard({
      getPlace: () => {
        const interiors = this.world.interiorManager;
        return interiors.currentInterior
          ? { def: interiors.currentInterior, objects: interiors.getActiveInteractiveObjects() }
          : null;
      },
      goTo: (obj) => this.input.approachAndInteract(obj),
      leave: () => this.hud.onExitInterior?.(),
    });

    // 10. Multiplayer & Street Chat
    this.network = new NetworkManager(this.scene, this.player);
    this.chatBox = new ChatBox(this.network);
    this.network.setOnPlayerCount((count) => this.hud.updateOnlineCount(count));

    // 11. Clock for delta-timed updates
    this.clock = new THREE.Clock();

    // 12. Window Resizing
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 12b. Resume where the player left off, then keep that position saved
    this.restoreWorldState();
    window.addEventListener('pagehide', () => this.saveWorldState());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveWorldState();
    });

    const loadNotice = BackendService.getInstance().loadNotice;
    if (loadNotice) {
      showGameToast(loadNotice, 'warning', 9000);
    }

    // 13. Start Loop
    this.loop();
  }

  /** Home is somewhere the player owns or rents. Without one, says so and stays put. */
  private canGoHome(): boolean {
    if (BackendService.getInstance().hasHome()) return true;
    this.hud.currentNavMode = 'street';
    document.getElementById('nav-btn-home')?.classList.remove('active');
    if (UIStateManager.getInstance().isMode('house')) {
      UIStateManager.getInstance().setMode(this.world.interiorManager.isPlayerInside() ? 'interior' : 'street');
    }
    this.hud.showDialogueModal({
      speakerName: 'No home yet',
      speakerRole: 'Housing',
      speakerAvatar: '🔑',
      dialogueText: 'You do not own or rent a place yet. Open Houses on your phone to rent or buy one, then come back.',
    });
    return false;
  }

  private isSavedCity(cityId: string): cityId is SavedCityId {
    return cityId === 'lagos' || cityId === 'abuja' || cityId === 'port_harcourt';
  }

  /** Switches the world to a city the player has just travelled to, and reports the arrival. */
  private arriveInCity(cityId: CityId): void {
    this.hud.interstateModal.currentOriginCityId = cityId;
    if (this.world.cityManager.currentCityId === cityId) return;

    this.world.cityManager.switchCity(cityId, this.player, (newObjs) => {
      this.world.interactiveObjects = newObjs;
    });
    emitGameEvent('arrive_city', { city: cityId });
    this.saveWorldState();
  }

  private saveArrivalInTransit(cityId: CityId): void {
    if (!this.isSavedCity(cityId)) return;
    BackendService.getInstance().saveWorldState({
      cityId,
      x: 0,
      z: 10,
      rotationY: 0,
      hour: this.world.skyEnvironment.currentHour,
      day: this.world.skyEnvironment.day,
      inTransit: true,
    });
  }

  /** Records the player's city, street position and the time of day in the saved game. */
  private saveWorldState(): void {
    // Mid-flight the destination was already saved when the ticket was bought
    if (this.flightExperience.isActive || this.roadRideExperience.isActive) return;

    const cityId = this.world.cityManager.currentCityId;
    if (!this.isSavedCity(cityId)) return;

    // Indoors or at the wheel, the place to come back to is the street door or the vehicle
    const interiors = this.world.interiorManager;
    const spot = interiors.isPlayerInside()
      ? interiors.getStreetReturnPosition()
      : this.player.isDriving && this.player.currentVehicle
      ? this.player.currentVehicle.mesh.position
      : this.player.position;

    BackendService.getInstance().saveWorldState({
      cityId,
      x: Number(spot.x.toFixed(2)),
      z: Number(spot.z.toFixed(2)),
      rotationY: Number(this.player.mesh.rotation.y.toFixed(2)),
      hour: Number(this.world.skyEnvironment.currentHour.toFixed(3)),
      day: this.world.skyEnvironment.day,
    });
  }

  private restoreWorldState(): void {
    const saved = BackendService.getInstance().getData().worldState;
    if (!saved) return;

    this.world.skyEnvironment.setDay(saved.day);
    this.world.skyEnvironment.setHour(saved.hour);

    if (saved.inTransit) {
      // The game closed during a paid journey: finish it
      this.arriveInCity(saved.cityId);
      return;
    }

    if (saved.cityId !== this.world.cityManager.currentCityId) {
      this.world.cityManager.switchCity(saved.cityId, this.player, (newObjs) => {
        this.world.interactiveObjects = newObjs;
      });
      this.hud.interstateModal.currentOriginCityId = saved.cityId;
    }
    this.player.mesh.position.set(saved.x, 0, saved.z);
    this.player.mesh.rotation.y = saved.rotationY;
    this.cameraManager.snapToPlayer(this.player, 'street');
  }

  /** Getting in is seen: the player walks round to the driver's door, reaches for it, and is then at the wheel. */
  private walkToVehicleAndGetIn(vehicle: any): void {
    if (this.player.isDriving) return;
    const actor = this.player.actor;
    const director = InteractionDirector.get();
    if (director.interrupt(actor) === 'locked') return;
    this.player.stopMoving();

    const door = new THREE.Vector3(-2.2, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.mesh.rotation.y)
      .add(vehicle.mesh.position)
      .setY(0);
    const started = director.perform({
      id: 'get in vehicle',
      actor,
      point: door,
      target: () => vehicle.mesh.position,
      speed: 6.5,
      ifStuck: 'snap',
      animation: { arms: 'reach' },
      seconds: 0.6,
      // At the very end, so nothing is still directing the body once it is in the seat
      effectAt: 1,
      requires: () => (vehicle.driver ? 'Someone is already driving that.' : null),
      effect: () => this.enterVehicle(vehicle),
    });
    if (!started.ok && started.reason && started.reason !== 'busy') showGameToast(started.reason, 'warning');
  }

  private enterVehicle(vehicle: any): void {
    vehicle.enter(this.player);
    this.player.isDriving = true;
    this.player.currentVehicle = vehicle;
    this.hud.showDrivingHUD(vehicle.name);
    UIStateManager.getInstance().setMode('driving');
    emitGameEvent('drive', { city: this.world.cityManager.currentCityId });
  }

  private exitVehicle(): void {
    if (this.player.isDriving && this.player.currentVehicle) {
      const exitPos = this.player.currentVehicle.exit();
      this.player.mesh.position.copy(exitPos);
      this.player.mesh.visible = true;
      this.player.isDriving = false;
      this.player.currentVehicle = null;
      this.hud.hideDrivingHUD();
      UIStateManager.getInstance().setMode('street');
    }
  }

  private onWindowResize(): void {
    this.cameraManager.handleResize();
    this.world.worldMap.handleResize();
    this.flightExperience.handleResize();
    this.roadRideExperience.handleResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcessing.setSize(window.innerWidth, window.innerHeight);
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    this.step(Math.min(this.clock.getDelta(), 0.1));
    this.render();
  };

  /**
   * Runs the game forward by some seconds of game time without drawing every frame.
   * For automated tests, so a scene that takes a minute to play out does not take a minute
   * to check (and still plays out on a machine too slow to render it in real time).
   */
  public async advance(seconds: number, frame: number = 1 / 30): Promise<void> {
    const frames = Math.ceil(seconds / frame);
    for (let i = 0; i < frames; i++) {
      this.step(frame);
      // Let promise continuations (a sequence finishing, a door opening) run between frames
      await Promise.resolve();
    }
    this.clock.getDelta();
  }

  /** One frame of game logic. */
  private step(delta: number): void {

    // Update Player Movement & Walking Cycle (frozen in Photo Mode so player can pose)
    if (this.cameraManager.mode === 'photo') {
      this.player.update(delta, {});
    } else {
      this.player.update(delta, this.input.keys);
    }

    // Scripted interactions: doors, sitting, serving, eating, waving
    InteractionDirector.get().update(delta);

    // Update Camera Follow (moved in closer while the player is seated)
    const playerActor = this.player.actor;
    this.cameraManager.setCloseUp(playerActor.hold !== null || (playerActor.busy && playerActor.sequence?.closeUp === true));
    this.cameraManager.update(this.player, delta);
    if (this.world.interiorManager.isPlayerInside()) {
      this.world.interiorManager.updateCutaway(delta, this.cameraManager.camera, this.player);
    }

    // Update Transit Simulations (Flight & Road Ride)
    this.flightExperience.update(delta);
    this.roadRideExperience.update(delta);

    // Update World (Vehicles, Traffic, NPCs, Weather, Districts) with keys & player position
    this.world.update(delta, this.input.keys, this.player.position, this.player);

    // Update Player Vitals (Hunger / Energy / Health Needs Loop)
    const vitalsResult = BackendService.getInstance().updateVitals(
      delta,
      this.player.isSprinting,
      this.player.isDriving
    );
    if (vitalsResult.starvedWarning) {
      showGameToast('⚠️ Hunger is low! Stop by Mama Put or order QuickChop before you faint.', 'warning');
    }
    if (vitalsResult.collapsed) {
      showGameToast('🚑 You collapsed from severe starvation! Rushed to local clinic (₦2,500 treatment fee).', 'error');
      this.player.mesh.position.set(0, 0, 0);
    }

    // Dynamic District Location Tracker in HUD (only when outdoors in street mode)
    if (!this.world.interiorManager.isPlayerInside() && !this.flightExperience.isActive && !this.roadRideExperience.isActive) {
      const district = this.world.getDistrictAtPosition(this.player.position);
      this.hud.updateLocation(district.name, district.sub);
    }

    // Update Driving HUD Speedometer
    if (this.player.isDriving && this.player.currentVehicle) {
      this.hud.updateDrivingHUD(this.player.currentVehicle.currentSpeed);
    }

    // Autosave position, time of day and vitals (wall-clock time, so a slow frame rate does not delay it)
    const nowMs = performance.now();
    if (nowMs - this.lastAutosaveAt >= AUTOSAVE_SECONDS * 1000) {
      this.lastAutosaveAt = nowMs;
      this.saveWorldState();
    }

    // Update Multiplayer networking & remote players
    this.network.update(delta);

    // Update Input cursor animations
    this.input.update(delta);

    // Keep the map's place pins over their buildings
    if (this.hud.currentNavMode === 'map') {
      this.hud.worldMapUI.updatePins(this.world.worldMap.mapCamera);
    }

    this.lastStepDelta = delta;
  }

  private render(): void {
    const delta = this.lastStepDelta;

    // Render Scene with active presentation camera (Isometric World Map vs In-Flight vs Road Ride vs 3D Game Camera)
    if (this.hud.currentNavMode === 'map') {
      this.renderer.render(this.scene, this.world.worldMap.mapCamera);
    } else if (this.flightExperience.isActive) {
      this.renderer.render(this.scene, this.flightExperience.flightCamera);
    } else if (this.roadRideExperience.isActive) {
      this.renderer.render(this.scene, this.roadRideExperience.rideCamera);
    } else {
      this.renderer.render(this.scene, this.cameraManager.camera);
    }

    // Performance Diagnostics Calculation
    this.frameCount++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      this.currentFPS = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;

      const fpsEl = document.getElementById('perf-fps');
      const msEl = document.getElementById('perf-ms');
      const drawEl = document.getElementById('perf-draws');
      if (fpsEl) fpsEl.textContent = `${this.currentFPS} FPS`;
      if (msEl) msEl.textContent = `${(delta * 1000).toFixed(1)}ms`;
      if (drawEl) drawEl.textContent = `${this.renderer.info.render.calls} draws`;
    }
  }
}
