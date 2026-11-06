/**
 * When a place is open. Hours are on the game's clock, 0 to 24, and may run past midnight:
 * a nightclub that opens at 20 and closes at 5 is open at 23 and at 3, and shut at noon. A place
 * may also keep days: a bank opens Monday to Friday, a market every day but Sunday. The small
 * hours after a late night belong to the night before (Saturday's 3 am is Friday night's).
 */
export interface OpeningHours {
  opens: number;
  closes: number;
  /** The days it opens, 0 Sunday to 6 Saturday; left out, every day */
  days?: readonly number[];
}

export const ALWAYS_OPEN: OpeningHours = { opens: 0, closes: 24 };
export const WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5];
export const NOT_SUNDAY: readonly number[] = [1, 2, 3, 4, 5, 6];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The day of the week on the game's calendar now, 0 Sunday to 6 Saturday (set by the game; null leaves days out) */
export const calendar = { weekday: (): number | null => null };

/**
 * When each place that keeps hours is open. This is the one record of it: the map, the door,
 * the room behind the door and the landmark itself all read it from here. A place given none of
 * these is given hours for what it is (`hoursFor`), and a few never shut.
 */
export const PLACE_HOURS = {
  bank: { opens: 8, closes: 16, days: WEEKDAYS },
  university: { opens: 7, closes: 21 },
  supermarket: { opens: 7, closes: 22 },
  buka: { opens: 9, closes: 23 },
  stadium: { opens: 9, closes: 23 },
  club: { opens: 20, closes: 5 },
  // Places of work that keep working hours: taken on at any hour, but the work is done in these
  buildingSite: { opens: 7, closes: 18 },
} satisfies Record<string, OpeningHours>;

/**
 * The hours of a place that has none of its own, from what it is: a hospital, a police station,
 * an airport, a hotel, a port, a refinery, a place of worship and the open-air landmarks never
 * shut; offices keep office hours on weekdays; markets shut on Sunday.
 */
export function hoursFor(name: string, category: string): OpeningHours | undefined {
  const n = name.toLowerCase();
  const office = { opens: 8, closes: 16, days: WEEKDAYS };
  // Never shut
  if (/hospital|police|radio house|frcn|monolith|zuma rock|katampe|city gate|eagle square|unity fountain|polling unit|bus stop|interchange|junction|roundabout|cab rank/.test(n)) return undefined;
  if (['Airport', 'Hotel', 'Seaport', 'Refinery', 'Church', 'Residential'].includes(category)) return undefined;
  switch (category) {
    case 'Bank':
      return office;
    case 'Civic':
      if (/cchub|co-creation/.test(n)) return { opens: 8, closes: 20, days: NOT_SUNDAY };
      if (/conference centre|world trade|commercial|tech strip|plaza/.test(n)) return { opens: 8, closes: 22 };
      return office;
    case 'Market':
      if (/cattle|slaughter|abattoir|marine market|creek road/.test(n)) return { opens: 6, closes: 18 };
      if (/plaza|centre|boulevard|high street|shopping/.test(n)) return { opens: 9, closes: 21 };
      return { opens: 8, closes: 18, days: NOT_SUNDAY };
    case 'Supermarket':
      return { opens: 9, closes: 21 };
    case 'Restaurant':
      if (/lounge|speakeasy|nightlife|boat club|bar/.test(n)) return { opens: 12, closes: 2 };
      return { opens: 10, closes: 23 };
    case 'Nightclub':
      // Fela's Shrine has its nights, Thursday to Sunday
      if (/shrine/.test(n)) return { opens: 18, closes: 4, days: [4, 5, 6, 0] };
      if (/club 1928|colonial/.test(n)) return { opens: 10, closes: 24 };
      if (/rooftop|sky lounge|cocktail/.test(n)) return { opens: 16, closes: 2 };
      return PLACE_HOURS.club;
    case 'Culture':
      if (/cinema/.test(n)) return { opens: 10, closes: 24 };
      if (/theme park|waterpark|amusement|magic land/.test(n)) return { opens: 10, closes: 19 };
      if (/conservation/.test(n)) return { opens: 8, closes: 17 };
      if (/freedom park/.test(n)) return { opens: 9, closes: 23 };
      if (/park|garden|lake/.test(n)) return { opens: 7, closes: 19 };
      return { opens: 9, closes: 18 };
    case 'Stadium':
      if (/viewing centre/.test(n)) return { opens: 14, closes: 24 };
      if (/golf/.test(n)) return { opens: 6, closes: 19 };
      if (/bowling/.test(n)) return { opens: 11, closes: 23 };
      if (/sports complex|training pitch|parade ground/.test(n)) return { opens: 6, closes: 21 };
      return PLACE_HOURS.stadium;
    case 'University':
      if (/library/.test(n)) return { opens: 8, closes: 18, days: NOT_SUNDAY };
      if (/open university/.test(n)) return office;
      return PLACE_HOURS.university;
    case 'Healthcare':
      // A gym (the rest of this kind, hospitals and the police, never shut)
      return { opens: 5, closes: 22 };
    case 'Beach':
      if (/jetty|fish/.test(n)) return { opens: 5, closes: 18 };
      return { opens: 7, closes: 19 };
    case 'Transit':
      // Boats do not sail the creeks at night; motor parks load from five
      if (/jetty/.test(n)) return { opens: 6, closes: 18 };
      return { opens: 5, closes: 22 };
    default:
      return undefined;
  }
}

/**
 * The days a place keeps when its hours were set without any: a bank and a government office
 * open on weekdays, a market every day but Sunday. Null: every day.
 */
export function daysFor(name: string, category: string): readonly number[] | undefined {
  const n = name.toLowerCase();
  if (category === 'Bank') return WEEKDAYS;
  if (category === 'Civic' && /secretariat|ministry|headquarters|commission|court|post office|works complex|government house|national assembly|state house|ecowas|efcc|sec/.test(n)) return WEEKDAYS;
  if (category === 'University' && /open university/.test(n)) return WEEKDAYS;
  if (category === 'University' && /library/.test(n)) return NOT_SUNDAY;
  if (category === 'Market' && !/plaza|centre|boulevard|high street|shopping|cattle|slaughter|abattoir|marine market|creek road/.test(n)) return NOT_SUNDAY;
  return undefined;
}

/** Is it open at this hour (and on this day of the week, when it keeps days)? */
export function isOpen(hours: OpeningHours | undefined, hour: number, weekday: number | null = calendar.weekday()): boolean {
  if (!hours) return true;
  if (hours.days && weekday !== null) {
    const overnight = hours.opens > hours.closes;
    const openedOn = overnight && hour < hours.closes ? (weekday + 6) % 7 : weekday;
    if (!hours.days.includes(openedOn)) return false;
  }
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

/** "Monday to Friday", "every day but Sunday", "Thursday to Sunday" */
function daysWords(days: readonly number[]): string {
  if (days.length >= 7) return '';
  if (days.length === 6) return `every day but ${DAY_NAMES[[0, 1, 2, 3, 4, 5, 6].find((d) => !days.includes(d))!]}`;
  // A run of days, going round the week
  const start = days.find((d) => !days.includes((d + 6) % 7));
  if (start !== undefined) {
    let end = start;
    while (days.includes((end + 1) % 7) && (end + 1) % 7 !== start) end = (end + 1) % 7;
    if ((end - start + 7) % 7 === days.length - 1) return `${DAY_NAMES[start]} to ${DAY_NAMES[end]}`;
  }
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

/** "8 pm to 5 am", "8 am to 4 pm, Monday to Friday", or "Open all day". */
export function describeHours(hours: OpeningHours | undefined): string {
  const allDay = !hours || (isOpen({ ...hours, days: undefined }, 0) && isOpen({ ...hours, days: undefined }, 6) && isOpen({ ...hours, days: undefined }, 12) && isOpen({ ...hours, days: undefined }, 18) && hours.opens <= 0);
  if (allDay && (!hours?.days || hours.days.length >= 7)) return 'Open all day';
  const times = allDay ? 'All day' : `${clockTime(hours!.opens)} to ${clockTime(hours!.closes)}`;
  const days = hours?.days ? daysWords(hours.days) : '';
  return days ? `${times}, ${days}` : times;
}

/** When it next opens, from this hour of this day: "at 8 am", "tomorrow at 8 am", "on Monday at 8 am" */
function nextOpening(hours: OpeningHours, hour: number, weekday: number | null): string {
  for (let step = 1; step <= 24 * 8; step++) {
    const h = Math.floor(hour) + step;
    const ahead = Math.floor(h / 24);
    const day = weekday === null ? null : (weekday + ahead) % 7;
    if (isOpen(hours, h % 24, day)) {
      const at = clockTime(hours.opens);
      if (ahead === 0 || weekday === null) return `at ${at}`;
      if (ahead === 1) return `tomorrow at ${at}`;
      return `on ${DAY_NAMES[day!]} at ${at}`;
    }
  }
  return `at ${clockTime(hours.opens)}`;
}

/** What a place's card says about now: "Open all day", "Open now, until 4 pm", "Closed now, opens on Monday at 8 am". */
export function openNow(hours: OpeningHours | undefined, hour: number, weekday: number | null = calendar.weekday()): { open: boolean; text: string } {
  if (!hours || describeHours(hours) === 'Open all day') return { open: true, text: 'Open all day' };
  if (isOpen(hours, hour, weekday)) return { open: true, text: `Open now, until ${clockTime(hours.closes)}` };
  const closedToday = !!hours.days && weekday !== null && !hours.days.includes(weekday) && !(hours.opens > hours.closes && hour < hours.closes);
  return { open: false, text: `${closedToday ? 'Closed today' : 'Closed now'}, opens ${nextOpening(hours, hour, weekday)}` };
}

/** What to tell someone at the door of a place that is shut. */
export function closedNotice(name: string, hours: OpeningHours, hour?: number, weekday: number | null = calendar.weekday()): string {
  return `${name} is closed. It opens ${hour === undefined ? `at ${clockTime(hours.opens)}` : nextOpening(hours, hour, weekday)}.`;
}
