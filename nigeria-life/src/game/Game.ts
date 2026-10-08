import * as THREE from 'three';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { GameCamera } from './Camera';
import { InputManager } from './Input';
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

  // In-Transit Simulations (In-Flight Airliner & First-Person Road Ride)
  public flightExperience: FlightExperience;
  public roadRideExperience: RoadRideExperience;
  public transitHUD: TransitHUD;

  private clock: THREE.Clock;
  private savedStreetFog: THREE.Fog | THREE.FogExp2 | null = null;
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFPS: number = 60;

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
      if (v) this.enterVehicle(v);
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
          this.enterVehicle(v);
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
      this.world.cityManager.switchCity(
        destId,
        this.player,
        (newObjs) => {
          this.world.interactiveObjects = newObjs;
        }
      );
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

      this.world.cityManager.switchCity(
        ride.destinationCityId,
        this.player,
        (newObjs) => {
          this.world.interactiveObjects = newObjs;
        }
      );
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

      // Temporarily hide street mode while in-flight
      this.world.setStreetModeVisibility(false);
      this.player.mesh.visible = false;

      this.flightExperience.startFlight(flightDetails);
      this.transitHUD.showFlightHUD(flightDetails);

      // Listen for eventual ride completion to signal modal
      const prevRideComplete = this.roadRideExperience.onRideCompleted;
      this.roadRideExperience.onRideCompleted = (ride) => {
        prevRideComplete?.(ride);
        onCompleted(route.destinationId);
      };
    };

    // 9c. Camera Navigation Modes (Home Flat | Street Walk | Aerial World Map)
    this.hud.onNavigateMode = (mode: 'street' | 'home' | 'map') => {
      if (mode === 'home') {
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
    this.hud.onEnterInterior = (buildingId: string) => {
      this.world.interiorManager.enterInterior(buildingId, this.player, this.cameraManager, this.hud, this.world);
    };

    this.hud.onExitInterior = () => {
      this.world.interiorManager.exitCurrentInterior(this.player, this.cameraManager, this.hud, this.world);
    };

    // 10. Multiplayer & Street Chat
    this.network = new NetworkManager(this.scene, this.player);
    this.chatBox = new ChatBox(this.network);
    this.network.setOnPlayerCount((count) => this.hud.updateOnlineCount(count));

    // 11. Clock for delta-timed updates
    this.clock = new THREE.Clock();

    // 12. Window Resizing
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 13. Start Loop
    this.loop();
  }

  private enterVehicle(vehicle: any): void {
    vehicle.enter(this.player);
    this.player.isDriving = true;
    this.player.currentVehicle = vehicle;
    this.hud.showDrivingHUD(vehicle.name);
    UIStateManager.getInstance().setMode('driving');
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

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update Player Movement & Walking Cycle (frozen in Photo Mode so player can pose)
    if (this.cameraManager.mode === 'photo') {
      this.player.update(delta, {});
    } else {
      this.player.update(delta, this.input.keys);
    }

    // Update Camera Follow
    this.cameraManager.update(this.player, delta);

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

    // Update Multiplayer networking & remote players
    this.network.update(delta);

    // Update Input cursor animations
    this.input.update(delta);

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
  };
}
