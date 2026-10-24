import { esc, naira } from './kit/html';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';
import { credibility, type PublicProfile } from '../social/Profile';
import { BAE_AT, FEE_MAX, FEE_MIN, ROLES, Ties, type HireRole, type Offer } from '../social/Ties';

export interface ProfileHooks {
  /** This player's own id and their card as others see it */
  me(): { id: string; profile: PublicProfile };
  /** Another player now: their card (if they have sent it) and where they are and what they are doing */
  other(id: string): { name: string; profile: PublicProfile | null; where: string } | null;
  sendMessage(toId: string, text: string): void;
  sendTie(toId: string, kind: 'family_ask' | 'family_yes' | 'family_no' | 'bae_ask' | 'bae_yes' | 'bae_no'): void;
  sendOffer(offer: Offer): void;
  sendOfferUpdate(toId: string, id: string, state: 'accepted' | 'declined' | 'done' | 'paid', rating?: number): void;
  /** Pays another player from the bank; returns why not, or null */
  pay(toId: string, amount: number, memo: string): string | null;
  openLook(): void;
}

type View =
  | { kind: 'card'; id: string | null }
  | { kind: 'cv'; id: string | null }
  | { kind: 'hire'; id: string }
  | { kind: 'jobs' }
  | { kind: 'ask'; fromId: string; fromName: string; what: 'family' | 'bae' }
  | { kind: 'offer'; offerId: string };

const WHEN = [['now', 'Now'], ['1h', 'In 1h'], ['3h', 'In 3h'], ['6h', 'In 6h'], ['tomorrow', 'Tomorrow']] as const;
const SKIN = ['#8d5524', '#5c3722', '#4a2c1d', '#3b2416', '#6b4423'];

/**
 * Another player's card, as Lagos players know it: chat, family, bae, their hustle rating, how
 * far they can be trusted, their level, their CV, and hiring them for a job. The same sheet shows
 * the player's own card, the jobs they have been offered or have offered, and answers to requests.
 */
export class ProfileSheet {
  private readonly el: HTMLDivElement;
  private readonly hooks: ProfileHooks;
  private readonly ties = Ties.get();
  private view: View = { kind: 'card', id: null };
  private hire = { role: 'decorator' as HireRole, details: '', fee: '', budget: '', when: 'now' };
  private stars = 5;

  constructor(hooks: ProfileHooks) {
    this.hooks = hooks;
    this.el = document.createElement('div');
    this.el.id = 'profile-sheet';
    this.el.className = 'cat-sheet profile-sheet';
    this.el.setAttribute('role', 'dialog');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    this.el.addEventListener('input', (event) => {
      const t = event.target as HTMLInputElement;
      if (t.dataset.field) (this.hire as Record<string, string>)[t.dataset.field] = t.value;
    });
    this.ties.onChange(() => this.isOpen && this.view.kind !== 'hire' && this.render());
    UIStateManager.getInstance().registerModal('profile', { id: 'profile', close: () => this.close(), isOpen: () => this.isOpen });
  }

  public get isOpen(): boolean {
    return this.el.style.display !== 'none';
  }

  /** Opens a player's card: another player's by id, or this player's own with null */
  public open(id: string | null = null): void {
    this.show({ kind: 'card', id });
  }

  public openJobs(): void {
    this.show({ kind: 'jobs' });
  }

  /** Someone asks to be family or bae */
  public ask(fromId: string, fromName: string, what: 'family' | 'bae'): void {
    this.show({ kind: 'ask', fromId, fromName, what });
  }

  /** A job has been offered to this player */
  public offered(offer: Offer): void {
    this.show({ kind: 'offer', offerId: offer.id });
  }

  private show(view: View): void {
    this.view = view;
    this.render();
    if (this.isOpen) return;
    this.el.style.display = 'flex';
    UIStateManager.getInstance().pushModal('profile');
  }

  public close(): void {
    if (!this.isOpen) return;
    this.el.style.display = 'none';
    UIStateManager.getInstance().popModal('profile');
  }

  private face(name: string, profile: PublicProfile | null): string {
    const skin = profile?.skin ?? SKIN[(name.charCodeAt(0) || 0) % SKIN.length];
    const shirt = `#${(profile?.outfit ?? 0x16a34a).toString(16).padStart(6, '0')}`;
    return `<span class="pf-face" style="--skin:${esc(skin)};--shirt:${shirt}" aria-hidden="true"><i></i><b></b></span>`;
  }

  private since(profile: PublicProfile): string {
    const d = new Date(profile.since);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  }

  private head(title: string, sub: string, name: string, profile: PublicProfile | null, back = false): string {
    return `<div class="cat-grab" aria-hidden="true"></div>
      <div class="pf-head">${back ? '<button class="cat-round" data-back aria-label="Back">‹</button>' : ''}${this.face(name, profile)}
        <div class="pf-title"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>
        <button class="cat-round" data-close aria-label="Close">✕</button></div>`;
  }

  private render(): void {
    const v = this.view;
    if (v.kind === 'card') this.el.innerHTML = this.renderCard(v.id);
    else if (v.kind === 'cv') this.el.innerHTML = this.renderCv(v.id);
    else if (v.kind === 'hire') this.el.innerHTML = this.renderHire(v.id);
    else if (v.kind === 'jobs') this.el.innerHTML = this.renderJobs();
    else if (v.kind === 'ask') this.el.innerHTML = this.renderAsk(v);
    else this.el.innerHTML = this.renderOffer(v.offerId);
  }

  private renderCard(id: string | null): string {
    const mine = id === null;
    const me = this.hooks.me();
    const other = mine ? null : this.hooks.other(id!);
    if (!mine && !other) return `${this.head('Not here', 'They have gone', '?', null)}<div class="cat-body"><p class="cat-empty">That player is no longer online.</p></div>`;
    const name = mine ? me.profile.name : other!.name;
    const p = mine ? me.profile : other!.profile;
    const sub = mine ? 'This is how other players see you' : other!.where;
    const rating = p?.hustle.rating ? `★${p.hustle.rating.toFixed(1)} (${p.hustle.ratings})` : 'Not rated yet';
    const hustleLine = p ? `${rating} · ${p.hustle.done} job${p.hustle.done === 1 ? '' : 's'} done` : '…';
    const chips = p ? `<div class="pf-chips"><span class="pf-level pf-${p.tier.toLowerCase()}">Lv ${p.level} · ${esc(p.tier)}</span>${p.since ? `<span class="pf-chip">🎖️ Since ${esc(this.since(p))}</span>` : ''}${p.bae ? `<span class="pf-chip">💘 ${esc(p.bae)}</span>` : ''}</div>` : '';
    let actions = '';
    if (mine) {
      actions = `
        <button class="cat-go pf-wide" data-jobs>🧰 My hustle · jobs offered and given</button>
        <div class="pf-pair"><button class="pf-btn" data-cv>📄 View CV</button><button class="pf-btn" data-look>🧍 Change my look</button></div>
        <label class="pf-row pf-toggle"><span>🚔 Show my criminal record on my CV</span><input type="checkbox" data-record ${this.ties.recordPublic ? 'checked' : ''}></label>`;
    } else {
      const close = this.ties.closeness(id!);
      const family = this.ties.isFamily(id!);
      const bae = this.ties.bae()?.id === id;
      actions = `
        <div class="pf-chat"><input class="fleet-input" data-chat maxlength="200" placeholder="Say something to @${esc(name)}"><button class="cat-go" data-send>💬 Chat</button></div>
        ${bae ? '<div class="pf-row">💘 Your bae</div>' : close >= BAE_AT ? '<button class="pf-btn pf-wide pf-bae" data-bae>💘 Ask to be my Bae</button>' : `<div class="pf-row pf-muted">💘 <b>Ask to be my Bae</b> opens when you are closer (${close}/${BAE_AT}). Chat, gist and hang out more.</div>`}
        ${family ? '<div class="pf-row">👪 Family</div>' : '<button class="pf-btn pf-wide" data-family>👪 Add as family</button>'}`;
    }
    const rows = p ? `
      <div class="pf-row"><span>🧰 Hustle</span><em>${esc(hustleLine)}</em></div>
      <div class="pf-row"><span>💳 Credibility</span><em class="pf-cred">📈 ${esc(credibility(p.cred))}</em></div>
      ${p.family.length ? `<div class="pf-row"><span>👪 Family</span><em>${esc(p.family.slice(0, 3).map((f) => `@${f}`).join(', '))}${p.family.length > 3 ? '…' : ''}</em></div>` : ''}` : '<p class="music-note">Their card is on its way…</p>';
    const more = mine ? '' : `<div class="pf-pair"><button class="pf-btn" data-cv>📄 View CV</button><button class="pf-btn" data-hire>🧰 Hire for a job</button></div>
      <button class="pf-btn pf-wide" data-money>💸 Send ₦10,000</button>`;
    return `${this.head(`@${name}`, sub, name, p)}<div class="cat-body pf-body">${actions}${rows}${chips}${more}</div>`;
  }

  private renderCv(id: string | null): string {
    const mine = id === null;
    const p = mine ? this.hooks.me().profile : this.hooks.other(id!)?.profile ?? null;
    const name = p?.name ?? 'Player';
    if (!p) return `${this.head(`@${name}'s CV`, '', name, null, true)}<div class="cat-body"><p class="cat-empty">Their CV has not come through yet.</p></div>`;
    const work = p.work.length
      ? p.work.map((w) => `<div class="pf-cvrow"><span>💼</span><div><strong>${esc(w.title)}</strong><em>${esc(w.place)} · ${w.done} shift${w.done === 1 ? '' : 's'}</em></div>${w.current ? '<b class="pf-current">Current</b>' : ''}</div>`).join('')
      : '<p class="music-note">No job yet.</p>';
    const roles = Object.entries(p.hustle.roles).map(([role, n]) => `${ROLES.find((r) => r.id === role)?.icon ?? '🧰'} ${ROLES.find((r) => r.id === role)?.name ?? role} ×${n}`).join(' · ');
    const hustle = p.hustle.done ? `<div class="pf-cvrow"><span>🧰</span><div><strong>Hustle jobs done for other players</strong><em>${esc(roles)}${p.hustle.rating ? ` · ★${p.hustle.rating.toFixed(1)}` : ''}</em></div></div>` : '';
    const education = p.education.length ? p.education.map((e) => `<div class="pf-cvrow"><span>🎓</span><div><strong>${esc(e)}</strong></div></div>`).join('') : '<p class="music-note">No degree or certificates yet.</p>';
    const record = p.record === null
      ? `<p class="music-note">🔒 @${esc(name)} keeps this private.</p>`
      : p.record.length ? p.record.map((r) => `<div class="pf-cvrow"><span>🚔</span><div><em>${esc(r)}</em></div></div>`).join('') : '<p class="music-note">Clean. Nothing on record.</p>';
    return `${this.head(`@${name}'s CV`, 'Jobs, education and record, from the game’s own records', name, p, true)}
      <div class="cat-body pf-body">
        <p class="music-note">In NigeriaLife since ${esc(this.since(p))}. Built from the game’s own records, not what anyone typed.</p>
        <section class="pf-section"><h4>💼 WORK</h4>${work}${hustle}</section>
        <section class="pf-section"><h4>🎓 EDUCATION</h4>${education}</section>
        <section class="pf-section"><h4>🚔 CRIMINAL RECORD</h4>${record}</section>
      </div>`;
  }

  private renderHire(id: string): string {
    const other = this.hooks.other(id);
    const name = other?.name ?? 'them';
    const role = ROLES.find((r) => r.id === this.hire.role)!;
    return `${this.head(`Hire @${name}`, 'They get a message to accept or say no', name, other?.profile ?? null, true)}
      <div class="cat-body pf-body">
        <h4 class="cat-h">What do you need @${esc(name)} to do?</h4>
        <div class="pf-roles">${ROLES.map((r) => `<button class="pf-role${r.id === this.hire.role ? ' is-on' : ''}" data-role="${r.id}">${r.icon} ${esc(r.name)}</button>`).join('')}</div>
        <input class="fleet-input" data-field="details" maxlength="140" placeholder="${esc(role.hint)} (add details, optional)" value="${esc(this.hire.details)}">
        <input class="fleet-input" data-field="fee" inputmode="numeric" placeholder="Fee (₦1,000 to ₦10,000,000)" value="${esc(this.hire.fee)}">
        <input class="fleet-input" data-field="budget" inputmode="numeric" placeholder="Budget for things they buy (optional)" value="${esc(this.hire.budget)}">
        <p class="music-note">The fee is paid when they say the job is done and you agree. Never share your password: hire through jobs.</p>
        <div class="pf-roles">${WHEN.map(([w, label]) => `<button class="pf-role${w === this.hire.when ? ' is-on' : ''}" data-when="${w}">${label}</button>`).join('')}</div>
        <button class="cat-go pf-wide" data-offer>Send the offer</button>
      </div>`;
  }

  private renderJobs(): string {
    const me = this.hooks.me();
    const offers = this.ties.offers();
    const row = (o: Offer) => {
      const mine = o.workerId === me.id;
      const role = ROLES.find((r) => r.id === o.role);
      const who = mine ? `From @${o.employerName}` : `For @${o.workerName}`;
      let action = `<span class="pump-full">${o.state === 'paid' ? `Paid${o.rating ? ` · ★${o.rating}` : ''}` : o.state === 'declined' ? 'Declined' : o.state === 'done' ? 'Waiting for payment' : o.state === 'accepted' ? 'On it' : 'Waiting'}</span>`;
      if (mine && o.state === 'offered') action = `<button class="cat-go pump-fill" data-open-offer="${esc(o.id)}">Answer</button>`;
      else if (mine && o.state === 'accepted') action = `<button class="cat-go pump-fill" data-done="${esc(o.id)}">Mark done</button>`;
      else if (!mine && o.state === 'done') action = `<button class="cat-go pump-fill" data-pay="${esc(o.id)}">Pay ${naira(o.fee)}</button>`;
      return `<div class="pump-row"><span class="pump-icon">${role?.icon ?? '🧰'}</span><span class="pump-text"><strong>${esc(role?.name ?? 'Job')} · ${naira(o.fee)}</strong><em>${esc(who)}${o.details ? ` · ${esc(o.details)}` : ''}</em></span>${action}</div>`;
    };
    const paying = offers.find((o) => o.state === 'done' && o.employerId === me.id);
    const stars = paying ? `<div class="pf-stars">Rate the work: ${[1, 2, 3, 4, 5].map((n) => `<button class="pf-star${n <= this.stars ? ' is-on' : ''}" data-stars="${n}">★</button>`).join('')}</div>` : '';
    return `${this.head('My hustle', 'Jobs you were offered and jobs you gave', me.profile.name, me.profile, true)}
      <div class="cat-body pump-body">${stars}${offers.length ? offers.map(row).join('') : '<p class="cat-empty">No jobs yet. Tap another player and choose Hire for a job, or wait for an offer.</p>'}</div>`;
  }

  private renderAsk(v: Extract<View, { kind: 'ask' }>): string {
    const text = v.what === 'family' ? `@${v.fromName} wants to add you as family.` : `@${v.fromName} is asking you to be their bae 💘`;
    return `${this.head(v.what === 'family' ? 'Family request' : 'Bae request', text, v.fromName, this.hooks.other(v.fromId)?.profile ?? null)}
      <div class="cat-body pf-body"><p class="music-note">${esc(text)}</p>
        <div class="pf-pair"><button class="pf-btn" data-tie-no>Not now</button><button class="cat-go" data-tie-yes>${v.what === 'family' ? '👪 Accept' : '💘 Yes'}</button></div></div>`;
  }

  private renderOffer(id: string): string {
    const o = this.ties.offer(id);
    if (!o) return `${this.head('Job offer', '', '?', null)}<div class="cat-body"><p class="cat-empty">That offer is gone.</p></div>`;
    const role = ROLES.find((r) => r.id === o.role);
    const when = WHEN.find(([w]) => w === o.when)?.[1] ?? 'Now';
    return `${this.head('Job offer', `From @${o.employerName}`, o.employerName, this.hooks.other(o.employerId)?.profile ?? null)}
      <div class="cat-body pf-body">
        <div class="pf-row"><span>${role?.icon ?? '🧰'} ${esc(role?.name ?? 'Job')}</span><em>${esc(when)}</em></div>
        ${o.details ? `<p class="music-note">“${esc(o.details)}”</p>` : ''}
        <div class="pf-row"><span>Fee</span><em>${naira(o.fee)}</em></div>
        ${o.budget ? `<div class="pf-row"><span>Budget for things</span><em>${naira(o.budget)}</em></div>` : ''}
        ${o.state === 'offered' ? `<div class="pf-pair"><button class="pf-btn" data-decline="${esc(o.id)}">No, thanks</button><button class="cat-go" data-accept="${esc(o.id)}">Accept the job</button></div>` : `<p class="music-note">You ${o.state === 'declined' ? 'said no to' : 'took'} this job.</p>`}
      </div>`;
  }

  private onClick(event: MouseEvent): void {
    const t = (event.target as HTMLElement).closest<HTMLElement>('button, input[type="checkbox"]');
    if (!t) return;
    const v = this.view;
    const d = t.dataset;
    const me = this.hooks.me();
    if ('close' in d) return this.close();
    if ('back' in d) {
      const id = v.kind === 'cv' || v.kind === 'hire' ? v.id : null;
      return this.show({ kind: 'card', id: id ?? null });
    }
    if ('record' in d) {
      this.ties.setRecordPublic((t as HTMLInputElement).checked);
      return;
    }
    if ('look' in d) {
      this.close();
      this.hooks.openLook();
      return;
    }
    if ('jobs' in d) return this.show({ kind: 'jobs' });
    if ('cv' in d && v.kind === 'card') return this.show({ kind: 'cv', id: v.id });
    if ('hire' in d && v.kind === 'card' && v.id) {
      this.hire = { role: 'decorator', details: '', fee: '', budget: '', when: 'now' };
      return this.show({ kind: 'hire', id: v.id });
    }
    if (d.role) {
      this.hire.role = d.role as HireRole;
      return this.render();
    }
    if (d.when) {
      this.hire.when = d.when;
      return this.render();
    }
    if (v.kind === 'card' && v.id) {
      const other = this.hooks.other(v.id);
      const name = other?.name ?? 'them';
      if ('send' in d) {
        const input = this.el.querySelector<HTMLInputElement>('[data-chat]');
        const text = input?.value.trim() ?? '';
        if (!text) return;
        this.hooks.sendMessage(v.id, text);
        this.ties.grow(v.id, name, 3);
        if (input) input.value = '';
        showGameToast(`💬 Sent to @${name}.`, 'success', 2400);
        return;
      }
      if ('family' in d) {
        this.hooks.sendTie(v.id, 'family_ask');
        showGameToast(`👪 Asked @${name} to be family. They will say.`, 'info', 3200);
        return;
      }
      if ('bae' in d) {
        this.hooks.sendTie(v.id, 'bae_ask');
        showGameToast(`💘 You asked @${name}. Fingers crossed!`, 'info', 3200);
        return;
      }
      if ('money' in d) {
        const refused = this.hooks.pay(v.id, 10000, 'Gift');
        if (refused) showGameToast(refused, 'warning', 3600);
        return;
      }
    }
    if ('offer' in d && v.kind === 'hire') {
      const fee = Math.round(Number(String(this.hire.fee).replace(/[^0-9]/g, '')));
      const budget = Math.round(Number(String(this.hire.budget).replace(/[^0-9]/g, '')) || 0);
      if (!Number.isFinite(fee) || fee < FEE_MIN || fee > FEE_MAX) {
        showGameToast(`The fee must be between ${naira(FEE_MIN)} and ${naira(FEE_MAX)}.`, 'warning', 3600);
        return;
      }
      const other = this.hooks.other(v.id);
      if (!other) {
        showGameToast('They are no longer online.', 'warning');
        return;
      }
      const offer: Offer = {
        id: `job_${me.id}_${Date.now().toString(36)}`, employerId: me.id, employerName: me.profile.name, workerId: v.id, workerName: other.name,
        role: this.hire.role, details: this.hire.details.trim().slice(0, 140), fee, budget: Math.max(0, Math.min(FEE_MAX, budget)), when: this.hire.when, at: Date.now(), state: 'offered',
      };
      this.ties.keep(offer);
      this.hooks.sendOffer(offer);
      showGameToast(`🧰 Offer sent to @${other.name}: ${ROLES.find((r) => r.id === offer.role)?.name}, ${naira(fee)}.`, 'success', 3600);
      return this.show({ kind: 'jobs' });
    }
    if (v.kind === 'ask') {
      const yes = 'tieYes' in d;
      if (!yes && !('tieNo' in d)) return;
      if (yes) {
        if (v.what === 'family') this.ties.addFamily(v.fromId, v.fromName);
        else this.ties.setBae(v.fromId, v.fromName);
      }
      this.hooks.sendTie(v.fromId, `${v.what}_${yes ? 'yes' : 'no'}` as 'family_yes');
      showGameToast(yes ? (v.what === 'family' ? `👪 @${v.fromName} is family now.` : `💘 You and @${v.fromName}!`) : 'You said not now.', 'info', 3200);
      return this.close();
    }
    if (d.openOffer) return this.show({ kind: 'offer', offerId: d.openOffer });
    if (d.accept || d.decline) {
      const id = (d.accept ?? d.decline)!;
      const o = this.ties.advance(id, d.accept ? 'accepted' : 'declined');
      if (o) {
        this.hooks.sendOfferUpdate(o.employerId, o.id, o.state as 'accepted');
        showGameToast(d.accept ? `🧰 You took the job from @${o.employerName}. Mark it done in My hustle when it is finished.` : 'You said no to the job.', 'info', 4200);
      }
      return this.show({ kind: 'jobs' });
    }
    if (d.done) {
      const o = this.ties.advance(d.done, 'done');
      if (o) {
        this.hooks.sendOfferUpdate(o.employerId, o.id, 'done');
        showGameToast(`✅ You told @${o.employerName} the job is done. They pay ${naira(o.fee)} when they agree.`, 'success', 4200);
      }
      return this.render();
    }
    if (d.stars) {
      this.stars = Number(d.stars);
      return this.render();
    }
    if (d.pay) {
      const o = this.ties.offer(d.pay);
      if (!o || o.state !== 'done') return;
      const refused = this.hooks.pay(o.workerId, o.fee, `${ROLES.find((r) => r.id === o.role)?.name ?? 'Job'} for @${o.employerName}`);
      if (refused) {
        showGameToast(refused, 'warning', 4200);
        return;
      }
      this.ties.advance(o.id, 'paid', this.stars);
      this.ties.grow(o.workerId, o.workerName, 8);
      this.hooks.sendOfferUpdate(o.workerId, o.id, 'paid', this.stars);
      showGameToast(`💸 Paid @${o.workerName} ${naira(o.fee)} and rated ★${this.stars}.`, 'success', 3600);
      return this.render();
    }
  }
}
