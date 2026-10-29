import * as THREE from 'three';
import { profileKey } from '../../backend/Profile';
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
import type { HomeStandard } from '../../housing/HomeStandard';
import { type RoomForFurniture } from '../../housing/HouseDecorationSystem';
import { roomDoor, DOOR_STYLES, type DoorStyle } from '../../housing/MoreFurniture';
import { InteractionDirector } from '../../interactions/InteractionDirector';

/** A door in one of the home's own doorways */
interface HomeDoor {
  id: string;
  name: string;
  /** The middle of the doorway, in the home's own space */
  x: number;
  z: number;
  /** Which way the wall runs: along x (0) or along z (a quarter turn) */
  yaw: number;
  /** Which side it swings to */
  swing: 1 | -1;
  holder: THREE.Group;
  leaf: THREE.Object3D | null;
  angle: number;
  style: string;
}
/** How wide the home's own doorways are */
const DOORWAY = 1.2;
/** The carport: how many cars it takes, side by side, and how wide each bay is */
const CARPORT_BAYS = 5;
const CARPORT_BAY = 3.4;

/** The uids of the four everyday pieces, and the cards that use them */
const CORE_TV = 'home_tv';
const CORE_CARDS: Record<string, string> = { home_bed: 'flat-bed', home_sofa: 'flat-tv', home_fridge: 'flat-fridge', home_drum: 'flat-drum' };
const CORE_WORDS: Record<string, { name: string; category: string; description: string }> = {
  'flat-tv': { name: 'Sofa & TV', category: 'Home Entertainment', description: 'Sit down and watch the Super Eagles. A little energy comes back while you relax.' },
  'flat-bed': { name: 'Master Bed', category: 'Rest & Recovery', description: 'Lie down and sleep. Energy and health come back while you rest.' },
  'flat-drum': { name: 'Water Drum & Bucket', category: 'Home Essentials', description: 'Cold borehole water and the red bucket. A quick bath wakes you up.' },
  'flat-fridge': { name: 'Fridge', category: 'Kitchen', description: 'Eat something from your bag.' },
};

type Starter = { uid?: string; id: string; x: number; z: number; turns: number };
const EVERY_HOME: Starter[] = [
  { uid: 'home_fridge', id: 'double_door_fridge', x: -14.7, z: 10.6, turns: 1 },
  { uid: 'home_drum', id: 'water_drum', x: 8.5, z: 0.5, turns: 3 },
  { id: 'toilet_wc', x: 14, z: 1.5, turns: 3 },
];
/** What each kind of home came with, as the catalogue's own pieces where the built ones stood */
const STARTERS: Record<HomeStandard, Starter[]> = {
  basic: [
    { uid: 'home_sofa', id: 'sofa2_brown', x: -7.6, z: 2.5, turns: 3 },
    { uid: CORE_TV, id: 'tv_24', x: -15.2, z: 4, turns: 1 },
    { uid: 'home_bed', id: 'double_bed_grey', x: 10.5, z: -6.5, turns: 0 },
    { id: 'plastic_set', x: -8, z: 10, turns: 0 },
    { id: 'lontor_fan', x: -11.5, z: 1.2, turns: 1 },
    { id: 'kerosene_stove', x: -12.4, z: 11.4, turns: 1 },
    ...EVERY_HOME,
  ],
  comfortable: [
    { uid: 'home_sofa', id: 'sofa3_leather', x: -7.6, z: 2.5, turns: 3 },
    { uid: CORE_TV, id: 'tv_43', x: -15.2, z: 4, turns: 1 },
    { uid: 'home_bed', id: 'king_bed_purple', x: 10.5, z: -6.5, turns: 0 },
    { id: 'double_bed_purple', x: -3, z: -7, turns: 0 },
    { id: 'ankara_rug', x: -6, z: 5, turns: 0 },
    { id: 'coffee_table', x: -6, z: 5, turns: 0 },
    { id: 'dining_table_6', x: -8, z: 10, turns: 0 },
    { id: 'majesty_palm', x: -0.5, z: 0.5, turns: 0 },
    { id: 'bathtub', x: 9.5, z: 3, turns: 0 },
    ...EVERY_HOME,
  ],
  luxury: [
    { uid: 'home_sofa', id: 'sofa3_leather', x: -7.6, z: 2.5, turns: 3 },
    { uid: CORE_TV, id: 'smart_tv_75', x: -15.4, z: 4, turns: 1 },
    { id: 'emerald_sofa', x: -2, z: 6, turns: 2 },
    { uid: 'home_bed', id: 'king_bed_purple', x: 10.5, z: -6.5, turns: 0 },
    { id: 'double_bed_purple', x: -3, z: -7, turns: 0 },
    { id: 'double_bed_blue', x: -12, z: -7, turns: 0 },
    { id: 'ankara_rug', x: -6, z: 5, turns: 0 },
    { id: 'coffee_table', x: -6, z: 5, turns: 0 },
    { id: 'dining_table_6', x: -8, z: 10, turns: 0 },
    { id: 'majesty_palm', x: -0.5, z: 0.5, turns: 0 },
    { id: 'bathtub', x: 9.5, z: 3, turns: 0 },
    { id: 'rain_shower', x: 13.5, z: 4.5, turns: 3 },
    ...EVERY_HOME,
  ],
};

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

  /** How well the home came furnished: set from the home the player rents or owns, each time they come in */
  public standard: HomeStandard = 'luxury';
  public static standardNow: (() => HomeStandard) | null = null;
  /** The player's own vehicles, as models, for the carport (set by the game) */
  public static carsOwned: (() => THREE.Object3D[]) | null = null;
  /** What the home came with, and in which homes */
  private kits: Array<{ object: THREE.Object3D; on: readonly HomeStandard[] }> = [];
  private kitSolids: Array<{ at: [number, number, number, number]; on: readonly HomeStandard[]; solid: { x: number; z: number; halfWidth: number; halfLength: number } | null }> = [];
  private leather!: THREE.MeshStandardMaterial;
  private coffeeTable!: THREE.Mesh;
  private tvUnit!: THREE.Mesh;
  private fridgeGroup!: THREE.Group;
  private masterMattress!: THREE.Mesh;
  private carportCars = new THREE.Group();
  /** The furniture the home was built with, hidden once it has been handed over as the player's own pieces */
  private builtIns: THREE.Object3D[] = [];
  private fixedSolids: Array<{ x: number; z: number; halfWidth: number; halfLength: number }> = [];
  /** Set once the home's own furniture has become the player's, to move, put away or sell */
  private handedOver = false;
  private readonly handedOverKey = profileKey('nigeria_life_home_handed_over_v1');
  private room!: RoomForFurniture;
  /** The doors in the home's own doorways */
  private doors: HomeDoor[] = [];
  private readonly doorsKey = profileKey('nigeria_life_home_doors_v1');

  /** This only stands in homes of these standards */
  private only(object: THREE.Object3D, ...on: HomeStandard[]): void {
    this.kits.push({ object, on });
    object.visible = on.includes(this.standard);
  }

  /** Floor taken up by something that only stands in homes of these standards */
  private onlyBlock(x: number, z: number, halfWidth: number, halfLength: number, ...on: HomeStandard[]): void {
    const entry = { at: [x, z, halfWidth, halfLength] as [number, number, number, number], on, solid: null as { x: number; z: number; halfWidth: number; halfLength: number } | null };
    if (on.includes(this.standard)) entry.solid = this.life.block(x, z, halfWidth, halfLength);
    this.kitSolids.push(entry);
  }

  /** The home the player is coming into: its name and where it is (set by the game) */
  public static homeName: (() => { name: string; area: string } | null) | null = null;
  /** Which of the player's homes it is: 'main' (the flat rented or bought) or a built house's plot (set by the game) */
  public static homeId: (() => string) | null = null;

  /** The player is coming in: the home is furnished as what they rent or own, and called by its name */
  public onPlayerArriving(): void {
    // Each home its own furniture: a house just built comes in bare, for the player to furnish
    HouseDecorationSystem.getInstance().setHome(ResidentialInterior.homeId?.() ?? 'main');
    const standard = ResidentialInterior.standardNow?.() ?? this.standard;
    this.furnish(standard);
    const home = ResidentialInterior.homeName?.();
    this.def.name = home?.name ?? (standard === 'basic' ? 'Your room & parlour' : standard === 'comfortable' ? 'Your flat' : 'Your house');
    if (home?.area) this.def.districtName = home.area;
  }

  /** In: their own vehicles stand in the carport */
  public onPlayerEntered(): void {
    this.parkCars();
  }

  /**
   * The first time the player comes home, what the home came with becomes theirs: the same pieces
   * from the catalogue, standing where the built ones stood, to move, put away or sell. From then
   * on the built pieces stay hidden and are not solid, whatever home the player moves to.
   */
  private handOver(standard: HomeStandard): void {
    if (!this.handedOver) {
      let done = false;
      try {
        done = localStorage.getItem(this.handedOverKey) === '1';
      } catch {
        // No storage: handed over again each time the page is loaded, and adopt skips what is there
      }
      // Only the first home came furnished; a house the player builds is theirs to furnish
      if (!done && HouseDecorationSystem.getInstance().homeId === 'main') {
        HouseDecorationSystem.getInstance().adopt(STARTERS[standard]);
        try {
          localStorage.setItem(this.handedOverKey, '1');
        } catch {
          // As above
        }
      }
      this.handedOver = true;
    }
    for (const object of this.builtIns) object.visible = false;
    for (const kit of this.kits) kit.object.visible = false;
    for (const entry of this.kitSolids) {
      if (entry.solid) this.life.unblock(entry.solid);
      entry.solid = null;
    }
    for (const solid of this.fixedSolids) this.life.unblock(solid);
    this.fixedSolids = [];
  }

  /** Shows what a home of this standard came with, and makes it, and only it, solid. */
  public furnish(standard: HomeStandard): void {
    this.standard = standard;
    for (const kit of this.kits) kit.object.visible = kit.on.includes(standard);
    for (const entry of this.kitSolids) {
      const wanted = entry.on.includes(standard);
      if (wanted && !entry.solid) entry.solid = this.life.block(...entry.at);
      if (!wanted && entry.solid) {
        this.life.unblock(entry.solid);
        entry.solid = null;
      }
    }
    this.handOver(standard);
    this.life.reblock();
    // The player's own furniture keeps its floor
    HouseDecorationSystem.getInstance().attach(this.room);
    this.furnitureChanged();
    // A first home: the sofa is old cloth, the table plastic, the television small on a table
    const basic = standard === 'basic';
    this.leather.color.setHex(basic ? 0x6b4f35 : 0x18181b);
    this.leather.roughness = basic ? 0.95 : 0.6;
    (this.coffeeTable.material as THREE.MeshStandardMaterial).color.setHex(basic ? 0xf1f5f9 : 0xfef08a);
    this.coffeeTable.scale.set(basic ? 0.6 : 1, basic ? 1.1 : 1, basic ? 0.7 : 1);
    const width = basic ? 1.6 : standard === 'comfortable' ? 3.0 : 6.2;
    const k = width / 6.2;
    const y = basic ? 1.55 : standard === 'comfortable' ? 2.1 : 2.4;
    this.tvScreen?.scale.set(k, k, 1);
    this.tvScreen?.position.setY(y);
    this.tvUnit.scale.set(1, (2.8 * k + 0.4) / 3.2, (6.2 * k + 0.3) / 6.5);
    this.tvUnit.position.setY(y);
    this.fridgeGroup.scale.set(basic ? 0.8 : 1, basic ? 0.55 : 1, basic ? 0.8 : 1);
    (this.masterMattress.material as THREE.MeshStandardMaterial).color.setHex(basic ? 0x93c5fd : 0x7c3aed);
  }

  /** The carport has the player's own vehicles in it, one to a bay, up to five, and nothing if they have none */
  private parkCars(): void {
    this.carportCars.clear();
    const cars = (ResidentialInterior.carsOwned?.() ?? []).slice(0, CARPORT_BAYS);
    cars.forEach((car, i) => {
      // Side by side down the carport, nose to the house
      car.position.set(0, 0, (i - (CARPORT_BAYS - 1) / 2) * CARPORT_BAY);
      car.rotation.set(0, -Math.PI / 2, 0);
      car.visible = true;
      this.carportCars.add(car);
    });
  }

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
      // Bright at any hour: the POP lights and the cove strips do the rest
      ambientLightIntensity: 1.55,
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
      const core = CORE_CARDS[item.uid];
      if (core) {
        this.followCore(core, item, origin);
        continue;
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
    // An everyday piece sold or put away takes its card with it
    if (this.handedOver) {
      for (const [uid, card] of Object.entries(CORE_CARDS)) {
        if (standing.has(uid) && decor.placing?.moving?.uid !== uid) continue;
        const at = this.interactiveList.findIndex((o) => o.id === card);
        if (at >= 0) this.interactiveList.splice(at, 1);
      }
    }
  }

  /**
   * One of the four everyday pieces (bed, sofa, fridge, water drum): its card keeps its name and
   * what it does, stands where the piece now is, and the walk to use it goes there. Moving,
   * putting away and selling it are on the card's second button.
   */
  private followCore(card: string, item: PlacedItem, origin: THREE.Vector3): void {
    const decor = HouseDecorationSystem.getInstance();
    const kind = decor.kind(item.modelType);
    const turn = (item.turns * Math.PI) / 2;
    const face = decor.facing(item.turns);
    const size = decor.footprint(item.modelType, item.turns);
    const onIt = (x: number, z: number) => new THREE.Vector3(item.x + x * Math.cos(turn) + z * Math.sin(turn), 0, item.z - x * Math.sin(turn) + z * Math.cos(turn));
    const reach = (face.x !== 0 ? size.width : size.depth) / 2 + 0.6;
    const front = new THREE.Vector3(item.x + face.x * reach, 0, item.z + face.z * reach);
    let stand = front;
    if (card === 'flat-bed' && kind.bed) {
      HOME.bed.root.copy(onIt(kind.bed.x, kind.bed.z));
      const sides = [onIt(kind.bed.side + 0.6, 0.3), onIt(-kind.bed.side - 0.6, 0.3)];
      HOME.bed.side.copy(sides.find((point) => this.life.nav.isFree(origin.x + point.x, origin.z + point.z)) ?? sides[0]);
      HOME.bed.top = kind.bed.top;
      HOME.bed.facing = turn;
      stand = HOME.bed.side;
    } else if (card === 'flat-tv' && kind.seat) {
      HOME.sofa.seat.copy(onIt(kind.seat.x, kind.seat.z));
      HOME.sofa.front.copy(front);
      HOME.sofa.facing = Math.atan2(face.x, face.z);
    } else if (card === 'flat-fridge') {
      HOME.fridge.position.set(item.x, 0, item.z);
      HOME.fridge.front.copy(front);
    } else if (card === 'flat-drum') {
      HOME.drum.position.set(item.x, 0, item.z);
      HOME.drum.front.copy(front);
    }
    const existing = this.interactiveList.find((o) => o.id === card);
    const entry = existing ?? { id: card, name: '', category: '', description: '', mesh: item.mesh, interactionPoint: new THREE.Vector3() };
    entry.mesh = item.mesh;
    entry.interactionPoint.set(origin.x + stand.x, 0, origin.z + stand.z);
    if (!existing) {
      const words = CORE_WORDS[card];
      Object.assign(entry, words);
      this.interactiveList.push(entry);
    }
    PlaceActions.register(`${card}:move`, this.pieceChoices(item));
  }

  /** Move it, put it away, or sell it: for a piece whose card is for using it */
  private pieceChoices(item: PlacedItem): PlaceAction {
    const decor = HouseDecorationSystem.getInstance();
    const name = decor.catalogueItem(item.id)?.name ?? 'Furniture';
    return {
      label: () => '🪑 Move, store or sell',
      run: (host) => host.ask({ who: name, role: 'Your furniture', text: 'What do you want to do with it?', choices: [
        { label: 'Move it', note: 'Free', pick: () => { decor.pickUp(item.uid); } },
        { label: 'Put it in storage', note: 'Place it again later, free', pick: () => { if (decor.putAway(item.uid)) host.say(`${name} is in storage. Find it under Storage in the catalogue.`, 'success'); } },
        { label: 'Sell it', note: `₦${decor.resaleValue(item).toLocaleString()} back`, pick: () => { const sold = decor.sell(item.uid); if (sold.ok) host.say(`${name} sold. ₦${sold.refund.toLocaleString()} back.`, 'info'); } },
      ] }),
    };
  }

  /** What can be done at a piece of the player's own furniture. */
  private furnitureAction(item: PlacedItem): PlaceAction {
    const decor = HouseDecorationSystem.getInstance();
    const kind = decor.kind(item.modelType);
    const name = decor.catalogueItem(item.id)?.name ?? 'Furniture';
    return {
      label: () => {
        const set = this.sets.get(item.uid);
        if (item.modelType === 'toilet_wc') return '🚽 Use the toilet, move it or sell it';
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
        if (kind.use === 'door') return '🚪 Move the door or sell it';
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
          if (item.modelType === 'toilet_wc') choices.push({ label: 'Use the toilet', note: 'Bladder back to 100', pick: () => { this.life.useToilet(seat, front, Math.atan2(face.x, face.z)); } });
          else choices.push({ label: 'Sit down', pick: () => { this.life.sitAt(seat, front, Math.atan2(face.x, face.z)); } });
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
            note: 'Hunger +60, Cooking +1',
            pick: () => {
              (host as any).backend.modifyNeed('hunger', 60);
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
              (host as any).backend.modifyNeed('hunger', 15);
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
        choices.push({ label: 'Put it in storage', note: 'Place it again later, free', pick: () => { if (decor.putAway(item.uid)) host.say(`${decor.catalogueItem(item.id)?.name ?? 'It'} is in storage. Find it under Storage in the catalogue.`, 'success'); } });
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

    // Dividing walls between the rooms, as tall as the catalogue's partition walls, with a doorway
    // into each room and a door in it: the living room, two bedrooms, and the bathroom side
    const partitionH = 2.6;
    const partition = (centerX: number, centerZ: number, width: number, length: number) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(width, partitionH, length), wallMat);
      wall.position.set(centerX, partitionH / 2, centerZ);
      wall.name = 'home_partition';
      this.group.add(wall);
      this.life.block(centerX, centerZ, width / 2, length / 2);
    };
    /** A wall along x from x0 to x1 at z, or along z from z0 to z1 at x, with a doorway centred at `door` */
    const wallAlongX = (z: number, x0: number, x1: number, door?: number) => {
      const cuts = door === undefined ? [[x0, x1]] : [[x0, door - DOORWAY / 2], [door + DOORWAY / 2, x1]];
      for (const [a, b] of cuts) if (b - a > 0.05) partition((a + b) / 2, z, b - a, wallT);
    };
    const wallAlongZ = (x: number, z0: number, z1: number, door?: number) => {
      const cuts = door === undefined ? [[z0, z1]] : [[z0, door - DOORWAY / 2], [door + DOORWAY / 2, z1]];
      for (const [a, b] of cuts) if (b - a > 0.05) partition(x, (a + b) / 2, wallT, b - a);
    };
    // The living room to the first bedroom, and on to the bathroom side
    wallAlongX(-1, -15.8, 6, -8.6);
    // Between the two bedrooms, all the way
    wallAlongZ(2, -12.8, -1);
    // The master bedroom to the bathroom side
    wallAlongX(-1, 6, 15.8, 10.6);
    // The living room to the bathroom side
    wallAlongZ(6, -1, 11.8, 0.8);
    this.hangDoors([
      { id: 'home_door_bedroom1', name: 'Bedroom door', x: -8.6, z: -1, yaw: 0, swing: 1 },
      { id: 'home_door_bedroom2', name: 'Master bedroom door', x: 10.6, z: -1, yaw: 0, swing: 1 },
      { id: 'home_door_bathroom', name: 'Bathroom door', x: 6, z: 0.8, yaw: Math.PI / 2, swing: -1 },
    ]);

    // 2. POP ceiling cornices with warm LED cove lights round every wall, and a light in every room
    this.popCeiling(wallH);
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-6, 4.0, 4), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(8, 4.0, -6), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-5, 4.0, -6), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(11, 4.0, 5), 0xfff7ed));

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
    const firstBuiltIn = this.group.children.length;
    // A. Circular Orange & Gold Heritage Rug (Screenshot 5)
    const rugOuter = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.7, 32),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.9, side: THREE.DoubleSide })
    );
    rugOuter.rotation.x = -Math.PI / 2;
    rugOuter.position.set(-6, 0.02, 5);
    this.group.add(rugOuter);
    this.only(rugOuter, 'comfortable', 'luxury');

    const rugInner = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 })
    );
    rugInner.rotation.x = -Math.PI / 2;
    rugInner.position.set(-6, 0.022, 5);
    this.group.add(rugInner);
    this.only(rugInner, 'comfortable', 'luxury');

    // B. Emerald Green 3-Seater Sofa
    // The same sofa the catalogue sells, built large: a seat, a back, arms and cushions
    const sofa = buildFurniture('sofa_emerald')!;
    sofa.scale.set(1.75, 1.25, 1.75);
    sofa.rotation.y = Math.PI;
    sofa.position.set(-2, 0, 6);
    this.group.add(sofa);
    this.only(sofa, 'luxury');

    // C. Black leather sofa facing the TV: a seat to sit on, with a back and arms
    const sofaBlack = new THREE.Group();
    sofaBlack.position.set(-7.5, 0, 2.5);
    const leather = (this.leather = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 }));
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
    this.coffeeTable = coffeeTable;

    // E. 75-inch Flat Screen TV & Entertainment Wall Console
    const tvUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.2, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 })
    );
    tvUnit.position.set(-15.8, 2.4, 4);
    this.group.add(tvUnit);
    this.tvUnit = tvUnit;
    // In a first home the set stands on a small table instead of hanging on the wall
    const tvTable = new Builder().box(0x8b5a2b, 1.0, 0.08, 2.1, 0, 1.0, 0).box(0x6b4423, 0.08, 1.0, 0.08, -0.4, 0, -0.95).box(0x6b4423, 0.08, 1.0, 0.08, -0.4, 0, 0.95).box(0x6b4423, 0.08, 1.0, 0.08, 0.4, 0, -0.95).box(0x6b4423, 0.08, 1.0, 0.08, 0.4, 0, 0.95).build('tv table');
    tvTable.position.set(-15.2, 0, 4);
    this.group.add(tvTable);
    this.only(tvTable, 'basic');

    const screenGeo = new THREE.PlaneGeometry(6.2, 2.8);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    this.tvScreen = new THREE.Mesh(screenGeo, screenMat);
    this.tvScreen.rotation.y = Math.PI / 2;
    this.tvScreen.position.set(-15.65, 2.4, 4);
    this.group.add(this.tvScreen);
    this.television = new Television(this.tvScreen);
    // Sitting down to watch turns the set on; whoever is sitting can turn it to something else
    this.life.onWatch = () => { if (!this.televisions().some((set) => set.on)) (this.sets.get(CORE_TV) ?? this.television).turnOn('football'); };
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
    this.only(diningTable, 'comfortable', 'luxury');

    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    tableLeg.position.set(-8, 0.55, 10);
    this.group.add(tableLeg);
    this.only(tableLeg, 'comfortable', 'luxury');

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const chair = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x9a3412 })
      );
      chair.position.set(-8 + Math.cos(a) * 1.8, 0.35, 10 + Math.sin(a) * 1.8);
      this.group.add(chair);
      this.only(chair, 'comfortable', 'luxury');
    }

    // G. Potted Indoor Majesty Palm Plant (Screenshot 5)
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.25, 0.7, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef08a })
    );
    pot.position.set(-0.5, 0.35, 0.5);
    this.group.add(pot);
    this.only(pot, 'comfortable', 'luxury');

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
    this.masterMattress = masterMattress;

    // B. Center Bedroom - Purple Bed (Screenshot 5)
    const centerBed = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.8, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    centerBed.position.set(-3, 0.4, -7);
    this.group.add(centerBed);
    this.only(centerBed, 'comfortable', 'luxury');

    const centerMattress = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.5, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 })
    );
    centerMattress.position.set(-3, 0.9, -7);
    this.group.add(centerMattress);
    this.only(centerMattress, 'comfortable', 'luxury');

    // C. Guest Bedroom (Left) - Blue Bed (Screenshot 5)
    const guestBed = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.8, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    guestBed.position.set(-12, 0.4, -7);
    this.group.add(guestBed);
    this.only(guestBed, 'luxury');

    const guestMattress = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.5, 4.0),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 }) // Vibrant Blue
    );
    guestMattress.position.set(-12, 0.9, -7);
    this.group.add(guestMattress);
    this.only(guestMattress, 'luxury');

    // 6. Bathroom (Tiled with Bathtub, Glass Shower, WC, Blue Drum & Red Bucket!):
    // White Ceramic Bathtub
    const tub = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.8, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    tub.position.set(9.5, 0.4, 3);
    this.group.add(tub);
    this.only(tub, 'comfortable', 'luxury');

    // Glass Shower Booth
    const showerGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 3.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.4, roughness: 0.1 })
    );
    showerGlass.position.set(13.5, 1.6, 4.5);
    this.group.add(showerGlass);
    this.only(showerGlass, 'luxury');

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
    this.createOutdoorCarport(20.6, 0, 0);

    // 8. Attach House Decoration System Placed Items Group
    const decorationSystem = HouseDecorationSystem.getInstance();
    this.group.add(decorationSystem.placedItemsGroup);
    decorationSystem.onPaint = (hex) => this.wallPaint.color.setHex(hex);
    decorationSystem.onFloor = (hex, roughness) => {
      this.floorMat.color.setHex(hex);
      this.floorMat.roughness = roughness;
    };
    decorationSystem.onChanged = () => this.furnitureChanged();
    this.room = {
      halfWidth: 16,
      halfLength: 13,
      solids: () => this.life.solids,
      // The furniture's own floor is marked directly: it is not part of what the home came with
      block: (x, z, halfWidth, halfLength) => this.life.nav.blockRect(x, z, halfWidth, halfLength),
      unblock: (x, z, halfWidth, halfLength) => this.life.nav.clearRect(x, z, halfWidth, halfLength),
      keepClear: [{ x: 0, z: 8 }, { x: 0, z: 10.6 }],
    };
    decorationSystem.attach(this.room);

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
    this.fridgeGroup = fridge;

    // Pillow at the head of the master bed
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.22, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 })
    );
    pillow.position.set(10.5, 1.26, -8.2);
    this.group.add(pillow);

    // Each bed has a headboard, pillows and a turned-down cover, so it reads as a bed and not a slab
    const beds: Array<[number, number, number, number, number, HomeStandard[]]> = [
      [10.5, -6.5, 4.8, 5.2, 0x6d28d9, ['basic', 'comfortable', 'luxury']],
      [-3, -7, 4.2, 4.6, 0x6d28d9, ['comfortable', 'luxury']],
      [-12, -7, 3.6, 4.4, 0x1d4ed8, ['luxury']],
    ];
    for (const [x, z, width, depth, cover, on] of beds) {
      const bedding = new Builder();
      const head = z - depth / 2;
      bedding.box(0x3f2a17, width + 0.2, 1.9, 0.22, x, 0, head + 0.05);
      for (const side of [-1, 1]) bedding.box(0xffffff, width * 0.36, 0.2, 0.8, x + side * width * 0.22, 1.15, head + 0.85);
      bedding.box(cover, width - 0.36, 0.09, depth * 0.5, x, 1.15, z + depth * 0.2).box(0xf8fafc, width - 0.36, 0.1, 0.42, x, 1.16, z - depth * 0.08);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bedding.box(0x1c1917, 0.18, 0.12, 0.18, x + sx * (width / 2 - 0.2), -0.02, z + sz * (depth / 2 - 0.2));
      const built = bedding.build('bedding');
      this.group.add(built);
      this.only(built, ...on);
    }

    // 10. Everything solid, so walking goes around it
    this.onlyBlock(-2, 6, 2.4, 0.9, 'luxury'); // green sofa
    this.fixedSolids.push(this.life.block(-6, 5, 1.2, 0.7)); // coffee table
    this.onlyBlock(-8, 10, 2.05, 2.05, 'comfortable', 'luxury'); // dining table and chairs
    this.onlyBlock(-0.5, 0.5, 0.35, 0.35, 'comfortable', 'luxury'); // palm pot
    this.fixedSolids.push(this.life.block(10.5, -6.5, 2.4, 2.6)); // master bed
    this.onlyBlock(-3, -7, 2.1, 2.3, 'comfortable', 'luxury'); // centre bed
    this.onlyBlock(-12, -7, 1.8, 2.2, 'luxury'); // guest bed
    this.onlyBlock(9.5, 3, 1.7, 0.8, 'comfortable', 'luxury'); // bathtub
    this.onlyBlock(13.5, 4.5, 1.1, 1.1, 'luxury'); // shower
    this.fixedSolids.push(this.life.block(14, 1.5, 0.4, 0.55)); // toilet
    this.fixedSolids.push(this.life.block(HOME.drum.position.x, HOME.drum.position.z, 0.8, 0.8));
    this.fixedSolids.push(this.life.block(9.8, 0.6, 0.45, 0.45)); // bucket
    this.fixedSolids.push(this.life.block(HOME.fridge.position.x, HOME.fridge.position.z, 0.5, 0.5));

    // A first home: plastic chairs where the dining set would be, a fan, and a kerosene stove by the fridge
    const plastic = buildFurniture('plastic_set')!;
    plastic.scale.setScalar(1.5);
    plastic.position.set(-8, 0, 10);
    this.group.add(plastic);
    this.only(plastic, 'basic');
    this.onlyBlock(-8, 10.15, 0.75, 0.9, 'basic');
    const fan = buildFurniture('standing_fan')!;
    fan.scale.setScalar(1.5);
    fan.position.set(-11.5, 0, 1.2);
    this.group.add(fan);
    this.only(fan, 'basic');
    this.onlyBlock(-11.5, 1.2, 0.4, 0.4, 'basic');
    const stove = buildFurniture('kerosene_stove')!;
    stove.scale.setScalar(1.5);
    stove.position.set(-12.4, 0, 11.4);
    this.group.add(stove);
    this.only(stove, 'basic');
    this.onlyBlock(-12.4, 11.4, 0.45, 0.45, 'basic');

    // Everything built from the living room on is furniture, but for the carport and the player's own pieces
    this.builtIns = this.group.children.slice(firstBuiltIn).filter((child) => child !== decorationSystem.placedItemsGroup && child.name !== 'carport' && child !== this.carportCars);

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
  /**
   * POP ceilings: a white plaster cornice stepped out from the top of every outer wall, a gold
   * line along it, warm LED strips in the cove that light the walls, and a downlight set in a
   * round POP rose in each room.
   */
  private popCeiling(wallH: number): void {
    const b = new Builder();
    const top = wallH - 0.55;
    const runs: Array<[number, number, number, number, number, number]> = [
      // x, z, width, depth, and which way is into the room (x, z)
      [0, -12.45, 31.2, 0.7, 0, 1],
      [0, 12.45, 31.2, 0.7, 0, -1],
      [-15.45, 0, 0.7, 25.2, 1, 0],
      [15.45, 0, 0.7, 25.2, -1, 0],
    ];
    for (const [x, z, w, d, ix, iz] of runs) {
      // Two steps of plaster, the lower one standing further out into the room
      b.box(0xf8fafc, w, 0.3, d, x, top, z).box(0xf1f5f9, w, 0.18, d, x - ix * 0.12, top + 0.3, z - iz * 0.12);
      b.box(0xd4af37, ix ? 0.04 : w, 0.04, iz ? 0.04 : d, x + ix * 0.36, top + 0.12, z + iz * 0.36);
      b.box(0xffd59e, ix ? 0.06 : w - 1, 0.06, iz ? 0.06 : d - 1, x + ix * 0.4, top - 0.06, z + iz * 0.4, { glow: true });
    }
    // A downlight in each room, set in a round POP rose
    for (const [x, z] of [[-6, 6], [-11, -7], [9, -7], [11, 5], [-12, 8]]) b.cylinder(0xf8fafc, 0.55, 0.08, x, wallH - 0.25, z, { sides: 20 }).cylinder(0xfff7d6, 0.28, 0.04, x, wallH - 0.3, z, { sides: 16, glow: true });
    const pop = b.build('pop ceiling', { roughness: 0.6 });
    pop.name = 'pop ceiling';
    this.group.add(pop);
  }

  /** The doors in the home's own doorways, each in the style the player chose for it */
  private hangDoors(spec: Array<Omit<HomeDoor, 'holder' | 'leaf' | 'angle' | 'style'>>): void {
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem(this.doorsKey) || '{}') ?? {};
    } catch {
      // Every door as it came
    }
    const origin = this.group.position;
    for (const d of spec) {
      const holder = new THREE.Group();
      holder.name = `home door ${d.id}`;
      holder.position.set(d.x, 0, d.z);
      holder.rotation.y = d.yaw;
      this.group.add(holder);
      const door: HomeDoor = { ...d, holder, leaf: null, angle: 0, style: DOOR_STYLES.some((st) => st.id === saved[d.id]) ? saved[d.id] : 'panel' };
      this.fitDoor(door);
      this.doors.push(door);
      // Stand beside the doorway on the living-room side to change the door
      const off = d.yaw === 0 ? new THREE.Vector3(1.1, 0, 0.9) : new THREE.Vector3(-0.9, 0, 1.1);
      const stand = new THREE.Vector3(origin.x + d.x + off.x, 0, origin.z + d.z + off.z);
      this.interactiveList.push({ mesh: holder, id: d.id, name: d.name, category: 'Your home', description: 'Opens as you come up to it and closes behind you.', interactionPoint: stand });
      PlaceActions.register(d.id, {
        label: () => `🚪 ${d.name}: ${DOOR_STYLES.find((st) => st.id === door.style)?.name ?? 'a door'} · change it`,
        run: (host) => host.ask({
          who: d.name,
          role: 'Your home',
          text: 'Change the door? The new one is fitted while you watch; the old one is taken away.',
          choices: [
            ...DOOR_STYLES.map((style) => ({
              label: style.name,
              note: style.id === door.style ? 'This one' : `₦${style.price.toLocaleString()}`,
              pick: () => {
                if (style.id === door.style) return;
                host.director.perform({
                  id: 'fit a door', actor: host.actor, point: stand, target: new THREE.Vector3(origin.x + d.x, 0, origin.z + d.z), animation: { arms: 'reach' }, seconds: 2.4, effectAt: 0.8, ifStuck: 'snap',
                  effect: () => {
                    if (!host.backend.pay(style.price, `${style.name} for the ${d.name.toLowerCase()}`, 'SHOP_PURCHASE')) {
                      host.say(`A ${style.name.toLowerCase()} is ₦${style.price.toLocaleString()}. You do not have it.`, 'warning');
                      return false;
                    }
                    this.setDoorStyle(door, style);
                    host.say(`${style.name} fitted on the ${d.name.toLowerCase()}.`, 'success');
                    return true;
                  },
                });
              },
            })),
            { label: 'Leave it', pick: () => undefined },
          ],
        }),
      });
    }
  }

  private fitDoor(door: HomeDoor): void {
    door.holder.clear();
    const style = DOOR_STYLES.find((st) => st.id === door.style) ?? DOOR_STYLES[1];
    const model = roomDoor(style, DOORWAY);
    door.holder.add(model);
    door.leaf = model.getObjectByName('door_leaf') ?? null;
    if (door.leaf) door.leaf.rotation.y = door.angle;
  }

  private setDoorStyle(door: HomeDoor, style: DoorStyle): void {
    door.style = style.id;
    this.fitDoor(door);
    try {
      localStorage.setItem(this.doorsKey, JSON.stringify(Object.fromEntries(this.doors.map((d) => [d.id, d.style]))));
    } catch {
      // Kept for this visit
    }
  }

  /** Doors swing open as the player comes within reach, and close again behind them */
  private swingDoors(delta: number): void {
    const player = InteractionDirector.get().player;
    if (!player) return;
    const origin = this.group.position;
    const px = player.root.position.x - origin.x;
    const pz = player.root.position.z - origin.z;
    const ease = Math.min(1, delta * 6);
    for (const door of this.doors) {
      const near = Math.hypot(px - door.x, pz - door.z) < 1.9;
      door.angle += ((near ? door.swing * 1.5 : 0) - door.angle) * ease;
      if (door.leaf) door.leaf.rotation.y = door.angle;
    }
    // And the doors the player bought and stood between their own walls
    for (const item of HouseDecorationSystem.getInstance().placed) {
      if (!item.modelType.startsWith('room_door_')) continue;
      const leaf = item.mesh.getObjectByName('door_leaf');
      if (!leaf) continue;
      const near = Math.hypot(px - item.x, pz - item.z) < 1.6;
      leaf.rotation.y += ((near ? 1.5 : 0) - leaf.rotation.y) * ease;
    }
  }

  private createOutdoorCarport(x: number, y: number, z: number): void {
    const carportGroup = new THREE.Group();
    carportGroup.position.set(x, y, z);

    // A carport for five cars side by side: an interlocked driveway, a bay marked out for each car,
    // steel posts and a slatted roof over it all, a light over each bay, and a gate at the end
    const length = CARPORT_BAYS * CARPORT_BAY + 0.6;
    const b = new Builder();
    b.box(0xb8b8b0, 7.4, 0.2, length, 0, -0.2, 0);
    for (let i = 0; i <= CARPORT_BAYS; i++) b.box(0xf8fafc, 5.6, 0.02, 0.1, 0.4, 0.01, (i - CARPORT_BAYS / 2) * CARPORT_BAY);
    for (const px of [-3.4, 3.4]) for (let i = 0; i <= CARPORT_BAYS; i++) b.box(0x334155, 0.2, 3.4, 0.2, px, 0, (i - CARPORT_BAYS / 2) * CARPORT_BAY);
    for (let rz = -length / 2 + 0.3; rz <= length / 2; rz += 0.9) b.box(0xeab308, 7.2, 0.12, 0.35, 0, 3.4, rz);
    b.box(0x334155, 0.25, 0.25, length, -3.4, 3.3, 0).box(0x334155, 0.25, 0.25, length, 3.4, 3.3, 0);
    for (let i = 0; i < CARPORT_BAYS; i++) b.box(0xfff7d6, 0.6, 0.06, 0.6, 0, 3.32, (i - (CARPORT_BAYS - 1) / 2) * CARPORT_BAY, { glow: true });
    // The sliding gate at the far end
    b.box(0x111827, 0.12, 2.2, length * 0.6, 3.9, 0, 0);
    for (let i = 0; i < 14; i++) b.box(0x374151, 0.14, 2.2, 0.06, 3.9, 0, -length * 0.3 + i * (length * 0.6) / 13);
    carportGroup.add(b.build('carport frame', { roughness: 0.7 }));

    // Parked Cars under carport
    // The player's own vehicles are parked here when they come home (see parkCars)
    carportGroup.add(this.carportCars);

    carportGroup.name = 'carport';
    this.group.add(carportGroup);
  }

  public update(delta: number, _time: number): void {
    this.animTime += delta;

    for (const blade of this.fanBlades) {
      blade.rotation.z += delta * 24;
    }

    this.life.update(delta);
    this.swingDoors(delta);

    for (const head of this.fanHeads) {
      head.rotation.y = Math.sin(this.animTime * 1.5) * 0.7;
    }

    for (const set of this.televisions()) set.update(delta);
  }
}
