import * as THREE from 'three';
import type { InteriorDefinition, InteriorNPCDef } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import type { NavGrid } from '../../interactions/NavGrid';
import { Builder, signBoard } from '../../world/kit/ArchKit';
import { clickBox } from '../../world/landmarks/Landmark';
import { PlaceActions, type PlaceAction } from '../../destinations/PlaceActions';
import { SoundEngine } from '../../audio/SoundEngine';
import { ClubService, CLUB } from '../club/ClubService';

const DANCERS: Array<[number, number, string, 'male' | 'female', number]> = [
  [-3.6, -3, 'Kelechi', 'male', 0xf97316],
  [-1, -3.3, 'Simi', 'female', 0xec4899],
  [1.5, -3, 'Obinna', 'male', 0x22d3ee],
  [-4, -0.8, 'Zainab', 'female', 0xa855f7],
  [1.9, -0.7, 'Dayo', 'male', 0xfacc15],
  [-3.2, 1.3, 'Ifeoma', 'female', 0x10b981],
  [1.4, 1.5, 'Femi', 'male', 0xef4444],
];

const TILE_COLOURS = [0xec4899, 0x8b5cf6, 0x22d3ee, 0xfacc15, 0x10b981, 0xf97316];

/**
 * The nightclub: a desk at the door where the gate fee is paid, a dance floor under moving
 * lights with people on it, a DJ at the back, a bar down one side and a lounge down the other.
 * It keeps hours. What happens here is run by club/ClubService.
 */
export class ClubInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;
  public service: ClubService;

  private dancers: Array<{ npc: InteriorNPCMesh; phase: number; yaw: number }> = [];
  private tiles!: THREE.InstancedMesh;
  private beams: THREE.Mesh[] = [];
  private beat = -1;
  private startedMusic = false;

  constructor() {
    this.group = new THREE.Group();
    const origin = new THREE.Vector3(260, 0, 640);
    this.group.position.copy(origin);
    this.service = new ClubService(this.group, origin);

    const staff: InteriorNPCDef[] = [
      {
        id: 'npc_club_cashier', name: 'Amaka', role: 'Teller', title: 'Door desk', gender: 'female',
        relativePosition: CLUB.cashier.clone(), rotationY: 0, outfitColor: 0x111827,
        dialogueGreeting: 'Good evening. Gate fee is five thousand, and you are in till we close.', actions: [],
      },
      {
        id: 'npc_club_barman', name: 'Tunde', role: 'Barman', title: 'Barman', gender: 'male',
        relativePosition: CLUB.barman.clone(), rotationY: -Math.PI / 2, outfitColor: 0xf8fafc, hasTie: true,
        dialogueGreeting: 'What are you having?', actions: [],
      },
      {
        id: 'npc_club_dj', name: 'DJ Kolade', role: 'DJ', title: 'On the decks', gender: 'male',
        relativePosition: new THREE.Vector3(CLUB.booth.x, 0, CLUB.booth.z - 0.7), rotationY: 0, outfitColor: 0x7c3aed,
        dialogueGreeting: 'Requests after this one!', actions: [],
      },
      {
        id: 'npc_club_bouncer', name: 'Big Sam', role: 'Security', title: 'Door', gender: 'male',
        relativePosition: new THREE.Vector3(-2.4, 0, 6.6), rotationY: Math.PI / 2, outfitColor: 0x0a0a0a,
        dialogueGreeting: 'No wahala tonight. Desk is on your right.', actions: [],
      },
    ];
    const crowd: InteriorNPCDef[] = DANCERS.map(([x, z, name, gender, outfitColor], index) => ({
      id: `npc_club_dancer_${index}`, name, role: 'Guest', title: 'On the floor', gender,
      relativePosition: new THREE.Vector3(x, 0, z), rotationY: Math.atan2(CLUB.booth.x - x, CLUB.booth.z - z), outfitColor,
      dialogueGreeting: 'This song! Come and dance!', actions: [],
    }));
    const lounge: InteriorNPCDef[] = [
      {
        id: 'npc_club_guest_0', name: 'Chief Okoro', role: 'Guest', title: 'In the lounge', gender: 'male',
        relativePosition: new THREE.Vector3(-7.5, 0, 2.2), rotationY: Math.PI / 2, outfitColor: 0xfef3c7,
        dialogueGreeting: 'Young one, the lounge is for those who buy a bottle.', actions: [],
      },
      {
        id: 'npc_club_guest_1', name: 'Bisi', role: 'Guest', title: 'In the lounge', gender: 'female',
        relativePosition: new THREE.Vector3(-7.1, 0, 3.5), rotationY: Math.PI * 0.75, outfitColor: 0xdb2777,
        dialogueGreeting: 'The DJ is on fire tonight.', actions: [],
      },
    ];

    this.def = {
      id: 'interior_club',
      name: CLUB.name,
      type: 'club',
      tier: 'tier3_simulated',
      districtName: 'Victoria Island',
      streetBuildingId: 'quilox-club',
      streetEntrance: new THREE.Vector3(14.8, 0, 103), // Replaced by the street door's position when it registers
      streetExitRotation: -Math.PI / 2,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, CLUB.room.length / 2 - 2.2),
      exitDoorOffset: new THREE.Vector3(0, 0, CLUB.room.length / 2),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xddd6fe,
      ambientLightIntensity: 1.7,
      hours: CLUB.hours,
      rooms: [
        { id: 'club_floor', name: 'Main room', size: CLUB.room, centerOffset: new THREE.Vector3(0, 0, 0), floorColor: 0x3a3350, wallColor: 0x4a2a78 },
      ],
      stations: [],
      npcs: [...staff, ...crowd, ...lounge],
    };

    this.build();
  }

  public get nav(): NavGrid {
    return this.service.nav;
  }

  public onPlayerEntered(): void {
    this.service.playerEntered();
    // The music is the room's: it starts as you come in and stops as you leave
    const sound = SoundEngine.getInstance();
    if (!sound.isRadioActive()) {
      sound.toggleRadio();
      this.startedMusic = true;
    }
  }

  public onPlayerLeft(): void {
    this.service.playerLeft();
    if (this.startedMusic) {
      const sound = SoundEngine.getInstance();
      if (sound.isRadioActive()) sound.toggleRadio();
      this.startedMusic = false;
    }
  }

  private build(): void {
    const origin = this.group.position;
    const at = (x: number, z: number) => new THREE.Vector3(origin.x + x, 0, origin.z + z);
    const { width, length, height } = CLUB.room;
    this.group.add(InteriorPrefabs.createRoom(width, length, height, 0x3a3350, 0x4a2a78));

    const b = new Builder();
    const BLACK = 0x0f0f14;
    const PINK = 0xec4899;
    const CYAN = 0x22d3ee;

    // The dance floor, a step of dark glass the lit tiles sit in
    b.box(BLACK, CLUB.floor.halfWidth * 2 + 0.3, 0.06, CLUB.floor.halfLength * 2 + 0.3, CLUB.floor.x, 0, CLUB.floor.z);

    // The DJ: a desk with two decks and a mixer, and a stack of speakers either side
    const booth = CLUB.booth;
    b.box(0x1f2937, 3.6, 1.05, 0.8, booth.x, 0, booth.z).box(PINK, 3.4, 0.1, 0.05, booth.x, 0.55, booth.z + 0.42, { glow: true });
    b.cylinder(0x0a0a0a, 0.3, 0.06, booth.x - 0.95, 1.05, booth.z, { sides: 20 }).cylinder(0x0a0a0a, 0.3, 0.06, booth.x + 0.95, 1.05, booth.z, { sides: 20 });
    b.box(0x27272a, 0.6, 0.08, 0.5, booth.x, 1.05, booth.z).box(CYAN, 0.4, 0.03, 0.08, booth.x, 1.13, booth.z + 0.1, { glow: true });
    for (const x of [booth.x - 3.7, booth.x + 3.7]) {
      b.box(0x0a0a0a, 1.1, 2.5, 0.9, x, 0, booth.z - 0.5);
      for (const y of [0.7, 1.75]) b.cylinder(0x7c3aed, 0.34, 0.06, x, y - 0.03, booth.z - 0.03, { pitch: Math.PI / 2, sides: 18, glow: true });
    }

    // The bar: a counter with a lit edge, stools, and bottles on the wall behind
    const bar = CLUB.bar;
    b.box(0x3b1d0e, 0.9, 1.1, bar.halfLength * 2, bar.x, 0, bar.z).box(0x111827, 1.1, 0.06, bar.halfLength * 2 + 0.2, bar.x, 1.1, bar.z);
    b.box(PINK, 0.05, 0.12, bar.halfLength * 2 - 0.2, bar.x - 0.47, 0.5, bar.z, { glow: true });
    b.box(0x1c1917, 0.4, 2.7, bar.halfLength * 2, 9.72, 0, bar.z);
    const bottles = [0xfde68a, 0x34d399, 0xf87171, 0x60a5fa, 0xf0abfc, 0xfb923c];
    let n = 0;
    for (const y of [1.0, 1.6, 2.2]) {
      b.box(0x292524, 0.36, 0.05, bar.halfLength * 2, 9.56, y - 0.05, bar.z);
      for (let z = bar.z - bar.halfLength + 0.3; z < bar.z + bar.halfLength - 0.2; z += 0.42) {
        b.box(bottles[n++ % bottles.length], 0.1, 0.3, 0.1, 9.5, y, z, { glow: true });
      }
    }
    for (const z of [-5.2, -4.2, -0.8, 0.2]) {
      b.cylinder(0x111827, 0.05, 0.75, 6.45, 0, z).cylinder(0xbe185d, 0.24, 0.09, 6.45, 0.75, z, { sides: 16 });
    }

    // The desk by the door, and a rope to queue along
    const desk = CLUB.desk;
    b.box(0x1f2937, desk.halfWidth * 2, 1.05, desk.halfLength * 2, desk.x, 0, desk.z).box(CYAN, desk.halfWidth * 2 - 0.2, 0.08, 0.05, desk.x, 0.3, desk.z + 0.47, { glow: true });
    for (const z of [4.4, 5.6, 6.8]) b.cylinder(0xd4af37, 0.05, 0.95, 3.3, 0, z).cylinder(0xd4af37, 0.09, 0.05, 3.3, 0.95, z);
    b.box(0x7f1d1d, 0.05, 0.05, 2.4, 3.3, 0.82, 5.6);

    // The lounge: two sofas along the wall, each with a low table
    for (const z of [CLUB.sofa.z, 2.9]) {
      b.box(0x581c87, 1, 0.45, 3.2, -8.9, 0, z).box(0x4c1d95, 0.3, 1.05, 3.2, -9.5, 0, z);
      b.box(0x4c1d95, 1, 0.7, 0.25, -8.9, 0, z - 1.72).box(0x4c1d95, 1, 0.7, 0.25, -8.9, 0, z + 1.72);
      b.cylinder(0x111827, 0.45, 0.42, -7.5, 0, z + 1.6, { sides: 18 }).box(0xfde68a, 0.1, 0.34, 0.1, -7.5, 0.42, z + 1.6, { glow: true });
    }

    // Toilets, off the room
    b.box(0x111827, 0.1, 2.3, 1.1, -9.9, 0, 5.6);

    // Light round the walls, and a rig over the floor
    b.box(PINK, width - 1, 0.1, 0.06, 0, 3.7, -length / 2 + 0.18, { glow: true });
    b.box(CYAN, 0.06, 0.1, length - 1, -width / 2 + 0.18, 3.7, 0, { glow: true }).box(CYAN, 0.06, 0.1, length - 1, width / 2 - 0.18, 3.7, 0, { glow: true });
    for (const z of [CLUB.floor.z - 2.2, CLUB.floor.z + 2.2]) b.box(0x27272a, CLUB.floor.halfWidth * 2 + 1, 0.14, 0.14, CLUB.floor.x, 4.2, z);
    this.group.add(b.build('club fittings'));

    const name = signBoard([CLUB.name.toUpperCase()], 5, 1.1, '#0a0a0f', '#f0abfc');
    name.position.set(booth.x, 3, -length / 2 + 0.24);
    const fee = signBoard([`GATE FEE  ₦${CLUB.gateFee.toLocaleString()}`], 2.3, 0.4, '#0a0a0f', '#67e8f9');
    fee.position.set(desk.x, 0.78, desk.z + 0.48);
    const toilets = signBoard(['TOILETS'], 1.2, 0.3, '#0a0a0f', '#e5e7eb');
    toilets.position.set(-9.82, 2.55, 5.6);
    toilets.rotation.y = Math.PI / 2;
    this.group.add(name, fee, toilets);

    // The room is lit in pools of colour: over the floor, along the bar, at the desk and in the lounge
    const pools: Array<[number, number, number, number]> = [
      [CLUB.floor.x, CLUB.floor.z, 0xf0abfc, 9],
      [bar.x - 1.6, bar.z, 0xfde68a, 7],
      [desk.x - 1, desk.z + 0.8, 0x93c5fd, 7],
      [-7, 0, 0xc4b5fd, 6],
      [0, 5.5, 0xfbcfe8, 5],
    ];
    for (const [x, z, hex, power] of pools) {
      const pool = new THREE.PointLight(hex, power, 16, 1);
      pool.position.set(x, 3.7, z);
      this.group.add(pool);
    }

    // Lit tiles in the floor, which change on the beat
    const columns = Math.round(CLUB.floor.halfWidth * 2);
    const rows = Math.round(CLUB.floor.halfLength * 2);
    const tile = new THREE.PlaneGeometry(0.92, 0.92);
    tile.rotateX(-Math.PI / 2);
    this.tiles = new THREE.InstancedMesh(tile, new THREE.MeshBasicMaterial(), columns * rows);
    const matrix = new THREE.Matrix4();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        this.tiles.setMatrixAt(r * columns + c, matrix.makeTranslation(CLUB.floor.x - CLUB.floor.halfWidth + c + 0.5, 0.07, CLUB.floor.z - CLUB.floor.halfLength + r + 0.5));
      }
    }
    this.group.add(this.tiles);
    this.lightTiles(0);

    // Beams from the rig, sweeping the floor
    const cone = new THREE.ConeGeometry(1.5, 4.1, 18, 1, true);
    cone.translate(0, -2.05, 0);
    TILE_COLOURS.slice(0, 4).forEach((hex, index) => {
      const beam = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.set(CLUB.floor.x + (index % 2 === 0 ? -2.2 : 2.2), 4.15, CLUB.floor.z + (index < 2 ? -2.2 : 2.2));
      this.beams.push(beam);
      this.group.add(beam);
    });

    // --- The door, and the things that are used ----------------------------------------------
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, length / 2), Math.PI);
    this.group.add(exitDoor);
    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Door to the street',
      category: 'Exit to Street',
      description: 'Step back out into the night.',
      interactionPoint: at(0, length / 2 - 1.3),
    });

    const mark = (w: number, h: number, d: number, x: number, z: number) => {
      const box = clickBox(w, h, d);
      box.position.set(x, h / 2, z);
      this.group.add(box);
      return box;
    };
    this.interactiveList.push(
      {
        mesh: mark(desk.halfWidth * 2, 1.4, 1.2, desk.x, desk.z),
        id: 'club_door_desk',
        name: 'Door desk',
        category: 'Pay here',
        description: `The gate fee is ₦${CLUB.gateFee.toLocaleString()}, paid once for the night. Without it there is no bar, floor or lounge.`,
        interactionPoint: at(CLUB.deskStand.x, CLUB.deskStand.z),
      },
      {
        mesh: mark(1.4, 1.5, bar.halfLength * 2, bar.x, bar.z),
        id: 'club_bar',
        name: 'Bar',
        category: 'Drinks',
        description: 'Tunde makes it and you pay as he hands it over. A bottle gets you a table in the lounge.',
        interactionPoint: at(CLUB.barStand.x, CLUB.barStand.z),
      },
      {
        mesh: mark(CLUB.floor.halfWidth * 2, 0.4, CLUB.floor.halfLength * 2, CLUB.floor.x, CLUB.floor.z),
        id: 'club_dance_floor',
        name: 'Dance floor',
        category: 'Dance',
        description: 'Dance a song through and the floor notices, a few times a night.',
        interactionPoint: at(CLUB.floorSpot.x, CLUB.floorSpot.z + 1.6),
      },
      {
        mesh: mark(1.6, 1.3, 3.4, CLUB.sofa.x, CLUB.sofa.z),
        id: 'club_lounge',
        name: 'Lounge table',
        category: 'Lounge',
        description: 'A seat out of the crush, for those who have bought a bottle tonight.',
        interactionPoint: at(CLUB.sofaStand.x, CLUB.sofaStand.z),
      }
    );

    const atDesk: PlaceAction = { label: () => this.service.deskLabel(), run: (host) => this.service.payAtDesk(host) };
    const atBar: PlaceAction = { label: () => this.service.barLabel(), run: (host) => this.service.askAtBar(host) };
    PlaceActions.registerAll({
      club_door_desk: atDesk,
      interior_npc_npc_club_cashier: atDesk,
      club_bar: atBar,
      interior_npc_npc_club_barman: atBar,
      club_dance_floor: { label: () => this.service.floorLabel(), run: (host) => this.service.dance(host) },
      club_lounge: { label: () => this.service.loungeLabel(), run: (host) => this.service.sitInLounge(host) },
    });

    // --- The people ---------------------------------------------------------------------------
    let cashier: InteriorNPCMesh | null = null;
    let barman: InteriorNPCMesh | null = null;
    for (const npcDef of this.def.npcs) {
      const npc = new InteriorNPCMesh(npcDef);
      this.npcs.push(npc);
      this.group.add(npc.group);
      const isCashier = npcDef.id === 'npc_club_cashier';
      const isBarman = npcDef.id === 'npc_club_barman';
      if (isCashier) cashier = npc;
      if (isBarman) barman = npc;
      if (npcDef.id.startsWith('npc_club_dancer_')) {
        this.dancers.push({ npc, phase: this.dancers.length * 1.7, yaw: npcDef.rotationY });
        this.service.nav.blockDisc(npcDef.relativePosition.x, npcDef.relativePosition.z, 0.3);
      } else if (!isCashier && !isBarman && npcDef.id !== 'npc_club_dj') {
        this.service.nav.blockDisc(npcDef.relativePosition.x, npcDef.relativePosition.z, 0.3);
      }
      this.interactiveList.push({
        mesh: npc.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: isCashier ? 'Pay here' : isBarman ? 'Drinks' : 'Club',
        description: npcDef.dialogueGreeting,
        // Staff are spoken to across their counters
        interactionPoint: isCashier
          ? at(CLUB.deskStand.x, CLUB.deskStand.z)
          : isBarman
            ? at(CLUB.barStand.x, CLUB.barStand.z)
            : npcDef.id === 'npc_club_dj'
              ? at(booth.x, booth.z + 1.5)
              : at(npcDef.relativePosition.x + 0.9, npcDef.relativePosition.z + 0.9),
      });
    }
    if (cashier && barman) this.service.setStaff(cashier.actor, barman.actor);
  }

  private lightTiles(beat: number): void {
    const colour = new THREE.Color();
    for (let i = 0; i < this.tiles.count; i++) {
      const pick = (i * 7 + beat * 5 + Math.floor(i / 8) * 3) % TILE_COLOURS.length;
      // Some tiles rest each beat, so the floor flickers and does not just change colour
      const lit = (i * 13 + beat * 7) % 5 === 0 ? 0.18 : 0.85;
      this.tiles.setColorAt(i, colour.setHex(TILE_COLOURS[pick]).multiplyScalar(lit));
    }
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) npc.update(delta, time);
    this.service.update(delta);

    // On the beat (the music runs at 112 to the minute)
    const beat = Math.floor(time / 0.535);
    if (beat !== this.beat) {
      this.beat = beat;
      this.lightTiles(beat);
    }
    this.beams.forEach((beam, index) => {
      beam.rotation.x = Math.sin(time * 1.3 + index * 1.9) * 0.5;
      beam.rotation.z = Math.cos(time * 1.1 + index * 2.3) * 0.5;
    });
    // The crowd on the floor moves to it
    for (const dancer of this.dancers) {
      if (dancer.npc.actor.busy) continue;
      dancer.npc.group.position.y = Math.abs(Math.sin(time * 5.87 + dancer.phase)) * 0.13;
      dancer.npc.group.rotation.y = dancer.yaw + Math.sin(time * 2.93 + dancer.phase) * 0.55;
    }
  }
}
