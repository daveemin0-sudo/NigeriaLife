import * as THREE from 'three';
import { HumanMeshBuilder, type HumanRig } from '../graphics/HumanMeshBuilder';
import { DrivableVehicle } from './DrivableVehicle';
import type { Game } from '../game/Game';

export interface ShowcaseCharacter {
  name: string;
  role: string;
  rig: HumanRig;
  platform: THREE.Group;
  defaultAnim: string;
}

export interface ShowcaseVehicle {
  name: string;
  type: string;
  vehicle: DrivableVehicle;
  platform: THREE.Group;
}

/**
 * Character & Vehicle Quality Test Scene (Milestone A Acceptance Gate)
 * An interactive studio exhibition featuring 7 diverse Nigerian human characters
 * in authentic attire with 8-head anatomical proportions, sculpted facial features,
 * 5-finger hands, articulated joints, and 5 detailed Nigerian vehicles.
 */
export class CharacterQualityTestScene {
  public group: THREE.Group;
  public isActive: boolean = false;

  private characters: ShowcaseCharacter[] = [];
  private vehicles: ShowcaseVehicle[] = [];
  private lightsGroup: THREE.Group;
  private animTime: number = 0;
  private currentAnimState: string = 'dance';
  private orbitAngle: number = 0;
  private autoRotate: boolean = false;
  private targetFocus: THREE.Vector3 = new THREE.Vector3(0, 1.2, 0);

  private uiContainer: HTMLElement | null = null;
  private prevCameraPos = new THREE.Vector3();
  private prevCameraQuat = new THREE.Quaternion();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'QualityShowcaseScene';
    this.group.visible = false;

    this.lightsGroup = new THREE.Group();
    this.group.add(this.lightsGroup);

    this.setupStudioLighting();
    this.buildShowcaseFloor();
    this.spawnShowcaseCharacters();
    this.spawnShowcaseVehicles();
  }

  private setupStudioLighting(): void {
    // 3-Point Studio Lighting Setup
    const ambient = new THREE.AmbientLight(0xffffff, 0.95);
    this.lightsGroup.add(ambient);

    // Warm Key Light (Golden Nigerian Sun accent)
    const keyLight = new THREE.DirectionalLight(0xfffaed, 2.4);
    keyLight.position.set(12, 18, 14);
    keyLight.castShadow = true;
    this.lightsGroup.add(keyLight);

    // Cool Sky Fill Light
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.3);
    fillLight.position.set(-14, 12, -10);
    this.lightsGroup.add(fillLight);

    // Rim / Backlight for crisp character silhouettes
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.6);
    rimLight.position.set(0, 16, -18);
    this.lightsGroup.add(rimLight);
  }

  private buildShowcaseFloor(): void {
    // High-gloss dark studio showroom floor with subtle circular platform
    const floorGeo = new THREE.CylinderGeometry(28, 28, 0.4, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.22,
      metalness: 0.65,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Concentric glowing blue showroom trim rings
    const ringGeo = new THREE.TorusGeometry(26, 0.08, 8, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.group.add(ring);
  }

  private spawnShowcaseCharacters(): void {
    const configs = [
      {
        name: 'Chief Adebayo',
        role: 'Traditional Royal Agbada & Fila',
        gender: 'male' as const,
        skinTone: '#26140b', // Deep ebony
        outfit: 'agbada' as const,
        outfitColor: 0x047857, // Emerald Green
        hairstyle: 'fila' as const,
        anim: 'dance',
      },
      {
        name: 'Aunty Nkechi',
        role: 'Owambe Ankara Silk Dress & Gele',
        gender: 'female' as const,
        skinTone: '#5c3722', // Warm chestnut
        outfit: 'blue_dress' as const,
        outfitColor: 0x1d4ed8, // Royal Blue
        secondaryColor: 0xf59e0b, // Amber Gold Gele
        hairstyle: 'gele' as const,
        anim: 'dance',
      },
      {
        name: 'Engr. Babatunde',
        role: 'Civil Engineer Safety Vest & Hardhat',
        gender: 'male' as const,
        skinTone: '#4a2c1d', // Mahogany
        outfit: 'engineer_vest' as const,
        outfitColor: 0xf97316,
        hairstyle: 'hardhat' as const,
        anim: 'talk',
      },
      {
        name: 'Dr. Amina',
        role: 'Medical Officer White Coat & Scrubs',
        gender: 'female' as const,
        skinTone: '#7c4b2e', // Caramel
        outfit: 'doctor_coat' as const,
        outfitColor: 0xf8fafc,
        secondaryColor: 0x0284c7,
        hasStethoscope: true,
        hairstyle: 'braids' as const,
        anim: 'idle',
      },
      {
        name: 'Capt. Emeka',
        role: 'Airline Captain 4-Bar Pilot Blazer',
        gender: 'male' as const,
        skinTone: '#3b2014',
        outfit: 'pilot_uniform' as const,
        outfitColor: 0x0f172a,
        hairstyle: 'pilot_cap' as const,
        anim: 'phone_call',
      },
      {
        name: 'Senator Farouk',
        role: 'Corporate Leader Senator Tunic',
        gender: 'male' as const,
        skinTone: '#6b3e24',
        outfit: 'senator' as const,
        outfitColor: 0x1e3a8a, // Navy Senator
        hairstyle: 'fade' as const,
        anim: 'talk',
      },
      {
        name: 'Kafayat',
        role: 'University Student & Backpack',
        gender: 'female' as const,
        skinTone: '#965c38',
        outfit: 'casual_blouse' as const,
        outfitColor: 0xdc2626,
        hasBackpack: true,
        hairstyle: 'bob_wig' as const,
        anim: 'walk',
      },
    ];

    const spacing = 3.2;
    const startX = -((configs.length - 1) * spacing) / 2;

    configs.forEach((cfg, idx) => {
      const platform = new THREE.Group();
      platform.position.set(startX + idx * spacing, 0, -3.5);

      // Elevated polished marble plinth
      const plinthGeo = new THREE.CylinderGeometry(1.15, 1.25, 0.25, 24);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.3,
      });
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.y = 0.125;
      plinth.receiveShadow = true;
      platform.add(plinth);

      // Gold plinth ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.025, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.25 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.25;
      platform.add(ring);

      // Human Rig
      const rig = HumanMeshBuilder.createHuman({
        gender: cfg.gender,
        username: cfg.name,
        skinTone: cfg.skinTone,
        outfit: cfg.outfit,
        outfitColor: cfg.outfitColor,
        secondaryColor: cfg.secondaryColor,
        hasStethoscope: cfg.hasStethoscope,
        hasBackpack: cfg.hasBackpack,
        hairstyle: cfg.hairstyle,
      });
      rig.group.position.y = 0.25; // Stand on top of plinth
      platform.add(rig.group);

      this.group.add(platform);
      this.characters.push({
        name: cfg.name,
        role: cfg.role,
        rig,
        platform,
        defaultAnim: cfg.anim,
      });
    });
  }

  private spawnShowcaseVehicles(): void {
    const vConfigs = [
      {
        id: 'showcase-danfo',
        name: 'Lagos Danfo Minibus',
        type: 'danfo' as const,
        pos: new THREE.Vector3(-12.5, 0, 1.2),
        rotY: 0.40,
      },
      {
        id: 'showcase-keke',
        name: 'Lagos Keke Napep Tricycle',
        type: 'keke' as const,
        pos: new THREE.Vector3(-8.2, 0, 4.8),
        rotY: 0.30,
      },
      {
        id: 'showcase-suv',
        name: 'Executive Black SUV (V8 Prado)',
        type: 'suv' as const,
        pos: new THREE.Vector3(8.2, 0, 4.8),
        rotY: -0.30,
      },
      {
        id: 'showcase-okada',
        name: 'QuickChop Delivery Okada',
        type: 'okada' as const,
        pos: new THREE.Vector3(12.5, 0, 1.2),
        rotY: -0.40,
      },
    ];

    for (const vc of vConfigs) {
      const platform = new THREE.Group();
      platform.position.copy(vc.pos);

      // Turntable pad
      const padGeo = new THREE.CylinderGeometry(vc.type === 'okada' ? 1.6 : 3.2, vc.type === 'okada' ? 1.7 : 3.3, 0.12, 32);
      const pad = new THREE.Mesh(
        padGeo,
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45, metalness: 0.4 })
      );
      pad.position.y = 0.06;
      platform.add(pad);

      const veh = new DrivableVehicle(
        {
          id: vc.id,
          name: vc.name,
          type: vc.type,
          maxSpeed: 20,
          reverseSpeed: 8,
          acceleration: 15,
          braking: 15,
          turnSpeed: 2.5,
          friction: 2,
          hornText: 'PEEP!',
        },
        new THREE.Vector3(0, 0.06, 0),
        vc.rotY
      );
      platform.add(veh.mesh);

      this.group.add(platform);
      this.vehicles.push({
        name: vc.name,
        type: vc.type,
        vehicle: veh,
        platform,
      });
    }
  }

  public open(game: Game): void {
    if (this.isActive) return;
    this.isActive = true;
    this.group.visible = true;

    // Save camera state
    this.prevCameraPos.copy(game.cameraManager.camera.position);
    this.prevCameraQuat.copy(game.cameraManager.camera.quaternion);

    // Frame camera on showcase center
    this.targetFocus.set(0, 1.3, 0);
    game.cameraManager.camera.position.set(0, 3.2, 10.5);
    game.cameraManager.camera.lookAt(this.targetFocus);

    // Hide normal street crowd and road traffic while in showcase
    game.world.setStreetModeVisibility(false);
    if (game.world.npcs) game.world.npcs.group.visible = false;
    if (game.world.vehicles) game.world.vehicles.group.visible = false;
    if (game.player) game.player.mesh.visible = false;

    this.createUI(game);
  }

  public close(game: Game): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.group.visible = false;

    // Restore camera
    game.cameraManager.camera.position.copy(this.prevCameraPos);
    game.cameraManager.camera.quaternion.copy(this.prevCameraQuat);

    // Restore street entities
    game.world.setStreetModeVisibility(true);
    if (game.world.npcs) game.world.npcs.group.visible = true;
    if (game.world.vehicles) game.world.vehicles.group.visible = true;
    if (game.player) game.player.mesh.visible = true;

    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
      this.uiContainer = null;
    }
  }

  public toggle(game: Game): void {
    if (this.isActive) {
      this.close(game);
    } else {
      this.open(game);
    }
  }

  public update(delta: number, game: Game): void {
    if (!this.isActive) return;

    this.animTime += delta;

    // Animate all showcase character rigs
    for (const c of this.characters) {
      const animToPlay = this.currentAnimState === 'cycle' ? c.defaultAnim : this.currentAnimState;
      c.rig.updateAnimation(this.animTime, animToPlay);
    }

    // Auto turntable orbit
    if (this.autoRotate) {
      this.orbitAngle += delta * 0.45;
      const cam = game.cameraManager.camera;
      const radius = 9.5;
      cam.position.x = this.targetFocus.x + Math.sin(this.orbitAngle) * radius;
      cam.position.z = this.targetFocus.z + Math.cos(this.orbitAngle) * radius;
      cam.position.y = this.targetFocus.y + 1.8;
      cam.lookAt(this.targetFocus);
    }
  }

  private setCameraView(game: Game, view: 'overview' | 'closeup' | 'front' | 'side' | 'back' | 'danfo' | 'keke' | 'suv' | 'okada'): void {
    const cam = game.cameraManager.camera;
    this.autoRotate = false;

    switch (view) {
      case 'closeup': // Close-up facial features & headwear
        this.targetFocus.set(0, 1.85, -3.5);
        cam.position.set(0, 1.85, -1.8);
        cam.lookAt(this.targetFocus);
        break;
      case 'front': // Front full silhouette
        this.targetFocus.set(0, 1.2, -3.5);
        cam.position.set(0, 1.4, 1.5);
        cam.lookAt(this.targetFocus);
        break;
      case 'side': // Side profile & joint articulation
        this.targetFocus.set(0, 1.2, -3.5);
        cam.position.set(-6.5, 1.4, -3.5);
        cam.lookAt(this.targetFocus);
        break;
      case 'back': // Back hair & clothing folds
        this.targetFocus.set(0, 1.2, -3.5);
        cam.position.set(0, 1.4, -8.5);
        cam.lookAt(this.targetFocus);
        break;
      case 'danfo': // Focus on Danfo minibus (front 3/4 beauty angle)
        this.targetFocus.set(-12.5, 1.4, 1.2);
        cam.position.set(-9.2, 2.1, 6.2);
        cam.lookAt(this.targetFocus);
        break;
      case 'keke': // Focus on Keke Napep (front 3/4 beauty angle)
        this.targetFocus.set(-8.2, 1.1, 4.8);
        cam.position.set(-5.6, 1.7, 8.8);
        cam.lookAt(this.targetFocus);
        break;
      case 'suv': // Focus on Executive Black SUV (front 3/4 beauty angle)
        this.targetFocus.set(8.2, 1.3, 4.8);
        cam.position.set(10.8, 2.0, 9.4);
        cam.lookAt(this.targetFocus);
        break;
      case 'okada': // Focus on Delivery Okada
        this.targetFocus.set(12.5, 0.9, 1.2);
        cam.position.set(9.8, 1.5, 5.0);
        cam.lookAt(this.targetFocus);
        break;
      case 'overview':
      default:
        this.targetFocus.set(0, 1.2, 0);
        cam.position.set(0, 4.5, 12.5);
        cam.lookAt(this.targetFocus);
        break;
    }
  }

  private createUI(game: Game): void {
    if (this.uiContainer) return;

    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'quality-showcase-ui';
    this.uiContainer.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.4);
        border-radius: 16px;
        padding: 14px 24px;
        color: #f8fafc;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 32px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">💎</span>
            <div>
              <div style="font-weight: 800; font-size: 16px; color: #38bdf8; letter-spacing: 0.5px;">NIGERIALIFE QUALITY GATE SHOWCASE</div>
              <div style="font-size: 12px; color: #94a3b8;">Stylized Realism • 8-Head Anatomy • 5-Finger Hands • Articulated Joints • Authentic Nigerian Vehicles</div>
            </div>
          </div>
          <button id="showcase-btn-close" style="
            background: #ef4444;
            color: #ffffff;
            border: 0;
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
          ">Exit Showcase [Esc]</button>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px;">
          <span style="font-size: 12px; color: #cbd5e1; align-self: center; font-weight: 600; margin-right: 4px;">Camera:</span>
          <button class="sc-cam-btn" data-view="overview" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Overview</button>
          <button class="sc-cam-btn" data-view="closeup" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Facial Close-Up</button>
          <button class="sc-cam-btn" data-view="front" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Front Silhouette</button>
          <button class="sc-cam-btn" data-view="side" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Side Joint Articulation</button>
          <button class="sc-cam-btn" data-view="back" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Back / Hair Profile</button>
          <button class="sc-cam-btn" data-view="danfo" style="background:#854d0e; color:#fef08a; border:1px solid #eab308; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Danfo Minibus</button>
          <button class="sc-cam-btn" data-view="keke" style="background:#854d0e; color:#fef08a; border:1px solid #eab308; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Keke Napep</button>
          <button class="sc-cam-btn" data-view="suv" style="background:#0f172a; color:#38bdf8; border:1px solid #0284c7; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Black SUV</button>
          <button class="sc-cam-btn" data-view="okada" style="background:#991b1b; color:#fecaca; border:1px solid #ef4444; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">Delivery Okada</button>
          <button id="sc-btn-turntable" style="background:#0284c7; color:#fff; border:0; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px;">🔄 Auto Turntable</button>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
          <span style="font-size: 12px; color: #cbd5e1; align-self: center; font-weight: 600; margin-right: 4px;">Animations:</span>
          <button class="sc-anim-btn" data-anim="dance" style="background:#059669; color:#fff; border:0; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Afrobeats Dance</button>
          <button class="sc-anim-btn" data-anim="walk" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Walk (Double Knee Flexion)</button>
          <button class="sc-anim-btn" data-anim="run" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Sprint Run</button>
          <button class="sc-anim-btn" data-anim="phone_call" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Phone Call (Elbow Flexion)</button>
          <button class="sc-anim-btn" data-anim="talk" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Conversational Gestures</button>
          <button class="sc-anim-btn" data-anim="idle" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Idle Breathing</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.uiContainer);

    // Event listeners
    document.getElementById('showcase-btn-close')?.addEventListener('click', () => {
      this.close(game);
    });

    this.uiContainer.querySelectorAll('.sc-cam-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const view = (e.currentTarget as HTMLElement).dataset.view as any;
        this.setCameraView(game, view);
      });
    });

    this.uiContainer.querySelectorAll('.sc-anim-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const anim = (e.currentTarget as HTMLElement).dataset.anim as string;
        this.currentAnimState = anim;
        this.uiContainer?.querySelectorAll('.sc-anim-btn').forEach((b) => {
          (b as HTMLElement).style.background = '#1e293b';
        });
        (e.currentTarget as HTMLElement).style.background = '#059669';
      });
    });

    document.getElementById('sc-btn-turntable')?.addEventListener('click', () => {
      this.autoRotate = !this.autoRotate;
      const btn = document.getElementById('sc-btn-turntable');
      if (btn) {
        btn.style.background = this.autoRotate ? '#10b981' : '#0284c7';
      }
    });
  }
}
