import { BackendService } from '../../backend/BackendService';
import type { PhoneMessage } from '../../backend/types';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { standingWith, type Standing } from '../../interactions/Social';
import { NetworkManager } from '../../multiplayer/NetworkManager';

/** Someone the player can write to. */
export interface Contact {
  /** The key their conversation is kept under */
  id: string;
  name: string;
  kind: 'person' | 'player';
  /** How well they know the player (people in the city), or that they are online now (players) */
  note: string;
  standing: Standing | 'player';
  unread: number;
  last: PhoneMessage | null;
}

const REPLIES: Record<Standing, string[]> = {
  stranger: [
    'Who be this, abeg?',
    'Ok. I don see your message.',
    'I dey busy now. We go talk when I see you.',
  ],
  acquaintance: [
    'Ah, na you! How far? I dey my usual place.',
    'No wahala. Pass through when you dey around.',
    'I see am. Greet your people for me.',
  ],
  friend: [
    'My person! I been dey think about you. Come see me today.',
    'Correct! Anything for you. When you dey come?',
    'Na you I dey wait for. No dull, show face.',
  ],
};

const REPLY_SECONDS = 2.5;

/**
 * Text messages. The people a player can write to are the people they have actually met in
 * the city (anyone who knows their face), plus the other players online now.
 *
 * Conversations with people in the city are kept in the saved game. Conversations with other
 * players go straight to that player and nobody else, and last for the session: there are no
 * accounts yet for them to be stored against.
 */
export class MessageService {
  public onChange: (() => void) | null = null;
  private readonly backend = BackendService.getInstance();
  private readonly director = InteractionDirector.get();
  private clock: () => string = () => '';
  private pending: Array<{ id: string; text: string; in: number }> = [];
  /** Conversations with other players, by their session id */
  private playerThreads = new Map<string, { messages: PhoneMessage[]; unread: number; name: string }>();

  public connect(clock: () => string): void {
    this.clock = clock;
    NetworkManager.getInstance()?.setOnDirectMessage((fromId, fromName, text) => {
      const thread = this.playerThread(fromId, fromName);
      thread.messages.push({ from: 'them', text, at: this.clock() });
      thread.unread += 1;
      this.changed();
    });
  }

  private playerThread(id: string, name: string): { messages: PhoneMessage[]; unread: number; name: string } {
    let thread = this.playerThreads.get(id);
    if (!thread) {
      thread = { messages: [], unread: 0, name };
      this.playerThreads.set(id, thread);
    }
    thread.name = name;
    return thread;
  }

  /** Everyone the player can write to: other players first, then the people they know best. */
  public contacts(): Contact[] {
    const list: Contact[] = [];
    const net = NetworkManager.getInstance();
    const online = new Set<string>();
    net?.remotePlayers.forEach((player, id) => {
      online.add(id);
      const thread = this.playerThreads.get(id);
      list.push({
        id: `player:${id}`, name: `@${player.name}`, kind: 'player', note: 'Online now', standing: 'player',
        unread: thread?.unread ?? 0, last: thread?.messages[thread.messages.length - 1] ?? null,
      });
    });
    // Players who have gone offline keep their conversation on screen until the game is closed
    for (const [id, thread] of this.playerThreads) {
      if (online.has(id)) continue;
      list.push({
        id: `player:${id}`, name: `@${thread.name}`, kind: 'player', note: 'Offline', standing: 'player',
        unread: thread.unread, last: thread.messages[thread.messages.length - 1] ?? null,
      });
    }

    const data = this.backend.getData();
    const known = Object.entries(data.relationships ?? {})
      .filter(([, level]) => level > 0)
      .sort((a, b) => b[1] - a[1]);
    for (const [actorId] of known) {
      const actor = this.director.actorFor(actorId);
      if (!actor) continue;
      const standing = standingWith(actor);
      const thread = this.backend.thread(actorId);
      list.push({
        id: actorId,
        name: actor.name.split('(')[0].trim(),
        kind: 'person',
        note: standing === 'friend' ? 'Friend' : standing === 'acquaintance' ? 'Knows you' : 'You have met',
        standing,
        unread: thread.unread,
        last: thread.messages[thread.messages.length - 1] ?? null,
      });
    }
    return list;
  }

  public contact(id: string): Contact | null {
    return this.contacts().find((entry) => entry.id === id) ?? null;
  }

  public thread(id: string): PhoneMessage[] {
    if (id.startsWith('player:')) return this.playerThreads.get(id.slice(7))?.messages ?? [];
    return this.backend.thread(id).messages;
  }

  public unread(): number {
    let total = this.backend.unreadMessages();
    for (const thread of this.playerThreads.values()) total += thread.unread;
    return total;
  }

  public markRead(id: string): void {
    if (id.startsWith('player:')) {
      const thread = this.playerThreads.get(id.slice(7));
      if (thread && thread.unread > 0) {
        thread.unread = 0;
        this.changed();
      }
      return;
    }
    this.backend.markThreadRead(id);
  }

  /** Sends a message. Returns why it could not be sent, or null if it was. */
  public send(id: string, text: string): string | null {
    const body = text.trim().slice(0, 240);
    if (!body) return 'Type a message first.';
    const contact = this.contact(id);
    if (!contact) return 'That person is not in your contacts.';

    if (contact.kind === 'player') {
      const playerId = id.slice(7);
      const net = NetworkManager.getInstance();
      if (!net || !net.remotePlayers.has(playerId)) return `${contact.name} is offline, so the message was not sent.`;
      net.sendDirectMessage(playerId, body);
      this.playerThread(playerId, contact.name.slice(1)).messages.push({ from: 'me', text: body, at: this.clock() });
      this.changed();
      return null;
    }

    this.backend.addMessage(id, { from: 'me', text: body, at: this.clock() }, false);
    const lines = REPLIES[contact.standing as Standing];
    this.pending.push({ id, text: lines[Math.floor(Math.random() * lines.length)], in: REPLY_SECONDS });
    this.changed();
    return null;
  }

  public update(delta: number): void {
    if (this.pending.length === 0) return;
    for (const reply of this.pending) reply.in -= delta;
    const due = this.pending.filter((reply) => reply.in <= 0);
    if (due.length === 0) return;
    this.pending = this.pending.filter((reply) => reply.in > 0);
    for (const reply of due) {
      this.backend.addMessage(reply.id, { from: 'them', text: reply.text, at: this.clock() }, true);
    }
    this.changed();
  }

  private changed(): void {
    this.onChange?.();
  }
}
