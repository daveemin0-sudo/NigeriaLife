/**
 * Which local player this tab is playing as.
 *
 * A browser normally holds one player, "main", whose saved game lives under the storage keys
 * the game has always used. Every tab opened on that player is the same person: the tabs share
 * one save and follow each other.
 *
 * A second, separate player can be opened in another tab by adding `?player=<name>` to the
 * address. That player has their own saved game, character and quests, so two tabs can be two
 * different people who see each other in the city and trade with each other.
 *
 * This is still one browser on one device. Nothing here is a server: a profile is not an
 * account anyone has to log in to, and anyone at this computer can open any of them.
 */

function readProfile(): string {
  try {
    const asked = new URLSearchParams(window.location.search).get('player') ?? '';
    const clean = asked.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    return clean && clean !== 'main' ? clean : 'main';
  } catch {
    return 'main';
  }
}

export const PROFILE_ID = readProfile();

/** The storage key this player's copy of something is kept under. The main player keeps the original keys. */
export function profileKey(base: string): string {
  return PROFILE_ID === 'main' ? base : `${base}__player_${PROFILE_ID}`;
}
