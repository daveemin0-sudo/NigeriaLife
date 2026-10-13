import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { clickBox, type Landmark, type LandmarkAction, type LandmarkHost } from './Landmark';
import { RENDER_LAYERS } from '../../interiors/InteriorTypes';

export interface RefineryLandmark extends Landmark {
  flareFlame: THREE.Mesh;
}

export interface RefineryConfig {
  id?: string;
  name?: string;
  x?: number;
  z?: number;
}

/**
 * Port Harcourt Petroleum Refinery & Petrochemical Complex:
 * Built with the building kit (ArchKit) as a full industrial landmark.
 *
 * Distillation catalytic cracking columns, Horton gas spheres, crude storage tanks,
 * overhead pipe racks, tanker loading gantry, and an animated flare stack.
 */
export function createRefinery(config: RefineryConfig = {}): RefineryLandmark {
  const id = config.id ?? 'ph-refinery-complex';
  const name = config.name ?? 'Port Harcourt Petroleum Refinery & Petrochemical Complex';
  const midX = config.x ?? 37;
  const midZ = config.z ?? -46;

  // Refinery ground footprint zone: x in [20, 50], z in [-64, -28]
  const zone = {
    minX: 20,
    maxX: 50,
    minZ: -64,
    maxZ: -28,
  };

  const b = new Builder().around(0, 0);

  // 1. Concrete Industrial Foundation & Safety Containment Bund
  const INDUSTRIAL_CONCRETE = 0x475569;
  const TANK_SILVER = 0xd1d5db;
  const TANK_WHITE = 0xf8fafc;
  const PIPING_DARK = 0x334155;
  const SAFETY_YELLOW = 0xfacc15;
  const BRICK_RED = 0x991b1b;
  const CRUDE_BROWN = 0x78350f;

  // Yard ground slab
  b.box(0x334155, 29, 0.2, 35, midX, 0, midZ);

  // 2. Distillation Fractionating Columns (Catalytic Cracking Towers)
  // Column 1 (T-101 Heavy Crude Column, 28m high)
  const col1X = midX + 6;
  const col1Z = midZ - 8;
  b.cylinder(TANK_SILVER, 2.2, 26, col1X, 0.2, col1Z, { solid: true });
  b.cylinder(SAFETY_YELLOW, 2.4, 0.6, col1X, 7, col1Z);
  b.cylinder(SAFETY_YELLOW, 2.4, 0.6, col1X, 15, col1Z);
  b.cylinder(SAFETY_YELLOW, 2.4, 0.6, col1X, 22, col1Z);
  b.cylinder(PIPING_DARK, 0.4, 28, col1X + 2.4, 0.2, col1Z);
  // Column 2 (T-102 Fractionator, 22m high)
  const col2X = midX + 2;
  const col2Z = midZ - 8;
  b.cylinder(TANK_WHITE, 1.8, 20, col2X, 0.2, col2Z, { solid: true });
  b.cylinder(SAFETY_YELLOW, 2.0, 0.5, col2X, 6, col2Z);
  b.cylinder(SAFETY_YELLOW, 2.0, 0.5, col2X, 13, col2Z);
  b.cylinder(PIPING_DARK, 0.35, 22, col2X + 2.0, 0.2, col2Z);

  // 3. Crude Oil Storage Tanks (T-201 to T-204) with floating roofs
  const tankRadius = 3.6;
  const tankHeight = 7.5;
  const tanks = [
    { x: midX - 8, z: midZ - 8, hex: TANK_WHITE },
    { x: midX - 8, z: midZ + 2, hex: TANK_SILVER },
    { x: midX + 6, z: midZ + 2, hex: TANK_WHITE },
  ];
  for (const t of tanks) {
    b.cylinder(t.hex, tankRadius, tankHeight, t.x, 0.2, t.z, { solid: true });
    // Roof rim and stair rail
    b.cylinder(BRICK_RED, tankRadius + 0.1, 0.4, t.x, tankHeight + 0.2, t.z);
    b.cylinder(INDUSTRIAL_CONCRETE, tankRadius - 0.2, 0.3, t.x, tankHeight + 0.5, t.z);
  }

  // 4. Spherical Horton Gas Storage Spheres (LPG Spheres) - positioned in southeast corner (x: 44, z: -35)
  const sphereX = midX + 7;
  const sphereZ = midZ + 11;
  b.box(INDUSTRIAL_CONCRETE, 6, 0.4, 6, sphereX, 0.2, sphereZ);
  // 4 legs
  for (const dx of [-2.0, 2.0]) {
    for (const dz of [-2.0, 2.0]) {
      b.cylinder(SAFETY_YELLOW, 0.25, 4.5, sphereX + dx, 0.4, sphereZ + dz);
    }
  }
  // Sphere body as stacked stepped cylinders resembling Horton sphere
  b.cylinder(TANK_WHITE, 2.6, 2.0, sphereX, 3.5, sphereZ, { solid: true });
  b.cylinder(TANK_WHITE, 3.0, 2.2, sphereX, 5.0, sphereZ);
  b.cylinder(TANK_WHITE, 2.6, 2.0, sphereX, 6.7, sphereZ);
  b.cylinder(SAFETY_YELLOW, 1.2, 0.5, sphereX, 8.5, sphereZ);

  // 5. Overhead Industrial Pipe Racks
  b.box(PIPING_DARK, 18, 0.3, 1.4, midX, 4.2, midZ - 2);
  b.box(SAFETY_YELLOW, 0.4, 4.2, 0.4, midX - 7, 0.2, midZ - 2);
  b.box(SAFETY_YELLOW, 0.4, 4.2, 0.4, midX, 0.2, midZ - 2);
  b.box(SAFETY_YELLOW, 0.4, 4.2, 0.4, midX + 7, 0.2, midZ - 2);
  // Heavy pipes running along the rack
  b.cylinder(CRUDE_BROWN, 0.25, 18, midX, 4.6, midZ - 2.3, { roll: Math.PI / 2 });
  b.cylinder(SAFETY_YELLOW, 0.2, 18, midX, 4.6, midZ - 2.0, { roll: Math.PI / 2 });
  b.cylinder(TANK_SILVER, 0.22, 18, midX, 4.6, midZ - 1.7, { roll: Math.PI / 2 });

  // 6. Tanker Loading Gantry Terminal (where road tankers load)
  const gantryX = midX - 1;
  const gantryZ = midZ + 9;
  b.box(INDUSTRIAL_CONCRETE, 9, 5.2, 5, gantryX, 0.2, gantryZ, { solid: true });
  b.box(SAFETY_YELLOW, 9.4, 0.4, 5.4, gantryX, 5.4, gantryZ);
  b.box(SAFETY_YELLOW, 0.5, 5.0, 0.5, gantryX - 4.2, 0.2, gantryZ + 2.2);
  b.box(SAFETY_YELLOW, 0.5, 5.0, 0.5, gantryX + 4.2, 0.2, gantryZ + 2.2);
  // Tanker Truck parked under loading bay
  b.box(0x1e3a5f, 2.2, 2.2, 2.4, gantryX - 2.5, 0.2, gantryZ + 3.8); // Cab
  b.box(TANK_SILVER, 2.4, 2.2, 5.2, gantryX - 2.5, 0.8, gantryZ + 0.2); // Tanker trailer
  b.cylinder(TANK_WHITE, 1.2, 5.2, gantryX - 2.5, 1.9, gantryZ + 0.2, { pitch: Math.PI / 2 });

  // 7. Flare Stack (Structural lattice mast rising 22m)
  const flareX = midX + 8;
  const flareZ = midZ - 14;
  b.cylinder(PIPING_DARK, 0.55, 20, flareX, 0.2, flareZ, { solid: true });
  b.cylinder(PIPING_DARK, 0.35, 3.5, flareX, 20.2, flareZ);
  // Flare tip platform
  b.cylinder(SAFETY_YELLOW, 1.5, 0.4, flareX, 22.0, flareZ);

  // 8. Perimeter Fence & Security Gatehouse
  // West boundary fence along Aba Road side with a wide open gate at z = -35
  b.box(INDUSTRIAL_CONCRETE, 0.3, 2.4, 18, midX - 13.5, 0.2, -52); // North fence: z in [-61, -43]
  b.box(INDUSTRIAL_CONCRETE, 0.3, 2.4, 4, midX - 13.5, 0.2, -29);  // South fence: z in [-31, -27]
  // Security Gatehouse at x = 24.5, z = -40 (north side of entrance gate)
  b.box(0xe2e8f0, 3.8, 3.2, 3.2, midX - 12.5, 0.2, -40, { solid: true });
  b.box(0x1e293b, 4.0, 0.3, 3.4, midX - 12.5, 3.4, -40);
  b.box(0x38bdf8, 2.0, 1.2, 0.1, midX - 12.5, 1.4, -38.3, { glow: true }); // Glass window

  const group = b.build('Refinery Landmark');

  // Animated Flare Flame
  const flameGeo = new THREE.ConeGeometry(0.7, 3.2, 12);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const flareFlame = new THREE.Mesh(flameGeo, flameMat);
  flareFlame.position.set(flareX, 24.8, flareZ);
  flareFlame.layers.set(RENDER_LAYERS.STREET);
  group.add(flareFlame);

  // Entrance Signboard over gatehouse
  const sign = signBoard(['PORT HARCOURT REFINERY', 'TRANS-AMADI PETROCHEMICAL COMPLEX'], 7.2, 1.1, '#1e293b', '#facc15');
  sign.position.set(midX - 12.5, 4.4, -40);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  // Interaction Clickbox at the gatehouse entrance (x: 30, z: -35)
  const click = clickBox(5.0, 3.5, 5.0);
  click.position.set(30, 0, -35);
  group.add(click);

  const interactive: Landmark['interactive'] = [
    {
      mesh: click,
      id,
      name,
      category: 'Petrochemical Industry',
      description: 'Major national oil refining infrastructure in Trans-Amadi featuring catalytic distillation towers, petroleum storage tanks, and fuel logistics.',
      interactionPoint: new THREE.Vector3(30, 0, -35),
    },
  ];

  const enterRefineryAction: LandmarkAction = {
    label: () => '🏭 Enter Refinery Gates & Petrochemical Complex',
    run: (host: LandmarkHost) => {
      host.ask({
        who: 'Engr. Briggs',
        role: 'Trans-Amadi Operations Superintendent',
        text: 'Welcome to the Port Harcourt Petroleum Refinery Complex. We coordinate crude distillation, PMS/AGO fractionation, and fuel distribution across Rivers State.',
        choices: [
          {
            label: '🛠️ Complete Industrial Safety & Pipeline Shift',
            note: '+₦12,000 · -25% Energy · +25 Cred',
            pick: () => {
              const gig = host.backend.performGig(12000, 25, 'Trans-Amadi Petrochemical Shift');
              if (gig.success) {
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
                host.say('Shift completed! Earned ₦12,000 cash, +25 Cred, and HSE Safety Pass!', 'success');
              } else {
                host.say(gig.message, 'warning');
              }
            },
          },
          {
            label: '🛢️ Supervise Fuel Tanker Gantry Dispatch',
            note: '+₦15,000 · -30% Energy · +30 Cred',
            pick: () => {
              const gig = host.backend.performGig(15000, 30, 'Port Harcourt Refinery Tanker Dispatch');
              if (gig.success) {
                host.backend.addStreetCred(30);
                host.say('Tanker dispatch completed! 33,000L PMS cleared for South-South distribution. Earned ₦15,000 & +30 Cred!', 'success');
              } else {
                host.say(gig.message, 'warning');
              }
            },
          },
          {
            label: '💡 Inquire About Delta Energy Engineering',
            note: '+20 Knowledge · Free Guidance',
            pick: () => {
              host.backend.addStreetCred(10);
              host.say('Engr. Briggs: "In the petrochemical sector, safety protocol is law. Always verify pressure relief valves and vapor seals before dispatch!"', 'info');
            },
          },
        ],
      });
    },
  };

  const actions: Record<string, LandmarkAction> = {
    [id]: enterRefineryAction,
    // Also bind alias for backwards compatibility
    'ph_refinery_hub': enterRefineryAction,
  };

  const doors = [{ name: 'Port Harcourt Refinery Gate', x: 30, z: -35 }];

  let animTime = 0;

  return {
    id,
    name,
    zone,
    group,
    obstructions: b.obstructions(name, 0, 0),
    interactive,
    actions,
    doors,
    flareFlame,
    update(delta: number, _hour: number): void {
      animTime += delta * 7;
      const flicker = 1.0 + Math.sin(animTime) * 0.18 + Math.cos(animTime * 1.7) * 0.12;
      flareFlame.scale.set(flicker, flicker * 1.15, flicker);
    },
    status(): Record<string, unknown> {
      return {
        operational: true,
        flareActive: true,
        towers: 2,
        tanks: 3,
        gate: { x: 30, z: -35 },
      };
    },
  };
}
