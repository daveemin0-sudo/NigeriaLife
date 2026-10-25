/**
 * Where the expressway runs and how wide it is. Kept apart from the builder so the city plan
 * and the traffic can know it without loading any of the drawing.
 */
export const EXPRESS = {
  /** Where Broad Street widens into the expressway, and where it ends at the roundabout (past Ikeja, on Ikorodu Road) */
  from: 120,
  to: 7110,
  /** Where the mainland's Ikeja stretch begins: Ikorodu Road */
  ikeja: 4110,
  /** Half the width of the carriageway (both directions), the median, the barrier, the pavement */
  half: 11,
  median: 0.7,
  barrier: 0.3,
  walk: 4,
  /** The lane centres either side of the barrier: Broad Street's two and an outer one */
  lanes: [1.8, 4.9, 8.0],
  toll: 1000,
  lagoonFrom: 1300,
  lagoonTo: 2600,
  pylon: 1950,
  ring: { z: 7175, island: 16, road: 36 },
  /** Gaps in the barrier where a car may turn back */
  uTurns: [700, 2900, 3500, 4700, 5800, 6800],
};


/** Places along the expressway, each on one side (-1 west, 1 east), centred at z, so long along the road and so deep */
export const ROADSIDE: Array<{ id: string; side: -1 | 1; z: number; length: number; depth: number }> = [
  { id: 'sankofa-motors', side: 1, z: 450, length: 42, depth: 24 },
  { id: 'redemption-cathedral', side: -1, z: 620, length: 34, depth: 28 },
  { id: 'central-mosque', side: 1, z: 820, length: 32, depth: 30 },
  { id: 'lagoon-beach', side: -1, z: 1235, length: 120, depth: 110 },
  { id: 'lagoon-marina', side: 1, z: 1240, length: 100, depth: 40 },
  { id: 'private-airfield', side: 1, z: 2830, length: 240, depth: 140 },
  { id: 'shopwell-mall', side: -1, z: 3150, length: 56, depth: 32 },
  { id: 'eko-grand-hotel', side: 1, z: 3330, length: 32, depth: 26 },
  { id: 'police-command', side: -1, z: 3520, length: 34, depth: 22 },
  { id: 'efcc-office', side: 1, z: 3680, length: 30, depth: 22 },
  { id: 'ikeja-golf', side: -1, z: 3860, length: 90, depth: 80 },
  { id: 'government-house', side: 1, z: 3990, length: 40, depth: 32 },
  // The places the phone and the map name, each with somewhere to stand (see MorePlaces)
  { id: 'marina-towers', side: 1, z: 250, length: 40, depth: 30 },
  { id: 'freedom-park', side: 1, z: 340, length: 60, depth: 50 },
  { id: 'ivory-rooftop', side: 1, z: 540, length: 30, depth: 24 },
  { id: 'the-library', side: 1, z: 640, length: 26, depth: 20 },
  { id: 'i-fitness', side: 1, z: 720, length: 34, depth: 26 },
  { id: 'balogun-market', side: -1, z: 300, length: 70, depth: 40 },
  { id: 'amala-shitta', side: -1, z: 425, length: 24, depth: 18 },
  { id: 'viewing-centre', side: -1, z: 485, length: 20, depth: 16 },
  { id: 'polling-unit', side: -1, z: 760, length: 26, depth: 20 },
  { id: 'afrika-shrine', side: -1, z: 2750, length: 50, depth: 36 },
  { id: 'lekki-conservation', side: 1, z: 3050, length: 70, depth: 70 },
  { id: 'dangote-refinery', side: 1, z: 3500, length: 120, depth: 120 },
  { id: 'radio-house', side: 1, z: 3800, length: 30, depth: 22 },
  // Filling stations: on the island before the toll, just off the bridge, and on the mainland
  { id: 'station-island', side: -1, z: 900, length: 44, depth: 30 },
  { id: 'station-bridge', side: 1, z: 2650, length: 44, depth: 30 },
  { id: 'station-mainland', side: -1, z: 3330, length: 44, depth: 30 },
  // Ikeja, on Ikorodu Road past the old end of the expressway
  { id: 'computer-village', side: 1, z: 4320, length: 80, depth: 50 },
  { id: 'ikeja-city-mall', side: -1, z: 4440, length: 80, depth: 50 },
  { id: 'allen-lounge', side: 1, z: 4560, length: 30, depth: 24 },
  { id: 'oshodi-interchange', side: -1, z: 4900, length: 90, depth: 50 },
  { id: 'lasuth', side: 1, z: 5000, length: 70, depth: 50 },
  { id: 'ladipo-auto', side: -1, z: 5350, length: 70, depth: 40 },
  { id: 'ikeja-gra', side: 1, z: 5480, length: 60, depth: 40 },
  { id: 'naija-fresh', side: -1, z: 5500, length: 40, depth: 28 },
  { id: 'chop-express', side: -1, z: 5700, length: 24, depth: 18 },
  { id: 'faith-arena', side: -1, z: 6060, length: 90, depth: 70 },
  { id: 'mmia-terminal', side: 1, z: 6300, length: 160, depth: 120 },
  { id: 'station-ikeja', side: -1, z: 6620, length: 44, depth: 30 },
];

/** Side streets off Ikorodu Road: which side, where they leave it, how far they run, how wide the carriageway is */
export const SIDE_ROADS: Array<{ id: string; name: string; side: -1 | 1; z: number; length: number; half: number }> = [
  { id: 'allen-avenue', name: 'Allen Avenue', side: 1, z: 4620, length: 230, half: 5 },
  { id: 'awolowo-way', name: 'Obafemi Awolowo Way', side: -1, z: 5650, length: 230, half: 5 },
];
/** The pavement either side of a side street */
export const SIDE_WALK = 3;

/** The places along the side streets: which street, which side of it (-1 toward the island), how far along it, how long and deep */
export const SIDE_PLACES: Array<{ id: string; road: string; side: -1 | 1; at: number; length: number; depth: number }> = [
  { id: 'allen-salon', road: 'allen-avenue', side: -1, at: 40, length: 16, depth: 14 },
  { id: 'allen-suya', road: 'allen-avenue', side: 1, at: 70, length: 14, depth: 12 },
  { id: 'allen-bank', road: 'allen-avenue', side: -1, at: 120, length: 22, depth: 16 },
  { id: 'awolowo-fashion', road: 'awolowo-way', side: 1, at: 45, length: 18, depth: 14 },
  { id: 'awolowo-pharmacy', road: 'awolowo-way', side: -1, at: 80, length: 14, depth: 12 },
  { id: 'awolowo-school', road: 'awolowo-way', side: 1, at: 130, length: 22, depth: 16 },
];

/** Where a side-street place's front is: the x along the street, the z of its face, and where to stand on the pavement */
export function sideFront(id: string): { x: number; faceZ: number; standZ: number; side: -1 | 1; road: (typeof SIDE_ROADS)[number] } | null {
  const place = SIDE_PLACES.find((p) => p.id === id);
  const road = place && SIDE_ROADS.find((r) => r.id === place.road);
  if (!place || !road) return null;
  return {
    x: road.side * (EXPRESS.half + EXPRESS.walk + place.at),
    faceZ: road.z + place.side * (road.half + SIDE_WALK + 0.5),
    standZ: road.z + place.side * (road.half + SIDE_WALK - 1),
    side: place.side,
    road,
  };
}

/** Is this stretch of frontage taken by one of the places, or by the mouth of a side street? */
export function roadsideAt(side: number, z0: number, z1: number): (typeof ROADSIDE)[number] | null {
  const place = ROADSIDE.find((p) => p.side === side && z1 > p.z - p.length / 2 - 2 && z0 < p.z + p.length / 2 + 2);
  if (place) return place;
  // The mouth of a side street, and the buildings down both sides of it (up to 28 m from its middle)
  const reach = (r: (typeof SIDE_ROADS)[number]) => r.half + SIDE_WALK + 20;
  const road = SIDE_ROADS.find((r) => r.side === side && z1 > r.z - reach(r) && z0 < r.z + reach(r));
  return road ? { id: road.id, side: road.side, z: road.z, length: reach(road) * 2, depth: 0 } : null;
}
