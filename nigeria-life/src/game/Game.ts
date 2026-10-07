import * as THREE from 'three';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { GameCamera } from './Camera';
import { InputManager } from './Input';
import { HUD } from '../ui/HUD';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { ChatBox } from '../ui/ChatBox';
import { PostProcessingManager } from '../graphics/PostProcessingManager';

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

  private clock: THREE.Clock;

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

    // 5. Player Character
    this.player = new Player();
    this.scene.add(this.player.mesh);

    // 6. UI / HUD
    this.hud = new HUD();
    this.hud.init(this.player, this.world);

    // 7. Input & Cursor Interaction
    this.input = new InputManager(
      this.cameraManager.camera,
      this.scene,
      this.player,
      this.world,
      this.hud
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

    // 9b. Inter-State Flights & Cross-Country Travel (Lagos <-> Abuja FCT)
    this.hud.interstateModal.onInterStateTravelCompleted = (destId) => {
      this.world.cityManager.switchCity(
        destId,
        this.player,
        (newObjs) => {
          this.world.interactiveObjects = newObjs;
        }
      );
    };

    // 9c. Camera Navigation Modes (Home Flat | Street Walk | Aerial World Map)
    this.hud.onNavigateMode = (mode: 'street' | 'home' | 'map') => {
      this.cameraManager.setMode(mode);
      if (mode === 'home') {
        this.player.mesh.position.set(0, 0, 184);
      } else if (mode === 'street') {
        if (this.player.mesh.position.z > 160) {
          this.player.mesh.position.set(0, 0, 5);
        }
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
  }

  private exitVehicle(): void {
    if (this.player.isDriving && this.player.currentVehicle) {
      const exitPos = this.player.currentVehicle.exit();
      this.player.mesh.position.copy(exitPos);
      this.player.mesh.visible = true;
      this.player.isDriving = false;
      this.player.currentVehicle = null;
      this.hud.hideDrivingHUD();
    }
  }

  private onWindowResize(): void {
    this.cameraManager.handleResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcessing.setSize(window.innerWidth, window.innerHeight);
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update Player Movement & Walking Cycle
    this.player.update(delta, this.input.keys);

    // Update Camera Follow
    this.cameraManager.update(this.player, delta);

    // Update World (Vehicles, Traffic, NPCs, Weather, Districts) with keys & player position
    this.world.update(delta, this.input.keys, this.player.position);

    // Dynamic District Location Tracker in HUD
    const district = this.world.getDistrictAtPosition(this.player.position);
    this.hud.updateLocation(district.name, district.sub);

    // Update Driving HUD Speedometer
    if (this.player.isDriving && this.player.currentVehicle) {
      this.hud.updateDrivingHUD(this.player.currentVehicle.currentSpeed);
    }

    // Update Multiplayer networking & remote players
    this.network.update(delta);

    // Update Input cursor animations
    this.input.update(delta);

    // Render Scene through Post-Processing Pipeline (with animated heat-haze delta)
    this.postProcessing.render(this.scene, this.cameraManager.camera, delta);
  };
}
