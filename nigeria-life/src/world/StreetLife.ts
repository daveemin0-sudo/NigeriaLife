/**
 * How busy the street is at each hour: the share of the day's people and traffic that are
 * out. Lagos has two rush hours, packed from seven to half past nine in the morning and from
 * five to eight in the evening; the middle of the day is lighter, the night nearly empty.
 */
const THROUGH_THE_DAY: Array<[number, number]> = [
  [0, 0.08],
  [4.5, 0.1],
  [6, 0.5],
  [7, 1],
  [9.5, 1],
  [11, 0.6],
  [15.5, 0.65],
  [17, 1],
  [20, 1],
  [22, 0.3],
  [24, 0.08],
];

/** Is this hour a rush hour: the roads full and slow? */
export function isRushHour(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return (h >= 7 && h < 9.5) || (h >= 17 && h < 20);
}

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
