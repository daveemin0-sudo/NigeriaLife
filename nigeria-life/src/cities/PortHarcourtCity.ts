import { InteriorManager } from '../interiors/InteriorManager';
import * as THREE from 'three';
import type { CityInstance } from './CityTypes';
import type { InteractiveObject } from '../world/World';
import { createAirport, type AirportLandmark } from '../world/landmarks/Airport';
import { createMotorPark, type MotorParkLandmark } from '../world/landmarks/MotorPark';
import { createRefinery, type RefineryLandmark } from '../world/landmarks/Refinery';
import { buildTownscape } from '../world/kit/Townscape';
import { createCashMachine } from '../world/kit/CashMachine';
import { PORT_HARCOURT_BUILDINGS } from './Townscapes';
import type { Obstruction } from '../world/plan/CityPlan';
import { PlaceActions } from '../destinations/PlaceActions';
import { settleGig } from '../online/checkedEarn';
import { WorldMapPrefabs } from '../world/map/WorldMapPrefabs';
import { CityLife } from './CityLife';
import { buildGrid, type GridStyle } from './CityGrid';
import { PH_CREEK, PH_ROADS } from '../world/plan/GridRoads';
import { PH_KEEP_OUT, buildPhLandmarks, phBuildings } from './PortHarcourtDistricts';
import { avenueTrees, cullTiles, placeDoors, tiledTown, townDoors, type CityTile } from './CityExtras';
import type { AbujaPlace as CityPlace } from './AbujaDistricts';

/** Port Harcourt's roads: worn asphalt, a yellow line down the middle, kerbs painted black and yellow, open drains */
const PH_STYLE: GridStyle = {
  asphalt: 0x2a2c30, line: 0xe5e7eb, centre: 0xfacc15, medianTop: 0x3f6212, kerb: 0x111827, kerbStripe: 0xfacc15,
  pavement: 0xa8a29e, top: 0.3, lamp: 'single', drain: true,
};

export class PortHarcourtCity implements CityInstance {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public groundMesh: THREE.Mesh;
  public airport: AirportLandmark;
  public motorPark: MotorParkLandmark;
  public refinery: RefineryLandmark;
  public standing: Obstruction[] = [];
  /** Traffic on Aba Road and people on its pavements */
  public life: CityLife;

  private animTime: number = 0;
  /** The places Port Harcourt is known for, with their doors on the street */
  public places: CityPlace[] = [];
  private tiles: CityTile[] = [];
  private sinceTiles = 1;

  constructor() {
    this.group = new THREE.Group();

    // 1. Niger Delta Tropical Ground
    const groundGeo = new THREE.PlaneGeometry(1140, 880);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Lush Niger Delta greenery
      roughness: 0.85,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    // The whole city: Ikwerre Road in the west to Trans-Amadi in the east
    this.groundMesh.position.set(-10, 0, 140);
    this.groundMesh.receiveShadow = true;
    this.group.add(this.groundMesh);

    // 2. The roads: Aba Road and Ikwerre Road, Trans-Amadi beyond the creek, three roads across over its bridges
    const roads = buildGrid('Port Harcourt roads', PH_ROADS, PH_STYLE);
    this.group.add(roads.group);

    // 4. Trans-Amadi Petrochemical Refinery built with the building kit
    this.refinery = createRefinery({ id: 'ph-refinery-complex', x: 37, z: -46 });
    this.group.add(this.refinery.group);
    this.interactiveList.push(...this.refinery.interactive);
    PlaceActions.registerAll(this.refinery.actions);

    // 5. Authentic Port Harcourt Bole King & Roasted Fish Stall
    this.buildBoleKingSpot();

    // 6. Uniport Academic Colonnade Arch
    this.buildUniportArch();

    // 7. Port Harcourt Blue & White Taxis
    this.buildPortHarcourtCabs();

    // 8. Inter-State Transit Hub to Lagos & Abuja
    // Waterlines Motor Park, east of Aba Road: where the coaches to Lagos and Abuja leave from
    this.motorPark = createMotorPark({ id: 'waterlines-park', city: 'port_harcourt', x: 14.5, z: 38, faces: 'west', apron: 2, ticketsId: 'ph-transit-hub' });
    this.group.add(this.motorPark.group);
    this.interactiveList.push(...this.motorPark.interactive);
    PlaceActions.registerAll(this.motorPark.actions);

    // The ordinary buildings of the city: offices, shops, flats, houses, a hotel, along Aba Road and behind it
    const town = buildTownscape('Port Harcourt townscape', PORT_HARCOURT_BUILDINGS);
    this.group.add(town.group);
    // The creek (drawn with the landmarks, the whole length of the city) is water: nobody walks or drives on it but over the bridges
    this.standing = [...town.obstructions, ...this.refinery.obstructions, ...roads.obstructions];
    // The districts along the roads, a square of the city at a time; the places it is known for
    const streetBuildings = phBuildings();
    const blocks = tiledTown('Port Harcourt', streetBuildings);
    townDoors(this.group, this.interactiveList, [...PORT_HARCOURT_BUILDINGS, ...streetBuildings], 'port_harcourt');
    for (const t of blocks.tiles) this.group.add(t.group);
    this.tiles = blocks.tiles;
    this.standing.push(...blocks.obstructions);
    const marks = buildPhLandmarks();
    this.group.add(marks.group);
    this.standing.push(...marks.obstructions);
    this.places = marks.places;
    placeDoors(this.group, this.interactiveList, this.places, 'ph', {
      'pleasure-park': { label: '🎡 Pleasure Park', who: 'Pleasure Park', role: 'Rumuokoro', text: 'The big wheel is turning. What will it be?', choices: [
        { label: '🎡 A ride on the big wheel', note: 'Fun +25', price: 2000, arms: 'rest', seconds: 7, needs: { fun: 25 }, said: 'Round and up: the whole Garden City, the creek and the flares at Trans-Amadi.' },
        { label: '🧺 A picnic on the lawn', note: 'Fun +15, Social +10', price: 4500, arms: 'reach', seconds: 6, needs: { fun: 15, social: 10, hunger: 20 }, said: 'Suya, chapman and a breeze. Sunday done well.' },
      ] },
      waterfront: { label: '⛵ The waterfront', who: 'Boatman Tamuno', role: 'Port Harcourt Waterfront', text: 'Boat to the islands, or fish fresh off the jetty?', choices: [
        { label: '⛵ A boat round the creek', note: 'Fun +25', price: 5000, arms: 'rest', seconds: 7, needs: { fun: 25 }, said: 'Past the mangroves and the fishing canoes, the city behind you.' },
        { label: '🐟 Roasted fish on the jetty', note: 'Hunger +40', price: 3500, arms: 'reach', seconds: 5, needs: { hunger: 40 }, said: 'Catfish off the grill with pepper sauce. Hot.' },
      ] },
    });
    // Palms down the roads, and along both banks of the creek
    const banks: Array<{ x: number; z: number; s: number }> = [];
    for (let z = PH_CREEK.from + 8; z < PH_CREEK.to - 8; z += 20) {
      const bridge = PH_ROADS.some((r) => r.axis === 'x' && Math.abs(z - r.fixed) < r.halfRoad + r.walk + 6);
      const jetty = z > 222 && z < 358;
      if (bridge) continue;
      banks.push({ x: PH_CREEK.minX - 3, z, s: 1.1 });
      if (!jetty) banks.push({ x: PH_CREEK.maxX + 3, z: z + 10, s: 1 });
    }
    this.group.add(avenueTrees(PH_ROADS, blocks.footprints, PH_KEEP_OUT.slice(1), 'palm', 26, banks, 'Port Harcourt palms'));
    // A cash machine in the wall of the bank on Aba Road
    const machine = createCashMachine({ id: 'delta-bank-ph', name: 'Delta Bank', x: 16.9, z: -22.4, facing: -Math.PI / 2 });
    this.group.add(machine.group);
    this.interactiveList.push(machine.interactive);

    // 9. Port Harcourt Airport, north-west of Aba Road: the same airport as Lagos's, with a road of its own
    this.airport = createAirport({ ids: ['ph-airport'], city: 'port_harcourt', ownDoor: true, approach: { alongZ: -78, toX: -12.5 } });
    this.group.add(this.airport.group);
    this.interactiveList.push(...this.airport.interactive);
    PlaceActions.registerAll(this.airport.actions);

    // The road's traffic and the people on its pavements
    this.life = new CityLife('port_harcourt');
    this.group.add(this.life.group);
    // Stage 3: the crowd's people go to these doors, in the hours the doors keep
    this.life.giveLives('port_harcourt', this.interactiveList, (id) => InteriorManager.getInstance().hoursOfDoor(id));

    this.registerCityActions();
  }

  private registerCityActions(): void {
    PlaceActions.register('ph-bole-king', {
      label: () => '🐟 Order Hot Bole & Roasted Fish',
      run: (host) => {
        host.ask({
          who: 'Mama Blessing',
          role: 'PH Bole & Roasted Fish Queen',
          text: 'Welcome to Port Harcourt Bole King! Fresh charcoal-grilled plantain, spicy palm-oil pepper sauce, and smoked mackerel fish hot off the fire. Wetin you wan chop?',
          choices: [
            {
              label: '🔥 Charcoal Roasted Bole + Pepper Sauce',
              note: '₦1,200 · +40 Hunger · +25 Energy',
              pick: () => {
                if (host.backend.spendCash(1200, 'Port Harcourt Roasted Bole Platter', 'FOOD_PURCHASE')) {
                  host.backend.consumeFood('PH Roasted Bole Platter', 40, 25, 15);
                  host.backend.addStreetCred(10);
                  host.backend.addItem({
                    id: `ph_bole_${Date.now()}`,
                    name: 'Port Harcourt Bole Wrap',
                    category: 'food',
                    icon: '🍌',
                    description: 'Charcoal-grilled plantain coated in spicy Utazi palm-oil pepper sauce.',
                    price: 1200,
                    usable: true,
                    energyRestore: 25,
                  });
                  host.emote('groove', 3.0);
                  host.say('Delicious Port Harcourt Bole! Sweet ripe plantain with fiery pepper sauce!', 'success');
                } else {
                  host.say('Mama Blessing: "Oga, ₦1,200 cash needed for hot bole!"', 'warning');
                }
              },
            },
            {
              label: '🐟 Bole & Smoked Mackerel Combo (Signature)',
              note: '₦2,500 · +75 Hunger · +50 Energy',
              pick: () => {
                if (host.backend.spendCash(2500, 'PH Bole & Smoked Mackerel Combo', 'FOOD_PURCHASE')) {
                  host.backend.consumeFood('PH Bole & Smoked Mackerel Combo', 75, 50, 25);
                  host.backend.addStreetCred(20);
                  host.backend.addItem({
                    id: `ph_fish_combo_${Date.now()}`,
                    name: 'PH Bole & Smoked Mackerel Combo',
                    category: 'food',
                    icon: '🐟',
                    description: 'Signature charcoal-grilled plantain served with whole spicy smoked mackerel fish and Utazi leaves.',
                    price: 2500,
                    usable: true,
                    energyRestore: 50,
                  });
                  host.emote('groove', 4.0);
                  host.say('Signature PH Bole & Fish combo enjoyed! Energy restored & Odogwu fresh vibes!', 'success');
                } else {
                  host.say('Mama Blessing: "₦2,500 needed for the full Bole & Fish combo, my person!"', 'warning');
                }
              },
            },
            {
              label: '👑 Royal Garden City Feast (Fish + Bole + Bushmeat + Zobo)',
              note: '₦4,500 · Full Recovery · +35 Cred',
              pick: () => {
                if (host.backend.spendCash(4500, 'Royal Garden City Bole Feast', 'FOOD_PURCHASE')) {
                  host.backend.consumeFood('Royal Garden City Bole Feast', 100, 80, 35);
                  host.backend.addStreetCred(35);
                  host.backend.addItem({
                    id: `ph_royal_feast_${Date.now()}`,
                    name: 'Royal Garden City Feast Parcel',
                    category: 'food',
                    icon: '👑',
                    description: 'The ultimate Port Harcourt delicacy: grilled bole, smoked fish, tender bushmeat, and chilled spiced zobo.',
                    price: 4500,
                    usable: true,
                    energyRestore: 80,
                  });
                  host.emote('zanku', 4.5);
                  host.say('Royal Garden City Feast devoured! Total revival and legendary Delta Street Cred!', 'success');
                } else {
                  host.say('Mama Blessing: "Royal feast requires ₦4,500 cash, oga!"', 'warning');
                }
              },
            },
          ],
        });
      },
    });

    PlaceActions.register('ph-refinery-complex', {
      label: () => '⛽ Petrochemical Operations & Safety Briefing',
      run: (host) => {
        host.ask({
          who: 'Engr. Briggs',
          role: 'Trans-Amadi Operations Superintendent',
          text: 'Welcome to the Trans-Amadi Petrochemical Complex. We coordinate refining, LNG fractionation, and offshore pipelines across Rivers State.',
          choices: [
            {
              label: '🛠️ Complete Industrial Safety & Pipeline Shift',
              note: '+₦12,000 · -25% Energy · +25 Cred',
              pick: () => {
                void (async () => {
                  const paid = await settleGig('hud:transamadi', 25);
                  const gig = paid ? null : host.backend.performGig(12000, 25, 'Trans-Amadi Petrochemical Shift');
                  const ok = paid ? paid.ok : !!gig?.success;
                  if (ok) {
                    host.backend.addStreetCred(25);
                    host.backend.addItem({
                      id: `trans_amadi_pass_${Date.now()}`,
                      name: 'Trans-Amadi Industrial Safety Card',
                      category: 'document',
                      icon: '🪪',
                      description: 'Certified HSE Level 3 safety induction card for Port Harcourt industrial complexes.',
                      price: 8000,
                      usable: false,
                    });
                    const amount = paid && paid.ok ? paid.pay : 12000;
                    host.say(`Shift completed! Earned ₦${amount.toLocaleString()} cash, +25 Cred, and HSE Safety Pass!`, 'success');
                  } else {
                    host.say((paid && !paid.ok ? paid.reason : gig?.message) ?? 'Not paid.', 'warning');
                  }
                })();
              },
            },
            {
              label: '💡 Inquire About Delta Energy Engineering',
              note: '+20 Knowledge · Free Guidance',
              pick: () => {
                host.backend.addStreetCred(10);
                host.say('Engr. Briggs: "In the petrochemical sector, safety protocol is law. Always verify pressure gauges before opening relief valves!"', 'info');
              },
            },
          ],
        });
      },
    });

    PlaceActions.register('ph-uniport', {
      label: () => '🎓 Enter Uniport Academic Quad & Student Hub',
      run: (host) => {
        host.ask({
          who: 'Comrade Tonye',
          role: 'Uniport Student Union Representative (Choba)',
          text: 'Unique Uniport! For Enlightenment and Self-Reliance. Students from Abuja Campus and Delta Park gather right here.',
          choices: [
            {
              label: '📚 Attend Petroleum Geosciences Seminar',
              note: '₦800 Fee · +35 Knowledge · +15 Cred',
              pick: () => {
                if (host.backend.spendCash(800, 'Uniport Academic Seminar Docket')) {
                  host.backend.addStreetCred(15);
                  host.backend.addItem({
                    id: `uniport_docket_${Date.now()}`,
                    name: 'Uniport Academic Lecture Docket',
                    category: 'document',
                    icon: '📄',
                    description: 'Official faculty lecture docket from the University of Port Harcourt.',
                    price: 1500,
                    usable: false,
                  });
                  host.say('Attended Uniport Geosciences Seminar! Knowledge deepened & Cred +15!', 'success');
                } else {
                  host.say('Comrade Tonye: "₦800 needed for seminar docket printing and registration!"', 'warning');
                }
              },
            },
            {
              label: '💬 Student Quad Social Gist & Delta Vibe',
              note: '+25 Energy · +10 Cred',
              pick: () => {
                host.backend.restoreEnergy(25);
                host.backend.addStreetCred(10);
                host.emote('zanku', 3.5);
                host.say('Shared jokes and campus gist at Uniport quad! Energy restored and high spirits!', 'success');
              },
            },
          ],
        });
      },
    });
  }

  // =========================================================================
  // 4. PORT HARCOURT BOLE KING & ROASTED FISH STALL
  // =========================================================================
  private buildBoleKingSpot(): void {
    const bole = WorldMapPrefabs.createBoleSpot(1.4);
    bole.position.set(-16, 0, 15);
    this.group.add(bole);

    // Interactive Trigger Box
    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 3.0, 5.0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
    );
    trigger.position.set(-16, 1.5, 15);
    this.group.add(trigger);

    this.interactiveList.push({
      mesh: trigger,
      id: 'ph-bole-king',
      name: 'Port Harcourt Bole King & Roasted Fish',
      category: 'Street Food',
      description: 'Legendary charcoal-grilled plantain with spicy pepper sauce and smoked mackerel fish.',
      interactionPoint: new THREE.Vector3(-16, 0, 15),
    });
  }

  // =========================================================================
  // 5. UNIPORT ACADEMIC ARCH
  // =========================================================================
  private buildUniportArch(): void {
    const gate = WorldMapPrefabs.createUniportGate(1.3);
    gate.position.set(-35, 0, -40);
    this.group.add(gate);

    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 4.0, 6.0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
    );
    trigger.position.set(-35, 2.0, -40);
    this.group.add(trigger);

    this.interactiveList.push({
      mesh: trigger,
      id: 'ph-uniport',
      name: 'University of Port Harcourt (Uniport)',
      category: 'Education',
      description: 'Prestigious federal university, lecture halls, faculties, and student halls.',
      interactionPoint: new THREE.Vector3(-35, 0, -40),
    });
  }

  // =========================================================================
  // 6. PORT HARCOURT BLUE & WHITE CABS
  // =========================================================================
  private buildPortHarcourtCabs(): void {
    for (const z of [-30, 0, 35]) {
      const cab = WorldMapPrefabs.createMiniVehicle('car', 0x0284c7);
      cab.scale.set(1.4, 1.4, 1.4);
      cab.position.set(7.5, 0.25, z);
      this.group.add(cab);
    }
  }

  // Update Animation
  public update(delta: number, viewer?: { x: number; z: number }): void {
    // Beyond the view's far end the city's squares are left out altogether
    this.sinceTiles += delta;
    if (viewer && this.sinceTiles > 0.4) {
      this.sinceTiles = 0;
      cullTiles(this.tiles, viewer);
    }
    this.animTime += delta;
    this.refinery.update?.(delta, 12);
    this.airport.update?.(delta, 12);
    this.motorPark.update?.(delta, 12);
  }
}
