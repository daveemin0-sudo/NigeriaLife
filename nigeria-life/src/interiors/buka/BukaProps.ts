import * as THREE from 'three';
import type { Dish } from './BukaMenu';

const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.75 });
const clothMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
const seatMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });

export const TABLE_RADIUS = 1.05;
export const TABLE_TOP = 0.8;
export const CHAIR_DISTANCE = 1.45;
export const SEAT_HEIGHT = 0.5;

/** A plate of food that visibly goes down as it is eaten. */
export interface Meal {
  group: THREE.Group;
  /** 1 = a full plate, 0 = empty */
  setRemaining: (fraction: number) => void;
  dispose: () => void;
}

export function createMeal(dish: Dish): Meal {
  const group = new THREE.Group();
  group.name = `meal_${dish.id}`;

  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.2, 0.04, 20), plateMat);
  plate.position.y = 0.02;
  group.add(plate);

  // Everything edible sits in `food`; pieces are removed one by one, then the mound shrinks
  const food = new THREE.Group();
  food.position.y = 0.04;
  group.add(food);
  const owned: THREE.Material[] = [];
  const mat = (color: number) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    owned.push(material);
    return material;
  };
  const pieces: THREE.Object3D[] = [];
  let mound: THREE.Mesh | null = null;

  const dome = (radius: number, color: number, x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(color));
    mesh.position.set(x, 0, z);
    food.add(mesh);
    return mesh;
  };
  const chunk = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, turn = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
    food.add(mesh);
    pieces.push(mesh);
  };

  if (dish.look === 'rice_orange' || dish.look === 'rice_yellow') {
    const orange = dish.look === 'rice_orange';
    mound = dome(0.17, orange ? 0xea580c : 0xfacc15, -0.04, 0);
    chunk(0.11, 0.07, 0.08, orange ? 0x7c2d12 : 0x713f12, 0.14, 0.035, -0.06, 0.4); // chicken or liver
    chunk(0.1, 0.03, 0.05, 0xf59e0b, 0.13, 0.015, 0.09, -0.5); // fried plantain
    chunk(0.1, 0.03, 0.05, 0xf59e0b, 0.05, 0.015, 0.16, 0.3);
    if (!orange) {
      chunk(0.03, 0.03, 0.03, 0x16a34a, -0.1, 0.15, 0.03);
      chunk(0.03, 0.03, 0.03, 0xdc2626, 0.0, 0.16, -0.05);
    }
  } else if (dish.look === 'swallow_dark' || dish.look === 'swallow_yellow') {
    const dark = dish.look === 'swallow_dark';
    mound = dome(0.13, dark ? 0x44403c : 0xfde047, -0.09, 0.02);
    // Soup beside the swallow
    const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16), mat(dark ? 0x3f6212 : 0xc2410c));
    soup.position.set(0.11, 0.015, 0);
    food.add(soup);
    pieces.push(soup);
    chunk(0.07, 0.05, 0.06, 0x57260f, 0.12, 0.05, -0.03, 0.6); // meat
    chunk(0.06, 0.05, 0.06, 0x57260f, 0.08, 0.05, 0.06, -0.3);
  } else {
    // Suya: skewers of meat with onion rings
    for (let i = 0; i < 4; i++) {
      chunk(0.3, 0.035, 0.045, 0x7c2d12, 0, 0.02 + (i % 2) * 0.012, -0.11 + i * 0.07, (i % 2 ? 1 : -1) * 0.12);
    }
    chunk(0.06, 0.02, 0.06, 0xf5d0fe, -0.13, 0.015, 0.14);
    chunk(0.06, 0.02, 0.06, 0xdc2626, 0.14, 0.015, -0.14);
  }

  const total = pieces.length + (mound ? 3 : 0);
  return {
    group,
    setRemaining(fraction: number) {
      const clamped = Math.max(0, Math.min(1, fraction));
      // Side pieces go first, then the mound shrinks in thirds
      const left = Math.round(clamped * total);
      const moundLeft = mound ? Math.min(3, left) : 0;
      const piecesLeft = left - moundLeft;
      pieces.forEach((piece, i) => { piece.visible = i < piecesLeft; });
      if (mound) {
        mound.visible = moundLeft > 0;
        const scale = moundLeft / 3;
        mound.scale.set(0.55 + scale * 0.45, Math.max(0.2, scale), 0.55 + scale * 0.45);
      }
    },
    dispose() {
      group.removeFromParent();
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material !== plateMat) mesh.geometry.dispose();
      });
      plate.geometry.dispose();
      for (const material of owned) material.dispose();
    },
  };
}

/** A round table with four chairs that people can actually sit on. Chairs sit on the X and Z axes. */
export function createBukaTable(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.06, 28), woodMat);
  top.position.y = TABLE_TOP - 0.03;
  top.castShadow = true;
  group.add(top);

  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.012, 20), clothMat);
  cloth.position.y = TABLE_TOP + 0.006;
  group.add(cloth);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, TABLE_TOP - 0.06, 10), woodDarkMat);
  column.position.y = (TABLE_TOP - 0.06) / 2;
  group.add(column);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 16), woodDarkMat);
  foot.position.y = 0.03;
  group.add(foot);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const chair = new THREE.Group();
    chair.position.set(Math.cos(angle) * CHAIR_DISTANCE, 0, Math.sin(angle) * CHAIR_DISTANCE);
    // Chair faces the table (its local +Z points at the table centre)
    chair.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle));

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), seatMat);
    seat.position.y = SEAT_HEIGHT - 0.03;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), seatMat);
    back.position.set(0, SEAT_HEIGHT + 0.3, -0.24);
    chair.add(back);
    for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, SEAT_HEIGHT - 0.06, 0.05), woodDarkMat);
      leg.position.set(x, (SEAT_HEIGHT - 0.06) / 2, z);
      chair.add(leg);
    }
    group.add(chair);
  }
  return group;
}

/** The side table where the cook puts finished plates for the waiter to collect. */
export function createPassTable(position: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.9), woodMat);
  top.position.y = 1.0;
  group.add(top);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.96, 0.8), woodDarkMat);
  body.position.y = 0.48;
  group.add(body);
  return group;
}
