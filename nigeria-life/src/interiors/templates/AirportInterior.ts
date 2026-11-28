import { addWork } from '../places/WorkSite';
import { AIRPORT_WORK } from '../places/PlaceJobs';
import * as THREE from 'three';
import type { InteriorDefinition, InteriorNPCDef } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import { NavGrid } from '../../interactions/NavGrid';
import { AIRPORTS, ROUTES, type FlightCity } from '../../travel/Flights';
import { Kit, M, WAYFINDING, contactShade, floorPlane, lightPool, mergeFloorDecals, signMesh } from '../airport/TerminalKit';
import { BAG_COLOURS, LuggageBatch, type BagKind } from '../airport/Luggage';
import { AirportCrowd } from '../airport/AirportCrowd';
import { AirportServices, SEAT_FORWARD, seatLift, type AirportSeat } from '../airport/AirportServices';
import { AirportSound } from '../airport/AirportSound';
import { AirportTalk } from '../airport/AirportTalk';
import { Escalator, GlassLift, rideLift, rideStair } from '../airport/Vertical';
import { ESCALATOR_RUN, HALL_DOWN, HALL_LIFT, HALL_UP, HALL_UP_STAND, LEVEL_RISE, UPPER_ID, UPPER_KEY, UPPER_LIFT, UPPER_TOP } from '../airport/Levels';
import { placeRooms } from '../places/PlaceInterior';
import { PlaceActions } from '../../destinations/PlaceActions';
import { Sequence, steps } from '../../interactions/Sequence';
import { RigRegistry } from '../../graphics/people/RigRegistry';
import { APRON, APRON_CREW, ApronLife } from '../airport/ApronLife';

/**
 * The airport terminal, gone into from the kerb: one domestic terminal hall, laid out the way a
 * Nigerian domestic terminal is. In through the glass doors from the kerb; the check-in hall with
 * its counters, queue lanes, self check-in kiosks and departure boards; the information desk;
 * security, two lanes of trays, X-ray machines and arches; airside, a café, a snack shop, the
 * airline's lounge and the gate seating along a glass wall onto the apron, where the aircraft
 * stand; and on the arrivals side the baggage belt, the SIM desk and the cab desk.
 *
 * Its surfaces are real (marble, brushed metal, wood, leather, terrazzo), its light falls in pools
 * on the floor, and everything in one area is merged by material, so the whole hall stays light
 * on a phone. One hall serves every city: its boards show the flights of the airport it is in.
 */

const W = 56;
const L = 40;
const H = 9;

/** Where the counters are along the check-in island */
const COUNTERS = [-23.5, -20.5, -17.5, -14.5, -11.5, -8.5];
const LANES = [-2.5, 3.5];
const GATES = [8, 20];
/** How far a café chair stands from the middle of its table: room for the knees under the top */
const CAFE_CHAIR = 0.88;
const CAROUSEL = new THREE.Vector3(16, 0, 10);
const ARRIVALS_DOOR = 26.2;
const BELT_STRAIGHT = 6;
const BELT_RADIUS = 1.5;

type Stand = { x: number; z: number };

const traveller = (id: string, name: string, at: Stand, rotationY: number, outfitColor: number, gender: 'male' | 'female', greeting: string): InteriorNPCDef => ({
  id, name, role: 'Traveller', title: 'Passenger', relativePosition: new THREE.Vector3(at.x, 0, at.z), rotationY, outfitColor, gender, light: true, badge: 'near',
  dialogueGreeting: greeting, actions: [],
});

const staff = (id: string, name: string, role: string, title: string, at: Stand, rotationY: number, outfitColor: number, gender: 'male' | 'female', greeting: string, extra: Partial<InteriorNPCDef> = {}): InteriorNPCDef => ({
  id, name, role, title, relativePosition: new THREE.Vector3(at.x, 0, at.z), rotationY, outfitColor, gender, dialogueGreeting: greeting, actions: [], badge: 'near', light: true, ...extra,
});

export class AirportInterior {
  /** The game's clock (hours from midnight), for the departure boards; set by the game */
  public static hourNow: () => number = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };

  /** Where the player is, so a name shows only over the people near them; set by the game */
  public static playerAt: () => THREE.Vector3 | null = () => null;

  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  private readonly scratch = new THREE.Vector3();
  /** The upper front wall and the ceiling lights: only seen with the camera down inside the hall */
  private eyeOnly!: THREE.Group;
  public def: InteriorDefinition;
  public nav: NavGrid;

  private clock = 0;
  private boardsFor = '';
  private sinceBoards = 99;
  private readonly boards: Array<{ canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; kind: 'departures' | 'gate'; gate?: number }> = [];
  private apron!: ApronLife;
  private beltPlates!: THREE.InstancedMesh;
  private beltBags!: LuggageBatch;
  /** Bags on the belt: along the loop (t), or still sliding down the feed (ramp 0 to 1); away while someone has it */
  private readonly onBelt: Array<{ kind: BagKind; colour: number; t: number; ramp: number; away: number; turn: number }> = [];
  private beltRun = 0;
  private crowd!: AirportCrowd;
  /** Seats nobody in the crowd is in: the player may sit on these */
  private readonly freeSeats: AirportSeat[] = [];
  private services!: AirportServices;
  private sound!: AirportSound;
  /** The staff who greet a passenger who walks up, and what they say */
  private talk!: AirportTalk;
  /** The ways up to the upper level: two escalators and a glass lift */
  private escalators: Escalator[] = [];
  private lift!: GlassLift;
  private readonly bm = new THREE.Matrix4();
  private readonly bq = new THREE.Quaternion();
  private readonly be = new THREE.Euler();
  private readonly bv = new THREE.Vector3();
  private readonly bone = new THREE.Vector3(1, 1, 1);

  constructor() {
    this.group = new THREE.Group();
    // Isolated world coordinates for the terminal hall
    const origin = new THREE.Vector3(260, 0, 240);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_airport',
      name: 'Murtala Muhammed International Airport (LOS)',
      type: 'airport',
      tier: 'tier3_simulated',
      districtName: 'Ikeja Aviation Corridor',
      streetBuildingId: 'mma-airport',
      // The kerb of Murtala Muhammed, in Ikeja (see Landmarks)
      streetEntrance: new THREE.Vector3(-53, 0, 6268.8),
      streetExitRotation: 0,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 17),
      exitDoorOffset: new THREE.Vector3(0, 0, 19.6),
      cameraOffset: new THREE.Vector3(0, 18, 22),
      ambientLightColor: 0xfff6ea,
      ambientLightIntensity: 1.1,
      rooms: [
        {
          id: 'airport_main_terminal',
          name: 'Domestic Terminal: Check-in, Security, Gates and Arrivals',
          size: { width: W, length: L, height: H },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xd9dadc,
          wallColor: 0xf2efe9,
        },
      ],
      stations: [
        {
          id: 'airport_checkin_desk',
          name: 'NigeriaLife Air Tickets & Check-In',
          category: 'Aviation Check-In',
          description: 'Six counters: show your ticket, weigh and tag your bag, take your boarding pass.',
          relativePosition: new THREE.Vector3(-14.5, 0, 4.2),
          actions: [
            {
              id: 'airport_issue_boarding_pass',
              label: '🎫 Flight Check-In & Boarding Pass',
              // Live check-in is PlaceActions on airport_checkin_desk (FlightService). Def actions are display-only.
              description: 'Check in baggage and receive a NigeriaLife Air boarding pass.',
              cost: 0,
              rewardSocial: 10,
              itemReward: {
                id: 'boarding_pass_ticket',
                name: 'NigeriaLife Air boarding pass',
                category: 'document',
                price: 0,
                usable: true,
                icon: '🎫',
                description: 'Verified boarding pass for interstate departures.',
              },
              dialogueResponse: '🎫 Check-In Officer: "Baggage checked! Here is your boarding pass. Security is straight ahead."',
            },
          ],
        },
        {
          id: 'airport_security_gate',
          name: 'FAAN Security Screening',
          category: 'Aviation Security',
          description: 'Two lanes: trays for your bag and phone, the X-ray belt, and the walk-through arch.',
          relativePosition: new THREE.Vector3(-2.2, 0, 2.3),
          actions: [
            {
              id: 'airport_pass_security',
              label: '🛡️ Clear Aviation Security',
              description: 'Put your things in a tray, walk through the arch and collect them on the far side.',
              cost: 0,
              rewardKnowledge: 10,
              dialogueResponse: '🛡️ Officer Ngozi: "You are clear. Gates are to your right. Safe flight!"',
            },
          ],
        },
        {
          id: 'airport_flight_abuja',
          name: 'Gate 1: Abuja Departure',
          category: 'Interstate Flight',
          description: 'Direct 55-minute flight to Nnamdi Azikiwe International Airport, Abuja.',
          relativePosition: new THREE.Vector3(GATES[0], 0, -16.2),
          // Live gate exit is PlaceActions → apron board. Fares live on FlightService (₦95,000).
          actions: [
            {
              id: 'airport_fly_abuja_action',
              label: '✈️ Gate 1 to Abuja (use the apron steps)',
              description: 'Exit Gate 1 to the apron and board NigeriaLife Air NL 204 at the steps.',
              cost: 0,
              rewardCred: 0,
              dialogueResponse: '✈️ Gate 1 leads out to the apron. Board NL 204 at the aircraft steps.',
            },
          ],
        },
        {
          id: 'airport_flight_ph',
          name: 'Gate 2: Port Harcourt Departure',
          category: 'Interstate Flight',
          description: 'Direct flight to Port Harcourt International Airport (Omagwa), Rivers State.',
          relativePosition: new THREE.Vector3(GATES[1], 0, -16.2),
          actions: [
            {
              id: 'airport_fly_ph_action',
              label: '✈️ Gate 2 to Port Harcourt (use the apron steps)',
              description: 'Exit Gate 2 to the apron and board NigeriaLife Air NL 310 at the steps.',
              cost: 0,
              rewardCred: 0,
              dialogueResponse: '✈️ Gate 2 leads out to the apron. Board NL 310 at the aircraft steps.',
            },
          ],
        },
        {
          id: 'airport_vip_lounge',
          name: 'NigeriaLife Air Executive Lounge',
          category: 'Airport Lounge',
          description: 'Quiet leather armchairs, a buffet of small chops, chilled drinks and Wi-Fi before your flight.',
          relativePosition: new THREE.Vector3(-21, 0, -12.8),
          actions: [
            {
              id: 'airport_enter_vip_lounge',
              label: '🥂 Relax in the Executive Lounge (₦40,000)',
              description: 'Recharge completely with luxury hospitality before your flight.',
              cost: 40000,
              rewardHealth: 100,
              rewardEnergy: 100,
              dialogueResponse: '🥂 "Welcome to the lounge. Enjoy chilled Chapman and small chops. Health and energy restored!"',
            },
          ],
        },
        {
          id: 'airport_baggage_carousel',
          name: '🧳 Baggage Claim, Belt 1',
          category: 'Aviation Baggage Claim',
          description: 'The arrivals belt: bags come through the flaps and go round until someone takes them.',
          relativePosition: CAROUSEL.clone(),
          actions: [
            {
              id: 'airport_claim_baggage',
              label: '🧳 Claim Your Checked Luggage',
              description: 'Retrieve your tagged suitcase from Belt 1.',
              cost: 0,
              rewardSocial: 15,
              dialogueResponse: '🧳 Baggage Claim: You lift your suitcase off Belt 1. Everything intact. The exit to the kerb is just ahead.',
            },
          ],
        },
        {
          id: 'airport_telecom_desk',
          name: '📱 Arrivals SIM & Airtime',
          category: 'Passenger Services',
          description: 'Prepaid local SIM and airtime for passengers just off the aircraft.',
          relativePosition: new THREE.Vector3(24, 0, 17),
          actions: [],
        },
        {
          id: 'airport_cab_pickup',
          name: '🚕 Airport Cab Desk',
          category: 'Ground Transport',
          description: 'Book a registered airport cab into town, or walk out to the kerb.',
          relativePosition: new THREE.Vector3(11, 0, 17),
          actions: [],
        },
      ],
      npcs: [
        // Check-in, behind the counters, facing the hall
        staff('npc_checkin_funke', 'Funke Adeyemi', 'Check-in Agent', 'NigeriaLife Air', { x: -20.5, z: 3.4 }, 0, 0x0f7a46, 'female', 'Good morning! Ticket and ID, please. Any bags to check in?'),
        staff('npc_checkin_tunde', 'Tunde Bakare', 'Check-in Agent', 'NigeriaLife Air', { x: -14.5, z: 3.4 }, 0, 0x0f7a46, 'male', 'Place your bag on the scale for me. Window or aisle?', { hasTie: true }),
        staff('npc_checkin_amaka', 'Amaka Obi', 'Check-in Agent', 'NigeriaLife Air', { x: -8.5, z: 3.4 }, 0, 0x0f7a46, 'female', 'Boarding starts forty minutes before departure. Security is just ahead.'),
        // The passengers in the queue and walking through are the crowd (AirportCrowd), not set figures
        // Information desk
        staff('npc_info_grace', 'Grace Okon', 'Information', 'FAAN Passenger Services', { x: 0, z: 10.4 }, 0, 0x1e3a8a, 'female', 'Welcome! Check-in is on your left, arrivals and taxis on your right.'),
        // Security
        staff('npc_officer_ngozi', 'Officer Ngozi Adeleke', 'Security Officer', 'FAAN Aviation Security', { x: -1.3, z: 1.2 }, -Math.PI / 2, 0x1f2937, 'female', 'Phones, belts and coins in the tray, please. Then walk through.'),
        staff('npc_officer_dauda', 'Officer Dauda Garba', 'Security Officer', 'FAAN Aviation Security', { x: 4.7, z: 1.2 }, -Math.PI / 2, 0x1f2937, 'male', 'Laptop out of the bag, sir. Step through when the light is green.'),
        staff('npc_xray_ibe', 'Chinedu Ibe', 'X-ray Operator', 'FAAN Aviation Security', { x: -4.7, z: 2.3 }, Math.PI / 2, 0x1f2937, 'male', 'Your bag is clear. You can collect it on the other side.'),
        // Gates
        staff('npc_gate1_zainab', 'Zainab Ali', 'Gate Agent', 'Gate 1', { x: GATES[0], z: -17.1 }, 0, 0x0f7a46, 'female', 'Gate 1 for Abuja. Boarding pass ready, please.'),
        staff('npc_gate2_efe', 'Efe Omoregie', 'Gate Agent', 'Gate 2', { x: GATES[1], z: -17.1 }, 0, 0x0f7a46, 'female', 'Gate 2 for Port Harcourt. We start boarding shortly.'),
        staff('npc_captain_ibrahim', 'Capt. Ibrahim Lawal', 'Flight Captain', 'NigeriaLife Air', { x: 13.5, z: -16.6 }, Math.PI / 2, 0x111827, 'male', 'Good day! Clear skies to Abuja. We expect a smooth flight at 32,000 feet.', { hasTie: true }),
        traveller('npc_traveler_chuka', 'Chuka Emeka', { x: 4.5, z: -18.6 }, Math.PI, 0xb45309, 'male', 'I like to watch the planes before I board. That one is ours.'),
        traveller('npc_pax_ada', 'Ada', { x: 16.5, z: -18.5 }, Math.PI, 0xdb2777, 'female', 'Port Harcourt by lunchtime, God willing.'),
        traveller('npc_pax_yemi', 'Yemi', { x: 24, z: -6.2 }, Math.PI / 2, 0x0f766e, 'male', 'Is there a socket here? My phone is on two percent.'),
        // Café, shop and lounge
        staff('npc_cafe_blessing', 'Blessing', 'Barista', 'Buka Express Café', { x: -25.9, z: -6 }, Math.PI / 2, 0x7c2d12, 'female', 'Fresh meat pie and hot coffee! What can I get you?'),
        staff('npc_shop_sule', 'Sule', 'Cashier', 'Naija Mart', { x: -3.9, z: -4.3 }, -Math.PI / 2, 0x0e7490, 'male', 'Drinks in the fridge, snacks on the shelves. I can also sell you a power bank.'),
        staff('npc_lounge_ifeoma', 'Ifeoma', 'Lounge Host', 'Executive Lounge', { x: -21, z: -14.3 }, 0, 0x7f1d1d, 'female', 'Welcome to the lounge. Please, make yourself comfortable.'),
        // Arrivals
        staff('npc_sim_desk', 'Kunle', 'SIM Agent', 'Arrivals', { x: 24, z: 18 }, Math.PI, 0xfacc15, 'male', 'New SIM or airtime? I can register it for you in five minutes.'),
        staff('npc_cab_desk', 'Chief Okafor', 'Cab Desk', 'Airport Cabs', { x: 11, z: 18 }, Math.PI, 0x1e3a8a, 'male', 'Registered airport cab, fixed price to the Island. Where are you going?'),
        staff('npc_porter_musa', 'Musa', 'Porter', 'Baggage Hall', { x: 22.8, z: 12.4 }, -Math.PI / 2, 0x1d4ed8, 'male', 'Oga, make I carry your load go the cab?'),
        staff('npc_cleaner_titi', 'Titi', 'Cleaner', 'Terminal Services', { x: 3, z: 8.5 }, 0.6, 0x0d9488, 'female', 'Mind the wet floor, please. Good morning!'),
      ],
    };

    this.nav = new NavGrid(origin, W, L);
    this.buildTerminal();
  }

  // ---------------------------------------------------------------------------------------------

  private buildTerminal(): void {
    this.group.add(this.buildShell());
    this.group.add(this.buildEntrance());
    this.group.add(this.buildColumns());
    this.group.add(this.buildCheckIn());
    this.group.add(this.buildInfoDesk());
    this.group.add(this.buildSecurity());
    this.group.add(this.buildGates());
    this.group.add(this.buildCafe());
    this.group.add(this.buildShop());
    this.group.add(this.buildLounge());
    this.buildPrayerRooms();
    this.buildLevels();
    this.group.add(this.buildBaggageHall());
    this.group.add(this.buildSigns());
    this.group.add(this.buildFloorLight());
    this.apron = new ApronLife();
    this.group.add(this.apron.group);
    this.group.add(this.eyeOnly = this.buildEyeLevelOnly());

    // The way back out to the kerb: the middle door of the entrance
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 19.6), Math.PI);
    this.styleExitDoor(exitDoor);
    this.group.add(exitDoor);
    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Terminal doors to the kerb',
      category: 'Exit',
      description: 'Out through the glass doors to the kerb and the airport road.',
      interactionPoint: new THREE.Vector3(0, 0, 18.2),
    });

    // People
    for (const npcDef of this.def.npcs) {
      const npc = new InteriorNPCMesh(npcDef);
      this.dressForWork(npc);
      this.npcs.push(npc);
      this.group.add(npc.group);
      this.group.add(contactShade(0.9, 0.9, npcDef.relativePosition.x, npcDef.relativePosition.z, 0.35));
      this.interactiveList.push({
        mesh: npc.group,
        id: `interior_npc_${npcDef.id}`,
        name: npcDef.name,
        category: `Airport • ${npcDef.role}`,
        description: npcDef.dialogueGreeting,
        // In front of them, on clear floor (staff behind a counter are spoken to across it)
        interactionPoint: this.nav.closestFree(npcDef.relativePosition.clone().add(new THREE.Vector3(Math.sin(npcDef.rotationY) * 1.1, 0, Math.cos(npcDef.rotationY) * 1.1)).add(this.group.position)).sub(this.group.position),
      });
    }

    this.crowd = this.buildCrowd();
    this.group.add(this.crowd.group);
    // What the player can do here besides flying: sit, eat, shop, rest in the lounge, the toilets
    this.services = new AirportServices(this.group, this.group.position, this.nav, this.freeSeats);
    this.services.register(this.interactiveList, this.group, { leaf: this.buildToilets() });
    this.sound = new AirportSound();
    this.talk = new AirportTalk(this.def.npcs, this.services, this.group.position);

    mergeFloorDecals(this.group);

    // Interaction points above are room-relative; the player walks in world space (the services' own are already)
    for (const obj of this.interactiveList) if (!obj.id.startsWith('airport_sit_') && !['airport_cafe_counter', 'airport_shop_till', 'airport_toilets', 'airport_mosque', 'airport_chapel'].includes(obj.id)) obj.interactionPoint.add(this.group.position);
    // Work here: check-in agents and security screeners, taken on by the duty manager and the commander
    const site = { key: 'mmia-terminal', name: 'Murtala Muhammed Airport (LOS)', group: this.group, interactiveList: this.interactiveList, addNpc: (npc: InteriorNPCMesh) => this.npcs.push(npc), world: (x: number, z: number) => this.group.position.clone().add(new THREE.Vector3(x, 0, z)) };
    for (const w of AIRPORT_WORK) addWork(site, w);
    this.refreshBoards(true);
  }

  /**
   * The shared exit door (it keeps its hinge, used by the walk out) dressed as one of the
   * terminal's doors: slim black steel and the hall's own sign, not the green street-door sign and mat
   */
  private styleExitDoor(door: THREE.Group): void {
    const meshes = door.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh);
    const [postA, postB, lintel, sign, mat] = meshes;
    for (const post of [postA, postB]) if (post) post.scale.x = 0.35;
    for (const part of [postA, postB, lintel]) if (part) part.material = M.black;
    for (const part of [sign, mat]) part?.removeFromParent();
    const exit = signMesh(['EXIT  ·  Kerb · Taxis · Car park'], 2.6, 0.42, WAYFINDING);
    // Over the door, on the side facing into the hall (the door group's +z, as its own sign was)
    exit.position.set(0, 3.45, 0.12);
    door.add(exit);
  }

  /** Lit screens made by `monitor`, waiting to be added to the group their desk is built into */
  private readonly screens: THREE.Mesh[] = [];

  /**
   * A desk computer: a slim black monitor on its stand, its screen lit with what the desk works on.
   * `y` is the desk top; the screen faces along `yaw` (0 = toward +z).
   */
  private monitor(k: Kit, x: number, y: number, z: number, yaw: number, lines: string[]): void {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (along: number) => ({ x: x + s * along, z: z + c * along });
    k.box(M.black, 0.24, 0.015, 0.17, x, y, z, yaw);
    const neck = at(-0.03);
    k.box(M.black, 0.045, 0.2, 0.03, neck.x, y + 0.01, neck.z, yaw);
    k.box(M.black, 0.54, 0.34, 0.03, x, y + 0.19, z, yaw);
    const face = at(0.017);
    const screen = signMesh(lines, 0.5, 0.3, { bg: '#0b3d2a', fg: '#d1fae5', accent: '#ffcc1a', density: 320 });
    screen.position.set(face.x, y + 0.36, face.z);
    screen.rotation.y = yaw;
    this.screens.push(screen);
  }

  /** A station to walk up to: its mesh, and the spot a person stands at to use it */
  private station(mesh: THREE.Object3D, id: string, stand: Stand): void {
    const def = this.def.stations.find((s) => s.id === id)!;
    this.interactiveList.push({ mesh, id, name: def.name, category: def.category, description: def.description, interactionPoint: new THREE.Vector3(stand.x, 0, stand.z) });
    this.nav.clearRect(stand.x, stand.z, 0.5, 0.5);
  }

  // --- The building ----------------------------------------------------------------------------

  private buildShell(): THREE.Group {
    const shell = new THREE.Group();
    shell.name = 'interior_room_shell';
    shell.userData.size = { width: W, length: L, height: H };
    // The hall is far bigger than a phone screen: the view follows the player through a part of it
    shell.userData.view = { width: 24, length: 18 };

    // The polished stone floor, a tile every three metres, on a slab so its edges never show the sky
    const floor = new THREE.Mesh(floorPlane(W, L, 3), M.floor);
    floor.name = 'interior_floor_mesh';
    floor.receiveShadow = true;
    shell.add(floor);
    const base = new Kit();
    base.box(M.floorDark, W + 0.4, 0.3, L + 0.4, 0, -0.32, 0); // just under the floor, never level with it
    // Dark stone borders and the line where airside begins
    for (const z of [-L / 2 + 0.3, L / 2 - 0.3]) base.box(M.floorDark, W - 0.2, 0.006, 0.5, 0, 0, z);
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) base.box(M.floorDark, 0.5, 0.006, L - 0.2, x, 0, 0);
    base.box(M.floorDark, W - 0.2, 0.006, 0.35, 0, 0, 0.6);
    base.box(M.floorDark, 0.35, 0.006, 16, -4.6, 0, 11.8);
    shell.add(base.build('floor slab'));
    // The joints between the 1.5 m stone tiles: what makes a floor read as a real floor from any height
    const joints = new Kit();
    for (let x = -W / 2 + 1.5; x < W / 2 - 0.5; x += 1.5) joints.box(M.joint, 0.02, 0.003, L - 1.2, x, 0, 0);
    for (let z = -L / 2 + 1.5; z < L / 2 - 0.5; z += 1.5) joints.box(M.joint, W - 1.2, 0.003, 0.02, 0, 0, z);
    shell.add(joints.build('floor joints', false));
    // Terrazzo in the café, carpet at the gates
    const cafe = new THREE.Mesh(floorPlane(12, 12, 2), M.terrazzo);
    cafe.position.set(-21, 0.004, -6);
    const carpet = new THREE.Mesh(floorPlane(24, 11, 3), M.carpet);
    carpet.position.set(14, 0.004, -9.6);
    shell.add(cafe, carpet);

    // Side walls: plaster above, brushed metal panels to head height, a dark skirting
    const side = (name: string, x: number) => {
      const k = new Kit();
      const inward = -Math.sign(x);
      k.box(M.plaster, 0.4, H, L, x, 0, 0);
      k.box(M.metal, 0.05, 2.8, L - 0.6, x + inward * 0.22, 0, 0);
      k.box(M.black, 0.06, 0.12, L - 0.6, x + inward * 0.25, 0, 0);
      for (let z = -L / 2 + 2; z < L / 2; z += 4) k.box(M.metalDark, 0.055, 2.8, 0.03, x + inward * 0.24, 0, z);
      const wall = k.build(name);
      return wall;
    };
    shell.add(side('shell_wall_left', -W / 2 - 0.2), side('shell_wall_right', W / 2 + 0.2));

    // The back wall onto the apron: floor-to-ceiling glass between steel mullions
    const back = new Kit();
    const z = -L / 2 - 0.1;
    back.box(M.glass, W, 7.2, 0.04, 0, 0.3, z);
    back.box(M.black, W, 0.3, 0.3, 0, 0, z);
    back.box(M.metalDark, W, H - 7.5, 0.3, 0, 7.5, z);
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 3.5) back.box(M.steel, 0.12, 7.2, 0.2, x, 0.3, z + 0.08);
    for (const y of [0.3, 3.4, 7.4]) back.box(M.steel, W, 0.1, 0.2, 0, y, z + 0.08);
    // The gate doors in the glass, framed in black
    for (const gx of GATES) {
      back.box(M.black, 3.4, 0.18, 0.32, gx, 3.0, z + 0.06);
      for (const sx of [-1.7, 1.7]) back.box(M.black, 0.16, 3.0, 0.32, gx + sx, 0, z + 0.06);
      back.box(M.black, 0.06, 3.0, 0.08, gx, 0, z + 0.12);
    }
    // The arrivals door, at the far right: passengers come in off the apron here
    back.box(M.black, 2.4, 0.18, 0.32, ARRIVALS_DOOR, 3.0, z + 0.06);
    for (const sx of [-1.2, 1.2]) back.box(M.black, 0.16, 3.0, 0.32, ARRIVALS_DOOR + sx, 0, z + 0.06);
    shell.add(back.build('shell_wall_back'));
    return shell;
  }

  private buildEntrance(): THREE.Group {
    const k = new Kit();
    const z = L / 2 + 0.05;
    // The glass front onto the kerb, with three sets of sliding doors
    // Kept to door height: the view into the hall looks down over it, like the cut-away rooms
    k.box(M.glass, W, 2.9, 0.04, 0, 0.3, z);
    k.box(M.black, W, 0.3, 0.3, 0, 0, z);
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 3.5) k.box(M.steel, 0.12, 2.9, 0.2, x, 0.3, z - 0.08);
    k.box(M.steel, W, 0.12, 0.22, 0, 3.2, z - 0.08);
    for (const dx of [-12, 0, 12]) {
      k.box(M.black, 3.6, 0.35, 0.36, dx, 2.7, z - 0.05);
      for (const sx of [-1.8, 1.8]) k.box(M.black, 0.15, 2.7, 0.36, dx + sx, 0, z - 0.05);
      k.box(M.rubber, 3.2, 0.01, 1.6, dx, 0.003, z - 1.1); // entrance mat
    }
    const g = k.build('entrance facade');
    // "Departures" over the doors, inside
    const sign = signMesh(['DEPARTURES', 'Check-in · Security · Gates'], 9, 1.4, { bg: '#16351f', fg: '#f6f3e8', accent: '#ffcc1a', density: 120 });
    sign.position.set(-12, 4.4, z - 0.25);
    sign.rotation.y = Math.PI;
    const arrivals = signMesh(['ARRIVALS', 'Baggage · Cabs · SIM cards'], 9, 1.4, { bg: '#22262c', fg: '#f6f3e8', accent: '#ffcc1a', density: 120 });
    arrivals.position.set(12, 4.4, z - 0.25);
    arrivals.rotation.y = Math.PI;
    g.add(sign, arrivals);
    // A row of luggage trolleys by the doors
    const t = new Kit();
    for (let i = 0; i < 7; i++) this.trolley(t, 4.6 + i * 0.32, 18.2, 0);
    g.add(t.build('trolley bay'));
    this.nav.blockRect(5.6, 18.2, 1.3, 0.55);
    this.nav.blockRect(0, L / 2 - 0.1, W / 2, 0.2);
    this.nav.clearRect(0, 18.9, 1.2, 0.8);
    return g;
  }

  /**
   * What is only there with the camera down inside the hall (the inside view): the front wall
   * above the doors, which would block the view from above, and the light strips in the ceiling
   * the game puts over a room seen from inside
   */
  private buildEyeLevelOnly(): THREE.Group {
    const k = new Kit();
    const z = L / 2 + 0.05;
    k.box(M.glass, W, 3.6, 0.04, 0, 3.3, z);
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 3.5) k.box(M.steel, 0.12, 3.6, 0.2, x, 3.3, z - 0.08);
    k.box(M.metalDark, W, H - 6.9, 0.3, 0, 6.9, z);
    // Long light strips in the ceiling, in rows across the hall
    for (let x = -W / 2 + 4; x < W / 2 - 1; x += 6) {
      for (let lz = -L / 2 + 3; lz < L / 2 - 1; lz += 3.4) k.box(M.lamp, 3.6, 0.04, 0.22, x, H - 0.05, lz);
    }
    const g = k.build('eye view only');
    g.visible = false;
    return g;
  }

  private buildColumns(): THREE.Group {
    const k = new Kit();
    for (const x of [-22, -8, 8, 24]) {
      for (const z of [-9, 9]) {
        k.cyl(M.metal, 0.42, 0.42, H, x, 0, z, 24);
        k.cyl(M.floorDark, 0.55, 0.58, 0.12, x, 0, z, 24);
        k.cyl(M.black, 0.43, 0.43, 0.25, x, 2.6, z, 24);
        this.nav.blockRect(x, z, 0.6, 0.6);
      }
    }
    return k.build('columns');
  }

  // --- Check-in ------------------------------------------------------------------------------------

  private buildCheckIn(): THREE.Group {
    const k = new Kit();
    // The backdrop behind the counters, wood-panelled, with the bag belt running in front of it
    k.box(M.plasterWarm, 20.6, 3.3, 0.3, -15.5, 0, 2.05);
    // Its back, toward the café, carries lit advertising panels, as every terminal wall does
    for (const ax of [-23, -17.5, -12, -6.8]) {
      k.box(M.metalDark, 4.3, 2.4, 0.12, ax, 0.55, 1.86);
    }
    k.box(M.wood, 20.4, 2.5, 0.04, -15.5, 0, 2.22);
    k.box(M.black, 20.4, 0.08, 0.06, -15.5, 2.5, 2.24);
    k.box(M.steel, 20.2, 0.42, 0.7, -15.5, 0, 2.75);
    k.box(M.rubber, 20.2, 0.03, 0.6, -15.5, 0.42, 2.75);
    // The hatch the bags go through, with its rubber flaps
    k.box(M.black, 1.2, 0.9, 0.36, -25.4, 0, 2.6);
    for (let i = 0; i < 5; i++) k.box(M.rubber, 0.2, 0.62, 0.02, -25.85 + i * 0.22, 0.28, 2.95);
    for (const cx of COUNTERS) {
      // The counter: a white solid-surface front, a wood top, a screen and a keyboard for the agent
      k.soft(M.solid, 1.9, 1.02, 0.75, cx, 0, 4.2, 0.08);
      k.box(M.wood, 2.0, 0.05, 0.85, cx, 1.02, 4.2);
      k.box(M.green, 1.9, 0.12, 0.02, cx, 0.82, 4.58);
      this.monitor(k, cx - 0.35, 1.07, 3.95, Math.PI, ['NigeriaLife Air', 'Check-in · NL 204']);
      k.box(M.black, 0.42, 0.02, 0.15, cx - 0.35, 1.08, 4.2);
      k.box(M.black, 0.22, 0.12, 0.18, cx + 0.45, 1.07, 4.3); // boarding pass printer
      // The bag scale between counters, with its little display
      k.box(M.steel, 0.75, 0.12, 0.8, cx + 1.45, 0, 4.4);
      k.box(M.black, 0.75, 0.02, 0.8, cx + 1.45, 0.12, 4.4);
      k.box(M.black, 0.1, 0.95, 0.1, cx + 1.45, 0, 3.95);
      k.box(M.screen, 0.24, 0.14, 0.05, cx + 1.45, 0.95, 3.99);
      this.group.add(contactShade(2.4, 1.3, cx, 4.2, 0.4));
    }
    // Queue lanes: chrome posts and navy belts, back and forth
    const rows = [6.4, 7.8, 9.2, 10.6];
    rows.forEach((rz, i) => {
      const from = -23.6 + (i % 2 ? 1.6 : 0);
      const to = -7.8 - (i % 2 ? 0 : 1.6);
      for (let x = from; x <= to + 0.01; x += 1.6) {
        k.cyl(M.chrome, 0.03, 0.03, 0.95, x, 0, rz, 10);
        k.cyl(M.chrome, 0.16, 0.17, 0.03, x, 0, rz, 18);
        if (x + 1.6 <= to + 0.01) k.box(M.black, 1.56, 0.05, 0.012, x + 0.8, 0.86, rz);
      }
      this.nav.blockRect((from + to) / 2, rz, (to - from) / 2 + 0.1, 0.12);
    });
    // Self check-in kiosks by the entrance
    for (const kz of [12.6, 14.2, 15.8]) {
      k.soft(M.solid, 0.55, 1.1, 0.45, -5.6, 0, kz, 0.05);
      k.box(M.black, 0.5, 0.55, 0.1, -5.6, 1.1, kz + 0.05, Math.PI / 2, -0.35);
      this.nav.blockRect(-5.6, kz, 0.35, 0.3);
    }
    const g = k.build('checkin');
    for (const sc of this.screens.splice(0)) g.add(sc);
    // The lit advertising panels on the back of the wall, facing the café
    const ads: Array<[string[], { bg: string; fg: string; accent: string }]> = [
      [['Obudu Mountain Resort', 'Cool air. Cable car. Cross River.'], { bg: '#0e5a3a', fg: '#f6f3e8', accent: '#ffcc1a' }],
      [['NigeriaLife Air', 'Lagos to Abuja from N95,000', 'Fly daily · Gates 1 and 2'], { bg: '#f6f3e8', fg: '#0e3d27', accent: '#0f7a46' }],
      [['Mama Put Kitchen', 'Jollof, dodo and peppered turkey', 'Opposite Gate 1'], { bg: '#b3261e', fg: '#fff7ea', accent: '#ffcc1a' }],
      [['Eko Atlantic', 'Live by the ocean', 'Homes from N120m'], { bg: '#0b2545', fg: '#f6f3e8', accent: '#7dd3fc' }],
    ];
    [-23, -17.5, -12, -6.8].forEach((ax, i) => {
      const [lines, style] = ads[i];
      const panel = signMesh(lines, 4.1, 2.2, { ...style, density: 110 });
      panel.position.set(ax, 1.75, 1.79);
      panel.rotation.y = Math.PI;
      g.add(panel);
    });
    // Kiosk screens and the counter numbers, lit
    for (const kz of [12.6, 14.2, 15.8]) {
      const screen = signMesh(['Self', 'check-in'], 0.42, 0.34, { bg: '#0f7a46', fg: '#ffffff', density: 300 });
      screen.position.set(-5.32, 1.42, kz + 0.05);
      screen.rotation.set(0, Math.PI / 2, 0);
      screen.rotateX(-0.35);
      g.add(screen);
    }
    COUNTERS.forEach((cx, i) => {
      const n = signMesh([`${i + 1}`], 0.6, 0.45, { bg: '#16351f', fg: '#ffcc1a', density: 200 });
      n.position.set(cx, 2.85, 2.26);
      g.add(n);
    });
    const brand = signMesh(['NigeriaLife Air  ✈  Check-in'], 12, 0.9, { bg: '#f6f3e8', fg: '#0f5132', accent: '#0f7a46', density: 120 });
    brand.position.set(-15.5, 3.55, 2.25);
    g.add(brand);
    // Everything behind the counters, and the counters themselves
    this.nav.blockRect(-15.5, 3.35, 10.6, 1.3);
    this.station(g, 'airport_checkin_desk', { x: -14.5, z: 5.0 });
    return g;
  }

  private buildInfoDesk(): THREE.Group {
    const k = new Kit();
    const ring = new THREE.RingGeometry(0.9, 1.45, 40, 1, 0, Math.PI * 1.7);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.45, 0, Math.PI * 1.7, false);
    shape.absarc(0, 0, 0.9, Math.PI * 1.7, 0, true);
    const body = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false, curveSegments: 24 });
    body.rotateX(-Math.PI / 2);
    k.geo(M.solid, body, 0, 0, 11, Math.PI * 0.65);
    ring.rotateX(-Math.PI / 2);
    k.geo(M.wood, ring, 0, 1.01, 11, Math.PI * 0.65);
    k.cyl(M.steel, 0.05, 0.05, 3.2, 0, 0, 12.6, 10);
    k.box(M.screen, 0.5, 0.32, 0.04, -0.3, 1.05, 11.2, 0.3);
    const g = k.build('information desk');
    const sign = signMesh(['i  Information'], 2.4, 0.55, WAYFINDING);
    sign.position.set(0, 3.0, 12.62);
    g.add(sign);
    this.group.add(contactShade(3.4, 3.4, 0, 11, 0.35));
    this.nav.blockRect(0, 11, 1.5, 1.5);
    return g;
  }

  // --- Security ----------------------------------------------------------------------------------------

  private buildSecurity(): THREE.Group {
    const k = new Kit();
    // The glass line between the public hall and airside, with the lanes and the arrivals way through it
    const pane = (from: number, to: number) => {
      k.box(M.glass, to - from, 2.4, 0.03, (from + to) / 2, 0.1, 1.2);
      k.box(M.steel, to - from, 0.08, 0.08, (from + to) / 2, 2.5, 1.2);
      k.box(M.black, to - from, 0.1, 0.1, (from + to) / 2, 0, 1.2);
      for (let x = from; x <= to + 0.01; x += 2) k.box(M.steel, 0.07, 2.55, 0.07, x, 0, 1.2);
      this.nav.blockRect((from + to) / 2, 1.2, (to - from) / 2, 0.15);
    };
    pane(-W / 2 + 0.3, -4.6);
    pane(-1.4, 2.0);
    pane(5.0, 10);
    pane(14, W / 2 - 0.3);
    for (const lx of LANES) {
      const bx = lx - 1.2;
      // In: the tray table and the rollers into the machine
      k.box(M.steel, 0.7, 0.78, 2.4, bx, 0, 4.7);
      for (let z = 3.6; z <= 5.8; z += 0.18) k.rod(M.chrome, 0.03, 0.62, bx, 0.8, z, 0, 8);
      for (let i = 0; i < 5; i++) k.box(M.metalDark, 0.5, 0.08, 0.42, bx, 0.82 + i * 0.08, 5.6);
      // The X-ray machine and its rubber curtains
      k.soft(M.solid, 1.1, 1.45, 1.9, bx, 0, 2.3, 0.12);
      k.box(M.black, 0.72, 0.5, 0.02, bx, 0.78, 3.26);
      k.box(M.black, 0.72, 0.5, 0.02, bx, 0.78, 1.34);
      k.box(M.green, 1.12, 0.06, 1.0, bx, 1.45, 2.3);
      // Out: the rollers on the far side
      k.box(M.steel, 0.7, 0.78, 2.6, bx, 0, -0.2);
      for (let z = -1.4; z <= 1.0; z += 0.18) k.rod(M.chrome, 0.03, 0.62, bx, 0.8, z, 0, 8);
      // The operator's screen
      k.box(M.black, 0.08, 0.8, 0.08, bx - 1.1, 0, 2.3);
      k.box(M.screen, 0.04, 0.4, 0.55, bx - 1.1, 0.95, 2.3);
      // The walk-through arch
      const ax = lx + 0.3;
      for (const s of [-0.55, 0.55]) k.box(M.solid, 0.14, 2.15, 0.62, ax + s, 0, 2.3);
      k.box(M.solid, 1.24, 0.24, 0.62, ax, 2.15, 2.3);
      k.box(M.green, 1.1, 0.04, 0.05, ax, 2.2, 2.62);
      this.nav.blockRect(bx, 2.3, 0.6, 3.6);
      for (const s of [-0.55, 0.55]) this.nav.blockRect(ax + s, 2.3, 0.1, 0.35);
      this.group.add(contactShade(1.6, 7, bx, 2.3, 0.35));
    }
    const g = k.build('security');
    const sign = signMesh(['SECURITY SCREENING', 'Have your boarding pass ready'], 6, 1.0, WAYFINDING);
    sign.position.set(0.5, 3.9, 3.4);
    g.add(sign);
    const exit = signMesh(['Arrivals exit · No re-entry'], 3.6, 0.5, { bg: '#7f1d1d', fg: '#ffffff', density: 150 });
    exit.position.set(12, 2.9, 1.22);
    g.add(exit);
    this.station(g, 'airport_security_gate', { x: LANES[0] + 0.3, z: 3.8 });
    return g;
  }

  // --- Airside: gates, café, shop, lounge ------------------------------------------------------------

  /** A row of five joined airport seats on a steel beam, facing along +z turned by `yaw` */
  private seatRow(k: Kit, x: number, z: number, yaw: number, seats = 5): void {
    const len = seats * 0.62;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const at = (along: number, back: number) => ({ x: x + c * along + s * back, z: z - s * along + c * back });
    const beam = at(0, 0);
    k.box(M.steel, len, 0.06, 0.08, beam.x, 0.32, beam.z, yaw);
    for (const leg of [-len / 2 + 0.2, len / 2 - 0.2]) {
      const p = at(leg, 0);
      k.box(M.steel, 0.06, 0.32, 0.5, p.x, 0, p.z, yaw);
    }
    for (let i = 0; i < seats; i++) {
      const along = -len / 2 + 0.31 + i * 0.62;
      const seat = at(along, 0.02);
      const back = at(along, -0.24);
      k.soft(M.leather, 0.52, 0.09, 0.48, seat.x, 0.4, seat.z, 0.06, yaw);
      k.box(M.leather, 0.52, 0.5, 0.07, back.x, 0.5, back.z, yaw, -0.18);
      if (i < seats - 1) {
        const arm = at(along + 0.31, 0);
        k.box(M.steel, 0.04, 0.22, 0.42, arm.x, 0.48, arm.z, yaw);
      }
    }
    this.nav.blockRect(x, z, Math.abs(c) * len / 2 + Math.abs(s) * 0.35, Math.abs(s) * len / 2 + Math.abs(c) * 0.35);
  }

  private buildGates(): THREE.Group {
    const k = new Kit();
    // Rows of seats facing the glass and the aircraft, some back to back
    for (const cx of [8, 20]) {
      for (const rz of [-12.5, -9.5, -6.5]) {
        this.seatRow(k, cx - 3.4, rz, Math.PI, 5);
        this.seatRow(k, cx + 3.4, rz, Math.PI, 5);
        this.group.add(contactShade(3.4, 0.9, cx - 3.4, rz, 0.3), contactShade(3.4, 0.9, cx + 3.4, rz, 0.3));
      }
    }
    // Charging posts between the rows
    for (const [px, pz] of [[14, -12.5], [14, -6.5], [26, -9.5]]) {
      k.soft(M.metalDark, 0.4, 1.1, 0.4, px, 0, pz, 0.05);
      k.box(M.green, 0.42, 0.06, 0.42, px, 1.1, pz);
      this.nav.blockRect(px, pz, 0.3, 0.3);
    }
    // The gate desks
    for (const gx of GATES) {
      k.soft(M.solid, 2.6, 1.05, 0.75, gx, 0, -16.2, 0.08);
      k.box(M.wood, 2.7, 0.05, 0.85, gx, 1.05, -16.2);
      k.box(M.green, 2.6, 0.12, 0.02, gx, 0.85, -15.82);
      this.monitor(k, gx - 0.5, 1.07, -16.4, Math.PI, ['Boarding', `Gate ${gx === GATES[0] ? 1 : 2}`]);
      k.cyl(M.steel, 0.05, 0.05, 2.4, gx + 1.9, 0, -16.6, 10);
      this.nav.blockRect(gx, -16.6, 1.5, 0.9);
      this.group.add(contactShade(3.2, 1.4, gx, -16.2, 0.4));
    }
    const g = k.build('gate seating');
    for (const sc of this.screens.splice(0)) g.add(sc);
    GATES.forEach((gx, i) => {
      const number = signMesh([`GATE ${i + 1}`], 2.6, 0.7, { bg: '#ffcc1a', fg: '#16181c', density: 160 });
      number.position.set(gx, 3.6, -19.85);
      g.add(number);
      const board = this.boardMesh('gate', 1.6, 0.9, i + 1);
      board.position.set(gx + 1.9, 2.7, -16.55);
      g.add(board);
    });
    this.station(g, 'airport_flight_abuja', { x: GATES[0], z: -15.2 });
    this.station(g, 'airport_flight_ph', { x: GATES[1], z: -15.2 });
    return g;
  }

  private buildCafe(): THREE.Group {
    const k = new Kit();
    // The counter along the wall, its pastry case, the coffee machine and the shelves behind
    k.soft(M.woodDark, 0.8, 0.93, 7, -25.4, 0, -6, 0.06);
    k.box(M.solid, 0.95, 0.05, 7.1, -25.4, 0.93, -6);
    k.box(M.glassShelf, 0.7, 0.36, 2.2, -25.4, 0.98, -4.2);
    for (let i = 0; i < 6; i++) this.goods(k, 0.16, 0.08, 0.16, -25.45 + ((i % 2) - 0.5) * 0.24, 1.02, -5.0 + (i >> 1) * 0.55, [0xc58b3c, 0xe7c07a, 0x8b5a2b][i % 3]);
    k.box(M.steel, 0.55, 0.5, 0.75, -25.5, 0.98, -7.4);
    k.box(M.black, 0.4, 0.12, 0.6, -25.5, 1.48, -7.4);
    k.box(M.woodDark, 0.4, 2.2, 6.6, -27.4, 0.95, -6);
    for (let y = 1.4; y < 2.9; y += 0.5) {
      k.box(M.wood, 0.45, 0.04, 6.4, -27.35, y, -6);
      for (let z = -9; z < -3; z += 0.35) this.goods(k, 0.12, 0.26, 0.12, -27.3, y + 0.04, z, [0xb91c1c, 0x15803d, 0xf59e0b, 0x1e3a8a, 0xe5e7eb][Math.floor((z + 9) / 0.35) % 5]);
    }
    this.nav.blockRect(-26.2, -6, 1.6, 3.7);
    // Tables and chairs
    for (const [tx, tz] of [[-22.5, -10.5], [-19, -10.5], [-22.5, -7.5], [-19, -7.5], [-17.5, -4.2]]) {
      k.cyl(M.solid, 0.48, 0.48, 0.04, tx, 0.74, tz, 24);
      k.cyl(M.black, 0.05, 0.05, 0.74, tx, 0, tz, 10);
      k.cyl(M.black, 0.28, 0.3, 0.03, tx, 0, tz, 16);
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const cx = tx + Math.sin(a) * CAFE_CHAIR;
        const cz = tz + Math.cos(a) * CAFE_CHAIR;
        k.soft(M.leatherTan, 0.44, 0.08, 0.44, cx, 0.44, cz, 0.05, a);
        for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
          k.box(M.black, 0.035, 0.44, 0.035, cx + Math.cos(a) * lx + Math.sin(a) * lz, 0, cz - Math.sin(a) * lx + Math.cos(a) * lz, a);
        }
        k.box(M.leatherTan, 0.44, 0.42, 0.06, cx + Math.sin(a) * 0.2, 0.52, cz + Math.cos(a) * 0.2, a, -0.12);
      }
      this.nav.blockRect(tx, tz, 1.0, 1.0);
      this.group.add(contactShade(2.0, 2.0, tx, tz, 0.35));
    }
    // Plants at the edge of the café
    for (const [px, pz] of [[-15.6, -11.4], [-15.6, -1.2]]) this.plant(k, px, pz);
    const g = k.build('cafe');
    const sign = signMesh(['Buka Express Café'], 4.2, 0.7, { bg: '#7c2d12', fg: '#fde68a', density: 140 });
    sign.position.set(-27.15, 3.4, -6);
    sign.rotation.y = Math.PI / 2;
    const menu = signMesh(['Jollof rice & chicken   ₦4,500', 'Meat pie   ₦1,500   ·   Puff-puff   ₦800', 'Coffee   ₦2,500   ·   Zobo   ₦1,000', 'Chapman   ₦2,000   ·   Water   ₦500'], 4.6, 1.1, { bg: '#1c1917', fg: '#fef3c7', align: 'left', density: 150 });
    menu.position.set(-27.15, 2.35, -6);
    menu.rotation.y = Math.PI / 2;
    g.add(sign, menu);
    return g;
  }

  private buildShop(): THREE.Group {
    const k = new Kit();
    const palette = [0xdc2626, 0xf59e0b, 0x16a34a, 0x2563eb, 0xfacc15, 0x7c3aed, 0xf97316, 0x0ea5e9, 0xe11d48, 0x65a30d];
    // Two shelving runs of snacks, biscuits, chin-chin, drinks and gifts
    for (const sx of [-11.5, -8.6]) {
      k.box(M.metalDark, 0.5, 1.8, 5, sx, 0, -4.6);
      for (let t = 0; t < 4; t++) {
        const y = 0.25 + t * 0.42;
        k.box(M.steel, 0.62, 0.03, 5, sx, y, -4.6);
        for (let z = -6.9; z < -2.3; z += 0.22) {
          for (const side of [-0.18, 0.18]) {
            const h = 0.16 + ((z * 7 + t) % 3 === 0 ? 0.1 : 0.04);
            this.goods(k, 0.16, h, 0.14, sx + side, y + 0.03, z, palette[Math.abs(Math.floor(z * 13 + t * 3 + side * 10)) % palette.length]);
          }
        }
      }
      this.nav.blockRect(sx, -4.6, 0.45, 2.6);
      this.group.add(contactShade(1.2, 5.6, sx, -4.6, 0.3));
    }
    // The drinks fridge, lit from inside
    k.box(M.black, 2.4, 2.1, 0.7, -12.2, 0, -7.8);
    k.box(M.glassShelf, 2.3, 1.9, 0.02, -12.2, 0.1, -7.43);
    for (let t = 0; t < 4; t++) for (let i = 0; i < 12; i++) this.goods(k, 0.08, 0.26, 0.08, -13.25 + i * 0.19, 0.25 + t * 0.45, -7.65, [0x15803d, 0xb91c1c, 0x1e3a8a, 0xf59e0b][(i + t) % 4]);
    this.nav.blockRect(-12.2, -7.8, 1.3, 0.45);
    // The till
    k.soft(M.solid, 0.7, 1.0, 1.8, -4.6, 0, -3.2, 0.06);
    k.box(M.black, 0.35, 0.22, 0.3, -4.6, 1.0, -3.5);
    k.box(M.screen, 0.3, 0.2, 0.03, -4.6, 1.2, -3.3, Math.PI / 2);
    this.nav.blockRect(-4.6, -3.2, 0.45, 1.0);
    const g = k.build('shop');
    const sign = signMesh(['NAIJA MART', 'Snacks · Drinks · Gifts · Power banks'], 5, 0.9, { bg: '#0e7490', fg: '#ffffff', accent: '#facc15', density: 140 });
    sign.position.set(-8.3, 2.9, -1.4);
    g.add(sign);
    const fridgeLight = lightPool(3, 1.6, -12.2, -6.9, 0.18);
    g.add(fridgeLight);
    return g;
  }

  private buildLounge(): THREE.Group {
    const k = new Kit();
    // Glass walls with the door in the middle
    const front = -12.8;
    for (const [from, to] of [[-27.7, -22], [-20, -14.5]] as const) {
      k.box(M.glass, to - from, 2.8, 0.03, (from + to) / 2, 0.1, front);
      k.box(M.woodDark, to - from, 0.12, 0.12, (from + to) / 2, 0, front);
      k.box(M.woodDark, to - from, 0.1, 0.1, (from + to) / 2, 2.9, front);
      this.nav.blockRect((from + to) / 2, front, (to - from) / 2, 0.15);
    }
    k.box(M.glass, 0.03, 2.8, 7, -14.5, 0.1, -16.3);
    k.box(M.woodDark, 0.12, 0.12, 7, -14.5, 0, -16.3);
    this.nav.blockRect(-14.5, -16.3, 0.15, 3.5);
    // Inside: deep armchairs round low tables, a bar along the back
    for (const [ax, az] of [[-25, -15], [-20.5, -17.5], [-17.4, -15]]) {
      for (const a of [0, Math.PI]) {
        const sx = ax + Math.sin(a) * 0.95;
        const sz = az + Math.cos(a) * 0.95;
        k.soft(M.leatherTan, 0.9, 0.45, 0.85, sx, 0, sz, 0.12, a);
        k.soft(M.leatherTan, 0.9, 0.55, 0.22, sx + Math.sin(a) * 0.32, 0.4, sz + Math.cos(a) * 0.32, 0.08, a);
        for (const side of [-0.42, 0.42]) k.soft(M.leatherTan, 0.14, 0.62, 0.85, sx + Math.cos(a) * side, 0, sz - Math.sin(a) * side, 0.05, a);
      }
      k.cyl(M.woodDark, 0.45, 0.45, 0.42, ax, 0, az, 24);
      this.nav.blockRect(ax, az, 0.7, 1.5);
      this.group.add(contactShade(2.2, 3, ax, az, 0.35));
    }
    k.soft(M.woodDark, 6, 1.05, 0.7, -21, 0, -19.2, 0.06);
    k.box(M.solid, 6.1, 0.05, 0.8, -21, 1.05, -19.2);
    for (let i = 0; i < 14; i++) this.goods(k, 0.08, 0.3, 0.08, -23.6 + i * 0.38, 1.1, -19.35, [0x7f1d1d, 0x15803d, 0xf59e0b, 0xe5e7eb][i % 4]);
    this.nav.blockRect(-21, -19.2, 3.1, 0.45);
    this.plant(k, -27, -13.6);
    this.plant(k, -15.2, -19);
    const g = k.build('lounge');
    const sign = signMesh(['Executive Lounge'], 3, 0.55, { bg: '#3f2a1d', fg: '#f5d38a', density: 160 });
    sign.position.set(-21, 3.25, front + 0.02);
    g.add(sign);
    const carpet = new THREE.Mesh(floorPlane(13, 7, 2.5), M.carpet);
    carpet.position.set(-21.2, 0.006, -16.4);
    g.add(carpet);
    this.station(g, 'airport_vip_lounge', { x: -21, z: -11.9 });
    return g;
  }

  /**
   * The prayer rooms the signs point to, beside the lounge by the apron windows: a mosque and a
   * chapel side by side, each with its own doorway in the front wall. The mosque: green carpet with
   * the rows of mats marked, the mihrab in the back (qibla) wall, a shoe rack inside the door, the
   * prayer times outside, and the ablution basin with its taps and stools along the front wall. The
   * chapel: pews, an altar with a cloth and candles, a cross on the wall.
   */
  private buildPrayerRooms(): void {
    // Each wall is its own piece (the one between the camera and the player fades, alone); what is
    // in the rooms is low and never fades
    const k = new Kit();
    const walls = { front: new Kit(), west: new Kit(), east: new Kit(), divide: new Kit(), back: new Kit() };
    const west = -13.8, east = -3.8, front = -14.6, back = -19.75, divide = -8.2;
    const tall = 3.0;
    let w = walls.back;
    const wall = (x0: number, z0: number, x1: number, z1: number) => {
      const k = w;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      k.box(M.plasterWarm, alongX ? len : 0.16, tall, alongX ? 0.16 : len, (x0 + x1) / 2, 0, (z0 + z1) / 2);
      k.box(M.woodDark, alongX ? len + 0.02 : 0.2, 0.12, alongX ? 0.2 : len + 0.02, (x0 + x1) / 2, tall, (z0 + z1) / 2);
      k.box(M.woodDark, alongX ? len + 0.01 : 0.18, 0.14, alongX ? 0.18 : len + 0.01, (x0 + x1) / 2, 0, (z0 + z1) / 2);
      this.nav.blockRect((x0 + x1) / 2, (z0 + z1) / 2, alongX ? len / 2 + 0.1 : 0.2, alongX ? 0.2 : len / 2 + 0.1);
    };
    wall(west, back, east, back);
    w = walls.west;
    wall(west, back, west, front);
    w = walls.east;
    wall(east, back, east, front);
    w = walls.divide;
    wall(divide, back, divide, front);
    // The front wall, with a doorway into each (mosque about x -9.3, chapel about x -6.0)
    w = walls.front;
    wall(west, front, -10.0, front);
    wall(-8.6, front, -6.7, front);
    wall(-5.3, front, east, front);
    for (const [a, b] of [[-10.0, -8.6], [-6.7, -5.3]]) walls.front.box(M.woodDark, b - a + 0.2, 0.3, 0.2, (a + b) / 2, 2.3, front);

    // --- The mosque ---
    const carpet = new THREE.MeshStandardMaterial({ color: 0x1d5c3a, roughness: 1 });
    const floor = new THREE.Mesh(floorPlane(divide - west - 0.16, front - back - 0.16, 2), carpet);
    floor.position.set((west + divide) / 2, 0.008, (front + back) / 2);
    // Rows of mats across the room, each edged in gold, facing the back wall
    for (const z of [-18.3, -17.0, -15.7]) {
      for (let x = west + 0.75; x < divide - 0.5; x += 1.05) {
        k.box(M.red, 0.85, 0.012, 1.15, x, 0.01, z);
        k.box(M.yellow, 0.85, 0.014, 0.05, x, 0.012, z - 0.52);
      }
    }
    // The mihrab: a green niche in the qibla wall, an arch over it, the words above
    const mid = (west + divide) / 2;
    walls.back.box(M.green, 1.3, 1.95, 0.08, mid, 0, back + 0.1);
    walls.back.cyl(M.green, 0.65, 0.65, 0.08, mid, 1.9, back + 0.1 - 0.04, 24, Math.PI / 2);
    walls.back.box(M.yellow, 1.42, 0.06, 0.1, mid, 1.95, back + 0.12);
    // A low wooden minbar beside it, and the shoe rack inside the door
    k.box(M.woodDark, 0.7, 0.5, 0.7, mid + 1.4, 0, back + 0.5);
    k.box(M.woodDark, 0.6, 0.9, 0.7, mid + 1.4, 0, back + 0.5 + 0.0);
    k.box(M.wood, 1.4, 0.06, 0.35, -9.3 + 0.1, 0.25, front - 0.35 - 0.6);
    k.box(M.wood, 1.4, 0.06, 0.35, -9.3 + 0.1, 0.55, front - 0.35 - 0.6);
    k.box(M.woodDark, 0.05, 0.6, 0.35, -9.3 - 0.6, 0, front - 0.95);
    k.box(M.woodDark, 0.05, 0.6, 0.35, -9.3 + 0.8, 0, front - 0.95);
    for (let i = 0; i < 6; i++) this.goods(k, 0.12, 0.08, 0.26, -9.8 + i * 0.2, i % 2 ? 0.31 : 0.61, front - 0.95, [0x111111, 0x5b3a1e, 0x1f2937][i % 3]);
    this.nav.blockRect(-9.2, front - 0.95, 0.75, 0.25);
    // Outside: the ablution basin along the front wall, its taps, a stool at each
    k.soft(M.solid, 2.2, 0.75, 0.42, -11.9, 0, front + 0.3, 0.05);
    k.box(M.floorDark, 2.0, 0.04, 0.32, -11.9, 0.75, front + 0.3);
    for (let i = 0; i < 4; i++) {
      const x = -12.7 + i * 0.53;
      k.cyl(M.chrome, 0.018, 0.018, 0.25, x, 1.0, front + 0.12, 8);
      k.rod(M.chrome, 0.016, 0.14, x, 1.24, front + 0.18, Math.PI / 2, 8);
      k.cyl(M.steel, 0.14, 0.14, 0.04, x, 0.38, front + 0.95, 14);
      k.cyl(M.steel, 0.02, 0.02, 0.38, x, 0, front + 0.95, 6);
    }
    this.nav.blockRect(-11.9, front + 0.3, 1.15, 0.3);

    // --- The chapel ---
    const cx = (divide + east) / 2;
    const tiles = new THREE.Mesh(floorPlane(east - divide - 0.16, front - back - 0.16, 1.2), M.floorDark);
    tiles.position.set(cx, 0.008, (front + back) / 2);
    // A runner up the middle to the altar
    k.box(M.red, 0.9, 0.01, front - back - 0.6, cx, 0.012, (front + back) / 2);
    for (const z of [-16.25, -17.45]) {
      for (const side of [-1, 1]) {
        const px = cx + side * 1.05;
        k.box(M.wood, 1.5, 0.07, 0.42, px, 0.42, z);
        k.box(M.wood, 1.5, 0.48, 0.06, px, 0.5, z + 0.22, 0, -0.1);
        for (const end of [-0.72, 0.72]) k.box(M.woodDark, 0.06, 0.92, 0.5, px + end, 0, z + 0.02);
        this.nav.blockRect(px, z + 0.05, 0.78, 0.3);
      }
    }
    // The altar: a table under a white cloth, candles either side, the cross on the wall behind
    k.box(M.wood, 1.5, 0.95, 0.65, cx, 0, back + 0.6);
    k.box(M.solid, 1.56, 0.03, 0.71, cx, 0.95, back + 0.6);
    k.box(M.yellow, 0.2, 0.6, 0.012, cx, 0.36, back + 0.6 + 0.36);
    for (const side of [-0.55, 0.55]) {
      k.cyl(M.chrome, 0.035, 0.05, 0.16, cx + side, 0.98, back + 0.6, 10);
      k.cyl(M.solid, 0.025, 0.025, 0.16, cx + side, 1.14, back + 0.6, 8);
      k.cyl(M.lamp, 0.012, 0.02, 0.05, cx + side, 1.3, back + 0.6, 6);
    }
    this.nav.blockRect(cx, back + 0.6, 0.85, 0.45);
    walls.back.box(M.woodDark, 0.14, 1.5, 0.08, cx, 1.25, back + 0.12);
    walls.back.box(M.woodDark, 0.85, 0.14, 0.08, cx, 2.25, back + 0.12);

    const g = k.build('prayer rooms');
    g.add(floor, tiles);
    const pieces: Record<string, THREE.Group> = {};
    for (const [name, kit] of Object.entries(walls)) {
      pieces[name] = kit.build(`prayer rooms ${name} wall`);
      this.group.add(pieces[name]);
    }
    this.group.add(g);
    // Signs over each door, the prayer times between them, and one above to find them by
    const mosqueSign = signMesh(['🕌 Mosque'], 1.6, 0.42, WAYFINDING);
    mosqueSign.position.set(-9.3, 2.72, front + 0.1);
    const chapelSign = signMesh(['✝ Chapel'], 1.6, 0.42, WAYFINDING);
    chapelSign.position.set(-6.0, 2.72, front + 0.1);
    const times = signMesh(['Prayer times', 'Fajr 5:25 · Dhuhr 1:15', 'Asr 4:30 · Maghrib 6:50', 'Isha 8:00'], 1.5, 1.0, { bg: '#0f3d2a', fg: '#f5e7b2', density: 220 });
    times.position.set(-7.65, 1.55, front + 0.1);
    const above = signMesh(['🛐 Prayer rooms · Mosque · Chapel'], 4.2, 0.5, WAYFINDING);
    above.position.set(-8.8, 3.6, front + 0.05);
    const words = signMesh(['﷽'], 1.1, 0.4, { bg: '#0f7a46', fg: '#f2c94c', density: 240 });
    words.position.set(mid, 2.95, back + 0.16);
    pieces.front.add(mosqueSign, chapelSign, times, above);
    pieces.back.add(words);
  }

  /**
   * The way up to the upper level (the food court, duty free and the viewing gallery), between the
   * information desk and the baggage hall: two escalators rising toward the airside, up on the left
   * and down on the right, into a landing with the way through lit above it; and a glass lift beside
   * them whose car really goes up and comes down.
   */
  private buildLevels(): void {
    const up = new Escalator({ x: HALL_UP.x, z: HALL_UP.foot, rise: LEVEL_RISE, run: ESCALATOR_RUN, up: true });
    const down = new Escalator({ x: HALL_DOWN.x, z: HALL_DOWN.foot, rise: LEVEL_RISE, run: ESCALATOR_RUN, up: false });
    this.escalators = [up, down];
    this.lift = new GlassLift({ x: HALL_LIFT.x, z: HALL_LIFT.z, travel: H - 2.6, shaft: H });
    this.group.add(up.group, down.group, this.lift.group);

    // The landing at the top: a slab hung from the roof, glass at its sides, the way through at its back
    const k = new Kit();
    const top = HALL_UP.foot - ESCALATOR_RUN;
    const x0 = HALL_UP.x - 0.85, x1 = HALL_DOWN.x + 0.85;
    const back = top - 3.6;
    k.box(M.solid, x1 - x0, 0.35, top - back + 0.4, (x0 + x1) / 2, LEVEL_RISE - 0.35, (top + back) / 2 - 0.2);
    k.box(M.floorDark, x1 - x0, 0.02, top - back, (x0 + x1) / 2, LEVEL_RISE, (top + back) / 2);
    for (const x of [x0, x1]) {
      k.box(M.chrome, 0.05, 1.05, top - back, x, LEVEL_RISE, (top + back) / 2);
      for (const z of [back + 0.2, top - 0.2]) k.cyl(M.chrome, 0.025, 0.025, H - LEVEL_RISE, x, LEVEL_RISE, z, 8);
    }
    // The wall at the back of the landing, its doorway lit, and the words over it
    k.box(M.plasterWarm, x1 - x0 + 1.2, H - LEVEL_RISE, 0.2, (x0 + x1) / 2, LEVEL_RISE, back);
    k.box(M.lamp, 1.6, 2.3, 0.05, (x0 + x1) / 2, LEVEL_RISE, back + 0.12);
    const g = k.build('upper landing');
    const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.2, depthWrite: false });
    for (const x of [x0, x1]) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, top - back), glass);
      pane.position.set(x, LEVEL_RISE + 0.5, (top + back) / 2);
      g.add(pane);
    }
    const sign = signMesh(['⬆ UPPER LEVEL', 'Food Court · Duty Free · Viewing Gallery'], 4.4, 0.9, WAYFINDING);
    sign.position.set((x0 + x1) / 2, LEVEL_RISE + 2.95, back + 0.14);
    const foot = signMesh(['⬆ Upper level  ·  🛗 Lift'], 2.6, 0.42, WAYFINDING);
    foot.position.set(HALL_LIFT.x, 2.75, HALL_LIFT.z + 1.02);
    g.add(sign, foot);
    this.group.add(g);

    // Nobody walks into the escalators' low ends or the lift shaft
    this.nav.blockRect((x0 + x1) / 2, (HALL_UP.foot + top) / 2, (x1 - x0) / 2 - 0.15, (HALL_UP.foot - top) / 2);
    this.nav.blockRect(HALL_LIFT.x, HALL_LIFT.z, 1.05, 1.0);

    // Going up: on the escalator, or in the lift
    const marker = (x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(x, 0.8, z);
      this.group.add(m);
      return m;
    };
    this.interactiveList.push(
      { mesh: marker(HALL_UP.x, HALL_UP.foot + 0.4), id: 'airport_escalator_up', name: '⬆ Escalator to the upper level', category: 'Airport · Upper level', description: 'Up to the food court, duty free and the viewing gallery.', interactionPoint: new THREE.Vector3(HALL_UP_STAND.x, 0, HALL_UP_STAND.z) },
      { mesh: marker(HALL_LIFT.x, HALL_LIFT.z + 1.2), id: 'airport_lift_up', name: '🛗 Glass lift', category: 'Airport · Upper level', description: 'Up to the food court, duty free and the viewing gallery.', interactionPoint: new THREE.Vector3(HALL_LIFT.x, 0, HALL_LIFT.stand) },
    );
    const here = (x: number, z: number) => this.group.position.clone().add(new THREE.Vector3(x, 0, z));
    PlaceActions.register('airport_escalator_up', {
      label: () => '⬆ Escalator up to the food court',
      run: (host) => {
        const actor = host.actor;
        const upper = placeRooms.get(UPPER_KEY);
        if (!upper || host.director.interrupt(actor) === 'locked') return;
        const ride = new Sequence('escalator up', [actor]).locked().add(
          steps.walk(actor, here(HALL_UP_STAND.x, HALL_UP_STAND.z), { nav: this.nav, ifStuck: 'snap' }),
          steps.face(actor, Math.PI),
          steps.slide(actor, here(HALL_UP.x, HALL_UP.foot + 0.3), 0.5),
          rideStair(actor, here(HALL_UP.x, HALL_UP.foot), here(HALL_UP.x, top), 0, LEVEL_RISE, 7),
        );
        ride.onEnd((reason) => {
          actor.root.position.y = 0;
          if (reason === 'done') host.ride(UPPER_ID, upper.at(HALL_UP.x, UPPER_TOP - 1.0), Math.PI);
        });
        host.director.run(ride);
      },
    });
    PlaceActions.register('airport_lift_up', {
      label: () => '🛗 Lift up to the food court',
      run: (host) => {
        const actor = host.actor;
        const upper = placeRooms.get(UPPER_KEY);
        if (!upper || host.director.interrupt(actor) === 'locked') return;
        const lift = this.lift;
        const inside = here(HALL_LIFT.x, HALL_LIFT.z);
        const ride = new Sequence('lift up', [actor]).locked().add(
          steps.walk(actor, here(HALL_LIFT.x, HALL_LIFT.stand), { nav: this.nav, ifStuck: 'snap' }),
          steps.face(actor, inside),
          steps.animate(actor, { arms: 'reach' }, 0.6, [{ at: 0.5, run: () => lift.doors(true) }]),
          steps.wait(0.7),
          steps.slide(actor, inside, 0.9, { legs: 'walk', arms: 'swing' }),
          steps.face(actor, 0),
          steps.call('doors close', () => { lift.doors(false); }),
          steps.wait(0.6),
          rideLift(actor, lift, 1),
        );
        ride.onEnd((reason) => {
          actor.root.position.y = 0;
          lift.send(0);
          lift.doors(false);
          if (reason === 'done') host.ride(UPPER_ID, upper.at(UPPER_LIFT.x, UPPER_LIFT.stand), Math.PI);
        });
        host.director.run(ride);
      },
    });
  }

  // --- Arrivals: the belt, SIM and cab desks ---------------------------------------------------------

  private buildBaggageHall(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'baggage hall';
    const belt = new THREE.Group();
    belt.position.copy(CAROUSEL);
    belt.rotation.y = Math.PI / 2;
    const k = new Kit();
    const R = BELT_RADIUS;
    const Ls = BELT_STRAIGHT;
    // The stainless sides, a black rubber bumper along the top edge, the island in the middle
    for (const side of [-1, 1]) {
      k.box(M.steel, 0.12, 0.44, Ls, side * (R + 0.42), 0, 0);
      k.rod(M.rubber, 0.05, Ls, side * (R + 0.42), 0.46, 0, Math.PI / 2, 10);
      k.box(M.black, 0.08, 0.06, Ls, side * (R + 0.38), 0.0, 0);
    }
    for (const end of [-1, 1]) {
      const cap = new THREE.CylinderGeometry(R + 0.42, R + 0.42, 0.44, 32, 1, true, end > 0 ? 0 : Math.PI, Math.PI);
      cap.translate(0, 0.22, 0);
      k.geo(M.steel, cap, 0, 0, end * Ls / 2);
      const bumper = new THREE.TorusGeometry(R + 0.42, 0.05, 8, 32, Math.PI);
      bumper.rotateX(Math.PI / 2);
      bumper.rotateY(end > 0 ? 0 : Math.PI);
      k.geo(M.rubber, bumper, 0, 0.46, end * Ls / 2);
      const isle = new THREE.CylinderGeometry(R - 0.4, R - 0.4, 0.5, 32, 1, false, end > 0 ? 0 : Math.PI, Math.PI);
      isle.translate(0, 0.25, 0);
      k.geo(M.steel, isle, 0, 0, end * Ls / 2);
    }
    k.box(M.steel, 2 * (R - 0.4), 0.5, Ls, 0, 0, 0);
    k.box(M.metalDark, 2 * (R + 0.42), 0.4, Ls, 0, 0, 0); // the dark bed under the plates
    // The feed: bags come through rubber flaps in the baggage-room wall and slide down a sloped belt
    const run = 2.2;
    const drop = 1.05;
    const slope = Math.atan2(drop, run);
    const ramp = new THREE.BoxGeometry(0.9, 0.05, Math.hypot(run, drop));
    k.geo(M.rubber, ramp, 0, 0.5 + drop / 2, -Ls / 2 - R + 0.2 - run / 2, 0, slope);
    for (const side of [-0.5, 0.5]) {
      const rail = new THREE.BoxGeometry(0.06, 0.22, Math.hypot(run, drop));
      k.geo(M.steel, rail, side, 0.6 + drop / 2, -Ls / 2 - R + 0.2 - run / 2, 0, slope);
      k.box(M.steel, 0.08, 0.5 + drop - 0.05, 0.08, side, 0, -Ls / 2 - R - run + 0.4);
    }
    const wallZ = -Ls / 2 - R - run - 0.25;
    k.box(M.metalDark, 3.6, 3.4, 0.2, 0, 0, wallZ - 0.12);
    k.box(M.black, 1.3, 1.0, 0.1, 0, 1.05, wallZ + 0.02);
    for (let i = 0; i < 6; i++) k.box(M.rubber, 0.2, 0.7, 0.015, -0.5 + i * 0.2, 1.33, wallZ + 0.09);
    k.box(M.steel, 1.5, 0.12, 0.16, 0, 2.05, wallZ + 0.02);
    belt.add(k.build('belt'));
    // The moving plates: overlapping crescents, so the ring reads as a belt going round
    const plate = new THREE.Shape();
    plate.moveTo(-0.36, -0.2);
    plate.quadraticCurveTo(0, -0.14, 0.36, -0.2);
    plate.lineTo(0.36, 0.22);
    plate.quadraticCurveTo(0, 0.28, -0.36, 0.22);
    plate.closePath();
    const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: 0.022, bevelEnabled: false, curveSegments: 6 });
    plateGeo.rotateX(Math.PI / 2);
    const total = 2 * Ls + 2 * Math.PI * R;
    const plates = Math.round(total / 0.33);
    this.beltPlates = new THREE.InstancedMesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.55, metalness: 0.35, name: 'belt plates' }), plates);
    this.beltPlates.name = 'belt plates';
    this.beltPlates.frustumCulled = false;
    this.beltPlates.receiveShadow = true;
    belt.add(this.beltPlates);
    // The bags riding round, in the same kit the travellers carry
    this.beltBags = new LuggageBatch({ rollerLying: 16, ghana: 10, duffel: 10, carton: 10 });
    belt.add(this.beltBags.group);
    const kinds: BagKind[] = ['rollerLying', 'rollerLying', 'ghana', 'carton', 'duffel', 'rollerLying', 'ghana', 'rollerLying', 'carton', 'duffel', 'rollerLying', 'ghana', 'rollerLying'];
    kinds.forEach((kind, i) => {
      this.onBelt.push({ kind, colour: BAG_COLOURS[(i * 5) % BAG_COLOURS.length], t: i / kinds.length + (i % 3) * 0.012, ramp: -1, away: 0, turn: (i % 4) * 0.35 - 0.5 });
    });
    this.stepBelt(0);
    const sign = signMesh(['BELT 1', 'NL 205 from Abuja'], 3.2, 1.0, { bg: '#111827', fg: '#ffcc1a', density: 140 });
    sign.position.set(0, 2.85, wallZ + 0.04);
    belt.add(sign);
    group.add(belt);
    this.nav.blockRect(CAROUSEL.x, CAROUSEL.z, Ls / 2 + R + 0.5, R + 0.5);
    this.nav.blockRect(CAROUSEL.x - Ls / 2 - R - 1.2, CAROUSEL.z, 1.3, 1.9);
    group.add(contactShade(Ls + 4, 4.2, CAROUSEL.x, CAROUSEL.z, 0.35));

    // SIM desk and cab desk by the arrivals doors
    const d = new Kit();
    for (const [x, colour] of [[24, M.yellow], [11, M.green]] as const) {
      d.soft(M.solid, 2.6, 1.05, 0.8, x, 0, 17, 0.08);
      d.box(colour, 2.6, 0.18, 0.02, x, 0.8, 16.58);
      d.box(M.wood, 2.7, 0.05, 0.9, x, 1.05, 17);
      this.monitor(d, x + 0.7, 1.07, 17.25, 0, x > 20 ? ['NaijaTel', 'New SIM · Register'] : ['Airport Cabs', 'Bookings']);
      // The card machine at the front, a tray of business cards or SIM packs beside it
      d.box(M.black, 0.09, 0.05, 0.17, x - 0.6, 1.08, 16.82, 0.2);
      d.box(M.screen, 0.07, 0.01, 0.06, x - 0.6, 1.13, 16.8, 0.2);
      // A tall backdrop behind the agent, in the desk's colours
      d.box(M.metalDark, 3.2, 3.3, 0.12, x, 0, 18.75);
      this.nav.blockRect(x, 17.4, 1.5, 0.9);
      this.nav.blockRect(x, 18.75, 1.7, 0.2);
    }
    for (let i = 0; i < 4; i++) this.trolley(d, 9 + i * 0.32, 12.6, Math.PI / 2);
    const desks = d.build('arrivals desks');
    for (const sc of this.screens.splice(0)) desks.add(sc);
    // The backdrops' faces: the telecom's colours with its offers, the cab desk's fixed fares
    const simBoard = signMesh(['NaijaTel', 'SIM card N1,500 · Register in 5 min', 'Airtime · Data bundles · eSIM'], 3.0, 1.5, { bg: '#facc15', fg: '#111827', accent: '#111827', density: 120 });
    simBoard.position.set(24, 1.62, 18.68);
    simBoard.rotation.y = Math.PI;
    const cabBoard = signMesh(['Airport Cabs · Fixed fares', 'Ikeja N8,500 · Yaba N15,000', 'Victoria Island N25,000 · Lekki N30,000'], 3.0, 1.5, { bg: '#0f7a46', fg: '#ffffff', accent: '#facc15', density: 120 });
    cabBoard.position.set(11, 1.62, 18.68);
    cabBoard.rotation.y = Math.PI;
    desks.add(simBoard, cabBoard);
    // SIM packs on a little stand, in the network's colours
    const packs = new Kit();
    for (let i = 0; i < 8; i++) packs.box(i % 2 ? M.yellow : M.solid, 0.08, 0.12, 0.012, 23.3 + (i % 4) * 0.11, 1.08 + Math.floor(i / 4) * 0.14, 16.75, 0, -0.2);
    desks.add(packs.build('sim packs'));
    const sim = signMesh(['SIM cards · Airtime · Data'], 2.8, 0.55, { bg: '#facc15', fg: '#111827', density: 150 });
    sim.position.set(24, 2.95, 18.66);
    sim.rotation.y = Math.PI;
    const cab = signMesh(['Airport Cabs · Fixed fares'], 2.8, 0.55, { bg: '#0f7a46', fg: '#ffffff', density: 150 });
    cab.position.set(11, 2.95, 18.66);
    cab.rotation.y = Math.PI;
    desks.add(sim, cab);
    group.add(desks);

    this.station(group, 'airport_baggage_carousel', { x: CAROUSEL.x, z: CAROUSEL.z + R + 1.1 });
    const telecom = this.def.stations.find((s) => s.id === 'airport_telecom_desk')!;
    this.interactiveList.push({ mesh: desks, id: telecom.id, name: telecom.name, category: telecom.category, description: telecom.description, interactionPoint: new THREE.Vector3(24, 0, 15.8) });
    const cabDef = this.def.stations.find((s) => s.id === 'airport_cab_pickup')!;
    this.interactiveList.push({ mesh: desks, id: cabDef.id, name: cabDef.name, category: cabDef.category, description: cabDef.description, interactionPoint: new THREE.Vector3(11, 0, 15.8) });
    this.nav.clearRect(24, 15.8, 0.5, 0.5);
    this.nav.clearRect(11, 15.8, 0.5, 0.5);
    return group;
  }

  // --- Signs, boards and light ---------------------------------------------------------------------

  private buildSigns(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'hanging signs';
    const hang = (lines: string[], w: number, x: number, z: number, yaw = 0) => {
      const s = signMesh(lines, w, 0.62, WAYFINDING);
      s.position.set(x, 4.6, z);
      s.rotation.y = yaw;
      const back = s.clone();
      back.rotation.y = yaw + Math.PI;
      back.position.z += Math.cos(yaw) * -0.02;
      g.add(s, back);
    };
    hang(['←  Check-in 1–6      Security  ↑'], 6, -9, 13.5);
    hang(['Baggage belt  →      Cabs · SIM  →'], 6, 9, 13.5);
    hang(['Gates 1–2  →      Toilets  ←'], 5.4, 2, -2.4);
    hang(['←  Café · Shop · Lounge'], 4.4, -10, -0.6);
    // Departure boards over the check-in hall and at the start of airside
    for (const [x, z] of [[-15.5, 14.6], [-2, 14.6]]) {
      const board = this.boardMesh('departures', 4.4, 2.5);
      board.position.set(x, 4.2, z);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.7, 0.12), M.black);
      frame.position.set(x, 4.2, z - 0.07);
      // Two-sided, as they are: the same live board on the back, for those walking in
      const back = new THREE.Mesh(board.geometry, board.material);
      back.position.set(x, 4.2, z - 0.14);
      back.rotation.y = Math.PI;
      g.add(frame, board, back);
      for (const cx of [-1.6, 1.6]) {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, H - 5.55, 6), M.steel);
        cable.position.set(x + cx, 5.45 + (H - 5.55) / 2, z - 0.07);
        g.add(cable);
      }
    }
    // Toilets on the west wall
    const wc = signMesh(['🚻  Toilets   ·   🕌 Prayer room'], 3.4, 0.5, WAYFINDING);
    wc.position.set(-27.7, 2.4, -0.4);
    wc.rotation.y = Math.PI / 2;
    g.add(wc);
    return g;
  }

  /** The pools of daylight from the roof lights, and the light at the glass */
  private buildFloorLight(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'floor light';
    for (const x of [-18, -6, 6, 18]) {
      for (const z of [-11, 0, 11]) g.add(lightPool(9, 7, x, z, 0.16));
    }
    g.add(lightPool(W - 4, 5, 0, -18, 0.22));
    g.add(lightPool(W - 4, 4, 0, 18, 0.14));
    return g;
  }

  /** A display board whose picture is drawn from the timetable */
  private boardMesh(kind: 'departures' | 'gate', width: number, height: number, gate?: number): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = kind === 'departures' ? 1024 : 512;
    canvas.height = Math.round((canvas.width * height) / width);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.boards.push({ canvas, texture, kind, gate });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    mesh.name = `${kind} board`;
    return mesh;
  }

  /** Which airport this hall is today, from its name */
  private cityHere(): FlightCity {
    for (const [city, airport] of Object.entries(AIRPORTS)) if (this.def.name.includes(`(${airport.code})`)) return city as FlightCity;
    return 'lagos';
  }

  /** Redraws the boards: this airport's departures, their times, gates and status */
  private refreshBoards(force = false): void {
    const city = this.cityHere();
    const hour = AirportInterior.hourNow();
    const key = `${city}|${Math.floor(hour * 6)}`;
    if (!force && key === this.boardsFor) return;
    this.boardsFor = key;
    const routes = ROUTES.filter((r) => r.from === city);
    const fmt = (h: number) => {
      const t = ((h % 24) + 24) % 24;
      return `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round((t % 1) * 60) % 60).padStart(2, '0')}`;
    };
    // Each route flies every two hours, each at its own minutes past
    const first = Math.floor(hour / 2) * 2;
    const flights = routes.flatMap((r, i) => [0, 2, 4, 6].map((k) => ({ r, dep: first + k + 0.25 + i * 0.6 })))
      .filter((f) => f.dep > hour - 0.1)
      .sort((a, b) => a.dep - b.dep)
      .slice(0, 7);
    const status = (dep: number) => {
      const mins = (dep - hour) * 60;
      if (mins < 15) return ['Gate closing', '#f87171'];
      if (mins < 45) return ['Boarding', '#4ade80'];
      if (mins < 90) return ['Go to gate', '#fde047'];
      return ['On time', '#e5e7eb'];
    };
    for (const board of this.boards) {
      const g = board.canvas.getContext('2d')!;
      const w = board.canvas.width;
      const h = board.canvas.height;
      g.fillStyle = '#0b1220';
      g.fillRect(0, 0, w, h);
      g.textBaseline = 'middle';
      if (board.kind === 'departures') {
        g.fillStyle = '#16351f';
        g.fillRect(0, 0, w, h * 0.16);
        g.fillStyle = '#ffffff';
        g.font = `700 ${Math.round(h * 0.09)}px "Outfit", Arial, sans-serif`;
        g.textAlign = 'left';
        g.fillText('✈  Departures', w * 0.03, h * 0.08);
        g.textAlign = 'right';
        g.fillText(fmt(hour), w * 0.97, h * 0.08);
        const cols = [0.03, 0.17, 0.33, 0.66, 0.76];
        g.font = `600 ${Math.round(h * 0.055)}px "Outfit", Arial, sans-serif`;
        g.fillStyle = '#93a3b8';
        g.textAlign = 'left';
        ['Time', 'Flight', 'Destination', 'Gate', 'Remarks'].forEach((t, i) => g.fillText(t, w * cols[i], h * 0.22));
        flights.forEach((f, row) => {
          const y = h * (0.32 + row * 0.1);
          if (row % 2 === 0) {
            g.fillStyle = 'rgba(255,255,255,0.04)';
            g.fillRect(0, y - h * 0.05, w, h * 0.1);
          }
          g.font = `600 ${Math.round(h * 0.06)}px "Outfit", Arial, sans-serif`;
          g.fillStyle = '#fde68a';
          g.fillText(fmt(f.dep), w * cols[0], y);
          g.fillStyle = '#ffffff';
          g.fillText(f.r.flight, w * cols[1], y);
          g.fillText(AIRPORTS[f.r.to].city, w * cols[2], y);
          g.fillText(String(f.r.gate), w * cols[3], y);
          const [label, colour] = status(f.dep);
          g.fillStyle = colour;
          g.fillText(label, w * cols[4], y);
        });
      } else {
        const next = flights.find((f) => f.r.gate === board.gate);
        g.fillStyle = '#ffcc1a';
        g.fillRect(0, 0, w, h * 0.24);
        g.fillStyle = '#111827';
        g.font = `700 ${Math.round(h * 0.15)}px "Outfit", Arial, sans-serif`;
        g.textAlign = 'center';
        g.fillText(`GATE ${board.gate}`, w / 2, h * 0.12);
        g.fillStyle = '#ffffff';
        g.font = `700 ${Math.round(h * 0.17)}px "Outfit", Arial, sans-serif`;
        g.fillText(next ? `${next.r.flight}  ${AIRPORTS[next.r.to].city}` : 'No departures', w / 2, h * 0.45);
        if (next) {
          const [label, colour] = status(next.dep);
          g.font = `600 ${Math.round(h * 0.13)}px "Outfit", Arial, sans-serif`;
          g.fillStyle = '#fde68a';
          g.fillText(`Departs ${fmt(next.dep)}`, w / 2, h * 0.68);
          g.fillStyle = colour;
          g.fillText(label, w / 2, h * 0.86);
        }
      }
      board.texture.needsUpdate = true;
    }
  }

  // --- Outside the glass: the apron and the aircraft on their stands ----------------------------------

  // --- Small things used in many places -----------------------------------------------------------

  private goodsMaterials = new Map<number, THREE.MeshStandardMaterial>();

  /** A coloured box of goods (a packet, a bottle, a case) sharing one material per colour */
  private goods(k: Kit, w: number, h: number, d: number, x: number, y: number, z: number, color: number): void {
    let mat = this.goodsMaterials.get(color);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
      this.goodsMaterials.set(color, mat);
    }
    k.box(mat, w, h, d, x, y, z);
  }

  private trolley(k: Kit, x: number, z: number, yaw: number): void {
    k.box(M.steel, 0.56, 0.04, 0.9, x, 0.28, z, yaw);
    k.box(M.steel, 0.56, 0.75, 0.04, x - Math.sin(yaw) * 0.45, 0.3, z - Math.cos(yaw) * 0.45, yaw);
    k.rod(M.black, 0.03, 0.56, x - Math.sin(yaw) * 0.5, 1.05, z - Math.cos(yaw) * 0.5, yaw);
    for (const s of [-0.22, 0.22]) {
      k.box(M.black, 0.04, 0.12, 0.12, x + Math.cos(yaw) * s, 0, z - Math.sin(yaw) * s, yaw);
    }
  }

  private plant(k: Kit, x: number, z: number): void {
    k.cyl(M.plantPot, 0.32, 0.26, 0.6, x, 0, z, 16);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const leaf = new THREE.ConeGeometry(0.12, 1.1, 5);
      k.geo(i % 2 ? M.leaf : M.leafLight, leaf, x + Math.sin(a) * 0.12, 1.1, z + Math.cos(a) * 0.12, a, Math.sin(a) * 0.35, Math.cos(a) * 0.35);
    }
    this.nav.blockRect(x, z, 0.4, 0.4);
  }

  /** The crowd as bodies the player cannot walk through (world coordinates in and out) */
  public peopleNear(x: number, z: number, range: number, out: Array<{ x: number; z: number; r: number }>): void {
    const o = this.group.position;
    const from = out.length;
    this.crowd.peopleNear(x - o.x, z - o.z, range, out);
    for (let i = from; i < out.length; i++) {
      out[i].x += o.x;
      out[i].z += o.z;
    }
  }

  /**
   * The staff in their working clothes, as the drawn model shows them: the airline's agents in its
   * green shirts over navy, FAAN security in dark uniforms and caps, the captain in white with a
   * dark cap, each shop and desk in its own colours. (The look is the one the model is dressed from.)
   */
  private dressForWork(npc: InteriorNPCMesh): void {
    const look = RigRegistry.entryOfGroup(npc.humanRig.group)?.look as unknown as Record<string, unknown> | undefined;
    if (!look) return;
    const d = npc.def;
    const female = d.gender === 'female';
    const role = `${d.role} ${d.title}`.toLowerCase();
    const uniform = (top: string, colour: number, below: number, extra: Record<string, unknown> = {}) =>
      Object.assign(look, {
        outfit: top,
        outfitColor: colour,
        bottom: female && !extra.trousers ? 'pencil_skirt' : 'trousers',
        trousersColor: below,
        shoes: female && !extra.trousers ? 'heels' : 'oxfords',
        shoeColor: 0x111111,
        hat: undefined,
        ...extra,
      });
    if (role.includes('captain')) uniform('corporate_shirt', 0xf8fafc, 0x0f172a, { hat: 'cap', hatColor: 0x0f172a });
    else if (role.includes('security') || role.includes('x-ray')) uniform('corporate_shirt', 0x1f2937, 0x111827, { hat: 'cap', hatColor: 0x111827, shoes: 'boots', trousers: true, bottom: 'trousers' });
    else if (role.includes('agent') && role.includes('nigerialife') || role.includes('gate agent') || role.includes('check-in')) uniform(female ? 'button_shirt' : 'corporate_shirt', 0x0f7a46, 0x1f2a44);
    else if (role.includes('information')) uniform(female ? 'button_shirt' : 'corporate_shirt', 0x1e3a8a, 0x111827);
    else if (role.includes('lounge')) uniform('button_shirt', 0x7f1d1d, 0x111111);
    else if (role.includes('barista')) uniform('polo_shirt', 0x7c2d12, 0x111111, { hat: 'cap', hatColor: 0x7c2d12, trousers: true, bottom: 'trousers', shoes: 'sneakers' });
    else if (role.includes('cashier')) uniform('polo_shirt', 0x0e7490, 0x1f2a44, { trousers: true, bottom: 'trousers', shoes: 'sneakers' });
    else if (role.includes('sim')) uniform('polo_shirt', 0xfacc15, 0x111111, { hat: 'cap', hatColor: 0xfacc15, trousers: true, bottom: 'trousers', shoes: 'sneakers' });
    else if (role.includes('cab')) uniform('corporate_shirt', 0x166534, 0x111111);
    else if (role.includes('cleaner')) uniform('polo_shirt', 0x0d9488, 0x0f3d3a, { trousers: true, bottom: 'trousers', shoes: 'sneakers' });
  }

  /** The toilets in the left wall airside, by the café: a door that swings, and its sign. Returns the leaf. */
  private buildToilets(): THREE.Object3D {
    const holder = new THREE.Group();
    holder.name = 'toilets door';
    holder.position.set(-W / 2 + 0.02, 0, -1.0);
    holder.rotation.y = Math.PI / 2;
    const k = new Kit();
    k.box(M.metalDark, 1.3, 2.3, 0.1, 0, 0, 0);
    const frame = k.build('toilets frame');
    const pivot = new THREE.Group();
    pivot.position.set(-0.5, 0, 0.06);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.15, 0.05), M.woodDark);
    leaf.position.set(0.5, 1.075, 0);
    pivot.add(leaf);
    const sign = signMesh(['🚻 Toilets', 'Ladies · Gents'], 1.4, 0.5, WAYFINDING);
    sign.position.set(0, 2.65, 0.08);
    holder.add(frame, pivot, sign);
    this.group.add(holder);
    this.nav.clearRect(-26.8, -1.0, 0.5, 0.5);
    return pivot;
  }

  // --- The people --------------------------------------------------------------------------------------

  private buildCrowd(): AirportCrowd {
    // Every seat in the hall. About three in ten gate seats, some café chairs and a few lounge
    // armchairs have someone in them (always the same ones); the rest are free for the player
    const seats: Array<{ x: number; z: number; yaw: number; y: number }> = [];
    let n = 7;
    const roll = () => (n = (n * 1103515245 + 12345) & 0x7fffffff) % 100;
    // (the crowd puts its sitters SIT_FORWARD in front of a seat and SIT_UP above its y: where the player would sit)
    const seat = (s: AirportSeat, crowd: boolean) => {
      if (!crowd) return this.freeSeats.push(s);
      const more = SEAT_FORWARD[s.kind] - 0.17;
      return seats.push({ x: s.x + Math.sin(s.yaw) * more, z: s.z + Math.cos(s.yaw) * more, yaw: s.yaw, y: seatLift(s.top) - 0.07 });
    };
    let k = 0;
    for (const cx of GATES) {
      for (const rz of [-12.5, -9.5, -6.5]) {
        for (const bx of [cx - 3.4, cx + 3.4]) {
          for (let i = 0; i < 5; i++) seat({ id: `airport_seat_${k++}`, x: bx + 1.24 - i * 0.62, z: rz - 0.04, yaw: Math.PI, top: 0.49, kind: 'gate' }, roll() < 30);
        }
      }
    }
    for (const [tx, tz] of [[-22.5, -10.5], [-19, -10.5], [-22.5, -7.5], [-19, -7.5], [-17.5, -4.2]]) {
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        seat({ id: `airport_seat_${k++}`, x: tx + Math.sin(a) * CAFE_CHAIR, z: tz + Math.cos(a) * CAFE_CHAIR, yaw: a + Math.PI, top: 0.52, kind: 'cafe', table: [tx, tz] }, roll() < 40);
      }
    }
    for (const z of [-16.25, -17.45]) {
      for (const px of [-7.05, -4.95]) {
        for (const dx of [-0.4, 0.4]) if (roll() < 35) seats.push({ x: px + dx, z: z + 0.04, yaw: Math.PI, y: seatLift(0.49) - 0.07 });
      }
    }
    for (const [ax, az] of [[-25, -15], [-20.5, -17.5], [-17.4, -15]]) {
      seat({ id: `airport_seat_${k++}`, x: ax, z: az + 0.95, yaw: Math.PI, top: 0.45, kind: 'lounge' }, roll() < 70);
      seat({ id: `airport_seat_${k++}`, x: ax, z: az - 0.95, yaw: 0, top: 0.45, kind: 'lounge' }, false);
    }
    return new AirportCrowd({
      counters: [-20.5, -8.5],
      // From the head (by the counters) back through the lanes to where the queue is joined
      queue: [[-9.0, 7.1], [-22.8, 7.1], [-22.8, 8.5], [-8.7, 8.5], [-8.7, 9.9], [-22.8, 9.9], [-22.8, 11.5], [-14, 11.5]],
      lanes: LANES,
      gates: GATES,
      boarding: [APRON.gate1Stairs, APRON.busDoor],
      arrivalsFrom: APRON.arrivalsStairs,
      seats,
      beltSpots: [
        ...[12.4, 13.2, 14.0, 14.8, 15.6, 16.4, 17.2, 18.0, 18.8, 19.6].map((x) => ({ x, z: 7.55, yaw: 0 })),
        ...[12.4, 13.2, 14.0, 18.0, 18.8, 19.6].map((x) => ({ x, z: 12.45, yaw: Math.PI })),
        { x: 21.35, z: 9.3, yaw: -Math.PI / 2 },
        { x: 21.35, z: 10.7, yaw: -Math.PI / 2 },
      ],
      takeBag: (x, z) => this.takeBag(x, z),
      playerAt: () => AirportInterior.playerAt(),
      crew: APRON_CREW,
      origin: this.group.position,
    });
  }

  /** The belt going round: its plates, the bags on it, and new bags sliding down the feed */
  private stepBelt(delta: number): void {
    const Ls = BELT_STRAIGHT;
    const R = BELT_RADIUS;
    const total = 2 * Ls + 2 * Math.PI * R;
    const speed = 0.45;
    this.beltRun = (this.beltRun + delta * speed) % total;
    const n = this.beltPlates.count;
    for (let i = 0; i < n; i++) {
      const p = this.beltPoint(i / n + this.beltRun / total);
      this.be.set(0, p.angle, 0);
      this.bm.compose(this.bv.set(p.pos.x, 0.42 + (i % 2) * 0.006, p.pos.z), this.bq.setFromEuler(this.be), this.bone);
      this.beltPlates.setMatrixAt(i, this.bm);
    }
    this.beltPlates.instanceMatrix.needsUpdate = true;
    // Where the feed meets the ring (the far end's apex), and whether that bit of belt is clear
    const apex = (2 * Ls + 1.5 * Math.PI * R) / total;
    const clear = () => this.onBelt.every((b) => b.ramp >= 0 || b.away > 0 || Math.abs(((b.t - apex + 1.5) % 1) - 0.5) > 0.055);
    const run = 2.2;
    const drop = 1.05;
    const slope = Math.atan2(drop, run);
    this.beltBags.begin();
    for (const b of this.onBelt) {
      if (b.away > 0) {
        b.away -= delta;
        if (b.away > 0) continue;
        // Another bag through the flaps
        const kinds: BagKind[] = ['rollerLying', 'rollerLying', 'ghana', 'carton', 'duffel'];
        b.kind = kinds[Math.floor(Math.random() * kinds.length)];
        b.colour = BAG_COLOURS[Math.floor(Math.random() * BAG_COLOURS.length)];
        b.ramp = 0;
      }
      if (b.ramp >= 0) {
        if (b.ramp < 1) b.ramp = Math.min(1, b.ramp + delta / 3.2);
        else if (clear()) {
          b.ramp = -1;
          b.t = apex;
        }
      } else {
        b.t = (b.t + (delta * speed) / total) % 1;
      }
      if (b.ramp >= 0) {
        const z = -Ls / 2 - R + 0.2 - run * (1 - b.ramp);
        this.be.set(slope, Math.PI / 2 + b.turn * 0.3, 0, 'YXZ');
        this.bm.compose(this.bv.set(0, 0.53 + drop * (1 - b.ramp), z), this.bq.setFromEuler(this.be), this.bone);
      } else {
        const p = this.beltPoint(b.t);
        this.be.set(0, p.angle + Math.PI / 2 + b.turn, 0, 'YXZ');
        this.bm.compose(this.bv.set(p.pos.x, 0.445, p.pos.z), this.bq.setFromEuler(this.be), this.bone);
      }
      this.beltBags.add(b.kind, this.bm, b.colour);
    }
    this.beltBags.end();
  }

  /** Someone at the belt lifts off a bag passing within reach (hall coordinates), if there is one */
  private takeBag(x: number, z: number): { kind: BagKind; colour: number } | null {
    // The belt is turned a quarter: its own x runs against the hall's z
    const lx = CAROUSEL.z - z;
    const lz = x - CAROUSEL.x;
    for (const b of this.onBelt) {
      if (b.ramp >= 0 || b.away > 0) continue;
      const p = this.beltPoint(b.t).pos;
      if ((p.x - lx) ** 2 + (p.z - lz) ** 2 < 1.3) {
        b.away = 5 + Math.random() * 8;
        return { kind: b.kind, colour: b.colour };
      }
    }
    return null;
  }

  // --- The baggage belt's track and the moving parts --------------------------------------------------

  private beltPoint(t: number): { pos: THREE.Vector3; angle: number } {
    const Ls = BELT_STRAIGHT;
    const R = BELT_RADIUS;
    const semi = Math.PI * R;
    const total = 2 * Ls + 2 * semi;
    let dist = (((t % 1) + 1) % 1) * total;
    if (dist < Ls) return { pos: new THREE.Vector3(-R, 0.46, -Ls / 2 + dist), angle: 0 };
    dist -= Ls;
    if (dist < semi) {
      const a = dist / R;
      return { pos: new THREE.Vector3(-R * Math.cos(a), 0.46, Ls / 2 + R * Math.sin(a)), angle: Math.PI / 2 + a };
    }
    dist -= semi;
    if (dist < Ls) return { pos: new THREE.Vector3(R, 0.46, Ls / 2 - dist), angle: Math.PI };
    dist -= Ls;
    const a = dist / R;
    return { pos: new THREE.Vector3(R * Math.cos(a), 0.46, -Ls / 2 - R * Math.sin(a)), angle: -Math.PI / 2 + a };
  }

  public onPlayerEntered(): void {
    this.sound.start();
  }

  public onPlayerLeft(): void {
    this.sound.stop();
  }

  /** What the public address says next: boarding calls for this airport's flights, arrivals on the belt, reminders */
  private announcements(): string[] {
    const here = this.cityHere();
    const names: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt', ibadan: 'Ibadan' };
    const out: string[] = [];
    for (const r of ROUTES.filter((x) => x.from === here)) {
      const to = names[r.to] ?? r.to;
      out.push(`Ladies and gentlemen, NigeriaLife Air flight ${r.flight} to ${to} is now boarding at Gate ${r.gate}. Please have your boarding pass and identification ready.`);
      out.push(`This is the final call for passengers on flight ${r.flight} to ${to}. Please proceed immediately to Gate ${r.gate}. The gate will close in five minutes.`);
    }
    const into = ROUTES.find((x) => x.to === here);
    if (into) out.push(`Baggage from flight ${into.flight}, arriving from ${names[into.from] ?? into.from}, is now on Belt 1.`);
    out.push('For your safety, please do not leave your luggage unattended. Unattended bags will be removed by airport security.');
    out.push('Passengers are reminded that liquids over one hundred millilitres are not allowed through security. Thank you.');
    out.push('Welcome to the airport. Smoking is not allowed anywhere inside the terminal.');
    return out;
  }

  public update(delta: number, animTime: number): void {
    this.clock += delta;
    this.npcs.forEach((npc) => npc.update(delta, animTime));
    const eye = !!this.group.getObjectByName('inside view ceiling')?.visible;
    // The upper wall and the ceiling lights come and go with the game's inside-view ceiling
    this.eyeOnly.visible = eye;
    // A name over a head only within talking distance: a hall of labels reads as a menu, not a place
    const at = AirportInterior.playerAt();
    // Not at eye level either, where a badge a metre wide covered the person's face
    if (at) for (const npc of this.npcs) npc.badge.visible = !eye && npc.group.getWorldPosition(this.scratch).distanceToSquared(at) < 20;
    this.stepBelt(delta);
    this.crowd.update(delta);
    this.sound.update(delta, () => this.announcements());
    this.talk.update(delta);
    for (const e of this.escalators) e.tick(delta);
    this.lift.tick(delta);
    this.apron.update(delta);
    this.sinceBoards += delta;
    if (this.sinceBoards > 2) {
      this.sinceBoards = 0;
      this.refreshBoards();
    }
  }
}
