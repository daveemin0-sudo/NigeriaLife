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
import { SoundEngine } from '../audio/SoundEngine';
import { DestinationRegistry } from '../destinations/DestinationRegistry';
import { RideService } from '../phone/services/RideService';
import { DeliveryService } from '../phone/services/DeliveryService';
import { MessageService } from '../phone/services/MessageService';
import { Market } from '../phone/services/Market';
import type { PhoneWorld } from '../phone/PhoneApp';
import { SelfMenu } from '../ui/SelfMenu';
import { Land } from '../realestate/Land';
import { BuildBar } from '../ui/BuildBar';
import { Garage } from '../realestate/Garage';
import { Deeds } from '../realestate/Deeds';
import { ServerLink } from '../realestate/ServerLink';
import { OwnedVehicles } from '../realestate/OwnedVehicles';
import { PlotWorld } from '../realestate/PlotWorld';
import { AssetMarket } from '../realestate/AssetMarket';
import { Registry } from '../realestate/Registry';
import { zonesFor, grow, intersection, obstructionsUnder, type Rect, type Obstruction } from '../world/plan/CityPlan';
import { LAGOS_DISTRICTS } from '../world/data/LagosMapData';
import { ABUJA_DISTRICTS } from '../world/data/AbujaMapData';
import { PH_DISTRICTS } from '../world/data/PortHarcourtMapData';
import { CITY_NAME, type PlotCity } from '../realestate/PlotCatalogue';
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
  /** What the phone's apps work with: rides, deliveries, messages and the market. They run whether or not the phone is open. */
  public rides = new RideService();
  public deliveries = new DeliveryService();
  public messages = new MessageService();
  public market = new Market();
  /** The menu that opens on a click on the player's own character */
  public selfMenu!: SelfMenu;
  /** Land, what is built on it, and buying and selling between players */
  public land = Land.get();
  public assetMarket = AssetMarket.get();
  public registry = Registry.get();
  public plotWorld!: PlotWorld;
  public buildBar!: BuildBar;
  public garage = Garage.get();
  public deeds = Deeds.get();
  public ownedVehicles!: OwnedVehicles;
  private lastLandHour: number | null = null;
  /** Scripted interactions, exposed for the browser tests and for debugging in the console */
  public interactions = InteractionDirector.get();
  /** Game data the browser tests read, reachable the same way from a dev server and from a built game */
  public readonly modules = { WorldDataManager, HouseDecorationSystem, CATALOGUE_ITEMS, SoundEngine, DestinationRegistry, zonesFor, ServerLink };
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

    // 10b. The phone: its apps act on this game through the hooks below
    this.connectPhone();
    this.connectSelfMenu();
    this.connectLand();

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

  /** Where the player is, as far as a driver, a rider or an ambulance is concerned. */
  private whereabouts(): 'street' | 'inside' | 'driving' | 'transit' {
    if (this.flightExperience.isActive || this.roadRideExperience.isActive) return 'transit';
    if (this.player.isDriving) return 'driving';
    if (this.world.interiorManager.isPlayerInside()) return 'inside';
    return 'street';
  }

  private connectPhone(): void {
    const sky = this.world.skyEnvironment;
    const cityNames: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };
    const cityId = () => this.world.cityManager.currentCityId;
    const placeName = () => this.world.getDistrictAtPosition(this.player.position).name;

    const world: PhoneWorld = {
      clock: () => {
        const label = sky.getFormattedTimeString();
        const [date, time] = label.split(' • ');
        return { day: sky.day, hour: sky.currentHour, label, date, time: time ?? label };
      },
      weather: () => (this.world.weather.currentWeather === 'rainy' ? 'rainy' : 'sunny'),
      cityId,
      cityName: () => cityNames[cityId()] ?? cityId(),
      where: () => this.whereabouts(),
      placeName,
      goHome: () => document.getElementById('nav-btn-home')?.click(),
      openMap: () => document.getElementById('nav-btn-map')?.click(),
      openFlights: () => this.hud.interstateModal.open(cityId()),
      openCamera: () => this.photoMode.open(),
      openWardrobe: () => this.hud.openWardrobe(),
      openQuests: () => this.hud.questModal.open(),
      openBag: () => this.hud.openInventory(),
      ambulance: () => this.callAmbulance(),
      distanceTo: (x, z) => Math.hypot(this.player.position.x - x, this.player.position.z - z),
      showPlace: (x, z, name) => {
        this.hud.phoneModal.close();
        this.world.highlightStreetProperty({ x, y: 0, z }, name);
      },
      placeBuilding: (plotId, typeId) => this.buildBar.open(plotId, typeId),
      bringVehicle: (vehicleId) => {
        if (this.whereabouts() !== 'street') return 'It can be brought to you when you are standing on the street.';
        if (this.world.cityManager.currentCityId !== 'lagos') return 'Your vehicles are in Lagos.';
        const blocked = this.ownedVehicles.bringRound(vehicleId);
        this.ownedVehicles.sync();
        if (!blocked) showGameToast('Your vehicle is at the kerb.', 'success', 3200);
        return blocked;
      },
    };

    this.rides.connect({
      where: () => this.whereabouts(),
      cityId,
      startJourney: (destination, vehicle, arrived) => {
        const ride: RideDetails = {
          vehicleName: vehicle.label,
          vehicleType: vehicle.mode,
          originName: placeName(),
          destinationName: destination.name,
          durationSeconds: 9,
          trafficCondition: 'Go-slow',
          weatherCondition: 'Sunny',
          destinationCityId: cityId(),
        };
        this.onJourneyCompleted = arrived;
        this.hud.phoneModal.close();
        this.world.setStreetModeVisibility(false);
        this.player.mesh.visible = false;
        this.roadRideExperience.startRide(ride);
        this.transitHUD.showRideHUD(ride);
      },
      arriveAt: (destination) => {
        this.player.stopMoving();
        this.player.mesh.position.set(destination.streetPosition.x, 0, destination.streetPosition.z);
        this.cameraManager.snapToPlayer(this.player, 'street');
        showGameToast(`You have arrived at ${destination.name}.`, 'success', 3600);
      },
    });
    this.deliveries.connect(() => this.whereabouts() === 'transit');
    this.messages.connect(() => sky.getFormattedTimeString());
    this.market.connect(() => sky.day * 24 + sky.currentHour);

    this.hud.phoneModal.connect({ world, rides: this.rides, deliveries: this.deliveries, messages: this.messages, market: this.market });
  }

  /** Land plots, what stands on them, and the market they are traded in. */
  private connectLand(): void {
    const districts: Record<string, typeof LAGOS_DISTRICTS> = { lagos: LAGOS_DISTRICTS, abuja: ABUJA_DISTRICTS, port_harcourt: PH_DISTRICTS };
    const zones = new Map<string, ReturnType<typeof zonesFor>>();
    const near = new Map<string, Rect[]>();
    this.land.connect({
      districtAt: (city, x, z) => {
        const list = districts[city] ?? LAGOS_DISTRICTS;
        const inside = list.find((d) => x >= d.bounds.minX && x <= d.bounds.maxX && z >= d.bounds.minZ && z <= d.bounds.maxZ);
        const district = inside ?? [...list].sort((a, b) => Math.hypot(a.center.x - x, a.center.z - z) - Math.hypot(b.center.x - x, b.center.z - z))[0];
        return { id: district.id, name: district.name };
      },
      zones: (city) => {
        if (!zones.has(city)) zones.set(city, zonesFor(city));
        return zones.get(city)!;
      },
      // What already stands beside a plot does not change, so it is worked out once for each plot
      buildingsNear: (city, rect) => {
        const key = `${city}:${rect.minX},${rect.minZ}`;
        let found = near.get(key);
        if (!found) {
          const around = grow(rect, 4);
          found = this.standingIn(city).filter((thing) => thing.structure && intersection(around, thing) && !intersection(rect, thing));
          near.set(key, found);
        }
        return found;
      },
    });

    this.plotWorld = new PlotWorld();
    this.scene.add(this.plotWorld.group);
    // Lagos plots come and go with the rest of Lagos; the other cities' plots are shown when the player is there
    const lagos = this.plotWorld.of('lagos');
    if (lagos.group) this.world.cityManager.addToLagos(lagos.group, lagos.cards);
    this.world.cityManager.onCityChanged = (city) => {
      this.plotWorld.showCity(city);
      for (const card of this.plotWorld.of(city as PlotCity).cards) {
        if (!this.world.interactiveObjects.includes(card)) this.world.interactiveObjects.push(card);
      }
      this.buildBar?.close();
    };
    this.plotWorld.showCity(this.world.cityManager.currentCityId);
    this.world.builtByPlayers.push(() => this.plotWorld.obstructions('lagos'));
    BackendService.getInstance().addHomeCheck(() => this.land.hasHome());

    this.buildBar = new BuildBar(this.plotWorld);
    // While a building is being placed, a click on the plot moves it there instead of walking there
    this.input.onGroundClick = (point) => this.buildBar.moveTo(point.x, point.z);
    this.hud.onPlotAction = (plotId) => this.hud.phoneModal.openApp('land', `plot:${plotId}`);

    // The player's own vehicles are in the city only while the registry says they are theirs
    this.ownedVehicles = new OwnedVehicles(this.world, {
      driving: () => (this.player.isDriving ? this.player.currentVehicle : null),
      getOut: () => {
        this.exitVehicle();
        showGameToast('This vehicle is no longer yours.', 'warning', 3600);
      },
      playerPosition: () => this.player.position,
    });
    void this.assetMarket.introduce(this.player.config.name);
  }

  /** What stands on the ground in a city: the full survey for Lagos, the landmarks for the others. */
  public standingIn(city: string): Obstruction[] {
    if (city === 'lagos') return this.world.standingOnTheGround();
    const instance = city === 'abuja' ? this.world.cityManager.abujaCity : this.world.cityManager.portHarcourtCity;
    const out = instance ? obstructionsUnder(instance.group, CITY_NAME[city as PlotCity] ?? city) : [];
    out.push(...this.plotWorld.obstructions(city as PlotCity));
    return out;
  }

  /** Clicking your own character opens a menu of who you are and what you can do where you stand. */
  private connectSelfMenu(): void {
    const actor = this.player.actor;
    const interiors = this.world.interiorManager;
    const director = InteractionDirector.get();
    const nearbyVehicle = () => (this.whereabouts() === 'street' ? this.world.vehicles.getNearestDrivableVehicle(this.player.position, 6.0) : null);

    this.selfMenu = new SelfMenu({
      name: () => this.player.config.name,
      where: () => this.whereabouts(),
      locked: () => interiors.busy || (actor.sequence !== null && !actor.sequence.interruptible),
      interior: () => interiors.currentInterior?.type ?? null,
      vehicleNearby: () => nearbyVehicle()?.name ?? null,
      seated: () => actor.hold !== null,
      standUp: () => actor.hold?.release(),
      openWardrobe: () => this.hud.openWardrobe(),
      openBag: () => this.hud.openInventory(),
      openPhone: (app) => (app ? this.hud.phoneModal.openApp(app) : this.hud.phoneModal.open()),
      openQuests: () => this.hud.questModal.open(),
      emote: (kind) => {
        if (kind === 'wave' || kind === 'greet') {
          // To nobody in particular: the same gesture a wave at someone uses, without the someone
          director.perform({ id: kind, actor, animation: { arms: kind }, seconds: kind === 'wave' ? 1.9 : 1.5 });
          return;
        }
        if (director.interrupt(actor) === 'locked') return;
        this.player.stopMoving();
        this.player.playEmote(kind, kind === 'salute' ? 3.0 : 4.0);
        this.network.syncEmote(kind);
      },
      getIntoVehicle: () => {
        const vehicle = nearbyVehicle();
        if (vehicle) this.walkToVehicleAndGetIn(vehicle);
      },
      sleep: () => interiors.residence.life.sleep(),
      sitOnSofa: () => interiors.residence.life.watchTv(),
      sitAtTable: () => this.bukaUI.open(),
    });
    this.input.onSelfClicked = (screen) => {
      if (UIStateManager.getInstance().isAnyModalOpen() || this.hud.currentNavMode === 'map') return;
      this.hud.hideInteractionCard();
      this.selfMenu.open(screen);
    };
  }

  /** An ambulance takes the player to the hospital and they are treated on arrival. The bill goes on credit if it cannot be paid. */
  private callAmbulance(): boolean {
    const where = this.whereabouts();
    if (where === 'transit' || where === 'driving' || this.world.interiorManager.busy) return false;
    if (this.world.cityManager.currentCityId !== 'lagos') return false;
    const backend = BackendService.getInstance();
    backend.processTransaction({ type: 'MEDICAL_BILL', amount: 3500, description: 'Ambulance and emergency treatment' });
    backend.treatEmergency();
    this.world.worldMap.deactivate();
    void this.world.interiorManager.enterInterior('hospital', this.player, this.cameraManager, this.hud, this.world);
    showGameToast('The ambulance brought you to St. Nicholas. You have been treated: ₦3,500.', 'success', 5200);
    return true;
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
      requires: () => (vehicle.driver ? 'Someone is already driving that.' : this.ownedVehicles?.cannotDrive(vehicle) ?? null),
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
      this.ownedVehicles?.leftVehicle(this.player.currentVehicle);
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

    // Drivers on the way, riders with orders, replies to messages
    this.rides.update(delta);

    // Building work goes on by the world's clock whoever is playing: once a second, show how far it has got,
    // pay any rent that is nearly due and clear any tenancy that has run out
    const landSecond = Math.floor(performance.now() / 1000);
    if (landSecond !== this.lastLandHour) {
      this.lastLandHour = landSecond;
      this.plotWorld.refresh();
      void this.land.keepUp();
    }
    this.ownedVehicles.update();
    this.deliveries.update(delta);
    this.messages.update(delta);

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
