/**
 * Earnings the game used to report, and what the server pays for them instead.
 *
 * Ranked by how much the client path can credit in a real hour if it is used as fast as that
 * code allows (energy comes back at 9% a second while resting; a pull with no cooldown is
 * counted at one a second, which a script can beat). Figures are the top of the table, before
 * this file. Anything already paid by the server (shifts on a worksite, business takings,
 * loans, transfers, registry sales) is not in the list.
 *
 *   1. Plot takings. A 60-floor tower nets ₦202,800,000 a game day, and a game day is ten
 *      minutes, so about ₦1,217,000,000 an hour. The server works the figure out from the
 *      building catalogue and its own clock, capped at a week, and the client does not name it.
 *   2. Tiger generator cord. ₦2,500 a pull and no cooldown: ₦9,000,000 an hour at one pull a
 *      second, and more if it is called in a loop. Now a gig: on the spot, a few seconds, ₦2,500.
 *   3. CcHUB minigame, top grade ₦95,000, 20% energy: on the order of ₦80,000,000 an hour.
 *      Now a worksite shift, same rules as the port.
 *   4. Port Harcourt refinery minigame, top grade ₦80,000: on the order of ₦50,000,000 an hour.
 *   5. LASTMA minigame, top grade ₦55,000: on the order of ₦40,000,000 an hour.
 *   6. Phone and life gigs that pay at once. The code sprint is ₦25,000 for 30% energy, about
 *      ₦20,000,000 an hour; the remote UI job is just under that. Same gig clock as the generator.
 *   7. Career shifts and the other HUD gigs (hackathon ₦15,000, secretariat ₦14,000, remote
 *      sprint ₦12,000, and the smaller site jobs). A software shift the client times at 20s is
 *      a few million an hour, and the client used to name the pay, including the career bonus.
 *   8. Tips on a server shift. Three stars is 30% of the wage. A top grade makes that a large
 *      second payment the client used to report. The server adds it from the stars.
 *   9. Story quests, up to ₦200,000 once each. Not an hourly grind; a ₦60,000 one used to clear
 *      the old allowance exactly, so they are paid here, once, at the catalogue figure.
 *  10. Album sets (₦60,000 to ₦1,000,000, once a set) and detective cases (catalogue base, once).
 *  11. NaijaBet. A ₦1,000 ticket, 6% chance of ₦15,000. The roll is the server's.
 *  12. Agama catches. ₦2,000, ₦50,000 on every tenth, ₦500,000 for the last of forty. Once each.
 *
 * Still reported by the game, and what a busy ten minutes of those needs:
 *   diaspora remittance ₦25,000 (once a day). Transit fares (payFare) and Eko Rides trips
 *   (startRide / finishRide) moved to the server, in economy.ts. A new player's hustle, a gist riddle and a small
 *   phone-game pot fit in the same window when they are not all stacked on that. The allowance
 *   is ₦30,000. Larger one-offs (a plot sale, a high ladder rung, politics pay) stay on the
 *   held queue, as they already did above ₦60,000.
 */
import { buildingType, MAX_DAYS_HELD } from '../src/realestate/BuildingCatalogue.ts';
import { ALL_PLOTS } from '../src/realestate/PlotCatalogue.ts';
import { MS_PER_GAME_DAY, MS_PER_GAME_HOUR } from '../src/realestate/WorldClock.ts';

export interface GigSite {
  city: string;
  x: number;
  z: number;
  radius: number;
}

export interface GigDef {
  pay: number;
  /** Set for a career shift: a wage from this employer, with a payslip and PAYE. Other gigs are cash in hand. */
  employer?: string;
  /** Seconds the server counts from the start before it will pay the full wage */
  minSeconds: number;
  /** The full shift, when leaving early pays for the share of it the clock has seen */
  spanSeconds?: number;
  memo: string;
  site?: GigSite;
}

/** Pieces of work that are not an employer grade. The id is what the client sends; the pay is not. */
export const GIGS: Record<string, GigDef> = {
  // The cord outside Bet9ja. Two pulls, a few seconds apart, standing next to it.
  'street:generator': { pay: 2_500, minSeconds: 4, memo: 'Generator Starting Assistance', site: { city: 'lagos', x: 8.5, z: 24, radius: 15 } },
  // Life app, three steps. No pin on the map: the phone is the site, and the clock is the server's.
  'life:code': { pay: 25_000, minSeconds: 8, memo: 'Code sprint at the hub' },
  'life:danfo': { pay: 12_500, minSeconds: 8, memo: 'Danfo conductor run' },
  'life:gen': { pay: 20_000, minSeconds: 8, memo: 'Generator repair' },
  // Phone jobs. The listed duration is the minimum the server will pay after.
  'phone:job_tech': { pay: 22_000, minSeconds: 4, memo: 'Remote UI/UX Design Gig' },
  'phone:job_pos': { pay: 7_500, minSeconds: 3, memo: 'POS Cash Point Agent' },
  'phone:job_conductor': { pay: 4_500, minSeconds: 3, memo: 'Danfo Bus Conductor Shift' },
  'phone:job_food': { pay: 3_800, minSeconds: 3, memo: 'Express Jollof Delivery' },
  // Career shifts. Base salary only: a career bonus the browser adds is not paid online.
  'career:job_shop_assistant': { pay: 4_500, minSeconds: 10, spanSeconds: 10, memo: 'Trade Shop Assistant', employer: 'Balogun Wholesale Market' },
  // A day's wage. The phone holds the hour; the server pays the full wage a minute short of that, and a share if the worker leaves.
  'career:job_mechanic': { pay: 7_000, minSeconds: 3540, spanSeconds: 3600, memo: 'Auto Mechanic Apprentice', employer: "God's Grace Auto Repair" },
  'career:job_danfo_driver': { pay: 8_000, minSeconds: 3540, spanSeconds: 3600, memo: 'Danfo Commercial Driver', employer: 'Broad Street Danfo Terminus' },
  'career:job_food_seller': { pay: 5_500, minSeconds: 3540, spanSeconds: 3600, memo: 'Buka Kitchen Cook Assistant', employer: 'Mama Put Special Bukateria' },
  'career:job_office_worker': { pay: 18_000, minSeconds: 3540, spanSeconds: 3600, memo: 'Corporate Office Clerk', employer: 'Eko Commercial Bank Tower' },
  'career:job_software_dev': { pay: 27_000, minSeconds: 3540, spanSeconds: 3600, memo: 'Junior Software Engineer', employer: 'Co-Creation Hub (CcHub)' },
  'career:job_construction': { pay: 9_000, minSeconds: 3540, spanSeconds: 3600, memo: 'Site Framing Artisan', employer: 'Crown Luxury Estate Site' },
  'career:job_security': { pay: 7_000, minSeconds: 3540, spanSeconds: 3600, memo: 'Estate Security Officer', employer: 'Victoria Residence Estate Gate' },
  // HUD and city gigs, at the place the button is.
  'hud:remote': { pay: 12_000, minSeconds: 6, memo: 'Remote Tech Sprint' },
  'hud:hackathon': { pay: 15_000, minSeconds: 6, memo: 'CcHub Hackathon Sprint', site: { city: 'lagos', x: -10, z: -25, radius: 30 } },
  'hud:ajah': { pay: 8_500, minSeconds: 6, memo: 'Ajah Site Labour', site: { city: 'lagos', x: 90, z: 25, radius: 30 } },
  'hud:construction': { pay: 6_500, minSeconds: 6, memo: 'Construction Site Day Shift', site: { city: 'lagos', x: 16.2, z: 64.5, radius: 30 } },
  'hud:workshop': { pay: 4_000, minSeconds: 6, memo: 'Auto Workshop Gig', site: { city: 'lagos', x: -13, z: -25, radius: 20 } },
  'hud:secretariat': { pay: 14_000, minSeconds: 6, memo: 'Federal Secretariat Policy Sprint', site: { city: 'abuja', x: -24, z: 32, radius: 40 } },
  'hud:transamadi': { pay: 12_000, minSeconds: 6, memo: 'Trans-Amadi Petrochemical Shift', site: { city: 'port_harcourt', x: 55, z: -10, radius: 40 } },
};

/** Story cash, once each. The ids and figures are the quest catalogue. */
export const QUEST_CASH: Record<string, number> = {
  quest_lagos_1: 15_000,
  quest_lagos_2: 35_000,
  quest_lagos_3: 75_000,
  quest_abuja_1: 30_000,
  quest_abuja_2: 65_000,
  quest_abuja_3: 150_000,
  quest_ph_1: 25_000,
  quest_ph_2: 60_000,
  quest_ph_3: 200_000,
};

/** The life ladder's rewards, once a rung, in order (src/life/Ladder.ts RUNGS) */
export const LADDER_CASH: Record<string, number> = {
  '1': 25_000, '2': 75_000, '3': 200_000, '4': 500_000, '5': 1_200_000, '6': 3_000_000, '7': 8_000_000, '8': 25_000_000, '9': 100_000_000,
};
/** A rung is paid only to someone the server has seen earn this many times its reward, from work, trade and their own takings */
export const LADDER_PROOF = 2;

/** Album set completion, once each. */
export const ALBUM_CASH: Record<string, number> = {
  places: 150_000,
  chop: 60_000,
  rides: 120_000,
  hustle: 100_000,
  bigman: 1_000_000,
  naija: 500_000,
};

/** Detective cases, the catalogue base (a ladder bonus the browser adds is not paid online). */
export const CASE_CASH: Record<string, number> = {
  'case-suya-money': 40_000,
  'case-agbada': 90_000,
  'case-saxophone': 120_000,
  'case-fake-doctor': 200_000,
  'case-owambe': 150_000,
};

export const AGAMA_CAP = 40;

/** The nth agama caught (1 to 40), matching the album. */
export function agamaPay(n: number): number {
  if (n === AGAMA_CAP) return 500_000;
  if (n % 10 === 0) return 50_000;
  return 2_000;
}

/** Tip for a finished shift: 30% at three stars, 15% at two, nothing otherwise, to the nearest ₦50. */
export function tipFor(pay: number, stars: number): number {
  const rate = stars === 3 ? 0.3 : stars === 2 ? 0.15 : 0;
  return Math.round((pay * rate) / 50) * 50;
}

export interface TakingsQuote {
  pay: number;
  memo: string;
  clock: { typeId: string; startedAt: number; paidUntil: number };
}

/**
 * What a finished building owes, from the catalogue and the server's clock.
 * A type the server has not seen on this plot can accrue from when it was finished, and at most a week.
 * A type it has paid before accrues only since that pay. A different type starts again from now.
 */
export function quoteTakings(
  plotId: string,
  typeId: string,
  clientStarted: number,
  recorded: { typeId: string; startedAt: number; paidUntil: number } | null,
  now: number,
): { ok: true } & TakingsQuote | { ok: false; reason: string; clock?: TakingsQuote['clock'] } {
  const plot = ALL_PLOTS.find((p) => p.id === plotId);
  if (!plot) return { ok: false, reason: 'There is no such plot.' };
  const type = buildingType(typeId);
  if (!type) return { ok: false, reason: 'That building is not one the server knows.' };
  if (!plot.uses.includes(type.use) || type.floors > plot.maxFloors) return { ok: false, reason: 'That building is not allowed on this plot.' };
  const net = type.incomePerDay - type.upkeepPerDay;
  if (net <= 0) return { ok: false, reason: 'This building does not earn money.' };
  if (!Number.isFinite(clientStarted)) return { ok: false, reason: 'That building has no start date.' };

  if (recorded && recorded.typeId !== type.id) {
    return { ok: false, reason: 'Nothing has come in yet.', clock: { typeId: type.id, startedAt: Math.min(now, clientStarted), paidUntil: now } };
  }
  const startedAt = recorded ? recorded.startedAt : Math.min(now, clientStarted);
  const finished = startedAt + type.hours * MS_PER_GAME_HOUR;
  if (now < finished) return { ok: false, reason: 'That building is not finished.' };
  const since = recorded ? Math.max(recorded.paidUntil, finished) : finished;
  if (now - since < MS_PER_GAME_HOUR) return { ok: false, reason: 'Nothing has come in yet.' };
  const days = Math.min(MAX_DAYS_HELD, (now - since) / MS_PER_GAME_DAY);
  const pay = Math.floor((days * net) / 100) * 100;
  if (pay <= 0) return { ok: false, reason: 'Nothing has come in yet.' };
  return { ok: true, pay, memo: `${type.name} at ${plot.name}`, clock: { typeId: type.id, startedAt, paidUntil: now } };
}

/** The plot as a place to stand, or null if the id is not a plot. */
export function plotOf(plotId: string) {
  return ALL_PLOTS.find((p) => p.id === plotId) ?? null;
}
