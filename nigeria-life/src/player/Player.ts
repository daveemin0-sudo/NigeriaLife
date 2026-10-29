import * as THREE from 'three';
import {
  type CharacterConfig,
  CharacterStorage,
  type EmoteType,
} from './CharacterCustomization';
import { createHumanForConfig } from './HumanFromConfig';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import type { GameCamera } from '../game/Camera';
import type { HumanRig } from '../graphics/HumanMeshBuilder';
import { AssetManager } from '../assets/AssetManager';
import { SoundEngine } from '../audio/SoundEngine';
import { bridgeNear } from '../world/density/StreetLayout';
import type { Solids } from '../world/plan/Solids';
import { Bodies, outOfCar, outOfPerson, waysRoundCar } from '../world/Bodies';
import type { Way } from '../world/plan/Wayfinder';
import { BackendService } from '../backend/BackendService';
import { Actor } from '../interactions/Actor';
import { InteractionDirector } from '../interactions/InteractionDirector';
import { holdCarriedItem } from '../interactions/Poses';

export class Player {
  public mesh: THREE.Group;
  public targetPosition: THREE.Vector3 | null = null;
  public walkSpeed: number = 5.6;
  public sprintSpeed: number = 9.8;
  public speed: number = 5.6;
  private currentVelocity: THREE.Vector3 = new THREE.Vector3();
  public isMoving: boolean = false;
  public isSprinting: boolean = false;
  public currentEmote: EmoteType = 'idle';
  public emoteTimer: number = 0;
  public isDriving: boolean = false;
  public currentVehicle: any = null;
  public cameraManager: GameCamera | null = null;

  // Configuration
  public config: CharacterConfig;

  // Human anatomical procedural rig
  public humanRig!: HumanRig;

  // Skinned GLTF Model & AnimationMixer
  public glbModel: THREE.Group | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public actions: Map<string, THREE.AnimationAction> = new Map();
  public currentAction: THREE.AnimationAction | null = null;

  // Animation state
  private animTime: number = 0;

  /** Lets scripted interactions (doors, sitting, eating, waving) direct the player's body */
  public actor: Actor;

  constructor() {
    this.mesh = new THREE.Group();
    // Start on the east pavement of Broad Street, looking across the street: not in the road among the traffic
    this.mesh.position.set(10, 0, -10);
    this.mesh.rotation.y = -Math.PI / 2;

    // Load saved or default character configuration
    this.config = CharacterStorage.load();

    this.buildHumanMesh();

    this.actor = new Actor({
      id: 'player',
      name: this.config.name || 'You',
      root: this.mesh,
      // The built-in body can be animated by hand; a loaded character model cannot (yet)
      getRig: () => (this.glbModel ? null : this.humanRig),
      speed: 4.2,
    });
    InteractionDirector.get().player = InteractionDirector.get().register(this.actor);

    // Assign to dedicated PLAYER layer so player is visible in both street and interior
    this.mesh.traverse((child) => {
      child.layers.set(RENDER_LAYERS.PLAYER);
    });
  }

  public get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  private buildHumanMesh(): void {
    if (this.humanRig) {
      this.mesh.remove(this.humanRig.group);
    }
    if (this.glbModel) {
      this.mesh.remove(this.glbModel);
      this.glbModel = null;
      this.mixer = null;
      this.actions.clear();
      this.currentAction = null;
    }

    // 1. Procedural Anatomical Model (Zero-latency instant render)
    this.humanRig = createHumanForConfig(this.config);

    this.mesh.add(this.humanRig.group);

    // 2. Asynchronous GLB Humanoid Rig (if available in public/models/characters/)
    const glbPath = `/models/characters/human_${this.config.gender || 'male'}.glb`;
    AssetManager.getInstance().instantiate(glbPath).then((gltfScene: THREE.Group | null) => {
      if (gltfScene) {
        this.mesh.remove(this.humanRig.group);
        this.glbModel = gltfScene;
        this.mesh.add(gltfScene);

        // Setup AnimationMixer
        if (gltfScene.userData.animations && gltfScene.userData.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(gltfScene);
          for (const clip of gltfScene.userData.animations) {
            const action = this.mixer.clipAction(clip);
            this.actions.set(clip.name.toLowerCase(), action);
          }
          this.playAnimation('idle');
        }

        this.mesh.traverse((child) => {
          child.layers.set(RENDER_LAYERS.PLAYER);
        });
      }
    });

    this.mesh.traverse((child) => {
      child.layers.set(RENDER_LAYERS.PLAYER);
    });
  }

  public playAnimation(clipName: string, fadeDuration: number = 0.25): void {
    if (!this.mixer) return;
    const target = this.actions.get(clipName.toLowerCase()) || this.actions.get('idle');
    if (target && target !== this.currentAction) {
      if (this.currentAction) {
        this.currentAction.fadeOut(fadeDuration);
      }
      target.reset().fadeIn(fadeDuration).play();
      this.currentAction = target;
    }
  }

  /**
   * Sets the player walking to a point. In the street they go by the way a person would: round
   * buildings, through gates, along the pavement. `onArrive` runs once if they get there, and
   * not at all if they are stopped or sent somewhere else first.
   */
  public setDestination(target: THREE.Vector3, onArrive?: () => void): void {
    this.nearest = Infinity;
    this.sinceNearer = 0;
    this.blockedFor = 0;
    this.roundIt = null;
    this.way = [];
    this.goal = target.clone();
    this.arrived = onArrive ?? null;
    let first = target;
    // The footbridge is climbed by walking straight at its stairs: it is not ground the way-finder knows
    const here = this.mesh.position;
    if (!this.onBridge && !this.onTheFootbridge(target.x, target.z) && !this.onTheFootbridge(here.x, here.z)) {
      const way = this.wayfinder?.(here.x, here.z, target.x, target.z);
      if (way && way.points.length > 0) {
        const points = way.points.map((point) => new THREE.Vector3(point.x, target.y, point.z));
        first = points[0];
        this.way = points.slice(1);
        this.goal = points[points.length - 1].clone();
      }
    }
    this.targetPosition = first.clone();
    this.isMoving = true;
    this.currentEmote = 'walk';
  }

  /** Is this spot under or on the footbridge: its deck or one of its flights of stairs? */
  private onTheFootbridge(x: number, z: number): boolean {
    const fb = bridgeNear(z);
    if (this.footbridge && !this.footbridge()) return false;
    const onDeck = Math.abs(x) <= fb.shape.halfSpan && Math.abs(z - fb.z) <= fb.shape.halfWidth;
    const onStairs = Math.abs(Math.abs(x) - fb.shape.stairX) <= fb.shape.stairHalfWidth + 0.15 && z >= fb.bottom - 0.4 && z <= fb.top;
    return onDeck || onStairs;
  }

  /** The walk is over. If it ended where it was going, whoever sent the player there is told. */
  private endWalk(): void {
    const then = this.arrived;
    const goal = this.goal;
    this.stopMoving();
    this.playAnimation('idle');
    if (then && goal && Math.hypot(goal.x - this.mesh.position.x, goal.z - this.mesh.position.z) < 2.8) then();
  }

  /**
   * After a step: someone up on the footbridge is held by its rails, and nobody on the street
   * walks into the side of a flight of stairs and finds themselves half-way up it.
   */
  private stayOnTheWay(cameFrom: THREE.Vector3): void {
    const fb = bridgeNear(this.mesh.position.z);
    if (this.onBridge) {
      this.keepOnBridge();
      return;
    }
    const p = this.mesh.position;
    const solids = this.solids?.();
    if (this.footbridge && !this.footbridge()) {
      if (!solids) return;
      const step = solids.step(cameFrom.x, cameFrom.z, p.x, p.z, 0.35);
      p.x = step.x;
      p.z = step.z;
      this.keepClearOfBodies(cameFrom, solids);
      return;
    }
    const inLine = (x: number) => Math.abs(Math.abs(x) - fb.shape.stairX) <= fb.shape.stairHalfWidth + 0.15;
    const inFlight = (x: number, z: number) => inLine(x) && z >= fb.bottom + 1.2 && z <= fb.top;
    const fromItsFoot = inLine(cameFrom.x) && cameFrom.z >= fb.bottom - 0.4 && cameFrom.z <= fb.top;
    // The foot of the stairs is the way on. Anywhere else, the flight is a block of concrete to walk round.
    if (inFlight(p.x, p.z) && !fromItsFoot) {
      p.x = cameFrom.x;
      p.z = cameFrom.z;
      return;
    }
    // On a flight the stairs' own rule governs. Everywhere else, buildings and walls are solid.
    if (inLine(p.x) && p.z >= fb.bottom - 0.4 && p.z <= fb.top) return;
    if (solids) {
      const step = solids.step(cameFrom.x, cameFrom.z, p.x, p.z, 0.35);
      p.x = step.x;
      p.z = step.z;
    }
    if (solids) this.keepClearOfBodies(cameFrom, solids);
  }

  /**
   * A parked car across the way: the walk goes round its corners, on whichever side is shorter
   * and clear of walls, then on to where it was going.
   */
  private walkRoundParkedCars(): void {
    const target = this.targetPosition;
    // Already on the way round one: no second way round until that one is walked
    if (!target || this.detourPoints.has(target)) return;
    const p = this.mesh.position;
    const solids = this.solids?.();
    /** The whole way, corner to corner, clear of walls and anything that juts out */
    const clear = (points: Array<{ x: number; z: number }>) => {
      let from = { x: p.x, z: p.z };
      for (const to of [...points, { x: target.x, z: target.z }]) {
        const length = Math.hypot(to.x - from.x, to.z - from.z);
        for (let d = 0.3; d < length; d += 0.3) {
          const t = d / length;
          if (solids?.at(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, 0.25)) return false;
        }
        from = to;
      }
      return true;
    };
    for (const car of Bodies.carsNear(p.x, p.z, 7)) {
      if (!car.parked) continue;
      // A point on the way that is right against this car is passed by: on to the one after it
      const c = Math.cos(car.yaw);
      const sn = Math.sin(car.yaw);
      const against = (x: number, z: number) => Math.abs((x - car.x) * c - (z - car.z) * sn) < car.halfWidth + 0.5 && Math.abs((x - car.x) * sn + (z - car.z) * c) < car.halfLength + 0.5;
      if (against(target.x, target.z) && this.way.length > 0) {
        this.targetPosition = this.way.shift()!;
        return;
      }
      const way = waysRoundCar(p.x, p.z, target.x, target.z, car, 0.6).find(clear);
      if (!way) continue;
      this.way.unshift(target.clone());
      for (let i = way.length - 1; i >= 1; i--) {
        const corner = new THREE.Vector3(way[i].x, target.y, way[i].z);
        this.detourPoints.add(corner);
        this.way.unshift(corner);
      }
      this.targetPosition = new THREE.Vector3(way[0].x, target.y, way[0].z);
      this.detourPoints.add(this.targetPosition);
      this.nearest = Infinity;
      this.sinceNearer = 0;
      return;
    }
  }

  /** Corners of a way round a parked car that the walk is on */
  private detourPoints = new WeakSet<THREE.Vector3>();

  /**
   * People and vehicles take up room: the player is moved out of anyone or anything they walk
   * into, round the side, and if that would put them in a wall they stay where they were.
   */
  /** A step the city does not allow on foot (onto an expressway away from its crossings): set by the game */
  public mayNotStep: ((fromX: number, fromZ: number, toX: number, toZ: number) => boolean) | null = null;

  private keepClearOfBodies(cameFrom: THREE.Vector3, solids: Solids): void {
    const p = this.mesh.position;
    if (this.mayNotStep?.(cameFrom.x, cameFrom.z, p.x, p.z)) {
      p.x = cameFrom.x;
      p.z = cameFrom.z;
      return;
    }
    const radius = 0.3;
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (const car of Bodies.carsNear(p.x, p.z, 7)) {
        const out = outOfCar(p.x, p.z, radius, car);
        if (out) {
          p.x = out.x;
          p.z = out.z;
          moved = true;
        }
      }
      for (const person of Bodies.peopleNear(p.x, p.z, 1.5)) {
        const out = outOfPerson(p.x, p.z, radius, person);
        if (out) {
          p.x = out.x;
          p.z = out.z;
          moved = true;
        }
      }
      if (!moved) break;
    }
    if (solids.at(p.x, p.z, 0.3) && !solids.at(cameFrom.x, cameFrom.z, 0.3)) {
      p.x = cameFrom.x;
      p.z = cameFrom.z;
    }
  }

  public stopMoving(): void {
    this.way = [];
    this.goal = null;
    this.arrived = null;
    this.targetPosition = null;
    this.isMoving = false;
    this.currentEmote = 'idle';
  }

  public applyCustomization(newConfig: CharacterConfig): void {
    this.config = { ...newConfig };
    CharacterStorage.save(this.config);
    this.buildHumanMesh();
  }

  public playEmote(emote: EmoteType, durationSeconds: number = 3.5): void {
    this.currentEmote = emote;
    this.emoteTimer = durationSeconds;
    this.isMoving = false;
    this.playAnimation(emote);
  }

  public stopEmote(): void {
    this.emoteTimer = 0;
    this.isMoving = false;
    this.currentEmote = 'idle';
    this.playAnimation('idle');
  }

  public update(delta: number, keys?: Record<string, boolean>): void {
    this.updateBody(delta, keys);
    // Something in the hands (a shop basket) stays held while walking about freely
    if (!this.actor.scripted && this.actor.carried && this.humanRig && !this.glbModel) {
      holdCarriedItem(this.humanRig);
    }
  }

  private updateBody(delta: number, keys?: Record<string, boolean>): void {
    // Tick GLB skeletal animation mixer if present
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // A scripted interaction is moving and animating the player: input waits until it ends
    if (this.actor.scripted) {
      this.way = [];
      this.arrived = null;
      this.targetPosition = null;
      this.isMoving = false;
      this.isSprinting = false;
      return;
    }

    if (this.isDriving && this.currentVehicle) {
      this.mesh.position.copy(this.currentVehicle.mesh.position);
      this.mesh.rotation.y = this.currentVehicle.mesh.rotation.y;
      return;
    }

    // 0. Sprint state via Shift key (depleted if energy < 5)
    const backend = BackendService.getInstance();
    const stats = backend.getData().stats;
    const isShift = keys && (keys['shift'] || keys['shiftleft'] || keys['shiftright']);
    this.isSprinting = !!isShift && stats.energy >= 5;
    let currentBaseSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    if (stats.hunger <= 0) {
      currentBaseSpeed *= 0.72; // Starvation fatigue
    }
    this.speed = currentBaseSpeed;

    // 1. Keyboard Walking & Running Controls (WASD / Arrow Keys)
    const hasMoveKey =
      keys &&
      (keys['w'] ||
        keys['s'] ||
        keys['a'] ||
        keys['d'] ||
        keys['arrowup'] ||
        keys['arrowdown'] ||
        keys['arrowleft'] ||
        keys['arrowright']);

    if (hasMoveKey && !this.isDriving) {
      this.way = [];
      this.arrived = null;
      this.targetPosition = null;
      let moveX = 0;
      let moveZ = 0;
      if (keys['w'] || keys['arrowup']) moveZ -= 1;
      if (keys['s'] || keys['arrowdown']) moveZ += 1;
      if (keys['a'] || keys['arrowleft']) moveX -= 1;
      if (keys['d'] || keys['arrowright']) moveX += 1;

      if (moveX !== 0 || moveZ !== 0) {
        let moveDir: THREE.Vector3;
        if (this.cameraManager) {
          const yaw = this.cameraManager.getActiveYaw();
          const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
          const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          moveDir = new THREE.Vector3()
            .addScaledVector(right, moveX)
            .addScaledVector(forward, -moveZ)
            .normalize();
        } else {
          moveDir = new THREE.Vector3(moveX, 0, moveZ).normalize();
        }

        const targetAngle = Math.atan2(moveDir.x, moveDir.z);
        const diffAngle = Math.atan2(Math.sin(targetAngle - this.mesh.rotation.y), Math.cos(targetAngle - this.mesh.rotation.y));
        this.mesh.rotation.y += diffAngle * Math.min(1, delta * 18.0);
        const cameFrom = this.mesh.position.clone();
        const targetVel = moveDir.clone().multiplyScalar(this.speed);
        this.currentVelocity.lerp(targetVel, Math.min(1, delta * 24.0));
        this.mesh.position.addScaledVector(this.currentVelocity, delta);
        this.stayOnTheWay(cameFrom);
        this.isMoving = true;
        const moveAction = this.isSprinting ? 'run' : 'walk';
        this.currentEmote = moveAction as EmoteType;
        this.playAnimation(moveAction);
        SoundEngine.getInstance().playFootstep(this.isSprinting);

        // Physically traverse pedestrian bridge, stairs, and terrain elevation
        const targetY = this.calculateWalkableHeight(this.mesh.position.x, this.mesh.position.z);
        this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, Math.min(1, delta * 14));

        const currentMoveSpeed = Math.hypot(this.currentVelocity.x, this.currentVelocity.z);
        this.animTime += delta * Math.max(0.65, (currentMoveSpeed / this.walkSpeed) * 1.15);
        if (this.humanRig) {
          this.humanRig.updateAnimation(this.animTime, moveAction);
        }
        return;
      }
    }

    // 2. Moving state (Point and Click)
    if (this.targetPosition && this.isMoving) {
      const currentPos = this.mesh.position;
      // A point on the way is passed, not stopped at: on to the next as soon as this one is underfoot
      while (this.way.length > 0 && Math.hypot(this.targetPosition.x - currentPos.x, this.targetPosition.z - currentPos.z) <= 0.45) {
        this.targetPosition = this.way.shift()!;
        this.nearest = Infinity;
        this.sinceNearer = 0;
      }
      const direction = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
      direction.y = 0;
      const distance = direction.length();

      const arriveTolerance = 0.15;
      if (distance <= arriveTolerance) {
        this.mesh.position.x = this.targetPosition.x;
        this.mesh.position.z = this.targetPosition.z;
        this.endWalk();
      } else {
        // Rotate smoothly
        const targetAngle = Math.atan2(direction.x, direction.z);
        const diffAngle = Math.atan2(Math.sin(targetAngle - this.mesh.rotation.y), Math.cos(targetAngle - this.mesh.rotation.y));
        this.mesh.rotation.y += diffAngle * Math.min(1, delta * 12.0);

        // Move forward
        direction.normalize();
        const moveDist = Math.min(distance, this.speed * delta);
        // A frame in which no time has passed is not a step that failed
        if (moveDist < 1e-5) return;
        const cameFrom = this.mesh.position.clone();
        const tryStep = (turn: number): boolean => {
          const cos = Math.cos(turn);
          const sin = Math.sin(turn);
          this.mesh.position.set(cameFrom.x + (direction.x * cos + direction.z * sin) * moveDist, cameFrom.y, cameFrom.z + (-direction.x * sin + direction.z * cos) * moveDist);
          this.stayOnTheWay(cameFrom);
          return Math.hypot(this.mesh.position.x - cameFrom.x, this.mesh.position.z - cameFrom.z) > moveDist * 0.5;
        };
        // Straight for it; or, for a moment after meeting something, on round the side they turned to
        if (this.roundIt) {
          this.roundIt.left -= delta;
          if (this.roundIt.left <= 0) this.roundIt = null;
        }
        if (!this.onBridge) this.walkRoundParkedCars();
        let stepped = tryStep(this.roundIt?.turn ?? 0);
        if (!stepped && !this.onBridge) {
          // Something is in the way: step round it, to whichever side is open, as a person does
          const first = this.roundIt ? Math.sign(this.roundIt.turn) || 1 : 1;
          for (const turn of [0.9 * first, -0.9 * first, 1.5 * first, -1.5 * first]) {
            if (tryStep(turn)) {
              this.roundIt = { turn, left: 0.45 };
              stepped = true;
              break;
            }
          }
        }
        // Getting no nearer (a rail, or walls on every side): there is no walking on to that point from here
        const leftToGo = Math.hypot(this.targetPosition.x - this.mesh.position.x, this.targetPosition.z - this.mesh.position.z);
        if (leftToGo < this.nearest - 0.05) {
          this.nearest = leftToGo;
          this.sinceNearer = 0;
        } else {
          this.sinceNearer += delta;
        }
        // Someone or a car crossing in front: wait a moment for the way to clear before giving up
        if (!stepped && !this.onBridge) {
          this.mesh.position.x = cameFrom.x;
          this.mesh.position.z = cameFrom.z;
          this.blockedFor += delta;
          this.sinceNearer = 0;
          if (this.blockedFor < 1.5) {
            this.playAnimation('idle');
            return;
          }
        } else if (stepped) {
          this.blockedFor = 0;
        }
        if (!stepped || this.sinceNearer > (this.onBridge ? 0.3 : 2.5)) {
          this.mesh.position.x = stepped ? this.mesh.position.x : cameFrom.x;
          this.mesh.position.z = stepped ? this.mesh.position.z : cameFrom.z;
          this.blockedFor = 0;
          this.endWalk();
          return;
        }
        this.playAnimation('walk');
        SoundEngine.getInstance().playFootstep(false);

        // Physically traverse pedestrian bridge, stairs, and terrain elevation
        const targetY = this.calculateWalkableHeight(this.mesh.position.x, this.mesh.position.z);
        this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, Math.min(1, delta * 14));

        this.animTime += delta;
        if (this.humanRig) {
          this.humanRig.updateAnimation(this.animTime, 'walk');
        }
        return;
      }
    }

    // 3. Emote Timer handling
    if (this.emoteTimer > 0) {
      this.emoteTimer -= delta;
      if (this.emoteTimer <= 0) {
        this.currentEmote = 'idle';
        this.playAnimation('idle');
      }
    }

    // 4. Emotes / Idle Animations
    this.animTime += delta;
    if (!this.isMoving && !this.isDriving) {
      const targetY = this.calculateWalkableHeight(this.mesh.position.x, this.mesh.position.z);
      this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, Math.min(1, delta * 14));
    }

    if (this.humanRig) {
      if (this.currentEmote === 'salute') {
        this.humanRig.rightArm.rotation.x = -Math.PI / 2.2;
        this.humanRig.rightArm.rotation.z = -Math.PI / 6;
      } else if (this.currentEmote === 'zanku' || this.currentEmote === 'groove' || this.currentEmote === 'dance') {
        this.humanRig.updateAnimation(this.animTime, 'dance');
      } else if (this.currentEmote === 'talk') {
        this.humanRig.updateAnimation(this.animTime, 'talk');
      } else if (this.currentEmote === 'phone_call') {
        this.humanRig.updateAnimation(this.animTime, 'phone_call');
      } else {
        // Natural idle breathing
        this.humanRig.updateAnimation(this.animTime, 'idle');
      }
    }
  }

  public setDriving(driving: boolean, vehicle: any = null): void {
    this.isDriving = driving;
    this.currentVehicle = vehicle;
    this.mesh.visible = !driving;
  }

  /**
   * Calculates the walkable ground surface height for physical verticality.
   * Enables physically traversing the overhead pedestrian bridge at z = 28.0m:
   * Walking up the concrete stairs from z = 14.2m to 26.5m, walking across the
   * overhead deck 5.4m above traffic, and walking down the stairs on the other side.
   */
  /** Up on the footbridge (having climbed its stairs), as against walking along the street underneath it */
  public onBridge = false;
  /** What cannot be walked through where the player is now: the buildings and walls of the city. Nothing indoors. */
  public solids: (() => Solids | null) | null = null;
  /** The way on foot between two points in the city the player is in, round what stands in between. Null indoors. */
  public wayfinder: ((fromX: number, fromZ: number, toX: number, toZ: number) => Way | null) | null = null;
  /** Is the footbridge in the city the player is in? (It is in Lagos.) */
  public footbridge: (() => boolean) | null = null;
  /** Active pedestrian positions for collision avoidance */
  /** A walk by a found way: the points still to pass after the one being walked to, and where it all ends */
  private way: THREE.Vector3[] = [];
  public goal: THREE.Vector3 | null = null;
  private arrived: (() => void) | null = null;
  /** Walking to a clicked point: the nearest they have got to it, and how long since they got any nearer */
  private nearest = Infinity;
  private sinceNearer = 0;
  /** How long the next step has been blocked by something in the way */
  private blockedFor = 0;
  /** Stepping round something in the way: which way they turned, and for how much longer */
  private roundIt: { turn: number; left: number } | null = null;

  /**
   * How high the ground is under a point, for someone walking there: the street, a stair of
   * the footbridge, or its deck. The deck is only underfoot for someone who came up the stairs;
   * anyone else at the same spot is on the road below it.
   */
  public calculateWalkableHeight(x: number, z: number): number {
    const fb = bridgeNear(z);
    if (this.isDriving) return 0;
    if (this.footbridge && !this.footbridge()) {
      this.onBridge = false;
      return 0;
    }
    const onStairs = Math.abs(Math.abs(x) - fb.shape.stairX) <= fb.shape.stairHalfWidth + 0.15 && z >= fb.bottom && z <= fb.top;
    if (onStairs) {
      const height = ((z - fb.bottom) / (fb.top - fb.bottom)) * fb.shape.top;
      // Half-way up they are on the bridge; back near the bottom they are on the street again
      if (height > fb.shape.top * 0.5) this.onBridge = true;
      else if (height < 0.9) this.onBridge = false;
      return height;
    }
    const overDeck = Math.abs(x) <= fb.shape.halfSpan && Math.abs(z - fb.z) <= fb.shape.halfWidth;
    if (overDeck && this.onBridge) return fb.shape.top;
    if (!overDeck) this.onBridge = false;

    // National Stadium Surulere stands elevation (5 tiers rising from 0.8m to 4.0m)
    const stadY = this.stadiumHeight(x, z);
    if (stadY !== null) return stadY;

    // Broad Street ground level (0.0m)
    return 0;
  }

  /**
   * How high above the ground someone is inside the National Stadium stands
   */
  public stadiumHeight(x: number, z: number): number | null {
    if (this.footbridge && !this.footbridge()) return null;

    // National Stadium Surulere center at (-74, 15)
    const sx = -74;
    const sz = 15;
    const dx = x - sx;
    const dz = z - sz;
    const absX = Math.abs(dx);
    const absZ = Math.abs(dz);

    const OUTER_X = 27.5;
    const OUTER_Z = 21.5;
    // Outside the stadium boundary
    if (absX > OUTER_X || absZ > OUTER_Z) return null;

    // Gate A entrance corridor through East stand at ground level
    const STAND_X = 21.5;
    const STAND_Z = 15.5;
    if (dx >= STAND_X && dz >= -13 && dz <= -7) {
      return 0;
    }

    // Inside pitch and running track at ground level
    if (absX < STAND_X && absZ < STAND_Z) {
      return 0;
    }

    // Inside the stepped seating stands
    const distX = Math.max(0, absX - STAND_X);
    const distZ = Math.max(0, absZ - STAND_Z);
    const dist = Math.max(distX, distZ);

    const TIER_DEPTH = 1.1;
    const TIER_RISE = 0.8;
    const tier = THREE.MathUtils.clamp(Math.floor(dist / TIER_DEPTH), 0, 4);
    return (tier + 1) * TIER_RISE;
  }

  /**
   * The footbridge has rails. Someone up on it stays on the deck and the stairs: they cannot
   * step off the side into the air. Call after moving.
   */
  private keepOnBridge(): void {
    const fb = bridgeNear(this.mesh.position.z);
    if (!this.onBridge) return;
    const p = this.mesh.position;
    const southRail = fb.z - fb.shape.halfWidth + 0.2;
    if (p.z < southRail) {
      // South of the deck there are only the two flights of stairs
      const side = p.x < 0 ? -1 : 1;
      const overFlight = Math.abs(Math.abs(p.x) - fb.shape.stairX) <= fb.shape.stairHalfWidth + 0.35;
      if (!overFlight) {
        // The rail along the deck holds
        p.z = southRail;
        p.x = THREE.MathUtils.clamp(p.x, -fb.shape.halfSpan + 0.2, fb.shape.halfSpan - 0.2);
      } else if (p.z >= fb.bottom) {
        // On a flight: its handrails keep them on it
        p.x = THREE.MathUtils.clamp(p.x, side * fb.shape.stairX - fb.shape.stairHalfWidth + 0.1, side * fb.shape.stairX + fb.shape.stairHalfWidth - 0.1);
      }
      return;
    }
    p.z = Math.min(p.z, fb.z + fb.shape.halfWidth - 0.2);
    p.x = THREE.MathUtils.clamp(p.x, -fb.shape.halfSpan + 0.2, fb.shape.halfSpan - 0.2);
  }
}
