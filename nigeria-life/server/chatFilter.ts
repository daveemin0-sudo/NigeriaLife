/**
 * Masks abusive words in chat before anyone else sees them. A starting list in English, Pidgin,
 * Yoruba, Igbo and Hausa: it needs reviewing by native speakers before launch, and the admin
 * page's reports are how missing words are found. Matching ignores case, spacing tricks
 * ("f u c k"), repeated letters and common letter swaps (0 for o, 1 for i, @ for a, $ for s).
 */
const WORDS = [
  // English
  'fuck', 'fucker', 'motherfucker', 'shit', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard',
  // Nigerian Pidgin and English as it is used in Nigeria
  'ashawo', 'olodo', 'werey', 'oloriburuku',
  // Yoruba
  'oloshi', 'omoale', 'didirin', 'apoda',
  // Igbo
  'onyeara', 'onyenzuzu',
  // Hausa
  'daniska', 'shege', 'danbanza', 'karuwa',
];
// Left out on purpose: short words that are ordinary in some language ("were" in English, "oko"
// husband in Yoruba, "otu" one in Igbo, "ewu" goat): matching them would mask innocent chat.

const SWAPS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', '$': 's', '5': 's', '7': 't', '!': 'i' };

/** The text reduced to plain letters: what the words are matched against */
function letters(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9@$!]/g, (c) => SWAPS[c] ?? c)
    .replace(/[^a-z\u00c0-\u024f]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}

const PLAIN = WORDS.map((w) => letters(w)).filter((w) => w.length >= 3);

/**
 * Masks whole words that are abusive. Two-word insults are matched joined ("dan iska"), and so
 * are letters spelt out one at a time ("f u c k"). Only whole words: a name like Dickson is left alone.
 */
export function filterChat(text: string): { text: string; masked: number } {
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
  const tokens = clean.split(/(\s+)/);
  const bad = (word: string) => PLAIN.includes(letters(word));
  let masked = 0;
  const mask = (i: number) => {
    tokens[i] = '*'.repeat(Math.min(8, tokens[i].length));
  };
  const words = tokens.map((t, i) => ({ t, i })).filter((w) => w.t.trim() !== '');
  for (let w = 0; w < words.length; w++) {
    // One word, or this word and the next together
    if (bad(words[w].t)) {
      mask(words[w].i);
      masked++;
      continue;
    }
    if (w + 1 < words.length && bad(words[w].t + words[w + 1].t)) {
      mask(words[w].i);
      mask(words[w + 1].i);
      masked++;
      w++;
      continue;
    }
    // A run of single letters spelling a word out
    let end = w;
    while (end < words.length && letters(words[end].t).length === 1) end++;
    if (end - w >= 3 && PLAIN.includes(words.slice(w, end).map((x) => letters(x.t)).join(''))) {
      for (let k = w; k < end; k++) mask(words[k].i);
      masked++;
      w = end - 1;
    }
  }
  return { text: tokens.join(''), masked };
}
