import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import { HouseDecorationSystem, type PlacedItem } from '../../housing/HouseDecorationSystem';
import { Television, CHANNELS } from '../../housing/Television';
import { TV_SCREEN, buildFurniture } from '../../housing/FurnitureModels';
import { Builder } from '../../world/kit/ArchKit';
import { PlaceActions, type PlaceAction } from '../../destinations/PlaceActions';
import type { NavGrid } from '../../interactions/NavGrid';
import { HomeLife, HOME } from '../home/HomeLife';

export class ResidentialInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;
  /** Daily life in the apartment: bed, sofa and TV, fridge, bath */
  public life: HomeLife;

  // Animated elements
  private fanBlades: THREE.Mesh[] = [];
  private fanHeads: THREE.Group[] = [];
  private tvScreen: THREE.Mesh | null = null;
  /** The set on the living-room wall */
  public television!: Television;
  /** Sets the player has bought, by the piece of furniture each is */
  public readonly sets = new Map<string, Television>();
  private wallPaint!: THREE.MeshStandardMaterial;
  private floorMat!: THREE.MeshStandardMaterial;
  private furnitureIds: string[] = [];
  private animTime: number = 0;

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for residential interior
    const origin = new THREE.Vector3(260, 0, 440);
    this.group.position.copy(origin);
    this.life = new HomeLife(this.group, origin);

    this.def = {
      id: 'interior_residence',
      name: 'Victoria Luxury Apartment & Residence',
      type: 'residence',
      tier: 'tier3_simulated',
      districtName: 'Victoria Island Residential Compound',
      streetBuildingId: 'villa-compound',
      streetEntrance: new THREE.Vector3(-14, 0, -45),
      streetExitRotation: Math.PI / 2,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 8),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 16, 20),
      ambientLightColor: 0xffedd5,
      ambientLightIntensity: 1.3,
      rooms: [
        {
          id: 'residence_main',
          name: 'Executive Duplex Apartment',
          size: { width: 30, length: 24, height: 4.2 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xf8fafc,
          wallColor: 0xd97706, // Warm Ochre / Mustard Yellow (Screenshot 5)
        },
      ],
      // What can be done here is registered in build3DInterior and acted out by HomeLife
      stations: [],
      npcs: [],
    };

    this.build3DInterior();
  }

  /** Floor map used to walk around the furniture and through the doorways. */
  public get nav(): NavGrid {
    return this.life.nav;
  }

  public onPlayerLeft(): void {
    this.life.playerLeft();
    // A piece half put down is not left standing in the air
    HouseDecorationSystem.getInstance().cancel();
  }

  /** Every television in the home, the one on the wall first. */
  public televisions(): Television[] {
    return [this.television, ...this.sets.values()];
  }

  /** The set someone sitting down is watching: one that is on, or the one on the wall. */
  private watched(): Television {
    return this.televisions().find((set) => set.on) ?? this.television;
  }

  /**
   * The furniture the player has put in the home has changed: each piece is something to walk
   * up to (sit on it, turn it on, move it, sell it), and what was sold is forgotten.
   */
  private furnitureChanged(): void {
    const decor = HouseDecorationSystem.getInstance();
    const origin = this.group.position;
    for (const id of this.furnitureIds) PlaceActions.unregister(id);
    this.furnitureIds = [];
    for (let i = this.interactiveList.length - 1; i >= 0; i--) {
      if (this.interactiveList[i].id.startsWith('home_item_')) this.interactiveList.splice(i, 1);
    }
    const standing = new Set<string>();
    for (const item of decor.placed) {
      standing.add(item.uid);
      if (decor.placing?.moving === item) continue;
      const entry = decor.catalogueItem(item.id);
      const size = decor.footprint(item.modelType, item.turns);
      const face = decor.facing(item.turns);
      const reach = (face.x !== 0 ? size.width : size.depth) / 2 + 0.8;
      if (decor.kind(item.modelType).use === 'tv' && !this.sets.has(item.uid)) {
        const screen = item.mesh.getObjectByName(TV_SCREEN) as THREE.Mesh | undefined;
        if (screen) this.sets.set(item.uid, new Television(screen));
      }
      const id = `home_item_${item.uid}`;
      this.furnitureIds.push(id);
      this.interactiveList.push({
        mesh: item.mesh,
        id,
        name: entry?.name ?? 'Furniture',
        category: 'Your furniture',
        description: entry?.description ?? 'Yours, to move or sell.',
        interactionPoint: new THREE.Vector3(origin.x + item.x + face.x * reach, 0, origin.z + item.z + face.z * reach),
      });
      PlaceActions.register(id, this.furnitureAction(item));
    }
    for (const uid of [...this.sets.keys()]) {
      if (!standing.has(uid)) this.sets.delete(uid);
    }
  }

  /** What can be done at a piece of the player's own furniture. */
  private furnitureAction(item: PlacedItem): PlaceAction {
    const decor = HouseDecorationSystem.getInstance();
    const kind = decor.kind(item.modelType);
    const name = decor.catalogueItem(item.id)?.name ?? 'Furniture';
    return {
      label: () => {
        const set = this.sets.get(item.uid);
        if (kind.use === 'seat') return '🛋️ Sit down, move it or sell it';
        if (kind.use === 'bed') return '🛏️ Sleep in it, move it or sell it';
        if (kind.use === 'tv') return set?.on ? `📺 On: ${set.showing()}` : '📺 Turn it on, move it or sell it';
        if (kind.use === 'cook') return '🍳 Cook food, move it or sell it';
        if (kind.use === 'bath') return '🛁 Bath & Spa, move it or sell it';
        if (kind.use === 'game') return '🎮 Play PS5, move it or sell it';
        if (kind.use === 'work') return '💻 Workstation, move it or sell it';
        if (kind.use === 'music') return '🎹 Play music, move it or sell it';
        if (kind.use === 'snooker') return '🎱 Play snooker, move it or sell it';
        if (kind.use === 'fitness') return '🏋️ Workout, move it or sell it';
        if (kind.use === 'drink') return '🧊 Refreshment, move it or sell it';
        if (kind.use === 'power') return '⚡ Generator / Inverter, move it or sell it';
        if (kind.use === 'clean') return '🧺 Laundry, move it or sell it';
        if (item.modelType === 'split_ac') return '❄️ AC, move it or sell it';
        if (item.modelType === 'wall_clock') return '🕰️ Clock, move it or sell it';
        if (item.modelType === 'wall_art') return '🖼️ Artwork, move it or sell it';
        if (item.modelType === 'wall_mirror') return '🪞 Mirror, move it or sell it';
        return '🪑 Move it or sell it';
      },
      run: (host) => {
        const set = this.sets.get(item.uid);
        const choices: Array<{ label: string; note?: string; pick: () => void }> = [];
        if (kind.use === 'seat' && kind.seat) {
          const turn = (item.turns * Math.PI) / 2;
          const face = decor.facing(item.turns);
          const size = decor.footprint(item.modelType, item.turns);
          const reach = (face.x !== 0 ? size.width : size.depth) / 2 + 0.55;
          const seat = new THREE.Vector3(item.x + kind.seat.x * Math.cos(turn) + kind.seat.z * Math.sin(turn), 0, item.z - kind.seat.x * Math.sin(turn) + kind.seat.z * Math.cos(turn));
          const front = new THREE.Vector3(item.x + face.x * reach, 0, item.z + face.z * reach);
          choices.push({ label: 'Sit down', pick: () => { this.life.sitAt(seat, front, Math.atan2(face.x, face.z)); } });
        }
        if (kind.use === 'bed' && kind.bed) {
          // Its foot points the way the piece faces; the sleeper gets in from whichever side has room to stand
          const turn = (item.turns * Math.PI) / 2;
          const onIt = (x: number, z: number) => new THREE.Vector3(item.x + x * Math.cos(turn) + z * Math.sin(turn), 0, item.z - x * Math.sin(turn) + z * Math.cos(turn));
          const feet = onIt(kind.bed.x, kind.bed.z);
          const origin = this.group.position;
          const sides = [onIt(kind.bed.side + 0.6, 0.3), onIt(-kind.bed.side - 0.6, 0.3)];
          const side = sides.find((point) => this.life.nav.isFree(origin.x + point.x, origin.z + point.z)) ?? sides[0];
          const top = kind.bed.top;
          choices.push({ label: 'Lie down and sleep', pick: () => { this.life.sleepAt(feet, side, turn, top); } });
        }
        if (kind.use === 'tv' && set) {
          for (const channel of CHANNELS) {
            choices.push({ label: `${channel.icon} ${channel.name}`, note: set.on && set.channel === channel.id ? 'On now' : undefined, pick: () => { set.turnOn(channel.id); this.life.refresh(); } });
          }
          if (set.on) choices.push({ label: 'Turn it off', pick: () => { set.turnOff(); this.life.refresh(); } });
        }
        if (kind.use === 'cook') {
          choices.push({
            label: 'Cook Party Jollof & Fried Dodo',
            note: 'Hunger -60, Cooking +1',
            pick: () => {
              (host as any).backend.modifyNeed('hunger', -60);
              (host as any).backend.modifyNeed('energy', -10);
              (host as any).backend.addSkillExp('cooking', 1);
              host.say('You cooked a fragrant pot of smoky party Jollof with sweet fried plantain! Hunger replenished.', 'success');
            },
          });
          choices.push({
            label: 'Boil Tea & Breakfast Coffee',
            note: 'Energy +25',
            pick: () => {
              (host as any).backend.modifyNeed('energy', 25);
              (host as any).backend.modifyNeed('hunger', -15);
              host.say('Hot brew prepared! Energy +25.', 'success');
            },
          });
        }
        if (kind.use === 'bath') {
          choices.push({
            label: 'Take Hot Soaking Bath / Jacuzzi Hydrojets',
            note: 'Hygiene 100%, Energy +30',
            pick: () => {
              (host as any).backend.modifyNeed('hygiene', 100);
              (host as any).backend.modifyNeed('energy', 30);
              (host as any).backend.modifyNeed('fun', 25);
              host.say('Deep warm hydrotherapy soak! Hygiene 100% restored, body completely revitalized.', 'success');
            },
          });
        }
        if (kind.use === 'game') {
          choices.push({
            label: 'Play PS5 Tournament',
            note: 'Fun +40, Energy -10',
            pick: () => {
              (host as any).backend.modifyNeed('fun', 40);
              (host as any).backend.modifyNeed('energy', -10);
              host.say('Intense gaming championship match with the squad! Fun +40.', 'success');
            },
          });
        }
        if (kind.use === 'work') {
          choices.push({
            label: 'Code Tech Startup MVP',
            note: 'Coding +1, Energy -15',
            pick: () => {
              (host as any).backend.addSkillExp('coding', 1);
              (host as any).backend.modifyNeed('energy', -15);
              host.say('Deployed 3 clean microservices to production! Coding skill +1.', 'success');
            },
          });
        }
        if (kind.use === 'music') {
          choices.push({
            label: 'Play Afrobeats Melodies',
            note: 'Music +1, Fun +30',
            pick: () => {
              (host as any).backend.addSkillExp('music', 1);
              (host as any).backend.modifyNeed('fun', 30);
              host.say('Playing soulful Afrobeats chords and bass grooves! Music +1, Fun +30.', 'success');
            },
          });
        }
        if (kind.use === 'snooker') {
          choices.push({
            label: 'Play a Game of Snooker',
            note: 'Fun +35, Hustle +1',
            pick: () => {
              (host as any).backend.modifyNeed('fun', 35);
              (host as any).backend.addSkillExp('hustle', 1);
              host.say('Pocketed the black ball with an exquisite spin shot! Fun +35, Hustle +1.', 'success');
            },
          });
        }
        if (kind.use === 'fitness') {
          choices.push({
            label: 'Cardio & Dumbbell Workout',
            note: 'Fitness +1, Energy -20',
            pick: () => {
              (host as any).backend.addSkillExp('fitness', 1);
              (host as any).backend.modifyNeed('energy', -20);
              (host as any).backend.modifyNeed('hygiene', -15);
              host.say('Crushed 5km on the treadmill and dumbbell presses! Fitness skill +1.', 'success');
            },
          });
        }
        if (kind.use === 'drink') {
          choices.push({
            label: 'Pour Ice-Cold Chapman & Refreshment',
            note: 'Hunger -20, Fun +15',
            pick: () => {
              (host as any).backend.modifyNeed('hunger', -20);
              (host as any).backend.modifyNeed('fun', 15);
              host.say('Poured a chilled Chapman with cucumber and Angostura bitters! So refreshing.', 'success');
            },
          });
        }
        if (kind.use === 'power') {
          choices.push({
            label: 'Start Standby Generator / Inverter Power',
            note: 'NEPA Backup',
            pick: () => {
              host.say('Engine hums smoothly with stable 230V sine-wave output. Full household power guaranteed!', 'success');
            },
          });
        }
        if (kind.use === 'clean') {
          choices.push({
            label: 'Run Automatic Wash & Dry Cycle',
            note: 'Hygiene +25',
            pick: () => {
              (host as any).backend.modifyNeed('hygiene', 25);
              host.say('Clothes washed, sanitized and smelling crisp! Hygiene +25.', 'success');
            },
          });
        }
        if (item.modelType === 'split_ac') {
          choices.push({
            label: 'Toggle AC Turbo Cooling',
            note: 'Refreshing chill',
            pick: () => {
              host.say('The Panasonic Inverter Split AC blows an ice-cold mountain breeze across the room. Ahhh!', 'success');
            },
          });
        }
        if (item.modelType === 'wall_clock') {
          choices.push({
            label: 'Check the clock',
            pick: () => {
              const hour = host.hour();
              const h = Math.floor(hour);
              const m = Math.floor((hour - h) * 60);
              const ampm = h >= 12 ? 'PM' : 'AM';
              const displayH = h % 12 === 0 ? 12 : h % 12;
              const timeStr = `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
              host.say(`The brass wall clock ticks steadily. It is ${timeStr}.`, 'info');
            },
          });
        }
        if (item.modelType === 'wall_art') {
          choices.push({
            label: 'Admire artwork',
            note: '+1 Street Cred',
            pick: () => {
              host.say('You admire the intricate carvings of the Benin bronze heritage canvas.', 'info');
            },
          });
        }
        if (item.modelType === 'wall_mirror') {
          choices.push({
            label: 'Check reflection',
            note: 'Looking sharp',
            pick: () => {
              host.say('You check your reflection in the ornate gilded mirror. Looking confident and ready!', 'info');
            },
          });
        }
        choices.push({ label: 'Move it', note: 'Free', pick: () => { decor.pickUp(item.uid); } });
        choices.push({
          label: 'Sell it',
          note: `₦${decor.resaleValue(item).toLocaleString()} back`,
          pick: () => {
            const sold = decor.sell(item.uid);
            if (sold.ok) host.say(`${name} sold. ₦${sold.refund.toLocaleString()} back.`, 'info');
          },
        });
        host.ask({ who: name, role: 'Your furniture', text: 'What do you want to do with it?', choices });
      },
    };
  }

  private build3DInterior(): void {
    // 1. Ceramic Tiled Floor with Grid Grout Lines
    const floorGeo = new THREE.BoxGeometry(32, 0.4, 26);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.25,
    });
    this.floorMat = floorMat;
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.name = 'interior_floor_mesh';
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;

    // Warm Ochre / Mustard Yellow Walls (Screenshot 5)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Authentic Nigerian ochre wall paint
      roughness: 0.7,
    });
    this.wallPaint = wallMat;
    const wallH = 4.2;
    const wallT = 0.4;

    // Floor and outer walls form the room shell, so the camera can cut away whichever walls face it
    const shell = new THREE.Group();
    shell.name = 'interior_room_shell';
    shell.userData.size = { width: 32, length: 26, height: wallH };
    shell.add(floor);
    this.group.add(shell);

    // Back Wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(32, wallH, wallT), wallMat);
    backWall.name = 'shell_wall_back';
    backWall.position.set(0, wallH / 2, -13);
    shell.add(backWall);

    // Windows with Burglar-Proof Metal Bars along back wall (Screenshot 5)
    for (const wx of [-10, 0, 10]) {
      this.createBurglarProofWindow(wx, 2.4, -12.8);
    }

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 26), wallMat);
    leftWall.name = 'shell_wall_left';
    leftWall.position.set(-16, wallH / 2, 0);
    shell.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, 26), wallMat);
    rightWall.name = 'shell_wall_right';
    rightWall.position.set(16, wallH / 2, 0);
    shell.add(rightWall);

    // Dividing Walls between Rooms (Living, Bedrooms, Bathroom).
    // Kept low so every room stays visible from above.
    const partitionH = 1.8;

    // Each partition is built in pieces, leaving doorways to walk through
    const partition = (centerX: number, centerZ: number, width: number, length: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(width, partitionH, length), wallMat);
      wall.position.set(centerX, partitionH / 2, centerZ);
      this.group.add(wall);
      this.life.block(centerX, centerZ, width / 2, length / 2);
    };

    // Between the bedrooms and the living room, with a doorway into the bedrooms
    partition(-12.75, -1, 6.5, wallT);
    partition(-0.6, -1, 13.2, wallT);

    // Between the two bedrooms, with a doorway at the living-room end
    partition(2, -8.2, wallT, 9.6);

    // Between the living room and the bathroom side, with a doorway beside the bedrooms
    partition(6, 7.0, wallT, 10);

    // 2. Ceiling & Ambient Lights
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-6, 4.0, 4), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(8, 4.0, -6), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-5, 4.0, -6), 0xffedd5));

    // 3. Exit Door
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 12), Math.PI);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Apartment Front Door',
      category: 'Exit to Street',
      description: 'Step outside through the compound gate back to the street.',
      interactionPoint: new THREE.Vector3(this.group.position.x, 0, this.group.position.z + 10.6),
    });

    // 4. Living Room:
    // A. Circular Orange & Gold Heritage Rug (Screenshot 5)
    const rugOuter = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.7, 32),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.9, side: THREE.DoubleSide })
    );
    rugOuter.rotation.x = -Math.PI / 2;
    rugOuter.position.set(-6, 0.02, 5);
    this.group.add(rugOuter);

    const rugInner = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 })
    );
    rugInner.rotation.x = -Math.PI / 2;
    rugInner.position.set(-6, 0.022, 5);
    this.group.add(rugInner);

    // B. Emerald Green 3-Seater Sofa
    // The same sofa the catalogue sells, built large: a seat, a back, arms and cushions
    const sofa = buildFurniture('sofa_emerald')!;
    sofa.scale.set(1.75, 1.25, 1.75);
    sofa.rotation.y = Math.PI;
    sofa.position.set(-2, 0, 6);
    this.group.add(sofa);

    // C. Black leather sofa facing the TV: a seat to sit on, with a back and arms
    const sofaBlack = new THREE.Group();
    sofaBlack.position.set(-7.5, 0, 2.5);
    const leather = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    const sofaSeat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3.4), leather);
    sofaSeat.position.set(-0.15, 0.25, 0);
    sofaBlack.add(sofaSeat);
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.15, 3.4), leather);
    sofaBack.position.set(0.7, 0.575, 0);
    sofaBlack.add(sofaBack);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 0.3), leather);
      arm.position.set(-0.15, 0.39, side * 1.55);
      sofaBlack.add(arm);
    }
    this.group.add(sofaBlack);
    this.life.block(-7.5, 2.5, 0.9, 1.7);

    // D. Wooden Coffee Table in Living Room
    const coffeeTable = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 })
    );
    coffeeTable.position.set(-6, 0.3, 5);
    this.group.add(coffeeTable);

    // E. 75-inch Flat Screen TV & Entertainment Wall Console
    const tvUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.2, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 })
    );
    tvUnit.position.set(-15.8, 2.4, 4);
    this.group.add(tvUnit);

    const screenGeo = new THREE.PlaneGeometry(6.2, 2.8);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    this.tvScreen = new THREE.Mesh(screenGeo, screenMat);
    this.tvScreen.rotation.y = Math.PI / 2;
    this.tvScreen.position.set(-15.65, 2.4, 4);
    this.group.add(this.tvScreen);
    this.television = new Television(this.tvScreen);
    // Sitting down to watch turns the set on; whoever is sitting can turn it to something else
    this.life.onWatch = () => { if (!this.televisions().some((set) => set.on)) this.television.turnOn('football'); };
    this.life.onTheTelevision = () => { const on = this.televisions().find((set) => set.on); return on ? `Watching: ${on.showing()}` : null; };
    this.life.channelChoices = () => {
      const set = this.watched();
      return [
        ...CHANNELS.map((channel) => ({
          id: channel.id,
          label: `${channel.icon} ${channel.id === 'football' ? 'Football' : channel.id === 'news' ? 'News' : 'Music'}`,
          current: set.on && set.channel === channel.id,
          pick: () => { set.turnOn(channel.id); this.life.refresh(); },
        })),
        { id: 'off', label: 'Off', current: !set.on, pick: () => { set.turnOff(); this.life.refresh(); } },
      ];
    };

    // F. Round Wooden Dining Table with 4 Chairs (Screenshot 5)
    const diningTable = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 })
    );
    diningTable.position.set(-8, 1.1, 10);
    this.group.add(diningTable);

    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    tableLeg.position.set(-8, 0.55, 10);
    this.group.add(tableLeg);

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const chair = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x9a3412 })
      );
      chair.position.set(-8 + Math.cos(a) * 1.8, 0.35, 10 + Math.sin(a) * 1.8);
      this.group.add(chair);
    }

    // G. Potted Indoor Majesty Palm Plant (Screenshot 5)
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.25, 0.7, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef08a })
    );
    pot.position.set(-0.5, 0.35, 0.5);
    this.group.add(pot);

    // 5. Bedrooms:
    // A. Master Bedroom (Right) - Purple Duvet King Bed (Screenshot 5)
    const masterBed = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.8, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    masterBed.position.set(10.5, 0.4, -6.5);
    this.group.add(masterBed);

    const masterMattress = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.5, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 }) // Royal Purple
    );
    masterMattress.position.set(10.5, 0.9, -6.5);
    this.group.add(masterMattress);

    // B. Center Bedroom - Purple Bed (Screenshot 5)
    const centerBed = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.8, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    centerBed.position.set(-3, 0.4, -7);
    this.group.add(centerBed);

    const centerMattress = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.5, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 })
    );
    centerMattress.position.set(-3, 0.9, -7);
    this.group.add(centerMattress);

    // C. Guest Bedroom (Left) - Blue Bed (Screenshot 5)
    const guestBed = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.8, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    guestBed.position.set(-12, 0.4, -7);
    this.group.add(guestBed);

    const guestMattress = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.5, 4.0),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 }) // Vibrant Blue
    );
    guestMattress.position.set(-12, 0.9, -7);
    this.group.add(guestMattress);

    // 6. Bathroom (Tiled with Bathtub, Glass Shower, WC, Blue Drum & Red Bucket!):
    // White Ceramic Bathtub
    const tub = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.8, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    tub.position.set(9.5, 0.4, 3);
    this.group.add(tub);

    // Glass Shower Booth
    const showerGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.4, roughness: 0.1 })
    );
    showerGlass.position.set(13.5, 1.6, 4.5);
    this.group.add(showerGlass);

    // Toilet WC
    const wc = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    wc.position.set(14, 0.45, 1.5);
    this.group.add(wc);

    // Iconic Nigerian Blue Water Storage Drum & Red Fetch Bucket (Screenshot 5)
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
    );
    drum.position.set(8.5, 0.9, 0.5);
    this.group.add(drum);

    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.35, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    bucket.position.set(9.8, 0.4, 0.6);
    this.group.add(bucket);

    // 7. Outdoor Covered Carport with Wooden Pergola & Parked Cars (Screenshot 5):
    this.createOutdoorCarport(17.5, 0, 7.5);

    // 8. Attach House Decoration System Placed Items Group
    const decorationSystem = HouseDecorationSystem.getInstance();
    this.group.add(decorationSystem.placedItemsGroup);
    decorationSystem.onPaint = (hex) => this.wallPaint.color.setHex(hex);
    decorationSystem.onFloor = (hex, roughness) => {
      this.floorMat.color.setHex(hex);
      this.floorMat.roughness = roughness;
    };
    decorationSystem.onChanged = () => this.furnitureChanged();
    decorationSystem.attach({
      halfWidth: 16,
      halfLength: 13,
      solids: () => this.life.solids,
      // The furniture's own floor is marked directly: it is not part of what the home came with
      block: (x, z, halfWidth, halfLength) => this.life.nav.blockRect(x, z, halfWidth, halfLength),
      unblock: (x, z, halfWidth, halfLength) => this.life.nav.clearRect(x, z, halfWidth, halfLength),
      keepClear: [{ x: 0, z: 8 }, { x: 0, z: 10.6 }],
    });

    // 9. Kitchen corner: fridge
    const fridge = new THREE.Group();
    fridge.position.copy(HOME.fridge.position);
    const fridgeBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.1, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5, roughness: 0.3 })
    );
    fridgeBody.position.y = 1.05;
    fridge.add(fridgeBody);
    const fridgeHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.9, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
    );
    fridgeHandle.position.set(0.53, 1.3, 0.3);
    fridge.add(fridgeHandle);
    this.group.add(fridge);

    // Pillow at the head of the master bed
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.22, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 })
    );
    pillow.position.set(10.5, 1.26, -8.2);
    this.group.add(pillow);

    // Each bed has a headboard, pillows and a turned-down cover, so it reads as a bed and not a slab
    const bedding = new Builder();
    for (const [x, z, width, depth, cover] of [[10.5, -6.5, 4.8, 5.2, 0x6d28d9], [-3, -7, 4.2, 4.6, 0x6d28d9], [-12, -7, 3.6, 4.4, 0x1d4ed8]] as Array<[number, number, number, number, number]>) {
      const head = z - depth / 2;
      bedding.box(0x3f2a17, width + 0.2, 1.9, 0.22, x, 0, head + 0.05);
      for (const side of [-1, 1]) bedding.box(0xffffff, width * 0.36, 0.2, 0.8, x + side * width * 0.22, 1.15, head + 0.85);
      bedding.box(cover, width - 0.36, 0.09, depth * 0.5, x, 1.15, z + depth * 0.2).box(0xf8fafc, width - 0.36, 0.1, 0.42, x, 1.16, z - depth * 0.08);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bedding.box(0x1c1917, 0.18, 0.12, 0.18, x + sx * (width / 2 - 0.2), -0.02, z + sz * (depth / 2 - 0.2));
    }
    this.group.add(bedding.build('bedding'));

    // 10. Everything solid, so walking goes around it
    this.life.block(-2, 6, 2.4, 0.9); // green sofa
    this.life.block(-6, 5, 1.2, 0.7); // coffee table
    this.life.block(-8, 10, 2.05, 2.05); // dining table and chairs
    this.life.block(-0.5, 0.5, 0.35, 0.35); // palm pot
    this.life.block(10.5, -6.5, 2.4, 2.6); // master bed
    this.life.block(-3, -7, 2.1, 2.3); // centre bed
    this.life.block(-12, -7, 1.8, 2.2); // guest bed
    this.life.block(9.5, 3, 1.7, 0.8); // bathtub
    this.life.block(13.5, 4.5, 1.1, 1.1); // shower
    this.life.block(14, 1.5, 0.4, 0.55); // toilet
    this.life.block(HOME.drum.position.x, HOME.drum.position.z, 0.8, 0.8);
    this.life.block(9.8, 0.6, 0.45, 0.45); // bucket
    this.life.block(HOME.fridge.position.x, HOME.fridge.position.z, 0.5, 0.5);

    // 11. Things to do, each registered where the player stands to use it
    const origin = this.group.position;
    const at = (local: THREE.Vector3) => new THREE.Vector3(origin.x + local.x, 0, origin.z + local.z);

    this.interactiveList.push({
      mesh: sofaBlack,
      id: 'flat-tv',
      name: 'Sofa & TV',
      category: 'Home Entertainment',
      description: 'Sit down and watch the Super Eagles. A little energy comes back while you relax.',
      interactionPoint: at(HOME.sofa.front),
    });

    this.interactiveList.push({
      mesh: masterBed,
      id: 'flat-bed',
      name: 'Master Bed',
      category: 'Rest & Recovery',
      description: 'Lie down and sleep. Energy and health come back while you rest.',
      interactionPoint: at(HOME.bed.side),
    });

    this.interactiveList.push({
      mesh: drum,
      id: 'flat-drum',
      name: 'Water Drum & Bucket',
      category: 'Home Essentials',
      description: 'Cold borehole water and the red bucket. A quick bath wakes you up.',
      interactionPoint: at(HOME.drum.front),
    });

    this.interactiveList.push({
      mesh: fridge,
      id: 'flat-fridge',
      name: 'Fridge',
      category: 'Kitchen',
      description: 'Eat something from your bag.',
      interactionPoint: at(HOME.fridge.front),
    });

    // 12. And the player's own furniture, as it stands now
    this.furnitureChanged();
  }

  /**
   * Builds burglar-proof metal window grills (Screenshot 5)
   */
  private createBurglarProofWindow(x: number, y: number, z: number): void {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, y, z);

    // White Window Frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    winGroup.add(frame);

    // Vertical Iron Burglar Proof Security Bars
    for (let bx = -1.1; bx <= 1.1; bx += 0.32) {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 2.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 })
      );
      bar.position.set(bx, 0, 0.12);
      winGroup.add(bar);
    }

    this.group.add(winGroup);
  }

  /**
   * Outdoor Carport with wooden pergola beams and parked cars (Screenshot 5)
   */
  private createOutdoorCarport(x: number, y: number, z: number): void {
    const carportGroup = new THREE.Group();
    carportGroup.position.set(x, y, z);

    // Concrete driveway slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.2, 8.5),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 })
    );
    slab.position.y = -0.1;
    carportGroup.add(slab);

    // Wooden Pergola Frame (Yellow/Ochre timber posts)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.6 });

    // 4 Corner Posts
    for (const px of [-3.0, 3.0]) {
      for (const pz of [-4.0, 4.0]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), woodMat);
        post.position.set(px, 1.8, pz);
        carportGroup.add(post);
      }
    }

    // Top horizontal crossbeams
    for (let rz = -3.8; rz <= 3.8; rz += 1.8) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 0.25), woodMat);
      beam.position.set(0, 3.6, rz);
      carportGroup.add(beam);
    }

    // Parked Cars under carport
    // Car 1: Silver Sedan
    const car1 = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.1, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.6 })
    );
    car1.position.set(-1.4, 0.55, 0);
    carportGroup.add(car1);

    // Car 2: Black Mercedes G-Wagon SUV (Screenshot 5)
    const car2 = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.5, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4, metalness: 0.4 })
    );
    car2.position.set(1.4, 0.75, 0);
    carportGroup.add(car2);

    this.group.add(carportGroup);
  }

  public update(delta: number, _time: number): void {
    this.animTime += delta;

    for (const blade of this.fanBlades) {
      blade.rotation.z += delta * 24;
    }

    this.life.update(delta);

    for (const head of this.fanHeads) {
      head.rotation.y = Math.sin(this.animTime * 1.5) * 0.7;
    }

    for (const set of this.televisions()) set.update(delta);
  }
}
