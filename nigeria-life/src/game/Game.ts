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
import { createHumanForConfig } from '../player/HumanFromConfig';
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
import { DeliveryService } from '../phone/services/DeliveryService';
import { MessageService } from '../phone/services/MessageService';
import { Market } from '../phone/services/Market';
import type { PhoneWorld } from '../phone/PhoneApp';
import { SelfMenu } from '../ui/SelfMenu';
import { Land } from '../realestate/Land';
import { BuildBar } from '../ui/BuildBar';
import { Garage } from '../realestate/Garage';
import { Deeds } from '../realestate/Deeds';
import { carryToServer, type Carried } from '../realestate/Carry';
import { VehicleSync } from '../multiplayer/VehicleSync';
import { ServerLink } from '../realestate/ServerLink';
import { OwnedVehicles } from '../realestate/OwnedVehicles';
import { PlotWorld } from '../realestate/PlotWorld';
import { AssetMarket } from '../realestate/AssetMarket';
import { Registry } from '../realestate/Registry';
import { zonesFor, grow, intersection, obstructionsUnder, validatePlan, type Rect, type Obstruction, type Violation } from '../world/plan/CityPlan';
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
import { FlightService, AIRLINE, AIRPORTS, type Booking, type FlightCity, type FlightStatus } from '../travel/Flights';
import { CoachService, MOTOR_PARKS, OPERATOR, type CoachCity, type CoachTicket } from '../travel/Coaches';
import { openAirportHall } from '../travel/AirportHall';
import { FurnishBar } from '../ui/FurnishBar';
import { Bodies, bodyOf, type CarBody } from '../world/Bodies';
import { MusicSheet } from '../ui/MusicSheet';
import { FleetSheet } from '../ui/FleetSheet';
import { PumpSheet } from '../ui/PumpSheet';
import { ProfileSheet } from '../ui/ProfileSheet';
import { StateHouseSheet } from '../ui/StateHouseSheet';
import { PlaceOpeners } from '../interiors/places/PlaceInterior';
import { Companies } from '../business/Companies';
import { EventClock, startedBetween } from '../interiors/places/LiveEvents';
import { PLACE_SPECS } from '../interiors/places/PlaceSpecs';
import { CompanyStaff } from '../business/CompanyStaff';
import { Convoys, ESCORTS, type EscortLevel } from '../world/convoy/Convoys';
import type { PlaceHost } from '../destinations/PlaceActions';
import { Supermarket, SUPERMARKET } from '../business/Supermarket';
import { vehicleModel } from '../realestate/Garage';
import { Politics, Policies } from '../politics/Politics';
import { hawkerPrices } from '../world/StreetVendors';
import { petrolPolicy } from '../world/Fuel';
import { RideService } from '../phone/services/RideService';
import { myProfile } from '../social/Profile';
import { BAE_AT, ROLES, Ties } from '../social/Ties';
import type { RemotePlayer } from '../multiplayer/RemotePlayer';
import { FORECOURT, STATIONS, jerryCanShare, nearestStation, stationNear, type Station } from '../world/Fuel';
import { TopMenu } from '../ui/TopMenu';
import { Fleet, fleetColour, fleetModel } from '../assets/Fleet';
import { buildJet, buildYacht } from '../world/expressway/FleetModels';
import { AIRFIELD, MARINA } from '../world/expressway/Roadside';
import { FurnitureThumbs } from '../ui/FurnitureThumbs';
import { DriveControls } from '../ui/DriveControls';
import { StreetAmbience } from '../audio/StreetAmbience';
import { CROSS_STREET_Z, MAIN_CORRIDOR_HALF, MAIN_ROAD } from '../world/density/StreetLayout';
import { EXPRESS } from '../world/expressway/layout';
import { isRushHour } from '../world/StreetLife';
import { ResidentialInterior } from '../interiors/templates/ResidentialInterior';
import { standardOf } from '../housing/HomeStandard';
import { Television } from '../housing/Television';
import { Employment } from '../jobs/Employment';
import { Solids } from '../world/plan/Solids';
import { LagosStreetLifeSystem } from '../world/LagosStreetLifeSystem';
import { GraphicsQuality } from '../graphics/GraphicsQuality';
import { OnlineAccount } from '../online/OnlineAccount';
import { Wayfinder, type Way } from '../world/plan/Wayfinder';
import { DrivableVehicle } from '../world/DrivableVehicle';
import { buildingType } from '../realestate/BuildingCatalogue';
import { CharacterQualityTestScene } from '../world/CharacterQualityTestScene';

/** How often the player's position, the time of day and their vitals are written to the save */
const AUTOSAVE_SECONDS = 5;

/** Broad Street's carriageway, away from the crossings at the Martins Street junction: not to be walked onto */
const NO_CROSSING = [
  { minX: -MAIN_ROAD.halfRoad + 0.2, maxX: MAIN_ROAD.halfRoad - 0.2, minZ: MAIN_ROAD.zMin, maxZ: CROSS_STREET_Z - 9 },
  { minX: -MAIN_ROAD.halfRoad + 0.2, maxX: MAIN_ROAD.halfRoad - 0.2, minZ: CROSS_STREET_Z + 9, maxZ: MAIN_ROAD.zMax },
  // and the whole expressway beyond it
  { minX: -EXPRESS.half + 0.2, maxX: EXPRESS.half - 0.2, minZ: MAIN_ROAD.zMax, maxZ: EXPRESS.to },
];

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
  /** Vehicles other players are driving, kept moving in this game */
  public vehicleSync!: VehicleSync;
  /** What came with the player from this browser's own registry when they joined a world server, once that is known */
  public carried: Carried | null | undefined = undefined;
  private lastLandHour: number | null = null;
  /** Scripted interactions, exposed for the browser tests and for debugging in the console */
  public interactions = InteractionDirector.get();
  /** Game data the browser tests read, reachable the same way from a dev server and from a built game */
  public readonly modules = { WorldDataManager, HouseDecorationSystem, CATALOGUE_ITEMS, SoundEngine, DestinationRegistry, zonesFor, ServerLink, OnlineAccount, THREE };
  private lastStepDelta: number = 0;
  /** How much is drawn on this device (Phone › Life › Settings) */
  public graphics!: GraphicsQuality;
  public placeCard: PlaceCard;

  // In-Transit Simulations (In-Flight Airliner & First-Person Road Ride)
  public flightExperience: FlightExperience;
  /** Where the player is employed, and how much work they have done there */
  public jobs = Employment.get();
  public furnishBar!: FurnishBar;
  /** Tickets and where each has got to */
  public flights = FlightService.get();
  public coaches = CoachService.get();
  /** The coach the player has just boarded is pulling out of its park: they go where it goes */
  private coachPullingOut: THREE.Object3D | null = null;
  private viewBeforeCoach: { pitch: number; distance: number } | null = null;
  public roadRideExperience: RoadRideExperience;
  public transitHUD: TransitHUD;
  public qualityShowcase: CharacterQualityTestScene;

  private clock: THREE.Clock;
  private savedStreetFog: THREE.Fog | THREE.FogExp2 | null = null;
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFPS: number = 60;
  /** Frames drawn since the game started, counted by the wall clock (the device report's frame rate) */
  private framesDrawn = 0;
  private lastAutosaveAt: number = performance.now();
  private onJourneyCompleted: (() => void) | null = null;

  constructor() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera Manager
    this.cameraManager = new GameCamera();
    // The camera starts behind the player, looking the way they face
    this.cameraManager.yaw = -Math.PI / 2 + Math.PI;

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

    this.input.onBuyFromWindow = (item) => {
      const streetLife = LagosStreetLifeSystem.getInstance();
      if (this.player.isDriving && streetLife.isHawkerAtWindow) streetLife.buyFromWindowHawker(item);
    };

    // The pump: at a filling station, the player's vehicles and their tanks; far from one, with the tank dry, a jerry can
    const pumpSheet = new PumpSheet({
      rows: () => {
        const at = this.pumpAt;
        const driving = this.player.isDriving ? this.player.currentVehicle : null;
        const mine = this.ownedVehicles?.mine() ?? [];
        const rows = mine.map(({ vehicle }) => vehicle);
        if (driving && !rows.includes(driving)) rows.unshift(driving);
        return rows.map((v) => ({
          id: v.id,
          name: v.name.split(' · ')[0],
          type: v.type,
          fuel: v.fuel,
          here: !!at && v.city === at.city && Math.hypot(v.mesh.position.x - at.x, v.mesh.position.z - at.z) < FORECOURT + 8,
        }));
      },
      fill: (id, cost) => {
        const v = this.world.vehicles.drivableVehicles.find((x) => x.id === id) ?? (this.player.currentVehicle?.id === id ? this.player.currentVehicle : null);
        if (!v) return 'That vehicle is not here.';
        if (!BackendService.getInstance().pay(cost, `Fuel, ${v.name.split(' · ')[0]}`, 'TRAVEL_COST')) return `Filling up comes to ₦${cost.toLocaleString()}. You do not have it.`;
        v.fuel = 100;
        v.isLowFuelWarned = false;
        this.ownedVehicles?.fuelled(v);
        SoundEngine.getInstance().playTransactionSuccess();
        return null;
      },
      jerryCan: (cost) => {
        const v = this.player.currentVehicle;
        if (!v) return 'Get into the vehicle first.';
        if (!BackendService.getInstance().pay(cost, 'Jerry can of petrol, brought out', 'TRAVEL_COST')) return `The jerry can comes to ₦${cost.toLocaleString()}. You do not have it.`;
        v.fuel = Math.min(100, v.fuel + jerryCanShare(v.type));
        v.isLowFuelWarned = false;
        this.ownedVehicles?.fuelled(v);
        return null;
      },
    });
    this.pumpSheet = pumpSheet;
    const openPump = (stationId?: string) => {
      const city = this.world.cityManager.currentCityId;
      const here = this.player.isDriving && this.player.currentVehicle ? this.player.currentVehicle.mesh.position : this.player.position;
      const station = stationId ? STATIONS.find((s) => s.id === stationId) ?? null : stationNear(here.x, here.z, city);
      if (station) {
        this.pumpAt = station;
        pumpSheet.open(station.name);
        return;
      }
      this.pumpAt = null;
      const v = this.player.isDriving ? this.player.currentVehicle : null;
      if (v && v.fuel < 8) {
        pumpSheet.openJerryCan();
        return;
      }
      const near = nearestStation(here.x, here.z, city);
      showGameToast(near ? `⛽ No pump here. The nearest filling station is ${near.station.name}, ${Math.round(near.metres).toLocaleString()} m away.` : '⛽ There is no filling station near. When the tank is nearly empty, a jerry can can be brought to you.', 'info', 4800);
    };
    this.hud.onOpenPump = openPump;
    const refuelActiveVehicle = () => openPump();

    this.hud.onRefuelVehicle = refuelActiveVehicle;
    this.input.onRefuelVehicle = refuelActiveVehicle;

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
    // The flight is its own world, drawn instead of the city: the player sits in it as themselves
    this.flightExperience.passengerLook = () => createHumanForConfig(this.player.config);
    this.flightExperience.hour = () => this.world.skyEnvironment.currentHour;

    this.roadRideExperience = new RoadRideExperience();
    this.scene.add(this.roadRideExperience.group);
    // The player rides as themselves: their own figure sits in the back, or behind the okada man
    this.roadRideExperience.passengerLook = () => createHumanForConfig(this.player.config);

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

    this.flightExperience.onAnnouncement = (announcement) => {
      this.transitHUD.setAnnouncement(announcement);
    };
    this.flightExperience.onLive = (status, fraction) => this.transitHUD.setFlightLive(status, fraction);
    this.flightExperience.onServed = () => {
      const be = BackendService.getInstance();
      be.modifyNeed('hunger', 25);
      be.modifyNeed('fun', 5);
      showGameToast('🥤 The trolley reaches your row: a cold zobo and a hot meat pie on your tray. Hunger +25', 'success', 4200);
    };

    this.flightExperience.onFlightCompleted = (flight) => {
      this.transitHUD.hideFlightHUD();
      if (this.flights.status().state === 'boarded') {
        this.disembark(flight.destinationId);
        return;
      }

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
      // A coach pulls in at the motor park of the city it was going to
      if (this.coaches.status().state === 'boarded') this.stepDownAtPark(ride.destinationCityId);

      const journeyCompleted = this.onJourneyCompleted;
      this.onJourneyCompleted = null;
      journeyCompleted?.();
    };

    // Wire InterState Modal to trigger the 3D Flight Experience
    this.hud.interstateModal.onStartTravelSimulation = (route, _fare, onCompleted) => {
      if (route.mode !== 'flight') {
        // A coach goes by road, all the way
        this.onJourneyCompleted = () => onCompleted(route.destinationId);
        this.saveArrivalInTransit(route.destinationId);
        this.world.setStreetModeVisibility(false);
        this.player.mesh.visible = false;
        const ride: RideDetails = {
          vehicleName: route.airlineOrOperator,
          vehicleType: 'suv',
          originName: route.departureStation,
          destinationName: route.arrivalStation,
          durationSeconds: 18,
          trafficCondition: 'Clear',
          weatherCondition: 'Sunny',
          destinationCityId: route.destinationId,
        };
        this.roadRideExperience.startRide(ride);
        this.transitHUD.showRideHUD(ride);
        return;
      }
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
        // Already at home: the Home button opens the catalogue
        if (this.world.interiorManager.currentInterior?.type === 'residence') {
          UIStateManager.getInstance().setMode('interior');
          HouseDecorationSystem.getInstance().openCatalogueModal();
          return;
        }
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
    // A place pressed on the bar of nearby places is walked to, not jumped to
    this.hud.onWalkToPlace = (place) => this.input.approachAndInteract(place);
    // Going somewhere on foot from the map is a walk by the streets, not a jump
    this.hud.onWalkTo = (point, then) => this.player.setDestination(new THREE.Vector3(point.x, 0, point.z), then);
    this.hud.wayTo = (x, z) => this.wayTo(x, z);

    // 9e. 3-Tier Interior Destination System (Hospital, Bank, Buka, Police, Residence)
    // The player walks in and out through the door wherever the place has one
    this.hud.onEnterInterior = (buildingId: string, comeOutAt?: THREE.Vector3) => {
      const target = this.world.interiorManager.getInteriorByBuildingId(buildingId);
      if (target?.type === 'residence' && !this.canGoHome()) return;
      // In through the gate of the compound: the flat, not a house built elsewhere
      if (target?.type === 'residence' && (buildingId === 'villa-compound' || buildingId === 'palm-view-flats')) this.homeNow = 'main';
      if (comeOutAt) {
        // In by one way and out by another: from the apron into the terminal, and out at the kerb
        void this.world.interiorManager.enterInterior(buildingId, this.player, this.cameraManager, this.hud, this.world, { returnTo: comeOutAt, returnYaw: 0 });
        return;
      }
      this.world.interiorManager.enterThroughDoor(buildingId, this.player, this.cameraManager, this.hud, this.world);
    };
    this.hud.onLeaveInteriorTo = (comeOutAt, facing) => {
      void this.world.interiorManager.exitCurrentInterior(this.player, this.cameraManager, this.hud, this.world, { emergeAt: comeOutAt, emergeYaw: facing ?? 0 });
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
      // At home: furnish it from the catalogue
      extras: (def) => (def.type === 'residence' ? [{ id: 'decorate', icon: '🛋️', label: 'Decorate', run: () => HouseDecorationSystem.getInstance().openCatalogueModal() }] : []),
    });

    // The music player, opened by its round button or the sound button
    const music = new MusicSheet();
    this.hud.onOpenMusic = () => music.open();

    // Driving with fingers: steering, pedals, horn and Get out, on touch screens
    const drive = new DriveControls({
      keys: this.input.keys,
      speed: () => this.player.currentVehicle?.currentSpeed ?? 0,
      fuel: () => this.player.currentVehicle?.fuel ?? 0,
      name: () => this.player.currentVehicle?.name ?? '',
      honk: () => this.hud.onHonkVehicle?.(),
      getOut: () => this.hud.onExitVehicle?.(),
      refuel: () => this.hud.onRefuelVehicle?.(),
      music: () => SoundEngine.getInstance().toggleRadio(),
      musicOn: () => SoundEngine.getInstance().isRadioActive(),
    });
    UIStateManager.getInstance().onModeChange((mode) => drive.show(mode === 'driving'));

    // 10. Multiplayer & Street Chat. On a game server the player has an account there first: the
    // server holds their money from now on, and the city's players are reached through it
    const backend = BackendService.getInstance();
    const start = backend.getData();
    const online = OnlineAccount.start({ name: start.username, save: { cash: start.walletCash, bank: start.bank.balance } });
    if (online) {
      backend.authority = { report: (cash, bank, memo) => online.report(cash, bank, memo) };
      online.on('wallet', (wallet) => backend.applyServerWallet(wallet));
      online.on('notice', (text) => showGameToast(String(text), 'warning', 5200));
      ServerLink.authorization = () => online.authorization;
      // Every 20 s, how the game is running on this device (frame rate, screen, quality, whether
      // the player could move), so the game team can see what a real phone does. Nothing personal.
      let lastAt = this.player.position.clone();
      let walked = 0;
      let lastTouches = 0;
      let lastFrames = 0;
      let lastReport = performance.now();
      setInterval(() => {
        const here = this.player.position;
        walked += Math.hypot(here.x - lastAt.x, here.z - lastAt.z);
        lastAt = here.clone();
      }, 1000);
      setInterval(() => {
        // Not before the player is signed in (a slow phone can take a while)
        if (!online.authorization || !online.connected) return;
        const joystick = this.input.virtualJoystick;
        const info = this.renderer.info.render;
        const now = performance.now();
        const fps = (this.framesDrawn - lastFrames) / ((now - lastReport) / 1000);
        lastFrames = this.framesDrawn;
        lastReport = now;
        void online.request('/me/device', {
          fps: Math.round(fps * 10) / 10,
          quality: this.graphics?.level,
          pixelRatio: this.renderer.getPixelRatio(),
          deviceRatio: window.devicePixelRatio,
          screen: `${window.innerWidth}x${window.innerHeight}`,
          touch: joystick.isVisible,
          triangles: info.triangles,
          drawCalls: info.calls,
          mode: document.body.dataset.uiMode ?? '',
          walked: Math.round(walked),
          joystickTouches: joystick.touches - lastTouches,
          agent: navigator.userAgent.slice(0, 160),
        });
        walked = 0;
        lastTouches = joystick.touches;
      }, 20_000);
      Registry.onRefused = () => online.resync();
      online.on('signed-in', (event) => showGameToast(event.upgraded ? 'Your progress is kept on your email address now.' : `Signed in as ${event.account.name}.`, 'success'));
    }
    NetworkManager.city = () => this.world.cityManager.currentCityId;
    this.network = new NetworkManager(this.scene, this.player);
    this.chatBox = new ChatBox(this.network);
    this.network.setOnPlayerCount((count) => this.hud.updateOnlineCount(count));
    this.connectProfiles();
    this.connectGovernment();
    // A cab from the map to a place along the road: paid when the driver comes, ridden, and set down at the door
    this.hud.onRideTo = (point, name, fare) => {
      if (!BackendService.getInstance().pay(fare, `Cab to ${name}`, 'TRAVEL_COST')) {
        showGameToast(`The cab is ₦${fare.toLocaleString()}. You do not have it.`, 'warning', 3600);
        return;
      }
      const ride: RideDetails = { vehicleName: 'Lagos taxi', vehicleType: 'taxi', originName: 'Here', destinationName: name, durationSeconds: 10, trafficCondition: 'Go-slow', weatherCondition: 'Sunny', destinationCityId: 'lagos' };
      this.onJourneyCompleted = () => {
        this.player.stopMoving();
        this.player.mesh.position.set(point.x, 0, point.z);
        this.player.position.copy(this.player.mesh.position);
        this.cameraManager.snapToPlayer(this.player, 'street');
      };
      this.world.setStreetModeVisibility(false);
      this.player.mesh.visible = false;
      this.roadRideExperience.startRide(ride);
      this.transitHUD.showRideHUD(ride);
    };
    PlaceOpeners.open = (what, host) => {
      if (what.startsWith('app:')) {
        // "app:business" or, to a screen inside it, "app:business:b:biz_mama_put"
        const [app, ...route] = what.slice(4).split(':');
        this.hud.phoneModal.openApp(app, route.length ? route.join(':') : undefined);
      }
      else if (what === 'vote') this.stateHouse.open('polling');
      else if (what === 'house') this.stateHouse.open('house');
      else if (what === 'interstate') this.hud.interstateModal.open(this.world.cityManager.currentCityId);
      else if (what === 'bus-island') this.hud.onRideTo?.(new THREE.Vector3(9, 0, 40), 'Lagos Island (Broad Street)', Math.round(750 * RideService.fareFactor()));
      else if (what === 'repair') this.offerRepairs();
      else if (what === 'airside') {
        // From the hall on the road through to the airport: the terminal, out at its kerb when done
        const kerb = this.world.airportOf('lagos')?.kerb;
        const go = () => this.world.interiorManager.enterInterior('mma-airport', this.player, this.cameraManager, this.hud, this.world, kerb ? { returnTo: kerb.clone(), returnYaw: 0 } : undefined);
        const rooms = this.world.interiorManager;
        if (rooms.isPlayerInside()) void rooms.exitCurrentInterior(this.player, this.cameraManager, this.hud, this.world).then(() => void go());
        else void go();
      }
      else if (what === 'yachts' && host) this.world.expressway.roadside.yachtDesk(host);
      else if (what === 'escort:escort' || what === 'escort:convoy') this.hireEscort(what.slice(7) as EscortLevel, host);
      else if (what === 'jets' && host) this.world.expressway.roadside.jetDesk(host);
      else if (what.startsWith('ride:')) {
        // A cab to a place along the road (from the jobs list, say): out of any room first
        const place = this.world.expressway.roadside.interactive.find((o) => o.id === what.slice(5));
        if (!place) return;
        const ride = () => this.hud.onRideTo?.(place.interactionPoint.clone(), place.name, Math.round(4500 * RideService.fareFactor()));
        const rooms = this.world.interiorManager;
        if (rooms.isPlayerInside()) void rooms.exitCurrentInterior(this.player, this.cameraManager, this.hud, this.world).then(ride);
        else ride();
      }
    };

    // 10b. The phone: its apps act on this game through the hooks below
    this.connectPhone();
    this.connectSelfMenu();
    this.connectLand();

    // 10c. Day & Saturday Rent Tick
    this.world.skyEnvironment.onNewDay = (day: number) => {
      BackendService.getInstance().processDailyRentTick(day);
      // The close of yesterday, for every business: takings, wages, rent and tax
      this.companies.closeDay(day - 1);
    };
    this.connectCompanies();
    this.connectEvents();
    this.connectConvoys();

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

    // 12c. Character & Vehicle Quality Studio Showcase (Milestone A Acceptance Gate)
    this.qualityShowcase = new CharacterQualityTestScene();
    // Attached dynamically to scene only when opened to protect street rendering performance

    this.hud.onToggleShowcase = () => this.qualityShowcase.toggle(this);
    this.input.onToggleShowcase = () => this.qualityShowcase.toggle(this);

    if (typeof window !== 'undefined' && (window.location.search.includes('showcase') || window.location.hash.includes('showcase'))) {
      setTimeout(() => {
        this.qualityShowcase.open(this);
      }, 350);
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
      goHome: (plotId) => {
        // A built house is a home of its own: that is the one gone into
        if (plotId && this.land.livesIn(plotId)) this.homeNow = plotId;
        document.getElementById('nav-btn-home')?.click();
      },
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
    this.jobs.today = () => sky.day;
    const club = this.world.interiorManager.club.service;
    club.connect(() => sky.day * 24 + sky.currentHour);
    club.onClosingTime = () => {
      showGameToast('Closing time. The lights are up and everyone is going home.', 'info', 4200);
      this.world.interiorManager.leaveThroughDoor(this.player, this.cameraManager, this.hud, this.world);
    };

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

    // Furnishing the home: a piece is put down where the player chooses, starting in front of them
    const decor = HouseDecorationSystem.getInstance();
    const home = this.world.interiorManager.residence;
    this.furnishBar = new FurnishBar();
    decor.startAt = () => {
      const facing = this.player.mesh.rotation.y;
      return { x: this.player.position.x - home.group.position.x + Math.sin(facing) * 1.8, z: this.player.position.z - home.group.position.z + Math.cos(facing) * 1.8 };
    };
    this.input.onFloorClick = (point) =>
      this.world.interiorManager.currentInterior?.type === 'residence' && decor.moveTo(point.x - home.group.position.x, point.z - home.group.position.z);
    // What is on television is what is going on in the city
    Television.match = this.world.landmarks.stadium.match;
    Television.matchOn = () => this.world.landmarks.stadium.status?.().open === true;
    Television.clock = () => ({ day: this.world.skyEnvironment.day, hour: this.world.skyEnvironment.currentHour });

    // Buildings and walls are solid to someone on foot and to a vehicle being driven
    this.player.solids = () => this.solidsHere();
    this.player.wayfinder = (fromX, fromZ, toX, toZ) => this.waysHere()?.route(fromX, fromZ, toX, toZ) ?? null;
    this.player.footbridge = () => this.world.cityManager.currentCityId === 'lagos';
    // People and vehicles take up room: nobody walks or drives through them
    const onLagosStreet = () => this.world.cityManager.currentCityId === 'lagos' && !this.world.interiorManager.isPlayerInside() && !this.world.interiorManager.busy;
    const inTheStreet = () => !this.world.interiorManager.isPlayerInside() && !this.world.interiorManager.busy;
    Bodies.add({
      people: (x, z, range, out) => {
        out.length = 0;
        if (!onLagosStreet()) return;
        this.world.cityPopulation.people(x, z, range, out);
        for (const npc of this.world.npcs.getPedestrianPositions()) {
          if (Math.abs(npc.x - x) <= range && Math.abs(npc.z - z) <= range) out.push({ x: npc.x, z: npc.z, r: 0.3 });
        }
      },
      cars: (x, z, range, out) => {
        if (onLagosStreet()) this.world.trafficSpawner.cars(x, z, range, out);
        if (inTheStreet()) this.world.vehicles.cars(x, z, range, out, this.world.cityManager.currentCityId);
      },
    });
    DrivableVehicle.solids = () => this.solidsHere();
    // Jets and yachts: bought here, standing at the airfield and the marina, flown and sailed from there
    const fleet = Fleet.get();
    const fleetSheet = new FleetSheet();
    this.fleetSheet = fleetSheet;
    const roadside = this.world.expressway.roadside;
    roadside.hooks = {
      openApp: (app) => this.hud.phoneModal.openApp(app),
      openFleet: (kind) => fleetSheet.open(kind),
      mine: (kind) => fleet.mine(kind).map((c) => ({ uid: c.uid, label: c.name })),
      // From inside the yacht club or the terminal: out of the room first, then away
      fly: (uid, city) => this.outThen(() => this.flyPrivate(uid, city)),
      cruise: (uid) => this.outThen(() => this.cruise(uid)),
      openPump: (station) => this.hud.onOpenPump?.(station),
      openStateHouse: (mode) => this.stateHouse.open(mode),
    };
    const showFleet = () => {
      const craft = (kind: 'jet' | 'yacht') => fleet.mine(kind).map((c) => ({ uid: c.uid, length: fleetModel(c.modelId)!.length, paint: fleetColour(c.colour), name: c.name }));
      roadside.showFleet(craft('jet'), craft('yacht'));
    };
    fleet.onChange(showFleet);
    showFleet();

    // The drop-down under the top bar: time, needs, money, and a tap to everything else
    new TopMenu({
      clock: () => document.getElementById('hud-clock-val')?.textContent ?? '',
      city: () => document.getElementById('hud-loc-name')?.textContent ?? 'Lagos',
      openQuests: () => this.hud.questModal.open(),
      openMusic: () => this.hud.onOpenMusic?.(),
      openFleet: () => fleetSheet.open('mine'),
      openApp: (app) => this.hud.phoneModal.openApp(app),
      openMap: () => document.getElementById('nav-btn-map')?.click(),
      cashMachine: () => this.hud.goToCashMachine(),
      musicPlaying: () => SoundEngine.getInstance().isRadioActive(),
      openStateHouse: () => this.stateHouse.open('view'),
      governor: () => this.politics.holder('governor')?.name ?? null,
    });
    // Pictures for the catalogue and for the jets and yachts come from one small renderer
    const furniture = (key: string) => HouseDecorationSystem.getInstance().createFurniture3DMesh(key);
    FurnitureThumbs.build = (key) => {
      if (!key.startsWith('fleet:')) return furniture(key);
      const [, id, colour] = key.split(':');
      const model = fleetModel(id)!;
      return model.kind === 'jet' ? buildJet(model.length, fleetColour(colour), 'NAIJA ONE') : buildYacht(model.length, fleetColour(colour), 'NAIJA ONE');
    };
    this.cameraManager.blocked = (x, z) => this.solidsHere()?.at(x, z, 0.4) ?? false;
    // Broad Street is crossed on foot at the junction's zebra crossings or over the footbridge, nowhere else
    let toldAt = 0;
    this.player.mayNotStep = (fromX, fromZ, toX, toZ) => {
      if (this.player.isDriving || this.world.cityManager.currentCityId !== 'lagos' || this.world.interiorManager.isPlayerInside()) return false;
      const barred = (x: number, z: number) => NO_CROSSING.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
      if (!barred(toX, toZ) || barred(fromX, fromZ)) return false;
      if (performance.now() - toldAt > 4000) {
        toldAt = performance.now();
        showGameToast('🚦 Lagos drivers no dey slow! Use the pedestrian bridge, or the zebra crossing at the junction.', 'warning', 3600);
      }
      return true;
    };
    DrivableVehicle.loadSettings();
    this.graphics = new GraphicsQuality({
      renderer: this.renderer,
      sun: this.world.skyEnvironment.sunLight,
      scene: this.scene,
      crowd: this.world.cityPopulation,
      resized: () => this.postProcessing.setSize(window.innerWidth, window.innerHeight),
      tell: (text) => showGameToast(text, 'info', 7000),
    });
    // The queues at Broad Street's bus stops are who a danfo or keke picks up
    const crowd = this.world.cityPopulation;
    DrivableVehicle.busStops = {
      stopAt: (x, z) => (this.world.cityManager.currentCityId === 'lagos' ? crowd.stopAt(x, z) : -1),
      board: (stop, doorX, doorZ, onBoard) => crowd.board(stop, doorX, doorZ, onBoard),
    };
    DrivableVehicle.makeWay = (x, z, dirX, dirZ, range, halfWidth) => (this.world.cityManager.currentCityId === 'lagos' ? crowd.scatter(x, z, dirX, dirZ, range, halfWidth) : 0);
    const roadsByCity = new Map<string, ReturnType<typeof zonesFor>>();
    DrivableVehicle.roads = () => {
      const city = this.world.cityManager.currentCityId;
      let roads = roadsByCity.get(city);
      if (!roads) roadsByCity.set(city, (roads = zonesFor(city)));
      return roads;
    };
    // What players build on their plots is solid too: when that changes, the list is made again
    this.registry.subscribe((state) => {
      const built = Object.keys(state.buildings).sort().join(',');
      if (built === this.builtOnPlots) return;
      this.builtOnPlots = built;
      this.solidsByCity.clear();
      this.waysByCity.clear();
    });

    // Flying: the hall is the same room in every city, and the flight starts at the aircraft door
    const hereCity = () => this.world.cityManager.currentCityId as FlightCity;
    openAirportHall({ city: hereCity, apronDoor: () => this.world.airportOf(hereCity())?.apron.door ?? null });
    this.flights.onBoarded = (booking) => this.depart(booking);
    this.coaches.onBoarded = (ticket) => this.departByCoach(ticket);
    this.nameAirportHall(hereCity());
    this.hud.onLookFrom = (yaw, pitch, distance) => {
      this.cameraManager.yaw = yaw;
      this.cameraManager.pitch = pitch;
      this.cameraManager.distance = distance;
    };

    // The player's own vehicles are in the city only while the registry says they are theirs
    this.ownedVehicles = new OwnedVehicles(this.world, {
      driving: () => (this.player.isDriving ? this.player.currentVehicle : null),
      getOut: () => {
        this.exitVehicle();
        showGameToast('This vehicle is no longer yours.', 'warning', 3600);
      },
      playerPosition: () => this.player.position,
      city: () => this.world.cityManager.currentCityId,
      kerbNear: (x, z) => this.kerbNear(x, z),
    });
    this.vehicleSync = new VehicleSync(this.world.vehicles, this.network, () => (this.player.isDriving ? this.player.currentVehicle : null));
    this.ownedVehicles.movingElsewhere = (vehicle) => this.vehicleSync.driverOf(vehicle) !== null;
    // The home is furnished as what the player rents or owns, and their own vehicles stand in its carport
    ResidentialInterior.homeId = () => this.currentHome();
    ResidentialInterior.standardNow = () => {
      const data = BackendService.getInstance().getData();
      const plotId = this.currentHome();
      if (plotId !== 'main') {
        // A house the player built: as grand as the house
        const type = buildingType(this.land.building(plotId)?.typeId ?? '');
        return type?.id === 'duplex' ? 'luxury' : 'comfortable';
      }
      return standardOf(data.properties, data.id, false);
    };
    ResidentialInterior.carsOwned = () => this.ownedVehicles.myModels();
    ResidentialInterior.homeName = () => {
      const plotId = this.currentHome();
      if (plotId !== 'main') {
        const plot = this.land.plot(plotId);
        const type = buildingType(this.land.building(plotId)?.typeId ?? '');
        return plot ? { name: `Your ${(type?.name ?? 'house').toLowerCase()} at ${plot.name}`, area: plot.neighbourhood } : null;
      }
      const data = BackendService.getInstance().getData();
      const home = data.properties.find((p) => p.ownerId === data.id && (p.status === 'owned' || p.status === 'rented') && !['office', 'shop', 'business'].includes(String(p.type)));
      return home ? { name: home.status === 'rented' ? `${home.name} (rented)` : home.name, area: home.location ?? '' } : null;
    };
    void this.assetMarket.introduce(this.player.config.name);

    // On a world server: bring along the land and vehicles owned in this browser
    void carryToServer().then((carried) => {
      this.carried = carried;
      if (!carried) return;
      const parts: string[] = [];
      if (carried.plots.length) parts.push(`${carried.plots.length} plot${carried.plots.length === 1 ? '' : 's'} of land`);
      if (carried.vehicles) parts.push(`${carried.vehicles} vehicle${carried.vehicles === 1 ? '' : 's'}`);
      if (parts.length) showGameToast(`${parts.join(' and ')} came with you to this server.`, 'success', 5200);
      if (carried.stayed.length) {
        const names = carried.stayed.map((id) => this.land.plot(id)?.name ?? id).join(', ');
        showGameToast(`${names} already ${carried.stayed.length === 1 ? 'has' : 'have'} an owner on this server, so ${carried.stayed.length === 1 ? 'it stays' : 'they stay'} in this browser.`, 'warning', 6400);
      }
    });
  }

  /** What stands on the ground in a city: the full survey for Lagos, the landmarks for the others. */
  public standingIn(city: string): Obstruction[] {
    if (city === 'lagos') return this.world.standingOnTheGround();
    const instance = city === 'abuja' ? this.world.cityManager.abujaCity : this.world.cityManager.portHarcourtCity;
    const out = instance ? obstructionsUnder(instance.group, CITY_NAME[city as PlotCity] ?? city) : [];
    if (instance?.airport) out.push(...instance.airport.obstructions);
    if (instance?.motorPark) out.push(...instance.motorPark.obstructions);
    if (instance?.standing) out.push(...instance.standing);
    out.push(...this.plotWorld.obstructions(city as PlotCity));
    return out;
  }

  /** Checks a city against its plan: roads clear, walkways passable, nothing overlapping, every door reachable. */
  public validateCity(city: string, extra: Obstruction[] = []): Violation[] {
    if (city === 'lagos') return this.world.validateCityPlan(extra);
    const instance = city === 'abuja' ? this.world.cityManager.abujaCity : this.world.cityManager.portHarcourtCity;
    // The steps and the apron door are inside the airport's fence, reached through the terminal: its way in is the kerb
    const airside = new Set(instance?.airport?.interactive ?? []);
    const doors = (instance?.interactiveList ?? []).filter((item) => !airside.has(item)).map((item) => ({ name: item.name, x: item.interactionPoint.x, z: item.interactionPoint.z }));
    if (instance?.airport) doors.push(...instance.airport.doors);
    if (instance?.motorPark) doors.push(...instance.motorPark.doors);
    for (const destination of DestinationRegistry.getInstance().getAll()) {
      if (destination.city === city) doors.push({ name: destination.name, x: destination.streetPosition.x, z: destination.streetPosition.z });
    }
    const zones = zonesFor(city);
    const walk = zones.find((zone) => zone.kind === 'walkway');
    return validatePlan({
      zones,
      obstructions: [...this.standingIn(city), ...extra],
      doors,
      start: walk ? { x: (walk.minX + walk.maxX) / 2, z: 0 } : { x: 0, z: 0 },
    });
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
      openProfile: () => this.profileSheet.open(null),
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
  /** The home the player last chose to go into: 'main' (the flat rented or bought) or a built house's plot */
  private homeNow: string | null = null;

  /** The home they go into now: the one they chose if it is still theirs, else the flat, else a house they built */
  private currentHome(): string {
    const data = BackendService.getInstance().getData();
    const hasFlat = data.properties.some((p) => p.ownerId === data.id && (p.status === 'owned' || p.status === 'rented') && !['office', 'shop', 'business', 'warehouse', 'land'].includes(String(p.type)));
    if (this.homeNow && this.homeNow !== 'main' && this.land.livesIn(this.homeNow)) return this.homeNow;
    if (this.homeNow === 'main' && hasFlat) return 'main';
    if (hasFlat) return 'main';
    return this.land.homes()[0]?.id ?? 'main';
  }

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

  private ambienceClock: number | undefined;
  public fleetSheet!: FleetSheet;
  public profileSheet!: ProfileSheet;
  public stateHouse!: StateHouseSheet;

  /** At Ladipo: each of the player's vehicles, what it needs, and a full repair for the price of the work */
  private offerRepairs(): void {
    const garage = this.garage;
    const mine = garage.mine().filter((r) => r.condition < 99);
    if (!mine.length) {
      showGameToast('🔧 "Your motors dey kampe. Nothing to fix." The mechanic waves you off.', 'info', 4000);
      return;
    }
    this.hud.showDialogueModal({
      speakerName: 'Oga Mechanic',
      speakerRole: 'Ladipo Auto Market',
      speakerAvatar: '🔧',
      dialogueText: 'Which one we dey fix? I go do am like new.',
      choices: mine.map((r) => {
        const cost = Math.round((100 - r.condition) * 5000);
        const name = vehicleModel(r.modelId)?.name ?? 'Vehicle';
        return {
          id: r.id,
          label: `${name} · ${Math.round(r.condition)}% condition`,
          badge: `₦${cost.toLocaleString()}`,
          onSelect: () => {
            if (!BackendService.getInstance().pay(cost, `Repair at Ladipo, ${name}`, 'SHOP_PURCHASE')) {
              showGameToast(`The repair is ₦${cost.toLocaleString()}. You do not have it.`, 'warning', 3600);
              return;
            }
            void garage.repair(r.id).then(() => showGameToast(`🔧 Your ${name} is like new: 100% condition.`, 'success', 4000));
          },
        };
      }),
    });
  }
  public readonly politics = Politics.get();
  public readonly companies = Companies.get();
  public readonly supermarket = Supermarket.get();
  public companyStaff: CompanyStaff | null = null;

  /** The governor's convoy on its runs, and the player's own when they have hired one */
  public convoys: Convoys | null = null;
  private connectConvoys(): void {
    const convoys = new Convoys();
    this.convoys = convoys;
    convoys.say = (text) => { if (!this.travelling()) showGameToast(text, 'warning', 5000); };
    convoys.siren = (level) => SoundEngine.getInstance().playSiren(level);
    this.scene.add(convoys.group);
    this.world.cityManager.addToLagos(convoys.group, []);
    // A hired convoy clears the road: nothing pulling over for it stops the player's car
    DrivableVehicle.clearsTraffic = () => this.player.isDriving && convoys.escort.active(this.world.skyEnvironment.day);
  }

  private moveConvoys(delta: number): void {
    const convoys = this.convoys;
    if (!convoys) return;
    const sky = this.world.skyEnvironment;
    const vehicle = this.player.isDriving ? this.player.currentVehicle : null;
    convoys.update(delta, {
      hour: sky.currentHour,
      day: sky.day,
      player: this.player.position,
      driving: vehicle ? { x: vehicle.mesh.position.x, z: vehicle.mesh.position.z, yaw: vehicle.mesh.rotation.y } : null,
      inLagos: this.world.cityManager.currentCityId === 'lagos' && !this.world.interiorManager.isPlayerInside(),
    });
    this.world.trafficSpawner.sirens = convoys.sirens;
  }

  /** A police escort or a full convoy, hired at the Police Command: paid once, for its days */
  private hireEscort(level: EscortLevel, host?: PlaceHost): void {
    const offer = ESCORTS[level];
    const convoys = this.convoys;
    if (!convoys) return;
    const day = this.world.skyEnvironment.day;
    if (convoys.escort.active(day) && convoys.escort.level === level) {
      host?.say(`Your ${offer.name.toLowerCase().replace(/^a /, '')} is with you till the end of day ${convoys.escort.until + 1}.`, 'info');
      return;
    }
    if (!BackendService.getInstance().pay(offer.price, `${offer.name}, Lagos State Police Command`, 'SHOP_PURCHASE')) {
      host?.say(`That is ₦${offer.price.toLocaleString()}. You do not have it.`, 'warning');
      return;
    }
    convoys.escort.set(level, day + offer.days - 1);
    host?.say(`${offer.name} is yours for ${offer.days} days. They will follow you whenever you drive, sirens on.`, 'success');
  }

  /** The venues' timetable runs on the game's clock, and the player hears when a show comes on */
  private eventsSeen: { day: number; hour: number } | null = null;
  private connectEvents(): void {
    const sky = this.world.skyEnvironment;
    EventClock.now = () => ({ day: sky.day, hour: sky.currentHour });
  }

  /** On a flight or a road ride: what is happening on the street is not told */
  private travelling(): boolean {
    return this.flightExperience.isActive || this.roadRideExperience.isActive;
  }

  private tellEvents(): void {
    const now = EventClock.now();
    const was = this.eventsSeen;
    this.eventsSeen = now;
    if (!was || this.world.cityManager.currentCityId !== 'lagos' || this.travelling()) return;
    for (const event of startedBetween(was.day, was.hour, now.day, now.hour)) {
      const venue = PLACE_SPECS.find((spec) => spec.key === event.venue)?.name ?? event.venue;
      showGameToast(`🔴 LIVE now at ${venue}: ${event.title}. See What’s on in your phone.`, 'info', 6000);
    }
  }

  /** Does something out in the street: if the player is in a room, they come out of it first */
  private outThen(then: () => void): void {
    const rooms = this.world.interiorManager;
    if (rooms.isPlayerInside()) void rooms.exitCurrentInterior(this.player, this.cameraManager, this.hud, this.world).then(then);
    else then();
  }

  /** The businesses the player owns, run as companies: staff and branches lift the takings, and each day closes with a report */
  private connectCompanies(): void {
    const companies = this.companies;
    const sky = this.world.skyEnvironment;
    companies.today = () => sky.day;
    companies.dayName = (day) => new Date(2026, 9, 7 + day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    BackendService.takings = (biz, own) => companies.perCycle(biz, own);
    BackendService.onTakings = (id, amount) => companies.took(id, amount);
    // The supermarket takes what customers buy off its shelves, which its stackers keep filled
    BackendService.sales = (biz, cycles) => (biz.id === SUPERMARKET ? Supermarket.get().trade(cycles, companies.lift(biz.id), companies.count(biz.id, 'stacker')) : null);
    companies.onReports = (reports) => {
      reports.forEach(({ business, report }, i) => {
        const line = `📊 ${business.name}, ${companies.dayName(report.day)}: took ₦${report.takings.toLocaleString()} · wages ₦${report.wages.toLocaleString()}${report.rent ? ` · rent ₦${report.rent.toLocaleString()}` : ''} · tax ₦${report.tax.toLocaleString()} · ${report.profit >= 0 ? 'profit' : 'loss'} ₦${Math.abs(report.profit).toLocaleString()}${report.banked ? ` · ₦${report.banked.toLocaleString()} banked by the manager` : ''}${report.note ? `. ${report.note}` : ''}`;
        setTimeout(() => showGameToast(line, report.note ? 'warning' : 'info', 7000), i * 1500);
      });
    };
    const lagos = this.world.cityManager;
    this.companyStaff = new CompanyStaff({
      find: (id) => this.world.interactiveObjects.find((o) => o.id === id),
      add: (o) => lagos.addLagosInteractive(o),
      remove: (o) => lagos.removeLagosInteractive(o),
      hour: () => sky.currentHour,
    });
    this.scene.add(this.companyStaff.group);
    lagos.addToLagos(this.companyStaff.group, []);
  }

  /** The government the players elect: its laws in force for everyone, its house to visit, its polling unit */
  private connectGovernment(): void {
    Employment.payBoost = Policies.pay;
    BackendService.revenueBoost = Policies.business;
    RideService.fareFactor = Policies.transport;
    hawkerPrices.factor = Policies.hawkers;
    petrolPolicy.factor = Policies.petrol;
    const politics = this.politics;
    this.stateHouse = new StateHouseSheet({
      name: () => this.player.config.name,
      knownPlayers: () => [...this.network.remotePlayers.values()].map((r) => ({ id: r.id, name: r.name })),
    });
    // Each new week the votes are counted, by whichever game sees the week turn first
    void politics.refresh();
    window.setInterval(() => void politics.refresh(), 60_000);
  }
  /** The player's ties with other players (closeness, family, bae, jobs) */
  public readonly profileTies = Ties.get();

  /**
   * Players to one another: each shows a card and a CV made from their own records; they chat,
   * become family or bae, and hire one another for jobs that are paid when done.
   */
  private connectProfiles(): void {
    const net = this.network;
    const ties = Ties.get();
    NetworkManager.profile = () => myProfile(net.localId, { skin: this.player.config.skinTone });
    const doing = (r: RemotePlayer) => (r.driving ? 'driving' : r.seated ? 'sitting down' : r.isMoving ? 'walking about' : 'hanging out');
    const sheet = new ProfileSheet({
      me: () => ({ id: net.localId, profile: myProfile(net.localId, { skin: this.player.config.skinTone }) }),
      other: (id) => {
        const r = net.remotePlayers.get(id);
        if (!r) return null;
        const place = r.place ? this.world.interiorManager.nameOfPlace(r.place) ?? 'a building' : null;
        const where = place ? `Here at ${place}` : `On ${this.world.getDistrictAtPosition(r.mesh.position).sub || 'the street'}`;
        return { name: r.name, profile: r.profile, where: `${where} · ${doing(r)}` };
      },
      sendMessage: (toId, text) => net.sendDirectMessage(toId, text),
      sendTie: (toId, kind) => net.sendTie(toId, kind),
      sendOffer: (offer) => net.sendOffer(offer),
      sendOfferUpdate: (toId, id, state, rating) => net.sendOfferUpdate(toId, id, state, rating),
      pay: (toId, amount, memo) => {
        const sent = net.sendTransfer(toId, amount, memo, 'bank');
        return sent.success ? null : sent.message;
      },
      openLook: () => this.hud.openWardrobe(),
    });
    this.profileSheet = sheet;
    this.hud.onOpenProfile = (id) => sheet.open(id);
    const nameOf = (id: string, fallback: string) => net.remotePlayers.get(id)?.name ?? fallback;
    net.onTie = (fromId, fromName, kind) => {
      if (kind === 'family_ask') sheet.ask(fromId, fromName, 'family');
      else if (kind === 'bae_ask') {
        // A bae is asked only by someone close enough; otherwise it is turned down for them
        if (ties.closeness(fromId) >= BAE_AT || ties.bae()?.id === fromId) sheet.ask(fromId, fromName, 'bae');
        else net.sendTie(fromId, 'bae_no');
      } else if (kind === 'family_yes') {
        ties.addFamily(fromId, fromName);
        showGameToast(`👪 @${fromName} said yes: you are family now.`, 'success', 4000);
      } else if (kind === 'bae_yes') {
        ties.setBae(fromId, fromName);
        showGameToast(`💘 @${fromName} said yes!`, 'success', 4000);
      } else {
        showGameToast(`@${fromName} said not now.`, 'info', 3200);
      }
    };
    net.onOffer = (offer) => {
      ties.keep(offer);
      showGameToast(`🧰 @${offer.employerName} wants to hire you: ${ROLES.find((r) => r.id === offer.role)?.name}, ₦${offer.fee.toLocaleString()}.`, 'info', 5000);
      sheet.offered(offer);
    };
    net.onOfferUpdate = (id, fromId, state, rating) => {
      const offer = ties.offer(id);
      // Only the other side of the job can move it on
      if (!offer || (fromId !== offer.employerId && fromId !== offer.workerId)) return;
      const moved = ties.advance(id, state, rating);
      if (!moved) return;
      const who = nameOf(fromId, fromId === offer.workerId ? offer.workerName : offer.employerName);
      if (state === 'accepted') showGameToast(`🧰 @${who} took the job.`, 'success', 3600);
      else if (state === 'declined') showGameToast(`@${who} turned the job down.`, 'info', 3600);
      else if (state === 'done') {
        showGameToast(`✅ @${who} says the job is done. Pay them in My hustle.`, 'success', 5000);
        sheet.openJobs();
      } else if (state === 'paid') {
        ties.grow(fromId, who, 8);
        showGameToast(`⭐ @${who} paid ₦${offer.fee.toLocaleString()} and rated you ★${moved.rating ?? '-'}.`, 'success', 5000);
        net.broadcastProfile();
      }
    };
  }
  public pumpSheet!: PumpSheet;
  /** The filling station whose pump is open */
  private pumpAt: Station | null = null;
  /** A jet taking off or a yacht out on the lagoon, with the player aboard */
  private ride: { craft: THREE.Group; t: number; total: number; deck: number; hidden: boolean; view?: { distance: number; pitch: number }; path: (p: number) => { x: number; y: number; z: number; dx: number; dz: number; pitch: number }; end: () => void } | null = null;

  /** Moves the craft along its way and keeps the player aboard; nothing else moves them meanwhile */
  private stepRide(delta: number): void {
    const ride = this.ride;
    if (!ride) return;
    ride.t += delta;
    const p = Math.min(1, ride.t / ride.total);
    const at = ride.path(p);
    ride.craft.position.set(at.x, at.y, at.z);
    ride.craft.quaternion.setFromEuler(new THREE.Euler(0, Math.atan2(-at.dz, at.dx), at.pitch, 'YZX'));
    this.player.stopMoving();
    this.player.mesh.position.set(at.x, at.y + ride.deck, at.z);
    this.player.position.copy(this.player.mesh.position);
    this.player.mesh.rotation.y = Math.atan2(at.dx, at.dz);
    // The camera stands well back and above, so the whole craft is in view
    if (!ride.view) {
      ride.view = { distance: this.cameraManager.distance, pitch: this.cameraManager.pitch };
      this.cameraManager.distance = Math.max(14, (ride.craft.userData.length as number) * 1.1);
      this.cameraManager.pitch = 0.42;
    }
    // Behind the craft, swinging round with it
    const behind = Math.atan2(at.dx, at.dz) + Math.PI;
    const turn = Math.atan2(Math.sin(behind - this.cameraManager.yaw), Math.cos(behind - this.cameraManager.yaw));
    this.cameraManager.yaw += turn * Math.min(1, delta * 2);
    if (p >= 1) {
      this.ride = null;
      this.player.mesh.visible = true;
      this.cameraManager.distance = ride.view.distance;
      this.cameraManager.pitch = ride.view.pitch;
      ride.end();
    }
  }

  /** Flies the player in their own jet: taxi, take-off over the airfield, and on landing they are at the destination's apron */
  private flyPrivate(uid: string, city: string): void {
    const craft = this.world.expressway.roadside.craft.get(uid);
    const owned = Fleet.get().mine('jet').find((c) => c.uid === uid);
    if (!craft || !owned || this.ride) return;
    const fuel = city === 'abuja' ? 2_500_000 : 2_000_000;
    const paid = BackendService.getInstance().processTransaction({ type: 'TRAVEL_COST', amount: fuel, description: `Fuel and crew, "${owned.name}" to ${city === 'abuja' ? 'Abuja' : 'Port Harcourt'}` });
    if (!paid.success) {
      showGameToast(`Fuel and crew come to ₦${fuel.toLocaleString()}. You do not have it.`, 'warning', 4000);
      return;
    }
    const home = (craft.userData.home as THREE.Vector3).clone();
    const start = new THREE.Vector3(AIRFIELD.runwayX, 0, AIRFIELD.from + 12);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    this.player.mesh.visible = false;
    showGameToast(`✈️ "${owned.name}" is taxiing. Sit back: wheels up in a moment.`, 'info', 4000);
    this.ride = {
      craft, t: 0, total: 16, deck: 2, hidden: true,
      path: (p) => {
        if (p < 0.25) {
          const t = p / 0.25;
          return { x: lerp(home.x, start.x, t), y: 0, z: lerp(home.z, start.z, t), dx: start.x - home.x, dz: start.z - home.z, pitch: 0 };
        }
        // Down the runway faster and faster, then up and away over the city
        const t = (p - 0.25) / 0.75;
        const run = t * t * (AIRFIELD.to - start.z + 900);
        const climb = Math.max(0, run - (AIRFIELD.to - start.z - 40));
        return { x: start.x, y: climb * 0.22, z: start.z + run, dx: 0, dz: 1, pitch: climb > 0 ? 0.22 : 0 };
      },
      end: () => {
        craft.position.copy(home);
        craft.rotation.set(0, Math.PI, 0);
        this.arriveInCity(city as CityId);
        this.standOnApron(city);
        showGameToast(`🛬 "${owned.name}" has landed you in ${city === 'abuja' ? 'Abuja' : 'Port Harcourt'}. Your crew takes her back to Lagos.`, 'success', 6000);
      },
    };
  }

  /** Takes the player out on the lagoon in their own yacht, round and back to the berth */
  private cruise(uid: string): void {
    const craft = this.world.expressway.roadside.craft.get(uid);
    const owned = Fleet.get().mine('yacht').find((c) => c.uid === uid);
    if (!craft || !owned || this.ride) return;
    const home = (craft.userData.home as THREE.Vector3).clone();
    const length = (craft.userData.length as number) ?? 15;
    const centre = { x: 280, z: 1760 };
    const radius = 190;
    const into = { x: centre.x, z: centre.z - radius };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    showGameToast(`🛥️ All aboard "${owned.name}"! Out on the lagoon.`, 'info', 3500);
    this.ride = {
      craft, t: 0, total: 42, deck: (craft.userData.top as number) ?? 2, hidden: false,
      path: (p) => {
        if (p < 0.12) {
          const t = p / 0.12;
          return { x: lerp(home.x, into.x, t), y: home.y, z: lerp(home.z, into.z, t), dx: into.x - home.x, dz: into.z - home.z, pitch: 0 };
        }
        if (p < 0.88) {
          const a = ((p - 0.12) / 0.76) * Math.PI * 2;
          return { x: centre.x + Math.sin(a) * radius, y: home.y + Math.sin(a * 6) * 0.08, z: centre.z - Math.cos(a) * radius, dx: Math.cos(a), dz: Math.sin(a), pitch: Math.sin(a * 5) * 0.02 };
        }
        const t = (p - 0.88) / 0.12;
        return { x: lerp(into.x, home.x, t), y: home.y, z: lerp(into.z, home.z, t), dx: home.x - into.x, dz: home.z - into.z, pitch: 0 };
      },
      end: () => {
        craft.position.copy(home);
        craft.rotation.set(0, 0, 0);
        this.player.mesh.position.set(home.x - length * 0.2, 0, MARINA.pierZ);
        this.player.position.copy(this.player.mesh.position);
        const backend = BackendService.getInstance();
        backend.modifyNeed('fun', 40);
        backend.modifyNeed('social', 25);
        showGameToast(`What a ride! Sunset on the lagoon in "${owned.name}". Fun +40, Social +25.`, 'success', 5000);
      },
    };
  }
  private lastDrivenZ: number | null = null;
  private rushToldAt = -1;

  /**
   * Driving on the expressway: the toll is paid passing the plaza (either way), and at rush hour
   * the driver is told what they are in for.
   */
  private onTheExpressway(): void {
    const car = this.player.isDriving ? this.player.currentVehicle : null;
    if (!car || this.world.cityManager.currentCityId !== 'lagos') {
      this.lastDrivenZ = null;
      return;
    }
    const z = car.mesh.position.z;
    const before = this.lastDrivenZ;
    this.lastDrivenZ = z;
    if (before === null || Math.abs(car.mesh.position.x) > EXPRESS.half + 2) return;
    if ((before - EXPRESS.toll) * (z - EXPRESS.toll) < 0) {
      const toll = Math.round(400 * Policies.toll());
      if (toll === 0) showGameToast('🛣️ No toll this week: the Senator made the roads toll-free.', 'info', 3200);
      else {
        const paid = BackendService.getInstance().processTransaction({ type: 'TRAVEL_COST', amount: toll, description: 'Lekki toll plaza (eTag)' });
        showGameToast(paid.success ? `🛣️ Toll ₦${toll} paid by eTag. Safe journey!` : '🛣️ eTag empty: the toll could not be paid. Top up soon o.', paid.success ? 'info' : 'warning', 3200);
      }
    }
    // Entering the expressway at rush hour
    if (before < MAIN_ROAD.zMax && z >= MAIN_ROAD.zMax && isRushHour(this.world.skyEnvironment.currentHour) && this.world.skyEnvironment.day !== this.rushToldAt) {
      this.rushToldAt = this.world.skyEnvironment.day;
      showGameToast('🚗 Rush hour! Third Mainland is packed. Na Lagos be this: hold your patience.', 'warning', 4200);
    }
  }
  private solidsByCity = new Map<string, Solids>();
  private waysByCity = new Map<string, Wayfinder>();
  private builtOnPlots = '';

  /** Finds the way on foot in the city the player is in. Nothing while they are indoors. */
  public waysHere(): Wayfinder | null {
    const solids = this.solidsHere();
    if (!solids) return null;
    const city = this.world.cityManager.currentCityId;
    let ways = this.waysByCity.get(city);
    if (!ways) {
      ways = new Wayfinder(city === 'lagos' ? new Solids([...this.standingIn(city), ...this.world.streetLamps(), ...this.parkedCars()]) : solids, zonesFor(city), city === 'lagos' ? NO_CROSSING : []);
      this.waysByCity.set(city, ways);
    }
    return ways;
  }

  /** Cars that are parked for good in Lagos, as rectangles on the ground: walks are planned round them */
  private parkedCars(): Obstruction[] {
    const cars: CarBody[] = [];
    this.world.trafficSpawner.cars(0, 0, 1000, cars);
    const parked = cars.filter((car) => car.parked).map((car) => ({ ...car }));
    for (const group of this.world.vehicles.parkedVehicles) parked.push({ ...bodyOf(group, { x: 0, z: 0, yaw: 0, halfWidth: 0, halfLength: 0 }) });
    return parked.map((car, index) => {
      const c = Math.abs(Math.cos(car.yaw));
      const s = Math.abs(Math.sin(car.yaw));
      const hx = car.halfWidth * c + car.halfLength * s;
      const hz = car.halfWidth * s + car.halfLength * c;
      return { owner: `Parked car #${index}`, structure: false, height: 1.5, minX: car.x - hx, maxX: car.x + hx, minZ: car.z - hz, maxZ: car.z + hz };
    });
  }

  /** The way on foot from where the player stands to a point in the city they are in. */
  public wayTo(x: number, z: number): Way | null {
    const from = this.player.position;
    return this.waysHere()?.route(from.x, from.z, x, z) ?? null;
  }

  /**
   * What cannot be walked or driven through where the player is: the buildings, walls and
   * fences of the city they are in, from the same list the city plan is checked against.
   * Nothing while they are indoors, where rooms have floor maps of their own.
   */
  /**
   * A clear spot at the kerb of the road nearest (x, z), on that side of it, facing the way
   * traffic drives there (Nigeria drives on the right). Null if no road is within 40 m.
   */
  public kerbNear(x: number, z: number): { x: number; z: number; yaw: number } | null {
    const roads = DrivableVehicle.roads?.() ?? [];
    const solids = this.solidsHere();
    const inset = 1.6;
    let best: { x: number; z: number; yaw: number; d: number } | null = null;
    for (const road of roads) {
      if (road.kind !== 'carriageway') continue;
      const clampTo = (v: number, lo: number, hi: number) => Math.min(hi - 3, Math.max(lo + 3, v));
      // Along the road as near the player as it goes, then try a few steps either way for a clear spot
      for (const shift of [0, 4, -4, 8, -8]) {
        let spot: { x: number; z: number; yaw: number };
        if (road.axis === 'z') {
          const east = x >= (road.minX + road.maxX) / 2;
          spot = { x: east ? road.maxX - inset : road.minX + inset, z: clampTo(z + shift, road.minZ, road.maxZ), yaw: east ? Math.PI : 0 };
        } else {
          const south = z >= (road.minZ + road.maxZ) / 2;
          spot = { x: clampTo(x + shift, road.minX, road.maxX), z: south ? road.maxZ - inset : road.minZ + inset, yaw: south ? Math.PI / 2 : -Math.PI / 2 };
        }
        if (solids?.at(spot.x, spot.z, 1.2)) continue;
        const d = Math.hypot(spot.x - x, spot.z - z);
        if (d <= 40 && (!best || d < best.d)) best = { ...spot, d };
        break;
      }
    }
    return best ? { x: best.x, z: best.z, yaw: best.yaw } : null;
  }

  public solidsHere(): Solids | null {
    if (this.world.interiorManager.isPlayerInside() || this.world.interiorManager.busy) return null;
    const city = this.world.cityManager.currentCityId;
    let solids = this.solidsByCity.get(city);
    if (!solids) {
      solids = new Solids(city === 'lagos' ? [...this.standingIn(city), ...this.world.streetLamps()] : this.standingIn(city));
      this.solidsByCity.set(city, solids);
    }
    return solids;
  }

  /** The hall inside is one room: it carries the name of the airport of the city it is entered from. */
  private nameAirportHall(city: string): void {
    const airport = AIRPORTS[city as FlightCity];
    if (!airport) return;
    const hall = this.world.interiorManager.airport.def;
    hall.name = `${airport.name} (${airport.code})`;
    // It is in the city it is entered from, not always in Ikeja
    hall.districtName = city === 'lagos' ? 'Ikeja Aviation Corridor' : `${airport.city} airport`;
  }

  /** The passenger is through the aircraft door: doors close and the flight goes. */
  private depart(booking: Booking): void {
    const route = booking.route;
    const from = AIRPORTS[route.from];
    const to = AIRPORTS[route.to];
    const details: FlightDetails = {
      flightCode: route.flight,
      airlineName: AIRLINE,
      travelClass: `Economy · seat ${booking.seat}`,
      tailNumber: '5N-NLA',
      originId: route.from,
      destinationId: route.to,
      originCode: from.code,
      destinationCode: to.code,
      originName: from.name,
      destinationName: to.name,
      durationSeconds: 120,
    };
    // The fare is paid and the passenger is aboard: if the game closes now, they still arrive
    this.saveArrivalInTransit(route.to);
    InteractionDirector.get().forceFree(this.player.actor);
    this.player.stopMoving();
    this.player.mesh.position.y = 0;
    this.hud.hideInteractionCard();
    this.world.setStreetModeVisibility(false);
    this.player.mesh.visible = false;
    this.flightExperience.startFlight(details);
    this.transitHUD.showFlightHUD(details);
  }

  /** The passenger is up the steps of the coach: it pulls out of the park with them on it, and takes the road. */
  private departByCoach(ticket: CoachTicket): void {
    const route = ticket.route;
    // The fare is paid and the passenger is aboard: if the game closes now, they still arrive
    this.saveArrivalInTransit(route.to);
    InteractionDirector.get().forceFree(this.player.actor);
    this.player.stopMoving();
    this.hud.hideInteractionCard();
    this.player.mesh.visible = false;
    const takeTheRoad = () => {
      this.coachPullingOut = null;
      this.world.setStreetModeVisibility(false);
      const ride: RideDetails = {
        vehicleName: `${OPERATOR} coach ${route.coach}`,
        vehicleType: 'coach',
        originName: MOTOR_PARKS[route.from].name,
        destinationName: MOTOR_PARKS[route.to].name,
        durationSeconds: 20,
        trafficCondition: 'Clear',
        weatherCondition: 'Sunny',
        destinationCityId: route.to,
      };
      this.roadRideExperience.startRide(ride);
      this.transitHUD.showRideHUD(ride);
    };
    const park = this.world.motorParkOf(route.from);
    if (!park) {
      takeTheRoad();
      return;
    }
    this.coachPullingOut = park.coach;
    // Seen from the back of the yard, over the coach, as it goes out through the gate
    this.viewBeforeCoach = { pitch: this.cameraManager.pitch, distance: this.cameraManager.distance };
    this.cameraManager.yaw = Math.atan2(-park.leaves.x, -park.leaves.z);
    this.cameraManager.pitch = 0.5;
    this.cameraManager.distance = 24;
    park.sendOff(takeTheRoad);
  }

  /** While the coach pulls out, its passenger is where it is, so the view goes out through the gate with it. */
  private rideOutOfThePark(): void {
    if (!this.coachPullingOut) return;
    const at = this.coachPullingOut.getWorldPosition(new THREE.Vector3());
    this.player.mesh.position.set(at.x, 0, at.z);
    this.player.position.copy(this.player.mesh.position);
  }

  /** Pulled in: the player gets down beside the coach in the motor park of the city they have come to. */
  private stepDownAtPark(cityId: string): void {
    const park = this.world.motorParkOf(cityId);
    const ridden = this.coaches.arrive();
    if (park) {
      park.receive();
      this.player.stopMoving();
      this.player.mesh.position.set(park.setDown.x, 0, park.setDown.z);
      this.player.position.copy(this.player.mesh.position);
      this.player.mesh.rotation.y = park.setDownFacing;
      // From behind them, looking at the gate, as near as they had the view before they set off
      this.cameraManager.yaw = Math.atan2(-park.leaves.x, -park.leaves.z);
      if (this.viewBeforeCoach) {
        this.cameraManager.pitch = this.viewBeforeCoach.pitch;
        this.cameraManager.distance = this.viewBeforeCoach.distance;
        this.viewBeforeCoach = null;
      }
      this.cameraManager.snapToPlayer(this.player, 'street');
    }
    this.saveWorldState();
    const there = MOTOR_PARKS[cityId as CoachCity];
    if (ridden && there) {
      showGameToast(`${ridden.route.coach} has pulled in at ${there.name}. Welcome to ${there.city}. The gate to the street is ahead.`, 'success', 6200);
    }
  }

  /** Where the flight has got to, as its passenger's ticket records it. */
  private trackFlight(): void {
    if (!this.flightExperience.isActive || this.flights.status().state !== 'boarded') return;
    const { stage } = this.flightExperience.progress();
    const status: FlightStatus = stage === 'gate' ? 'Boarding closed'
      : stage === 'pushback' || stage === 'taxi' ? 'Taxiing'
      : stage === 'takeoff' || stage === 'climb' ? 'Taking off'
      : stage === 'cruise' ? 'In flight'
      : stage === 'descent' ? 'Approaching'
      : 'Landing';
    this.flights.setStatus(status);
  }

  /** Landed: the player gets off at the foot of the steps on the destination's apron. */
  private disembark(cityId: CityId): void {
    this.world.setStreetModeVisibility(true);
    this.player.mesh.visible = true;
    this.arriveInCity(cityId);
    this.standOnApron(cityId);
    const flown = this.flights.arrive();
    this.saveWorldState();
    const airport = AIRPORTS[cityId as FlightCity];
    if (flown && airport) {
      showGameToast(`${flown.route.flight} has landed at ${airport.name}. Welcome to ${airport.city}. The terminal is ahead: go through it for the street.`, 'success', 6200);
    }
    const journeyCompleted = this.onJourneyCompleted;
    this.onJourneyCompleted = null;
    journeyCompleted?.();
  }

  /** Puts the player at the foot of the aircraft steps, with the aircraft that brought them on the stand. */
  private standOnApron(cityId: string): void {
    const airport = this.world.airportOf(cityId);
    if (!airport) return;
    airport.receive();
    this.player.stopMoving();
    this.player.mesh.position.set(airport.apron.steps.x, 0, airport.apron.steps.z);
    this.player.position.copy(this.player.mesh.position);
    // Facing the terminal
    this.player.mesh.rotation.y = 0;
    // Seen from the open apron, with the aircraft behind them
    this.cameraManager.yaw = -Math.PI / 2;
    this.cameraManager.snapToPlayer(this.player, 'street');
  }

  private isSavedCity(cityId: string): cityId is SavedCityId {
    return cityId === 'lagos' || cityId === 'abuja' || cityId === 'port_harcourt';
  }

  /** Switches the world to a city the player has just travelled to, and reports the arrival. */
  private arriveInCity(cityId: CityId): void {
    this.hud.interstateModal.currentOriginCityId = cityId;
    this.nameAirportHall(cityId);
    if (this.world.cityManager.currentCityId === cityId) return;
    // A vehicle stays in the city it was left in: nobody arrives by air or coach still at its wheel
    if (this.player.isDriving) this.exitVehicle();

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
    // Mid-journey or while boarding/pulling out, the destination was already saved when the ticket was bought
    if (
      this.flightExperience.isActive ||
      this.roadRideExperience.isActive ||
      this.coachPullingOut !== null ||
      this.coaches.status().state === 'boarded' ||
      this.flights.status().state === 'boarded'
    ) return;

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
      weather: this.world.weather.currentWeather,
      clockMode: this.world.skyEnvironment.clockMode,
    });
  }

  private restoreWorldState(): void {
    const saved = BackendService.getInstance().getData().worldState;
    if (!saved) return;

    if (saved.clockMode === 'SIMULATED_TIME') {
      this.world.skyEnvironment.setDay(saved.day);
      this.world.skyEnvironment.setHour(saved.hour);
      this.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    } else {
      // Default to REAL_TIME (Africa/Lagos UTC+1 WAT)
      this.world.skyEnvironment.setClockMode('REAL_TIME');
    }
    if (saved.weather) {
      this.world.weather.setWeather(saved.weather as any);
      this.hud.updateWeatherButton(saved.weather);
    }

    const coachState = this.coaches.status();
    const flightState = this.flights.status();
    if (saved.inTransit || coachState.state === 'boarded' || flightState.state === 'boarded') {
      const destCity = (saved.inTransit ? saved.cityId : (coachState.to ?? flightState.to)) as CityId;
      if (destCity) {
        // The game closed during a paid journey: finish it
        this.arriveInCity(destCity);
        // A flight that was in the air has landed: its passenger is on the apron, ticket used
        if (flightState.state === 'boarded') {
          this.standOnApron(destCity);
          this.flights.arrive();
          this.saveWorldState();
        } else if (coachState.state === 'boarded') {
          // A coach that was on the road has pulled in: its passenger is in the motor park, ticket used
          this.stepDownAtPark(destCity);
        }
        return;
      }
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
      requires: () => (vehicle.driver || this.vehicleSync?.driverOf(vehicle) ? 'Someone is already driving that.' : this.ownedVehicles?.cannotDrive(vehicle) ?? null),
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
    const rawDelta = this.clock.getDelta();
    this.graphics?.watch(rawDelta);
    // Cap maximum delta to prevent excessive steps after browser tab backgrounding
    const clampedDelta = Math.min(rawDelta, 0.15);
    if (clampedDelta > 0.055) {
      // Sub-step on longer frames to maintain smooth physics, velocity integration and consistent movement speed
      const half = clampedDelta * 0.5;
      this.step(half);
      this.step(half);
    } else {
      this.step(clampedDelta);
    }
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
    if (this.qualityShowcase && this.qualityShowcase.isActive) {
      this.qualityShowcase.update(delta, this);
      this.lastStepDelta = delta;
      return;
    }

    // Update Player Movement & Walking Cycle (frozen in Photo Mode so player can pose)
    if (this.cameraManager.mode === 'photo') {
      this.player.update(delta, {});
    } else {
      this.player.update(delta, this.input.keys);
    }

    // Scripted interactions: doors, sitting, serving, eating, waving
    InteractionDirector.get().update(delta);
    // Riding in a jet or a yacht of one's own
    this.stepRide(delta);

    // Drivers on the way, riders with orders, replies to messages
    this.rides.update(delta);

    // Building work goes on by the world's clock whoever is playing: once a second, show how far it has got,
    // pay any rent that is nearly due and clear any tenancy that has run out
    const landSecond = Math.floor(performance.now() / 1000);
    if (landSecond !== this.lastLandHour) {
      this.lastLandHour = landSecond;
      this.plotWorld.refresh();
      void this.land.keepUp();
      // A vehicle someone else was driving is put where they parked it once they have stopped
      this.ownedVehicles.sync();
      this.hud.refreshNearby(this.player.position.x, this.player.position.z);
    }
    this.ownedVehicles.update();
    this.vehicleSync.update(delta);
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
    this.trackFlight();
    this.roadRideExperience.update(delta);

    // Update World (Vehicles, Traffic, NPCs, Weather, Districts) with keys & player position
    // The sound of the street around the player: crowd, traffic, horns and voices
    if (this.ambienceClock === undefined || (this.ambienceClock += delta) > 0.5) {
      this.ambienceClock = 0;
      const at = this.player.position;
      const outside = !this.world.interiorManager.isPlayerInside() && this.hud.currentNavMode !== 'map';
      StreetAmbience.get().update(0.5, {
        outside,
        // Broad Street and its pavements, or wherever there is traffic near
        onMainRoad: outside && ((this.world.cityManager.currentCityId === 'lagos' && Math.abs(at.x) < MAIN_CORRIDOR_HALF + 3) || Bodies.carsNear(at.x, at.z, 25).length >= 6),
        driving: this.player.isDriving,
        people: outside ? Bodies.peopleNear(at.x, at.z, 20).length : 0,
        cars: outside ? Bodies.carsNear(at.x, at.z, 30).length : 0,
        hour: this.world.skyEnvironment.currentHour,
      });
    }

    this.onTheExpressway();

    // Walkers step round the player, or round the vehicle the player is driving
    const avoid = this.world.cityPopulation.avoid;
    avoid.length = 0;
    const driven = this.player.isDriving ? this.player.currentVehicle : null;
    if (driven) avoid.push({ x: driven.mesh.position.x, z: driven.mesh.position.z, r: 2.4 });
    else if (!this.world.interiorManager.isPlayerInside()) avoid.push({ x: this.player.position.x, z: this.player.position.z, r: 0.35 });
    this.world.update(delta, this.input.keys, this.player.position, this.player);
    this.companyStaff?.update();
    this.tellEvents();
    this.moveConvoys(delta);
    // After the world has moved the coach: its passenger is exactly where it is
    this.rideOutOfThePark();

    // Update Player Vitals (Hunger / Energy / Health Needs Loop)
    const vitalsResult = BackendService.getInstance().updateVitals(
      delta,
      this.player.isSprinting,
      this.player.isDriving
    );
    if (vitalsResult.starvedWarning) {
      showGameToast('⚠️ Hunger is low! Stop by Mama Put or order QuickChop before you faint.', 'warning');
    }
    if (vitalsResult.bladderWarning) {
      showGameToast('🚽 You need the toilet! There is one at home, and at most places you can go into.', 'warning');
    }
    if (vitalsResult.bladderAccident) {
      showGameToast('😳 You could not hold it any longer. Hygiene ruined: go and wash.', 'error');
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

    // Update Driving HUD Speedometer & Vehicle Simulation Metrics
    if (this.player.isDriving && this.player.currentVehicle) {
      const v = this.player.currentVehicle;
      this.hud.updateDrivingHUD(
        v.currentSpeed,
        v.fuel,
        v.passengers,
        v.maxPassengers,
        v.totalFaresCollected,
        v.isCommercialTransit
      );
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
      this.renderer.render(this.flightExperience.scene, this.flightExperience.flightCamera);
    } else if (this.roadRideExperience.isActive) {
      this.renderer.render(this.scene, this.roadRideExperience.rideCamera);
    } else {
      this.renderer.render(this.scene, this.cameraManager.camera);
    }

    // Performance Diagnostics Calculation
    this.framesDrawn++;
    this.frameCount++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      this.currentFPS = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;

      const fpsEl = document.getElementById('perf-fps');
      const msEl = document.getElementById('perf-ms');
      const drawEl = document.getElementById('perf-draws');
      const speedEl = document.getElementById('perf-speed');
      if (fpsEl) fpsEl.textContent = `${this.currentFPS} FPS`;
      if (msEl) msEl.textContent = `${(delta * 1000).toFixed(1)}ms`;
      if (drawEl) drawEl.textContent = `${this.renderer.info.render.calls} draws (${(this.renderer.info.render.triangles / 1000).toFixed(0)}k tris)`;
      if (speedEl) {
        const pSpeed = this.player.isMoving
          ? `${this.player.speed.toFixed(1)}m/s [${this.player.isSprinting ? 'RUN' : 'WALK'}]`
          : '0m/s [IDLE]';
        speedEl.textContent = pSpeed;
      }
    }
  }
}
