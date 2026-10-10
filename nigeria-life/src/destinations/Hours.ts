/**
 * When a place is open. Hours are on the game's clock, 0 to 24, and may run past midnight:
 * a nightclub that opens at 20 and closes at 5 is open at 23 and at 3, and shut at noon.
 */
export interface OpeningHours {
  opens: number;
  closes: number;
}

export const ALWAYS_OPEN: OpeningHours = { opens: 0, closes: 24 };

export function isOpen(hours: OpeningHours | undefined, hour: number): boolean {
  if (!hours) return true;
  if (hours.opens === hours.closes || (hours.opens <= 0 && hours.closes >= 24)) return true;
  if (hours.opens < hours.closes) return hour >= hours.opens && hour < hours.closes;
  return hour >= hours.opens || hour < hours.closes;
}

/** "8 pm", "5 am", "noon". */
export function clockTime(hour: number): string {
  const whole = ((Math.floor(hour) % 24) + 24) % 24;
  const minutes = Math.round((hour - Math.floor(hour)) * 60);
  if (whole === 12 && minutes === 0) return 'noon';
  if (whole === 0 && minutes === 0) return 'midnight';
  const twelve = whole % 12 === 0 ? 12 : whole % 12;
  return `${twelve}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${whole < 12 ? 'am' : 'pm'}`;
}

/** "8 pm to 5 am", or "Open all day". */
export function describeHours(hours: OpeningHours | undefined): string {
  if (!hours || isOpen(hours, 0) && isOpen(hours, 6) && isOpen(hours, 12) && isOpen(hours, 18) && hours.opens <= 0) return 'Open all day';
  return `${clockTime(hours.opens)} to ${clockTime(hours.closes)}`;
}

/** What to tell someone at the door of a place that is shut. */
export function closedNotice(name: string, hours: OpeningHours): string {
  return `${name} is closed. It opens at ${clockTime(hours.opens)}.`;
}
