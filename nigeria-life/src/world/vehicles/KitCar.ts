import * as THREE from 'three';
import { buildCarBody, carMaterials, CAR_SPECS, type CarMaterials, type CarSpec } from './CarBodyKit';

/**
 * A whole car from the body kit: the body, four plain wheels (a tyre, a rim and a hub, cheap
 * enough for traffic), and for a Lagos taxi its yellow paint, the black and white band down
 * each side and the sign on the roof.
 */
export interface KitCar {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  spec: CarSpec;
  materials: CarMaterials;
}

const TYRE = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.9 });
const RIM = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.85, roughness: 0.3 });
const HUB = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.6, roughness: 0.4 });

/** A wheel standing on its edge, turning about x */
export function plainWheel(radius: number, width: number, light = false): THREE.Group {
  const wheel = new THREE.Group();
  if (light) {
    // For traffic, drawn by the hundred: a tyre and a rim, no more
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 12), TYRE);
    tyre.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 8), RIM);
    rim.rotation.z = Math.PI / 2;
    wheel.add(tyre, rim);
    return wheel;
  }
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), TYRE);
  tyre.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.64, radius * 0.64, width + 0.02, 14), RIM);
  rim.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, width + 0.05, 8), HUB);
  hub.rotation.z = Math.PI / 2;
  // Spokes, so a turning wheel is seen to turn
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, radius * 0.1, radius * 0.95), HUB);
    spoke.rotation.x = (i / 5) * Math.PI;
    wheel.add(spoke);
  }
  wheel.add(tyre, rim, hub);
  return wheel;
}

/** A band of black and white squares, for a taxi's flank */
function checkerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 32; i++) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = (i + row) % 2 ? '#111111' : '#f8fafc';
      ctx.fillRect(i * 8, row * 8, 8, 8);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

let checker: THREE.CanvasTexture | null = null;

export function buildKitCar(specId: string, paint?: number, options: { taxi?: boolean; materials?: CarMaterials; light?: boolean } = {}): KitCar {
  const base = CAR_SPECS[specId] ?? CAR_SPECS.sedan;
  const colour = options.taxi ? 0xfacc15 : paint ?? base.paint ?? 0x9ca3af;
  const spec: CarSpec = { ...base, paint: colour };
  const materials = options.materials ?? carMaterials(colour);
  const group = new THREE.Group();
  group.name = options.taxi ? 'taxi' : specId;
  group.add(buildCarBody(spec, materials, options.light ? 'light' : 'full'));
  const wheels: THREE.Object3D[] = [];
  for (const z of [spec.frontAxle, spec.rearAxle]) {
    for (const side of [-1, 1]) {
      const wheel = plainWheel(spec.wheelRadius, spec.style === 'sports' ? 0.28 : 0.24, options.light);
      wheel.position.set(side * (spec.width / 2 - 0.16), spec.wheelRadius, z);
      group.add(wheel);
      wheels.push(wheel);
    }
  }
  if (options.taxi) {
    // The band along each side under the windows, and TAXI on the roof
    checker ??= checkerTexture();
    const length = spec.length * 0.78;
    for (const side of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(length, 0.1), new THREE.MeshBasicMaterial({ map: checker }));
      band.position.set(side * (spec.width / 2 + 0.012), spec.belt - 0.2, 0);
      band.rotation.y = side * (Math.PI / 2);
      group.add(band);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.22), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfacc15, emissiveIntensity: 0.25, roughness: 0.5 }));
    sign.position.set(0, spec.roof + 0.09, (spec.screenTop + spec.backTop) / 2);
    group.add(sign);
  }
  return { group, wheels, spec, materials };
}
