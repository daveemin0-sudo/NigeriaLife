/**
 * How busy the street is at each hour: the share of the day's people and traffic that are
 * out. Full from seven in the morning to seven at night, thinning through the evening, a
 * few night people and the odd vehicle in the small hours, filling again before dawn.
 */
const THROUGH_THE_DAY: Array<[number, number]> = [
  [0, 0.1],
  [4.5, 0.1],
  [7, 1],
  [19, 1],
  [22, 0.3],
  [24, 0.1],
];

export function shareAbroad(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < THROUGH_THE_DAY.length; i++) {
    const [from, low] = THROUGH_THE_DAY[i - 1];
    const [to, high] = THROUGH_THE_DAY[i];
    if (h <= to) return low + ((high - low) * (h - from)) / (to - from);
  }
  return THROUGH_THE_DAY[0][1];
}

/** Whether the one of a crowd with this place in it is out when this share of the crowd is: the same ones stay home each night. */
export function isAbroad(place: number, share: number): boolean {
  return (place * 0.61803398875) % 1 <= share;
}
