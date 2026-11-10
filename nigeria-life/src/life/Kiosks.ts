import * as THREE from 'three';
import { signBoard } from '../world/kit/ArchKit';
import type { BusinessEnterprise } from '../backend/types';

/**
 * A registered business starts as a kiosk. The sign on it carries the name and the logo.
 * One kiosk per area the player has registered in, in the city they are standing in.
 */

export interface KioskSpot {
  cityId: string;
  area: string;
  x: number;
  z: number;
}

export const KIOSK_SPOTS: KioskSpot[] = [
  { cityId: 'lagos', area: 'Ikorodu', x: 180, z: -220 },
  { cityId: 'lagos', area: 'Ajah', x: 210, z: 30 },
  { cityId: 'lagos', area: 'Yaba', x: -36, z: -70 },
  { cityId: 'lagos', area: 'Lagos Island', x: 8, z: 18 },
  { cityId: 'lagos', area: 'Lekki', x: 150, z: 70 },
  { cityId: 'lagos', area: 'Victoria Island', x: 48, z: 42 },
  { cityId: 'lagos', area: 'Ikoyi', x: 72, z: 8 },
  { cityId: 'lagos', area: 'Banana Island', x: 96, z: 64 },
  { cityId: 'abuja', area: 'Wuse', x: -150, z: 200 },
  { cityId: 'abuja', area: 'Garki', x: -240, z: 430 },
  { cityId: 'abuja', area: 'Maitama', x: 70, z: 280 },
  { cityId: 'abuja', area: 'Asokoro', x: 30, z: -70 },
  { cityId: 'port_harcourt', area: 'Diobu', x: -70, z: 16 },
  { cityId: 'port_harcourt', area: 'Mile 1', x: -20, z: 40 },
  { cityId: 'port_harcourt', area: 'Old GRA', x: -30, z: -36 },
  { cityId: 'port_harcourt', area: 'Trans-Amadi', x: 180, z: 70 },
  { cityId: 'port_harcourt', area: 'GRA Phase 2', x: -190, z: 36 },
];

export function spotFor(cityId: string, area: string): KioskSpot | undefined {
  return KIOSK_SPOTS.find((s) => s.cityId === cityId && s.area === area);
}

/** Areas a new business can be registered in, and what the papers cost. */
export const REGISTER_AREAS: Array<{ cityId: string; area: string; fee: number }> = [
  { cityId: 'lagos', area: 'Ikorodu', fee: 6_000_000 },
  { cityId: 'lagos', area: 'Ajah', fee: 6_000_000 },
  { cityId: 'abuja', area: 'Wuse', fee: 6_000_000 },
  { cityId: 'port_harcourt', area: 'Diobu', fee: 6_000_000 },
  { cityId: 'port_harcourt', area: 'Mile 1', fee: 6_000_000 },
  { cityId: 'lagos', area: 'Yaba', fee: 10_000_000 },
  { cityId: 'lagos', area: 'Lagos Island', fee: 10_000_000 },
  { cityId: 'abuja', area: 'Garki', fee: 10_000_000 },
  { cityId: 'port_harcourt', area: 'Old GRA', fee: 10_000_000 },
  { cityId: 'lagos', area: 'Lekki', fee: 18_000_000 },
  { cityId: 'abuja', area: 'Maitama', fee: 18_000_000 },
  { cityId: 'port_harcourt', area: 'Trans-Amadi', fee: 18_000_000 },
  { cityId: 'lagos', area: 'Victoria Island', fee: 30_000_000 },
  { cityId: 'lagos', area: 'Ikoyi', fee: 30_000_000 },
  { cityId: 'lagos', area: 'Banana Island', fee: 30_000_000 },
  { cityId: 'abuja', area: 'Asokoro', fee: 30_000_000 },
  { cityId: 'port_harcourt', area: 'GRA Phase 2', fee: 30_000_000 },
];

const groupName = 'registered-kiosks';

/** Rebuild the kiosks for the city the player is in. Registered businesses only. */
export function showKiosks(scene: THREE.Scene, cityId: string, businesses: BusinessEnterprise[]): void {
  const previous = scene.getObjectByName(groupName);
  if (previous) scene.remove(previous);
  const group = new THREE.Group();
  group.name = groupName;
  for (const biz of businesses) {
    if (!biz.owned || !biz.id.startsWith('reg_')) continue;
    if ((biz.cityId ?? 'lagos') !== cityId) continue;
    const area = biz.districtId ?? '';
    const spot = spotFor(cityId, area);
    if (!spot) continue;
    const stall = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }));
    box.position.y = 1.2;
    const sign = signBoard([biz.name.toUpperCase().slice(0, 18), biz.icon], 3, 0.9, biz.logo || '#0f172a', '#fde68a');
    sign.position.set(0, 2.6, 1.25);
    stall.add(box, sign);
    stall.position.set(spot.x, 0, spot.z);
    group.add(stall);
  }
  if (group.children.length) scene.add(group);
}
