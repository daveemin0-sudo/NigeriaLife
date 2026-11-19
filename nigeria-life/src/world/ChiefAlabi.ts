/**
 * Chief Alabi, the elder who sits on Broad Street, and what he makes of the player.
 *
 * The first time someone greets him he asks who they are: this is where a new player gives their
 * name (no form: they tell an elder). How they answer (with respect, with
 * street talk, or giving little away) is remembered for good: he greets them by it ever after and
 * the street remembers them as someone he knows. What he tells them is true of their game right
 * now: whether Amaka's site is working at this hour or only the port is, whether they have already
 * earned, whether they have a roof. He gives advice, not money.
 */
import { profileKey } from '../backend/Profile';

const KEY = profileKey('nl_chief_alabi_v1');

export type Answer = 'respect' | 'street' | 'guarded';

export interface ElderMemory {
  met: number;
  answer: Answer;
  /** Did they tell him their name, or did he have to give them one? */
  told: boolean;
  visits: number;
}

export interface ElderHost {
  /** The player's name as the street knows it */
  name(): string;
  siteOpen(): boolean;
  timesPaid(): number;
  hasHome(): boolean;
  /**
   * Shows a line of his with replies to choose from (none: a single "continue"). With `askName`
   * there is a place under his words to type a name.
   */
  speak(text: string, replies: Array<{ label: string; run: () => void }>, onClose?: () => void, askName?: boolean): void;
  /** What was typed as a name at his question ('' if nothing) */
  typedName(): string;
  /** The player takes this name; returns it as kept */
  rename(name: string): string;
  /** The friendship with him grows (Ties) */
  warm(by: number): void;
}

export function elderMemory(): ElderMemory | null {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) || 'null');
    return kept && typeof kept.met === 'number' && ['respect', 'street', 'guarded'].includes(kept.answer) ? kept : null;
  } catch {
    return null;
  }
}

function remember(memory: ElderMemory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Kept for this visit only
  }
}

/** What he says about work, true of this hour and this player */
function aboutWork(host: ElderHost): string {
  if (host.timesPaid() > 0) return 'I saw you sweating for your money already. Good. Sweat is the first rent Lagos collects, and you have paid it.';
  if (host.siteOpen()) return 'Amaka is raising the new plaza across the road, the Eko Mega Plaza site. She pays a day\'s money for one course of blocks to anybody with strong arms and no shame. Tell her Alabi sent you.';
  return 'Amaka\'s site has knocked off for the day. But the port down Wharf Road never sleeps. Foreman Sunday takes hands on by the lorry, day or night.';
}

function aboutHome(host: ElderHost): string {
  if (host.hasHome()) return 'And you have a roof already. Keep it well.';
  return 'When night falls, the estate office by that gate lets rooms, and there are cheaper ones on the Mainland. Do not let night meet you without a roof.';
}

/** A line for the card when he is next tapped, from what he remembers */
export function elderCard(memory: ElderMemory | null, name: string): string {
  if (!memory) return '"Welcome my child. Broad Street has seen many generations come and go. Maintain your peace of mind and integrity as you hustle in this vibrant city."';
  if (memory.answer === 'respect') return `"${name}! My well-trained child. You greeted me properly the day you arrived, I have not forgotten."`;
  if (memory.answer === 'street') return `"Ah, '${name}, how far Chief!' Lagos has not finished you yet? Good."`;
  return `"${name}, the one who was 'just looking around'. Have you seen enough of Lagos now?"`;
}

/** He calls out like this when a player he knows comes near */
export function elderHello(memory: ElderMemory, name: string): string {
  return memory.answer === 'respect' ? `${name}, my child! Come and greet me.` : memory.answer === 'street' ? `How far, ${name}! You have forgotten me?` : `${name}! Still looking around?`;
}

/** A name as he will hear it: letters, numbers and a few marks, 2 to 16 long ('' if it is not one) */
export function heardName(typed: string): string {
  const name = typed.replace(/[^\p{L}\p{N} _.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
  return name.length >= 2 ? name : '';
}

/** The conversation after a greeting: the first meeting, or a word with someone he knows */
export function talkToElder(host: ElderHost, done: () => void): void {
  const known = elderMemory();
  if (known) {
    known.visits += 1;
    remember(known);
    host.warm(2);
    const who = host.name();
    const opener = known.answer === 'respect' ? `${who}, my child. You came back to greet me, that is how it is done.` : known.answer === 'street' ? `${who}! "How far, Chief" has come again. How the hustle?` : `${who}. You have stopped "just looking", I hope?`;
    host.speak(`${opener} ${aboutWork(host)}`, [], done);
    return;
  }
  const answered = (answer: Answer, reply: (name: string, told: boolean) => string, warmth: number) => () => {
    // The name they gave him is theirs from now on; given none, he gives them the one they came with
    const typed = heardName(host.typedName());
    const name = typed ? host.rename(typed) : host.name();
    remember({ met: Date.now(), answer, told: typed !== '', visits: 1 });
    host.warm(warmth);
    host.speak(`${reply(name, typed !== '')} ${aboutWork(host)}`, [
      {
        label: answer === 'street' ? 'I go try am. Thank you, Chief.' : 'Thank you, sir.',
        run: () => host.speak(`${aboutHome(host)} Go well, ${name}. When you pass this way, greet me.`, [], done),
      },
    ], done);
  };
  host.speak(
    'Ehen. Welcome, my child. I have sat on this street since before they tarred it, and I know every face on it. Yours is new. Who are you, and what brought you to Lagos?',
    [
      { label: 'Good day, sir. I came to make something of myself.', run: answered('respect', (name, told) => `${told ? `${name}.` : `No name? Then you are ${name} to me, like my late brother.`} A child who greets well will never lack a helper in this city. Hold on to that.`, 6) },
      { label: 'How far, Chief! Na hustle bring me.', run: answered('street', (name, told) => `Hah! "How far, Chief!" Lagos has entered your mouth already, ${told ? name : `whoever you are. I will call you ${name}`}. But hustle without direction is just running.`, 4) },
      { label: 'I am just looking around.', run: answered('guarded', (name, told) => `Just looking. Hm. ${told ? `Look well, then, ${name}.` : `And no name for an old man. I will call you ${name}.`} Lagos shows every newcomer two faces, and you will need to know them both.`, 2) },
    ],
    undefined,
    true,
  );
}
