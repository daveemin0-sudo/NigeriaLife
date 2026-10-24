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

