/**
 * Where the expressway runs and how wide it is. Kept apart from the builder so the city plan
 * and the traffic can know it without loading any of the drawing.
 */
export const EXPRESS = {
  /** Where Broad Street widens into the expressway, and where it ends at the roundabout */
  from: 120,
  to: 4110,
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
  ring: { z: 4175, island: 16, road: 36 },
  /** Gaps in the barrier where a car may turn back */
  uTurns: [700, 2900, 3500],
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
];

/** Is this stretch of frontage taken by one of the places? */
export function roadsideAt(side: number, z0: number, z1: number): (typeof ROADSIDE)[number] | null {
  return ROADSIDE.find((p) => p.side === side && z1 > p.z - p.length / 2 - 2 && z0 < p.z + p.length / 2 + 2) ?? null;
}
