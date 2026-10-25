import type { Builder } from '../kit/ArchKit';
import type { Card, PlaceShape } from './MorePlaces';

/**
 * The places along Ikorodu Road in Ikeja, past where the expressway used to end: Computer
 * Village, the mall, the Allen Avenue lounge, Oshodi's interchange, LASUTH, Ladipo's auto
 * market, the GRA, a fast-food place, a mega-church, and the international airport with an
 * airliner on its stand. Each has an inside (see interiors/places).
 */

/** An airliner, nose toward +x, its fuselage centre at (x, z) */
export function airliner(b: Builder, x: number, z: number, livery = 0x0b7a43): void {
  const y = 4.2;
  b.tube(0xf8fafc, 2.1, 2.1, 30, x, y, z).tube(0xf8fafc, 2.1, 0.9, 6, x + 18, y - 0.2, z).tube(0xf8fafc, 0.7, 2.1, 7, x - 18.5, y + 0.4, z);
  b.box(0x0f172a, 1.6, 0.7, 2.6, x + 19.5, y + 0.7, z, { pitch: 0 });
  for (let i = 0; i < 20; i++) for (const side of [-1, 1]) b.box(0x1e293b, 0.5, 0.45, 0.05, x - 12 + i * 1.3, y + 0.5, z + side * 2.08);
  b.box(livery, 30, 0.35, 4.24, x, y - 0.6, z);
  for (const side of [-1, 1]) {
    b.box(0xe5e7eb, 7, 0.4, 15, x - 1, y - 1.3, z + side * 9, { yaw: side * 0.45 });
    b.tube(0xd4d4d8, 1.1, 1.0, 4.4, x + 2, y - 2.4, z + side * 6.5).cylinder(0x111827, 0.9, 0.1, x + 4.2, y - 2.4, z + side * 6.5, { pitch: Math.PI / 2 });
    b.box(0xe5e7eb, 3.4, 0.25, 6, x - 19, y + 1.4, z + side * 3.4, { yaw: side * 0.4 });
  }
  b.box(livery, 4.4, 6.5, 0.4, x - 19.5, y + 1.6, z, { pitch: 0 });
  b.cylinder(0xfacc15, 0.9, 0.1, x - 19.5, y + 5.2, z + 0.25, { pitch: Math.PI / 2, glow: true });
  for (const [dx, dz] of [[14, 0], [-2, 3], [-2, -3]]) b.cylinder(0x6b7280, 0.18, y - 2.2, x + dx, 0, z + dz).cylinder(0x111827, 0.6, 0.5, x + dx, 0, z + dz, { pitch: Math.PI / 2 });
}

export function buildIkejaPlace(k: PlaceShape): Card | null {
  const { b, place, faceX, s, depthMid, z0 } = k;
  const along = place.length;
  const at = (x: number) => faceX + s * x;
  switch (place.id) {
    case 'computer-village': {
      // Plazas of little shops, three floors, signs and banners over every door, umbrellas on the pavement
      for (let i = 0; i < 4; i++) {
        const z = z0 + 10 + i * 20;
        b.box([0xfde68a, 0xe2e8f0, 0xfecaca, 0xbfdbfe][i], place.depth - 6, 10, 18, depthMid + s * 3, 0, z);
        for (let f = 0; f < 3; f++) for (let j = 0; j < 4; j++) b.box([0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b, 0x7c3aed][(i + f + j) % 5], 0.1, 0.7, 3.4, at(6) - s * 0.06, 2.3 + f * 3.3, z - 6.5 + j * 4.3);
      }
      for (let i = 0; i < 8; i++) b.cylinder(0x3f3f46, 0.04, 2.3, at(2), 0, z0 + 6 + i * 9.5).cone([0xdc2626, 0x2563eb, 0xfacc15][i % 3], 1.4, 0.5, at(2), 2.3, z0 + 6 + i * 9.5, 8);
      k.obstruct(Math.min(at(6), at(place.depth)), Math.max(at(6), at(place.depth)), z0, z0 + along, 10);
      k.label('COMPUTER VILLAGE', 'Phones · Laptops · Repairs · Otigba', '#1d4ed8', 10.6, 26);
      return { name: 'Computer Village', category: 'Gadget market', description: 'The biggest gadget market in Africa: phones, laptops, tablets, earbuds, watches and consoles, new and UK-used, and repairs while you wait.' };
    }
    case 'ikeja-city-mall': {
      b.box(0xe2e8f0, place.depth - 10, 12, along - 10, depthMid + s * 5, 0, place.z);
      b.box(0x93c5fd, 0.15, 7, along * 0.5, at(10) - s * 0.08, 0, place.z).box(0xdc2626, 0.3, 2, along - 12, at(10) - s * 0.1, 9, place.z);
      b.box(0x6b7280, 9, 0.03, along, at(4.5), 0.02, place.z);
      for (let i = 0; i < 6; i++) b.box([0x111827, 0xf8fafc, 0x9ca3af, 0x1e3a8a][i % 4], 2, 1.4, 4.4, at(3 + (i % 2) * 3.5), 0, z0 + 10 + Math.floor(i / 2) * 22);
      k.obstruct(Math.min(at(10), at(place.depth)), Math.max(at(10), at(place.depth)), z0 + 5, z0 + along - 5, 12);
      k.label('IKEJA CITY MALL', 'Supermarket · Cinema · Food court', '#dc2626', 9.5, 26);
      return { name: 'Ikeja City Mall', category: 'Mall', description: 'The mainland mall: a big supermarket, a cinema, a food court and every kind of shop, with generator light and cold AC.' };
    }
    case 'allen-lounge': {
      b.box(0x111827, place.depth, 8, along, depthMid, 0, place.z);
      b.box(0xdb2777, 0.1, 0.3, along - 2, faceX - s * 0.06, 6.6, place.z, { glow: true }).box(0x22d3ee, 0.1, 0.3, along - 2, faceX - s * 0.06, 1.2, place.z, { glow: true });
      k.footprint(8);
      k.label('ALLEN LOUNGE', 'Allen Avenue · Afrobeats · Shisha', '#db2777', 4.5, 18);
      return { name: 'Allen Lounge', category: 'Lounge & club', description: 'Allen Avenue nights: Afrobeats loud, shisha, small chops and bottles, till the sun comes up.' };
    }
    case 'oshodi-interchange': {
      b.box(0xe5e7eb, place.depth - 16, 16, along - 20, depthMid + s * 8, 0, place.z);
      for (let f = 1; f < 5; f++) b.box(0x0ea5e9, 0.1, 1.6, along - 22, at(16) - s * 0.06, f * 3.4 - 1.6, place.z);
      for (let i = 0; i < 3; i++) {
        b.box(0xf8fafc, 10, 0.3, 4, at(7), 4, z0 + 15 + i * 30);
        b.box(0x1d4ed8, 2.6, 3, 11, at(7), 0, z0 + 15 + i * 30).box(0xdc2626, 2.62, 0.6, 11, at(7), 1, z0 + 15 + i * 30);
      }
      k.obstruct(Math.min(at(16), at(place.depth)), Math.max(at(16), at(place.depth)), z0 + 10, z0 + along - 10, 16);
      k.label('OSHODI TRANSPORT INTERCHANGE', 'BRT · Danfo · Interstate buses', '#1d4ed8', 13, 30);
      return { name: 'Oshodi Transport Interchange', category: 'Bus terminal', description: 'Three terminals of buses to every part of Lagos and beyond. Buy a ticket and go.' };
    }
    case 'lasuth': {
      b.box(0xf8fafc, place.depth - 8, 14, along - 8, depthMid + s * 4, 0, place.z);
      for (let f = 1; f < 4; f++) b.box(0x1e3a8a, 0.08, 1.6, along - 10, at(8) - s * 0.05, f * 3.6 - 1.4, place.z);
      b.box(0xdc2626, 0.15, 3, 1, at(8) - s * 0.1, 10, place.z).box(0xdc2626, 0.15, 1, 3, at(8) - s * 0.1, 11, place.z);
      b.box(0xf8fafc, 2.2, 2.4, 5.6, at(3), 0, z0 + 8).box(0xdc2626, 2.22, 0.4, 5.62, at(3), 1.2, z0 + 8);
      k.obstruct(Math.min(at(8), at(place.depth)), Math.max(at(8), at(place.depth)), z0 + 4, z0 + along - 4, 14);
      k.label('LASUTH', 'Lagos State University Teaching Hospital · A&E 24 hrs', '#dc2626', 7, 24);
      return { name: 'LASUTH', category: 'Hospital', description: 'The teaching hospital: emergency, clinics, pharmacy and a ward. Get treated and get well.' };
    }
    case 'ladipo-auto': {
      b.box(0x78716c, place.depth, 0.05, along, depthMid, 0, place.z);
      for (let i = 0; i < 3; i++) b.box(0x57534e, 12, 0.3, 14, at(26), 4, z0 + 12 + i * 22).box(0x3f3f46, 0.3, 4, 0.3, at(20), 0, z0 + 6 + i * 22).box(0x3f3f46, 0.3, 4, 0.3, at(32), 0, z0 + 6 + i * 22);
      for (let i = 0; i < 6; i++) b.box([0x7f1d1d, 0x1e3a8a, 0x6b7280, 0x14532d][i % 4], 1.9, 1.3, 4.3, at(8 + (i % 2) * 5), 0, z0 + 8 + Math.floor(i / 2) * 22);
      for (let i = 0; i < 10; i++) b.cylinder(0x111111, 0.4, 0.25, at(3 + (i % 3) * 0.9), (i % 4) * 0.25, z0 + 40 + Math.floor(i / 3) * 1.1);
      k.obstruct(Math.min(at(20), at(32)), Math.max(at(20), at(32)), z0 + 5, z0 + along - 5, 4.3);
      k.label('LADIPO AUTO MARKET', 'Spare parts · Mechanics · Panel beaters', '#78350f', 5, 24);
      return { name: 'Ladipo Auto Market', category: 'Auto parts & mechanics', description: 'Every part for every car, new and tokunbo, and mechanics who can fix anything. Bring your car.' };
    }
    case 'ikeja-gra': {
      b.box(0xe7e5e4, 0.5, 3, along, at(1), 0, place.z).box(0x1f2937, 0.6, 2.6, 5, at(1), 0, place.z);
      for (let i = 0; i < 3; i++) b.box(0xfef3c7, 14, 8, 14, at(18), 0, z0 + 10 + i * 20).box(0x7f1d1d, 15, 0.6, 15, at(18), 8, z0 + 10 + i * 20);
      k.obstruct(Math.min(at(0.75), at(1.25)), Math.max(at(0.75), at(1.25)), z0, place.z - 2.5, 3);
      k.obstruct(Math.min(at(0.75), at(1.25)), Math.max(at(0.75), at(1.25)), place.z + 2.5, z0 + along, 3);
      k.label('IKEJA GRA', 'Government Reserved Area · Estate office', '#14532d', 3.2, 18);
      return { name: 'Ikeja GRA', category: 'Estate', description: 'Leafy streets of big houses behind walls. The estate office has houses to rent and buy.' };
    }
    case 'naija-fresh': {
      // A neighbourhood supermarket: glass front, a green fascia, trolleys by the door, a delivery van at the side
      b.box(0xf1f5f9, place.depth - 6, 7, along - 4, depthMid + s * 3, 0, place.z);
      b.box(0x16a34a, 0.3, 1.6, along - 3, at(6) - s * 0.15, 5.6, place.z);
      b.box(0x93c5fd, 0.1, 3.6, along - 12, at(6) - s * 0.06, 0.2, place.z);
      for (let i = 0; i < 6; i++) b.box(0x9ca3af, 0.9, 1, 0.55, at(3), 0, place.z + 8 + i * 0.6);
      b.box(0xf8fafc, 2.2, 2.4, 5.4, at(3), 0, z0 + 4).box(0x16a34a, 2.22, 0.5, 5.42, at(3), 1.3, z0 + 4);
      k.obstruct(Math.min(at(6), at(place.depth)), Math.max(at(6), at(place.depth)), z0 + 2, z0 + along - 2, 7);
      k.label('NAIJA FRESH SUPERMARKET', 'Groceries · Drinks · Household · Open 7 am to 10 pm', '#16a34a', 5.8, 22);
      return { name: 'Naija Fresh Supermarket', category: 'Supermarket', description: 'A neighbourhood supermarket on Ikorodu Road. Shop, or buy the business and run it: order the stock, lay out the shelves, stack them.' };
    }
    case 'chop-express': {
      b.box(0xdc2626, place.depth, 5, along, depthMid, 0, place.z).box(0xfacc15, place.depth + 0.4, 0.6, along + 0.4, depthMid, 5, place.z);
      b.box(0x93c5fd, 0.08, 2.6, along - 6, faceX - s * 0.05, 0.3, place.z);
      k.footprint(5);
      k.label('CHOP EXPRESS', 'Rice · Chicken · Meat pie · Ice cream', '#dc2626', 5.8, 16);
      return { name: 'Chop Express', category: 'Fast food', description: 'Jollof and chicken, fried rice, meat pies and ice cream, fast.' };
    }
    case 'faith-arena': {
      b.box(0xf5f5f4, place.depth - 10, 14, along - 10, depthMid + s * 5, 0, place.z);
      b.dome(0x2563eb, Math.min(place.depth, along) * 0.33, depthMid + s * 5, 14, place.z);
      b.box(0x1e3a8a, 0.15, 6, 12, at(10) - s * 0.08, 0, place.z);
      b.box(0x6b7280, 9, 0.03, along, at(4.5), 0.02, place.z);
      k.obstruct(Math.min(at(10), at(place.depth)), Math.max(at(10), at(place.depth)), z0 + 5, z0 + along - 5, 14);
      k.label('FAITH ARENA', 'Sunday 7, 9 & 11 am · Night vigil Fridays', '#1e3a8a', 10.5, 24);
      return { name: 'Faith Arena', category: 'Church', description: 'A church the size of a stadium: a choir of hundreds, a band, and a pastor who preaches till the walls shake.' };
    }
    case 'mmia-terminal': {
      // The terminal, its curved roof, the kerb canopy, the control tower, and an airliner on its stand
      b.box(0xe5e7eb, 40, 14, along - 20, at(30), 0, place.z);
      b.box(0x0ea5e9, 0.15, 10, along - 24, at(10) - s * 0.08, 0.5, place.z);
      b.box(0x16a34a, 44, 1.2, along - 16, at(30), 14, place.z, { roll: s * 0.05 });
      b.box(0xf8fafc, 7, 0.4, along - 30, at(5), 5, place.z);
      for (let i = 0; i < 6; i++) b.cylinder(0x9ca3af, 0.25, 5, at(5), 0, z0 + 25 + i * 22);
      b.cylinder(0xd6d3d1, 2.2, 32, at(80), 0, z0 + 15).cylinder(0x0f172a, 4, 4, at(80), 32, z0 + 15, { sides: 10 }).cone(0x9ca3af, 4.2, 2, at(80), 36, z0 + 15, 10);
      b.box(0x52525b, 70, 0.04, along, at(85), 0.01, place.z);
      airliner(b, at(85), place.z + 30, 0x0b7a43);
      airliner(b, at(85), place.z - 35, 0x1d4ed8);
      k.obstruct(Math.min(at(10), at(50)), Math.max(at(10), at(50)), z0 + 10, z0 + along - 10, 14);
      k.label('MURTALA MUHAMMED INTERNATIONAL AIRPORT', 'Departures · Arrivals · LOS', '#0b7a43', 15.4, 34);
      return { name: 'Murtala Muhammed International Airport', category: 'International airport', description: 'Lagos to the world: check in, security, duty free, the lounge and the gates, with airliners on their stands outside.' };
    }
  }
  return null;
}
