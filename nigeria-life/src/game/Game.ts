import * as THREE from 'three';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { GameCamera } from './Camera';
import { InputManager } from './Input';
import { HUD } from '../ui/HUD';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { ChatBox } from '../ui/ChatBox';

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

  private clock: THREE.Clock;

  constructor() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera Manager
    this.cameraManager = new GameCamera();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // 4. World & Environment
    this.world = new World(this.scene);

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

    // 8. Multiplayer & Street Chat
    this.network = new NetworkManager(this.scene, this.player);
    this.chatBox = new ChatBox(this.network);
    this.network.setOnPlayerCount((count) => this.hud.updateOnlineCount(count));

    // 9. Clock for delta-timed updates
    this.clock = new THREE.Clock();

    // 10. Window Resizing
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 11. Start Loop
    this.loop();
  }

  private onWindowResize(): void {
    this.cameraManager.handleResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update Player Movement & Walking Cycle
    this.player.update(delta);

    // Update Camera Follow
    this.cameraManager.update(this.player, delta);

    // Update World (Traffic, NPCs, Animations)
    this.world.update(delta);

    // Update Multiplayer networking & remote players
    this.network.update(delta);

    // Update Input cursor animations
    this.input.update(delta);

    // Render Scene
    this.renderer.render(this.scene, this.cameraManager.camera);
  };
}
