import { esc, naira } from './kit/html';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';
import { CABINET_ROLES, OFFICES, POLICIES, Politics, RALLY } from '../politics/Politics';
import { MY_ID, Registry } from '../realestate/Registry';
import type { OfficeId } from '../realestate/types';

export interface StateHouseHooks {
  /** This player's name, for the ballot */
  name(): string;
  /** Players about, whom a governor may name to the cabinet */
  knownPlayers(): Array<{ id: string; name: string }>;
}

/** Where the sheet was opened: at Government House (pay is collected), at the polling unit (votes are cast), or from anywhere (to read) */
export type StateHouseMode = 'house' | 'polling' | 'view';

/**
 * Lagos State House: who governs, who represents Lagos in the Senate and who is President, the
 * law each has made, the cabinet, and this week's election. Votes are cast only at the polling
 * unit; pay is collected only at Government House.
 */
export class StateHouseSheet {
  private readonly el: HTMLDivElement;
  private readonly hooks: StateHouseHooks;
  private readonly politics = Politics.get();
  private tab: OfficeId = 'governor';
  private mode: StateHouseMode = 'view';
  private standing: { slogan: string; policy: string } | null = null;
  private busy = false;

  constructor(hooks: StateHouseHooks) {
    this.hooks = hooks;
    this.el = document.createElement('div');
    this.el.id = 'state-house';
    this.el.className = 'cat-sheet state-house';
    this.el.setAttribute('role', 'dialog');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => void this.onClick(event));
    this.el.addEventListener('input', (event) => {
      const t = event.target as HTMLInputElement;
      if (t.dataset.slogan !== undefined && this.standing) this.standing.slogan = t.value;
    });
    Registry.get().subscribe(() => this.isOpen && !this.standing && this.render());
    // The governor names someone to a post
    this.el.addEventListener('change', async (event) => {
      const t = event.target as HTMLSelectElement;
      if (t.dataset.appoint === undefined || !t.value) return;
      const done = await this.politics.appoint(t.dataset.appoint, t.dataset.name ?? 'player', t.value);
      showGameToast(done.ok ? `📁 @${t.dataset.name} is now ${t.value}.` : done.reason ?? 'Not done.', done.ok ? 'success' : 'warning', 3600);
      this.render();
    });
    UIStateManager.getInstance().registerModal('state-house', { id: 'state-house', close: () => this.close(), isOpen: () => this.isOpen });
  }

  public get isOpen(): boolean {
    return this.el.style.display !== 'none';
  }

  public open(mode: StateHouseMode = 'view', tab: OfficeId = 'governor'): void {
    this.mode = mode;
    this.tab = tab;
    this.standing = null;
    void this.politics.refresh().then(() => this.isOpen && this.render());
    this.render();
    if (this.isOpen) return;
    this.el.style.display = 'flex';
    UIStateManager.getInstance().pushModal('state-house');
  }

  public close(): void {
    if (!this.isOpen) return;
    this.el.style.display = 'none';
    UIStateManager.getInstance().popModal('state-house');
  }

  private left(): string {
    const ms = Math.max(0, this.politics.closesAt() - this.politics.now());
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    return d ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  }

  private render(): void {
    const office = OFFICES.find((o) => o.id === this.tab)!;
    const holder = this.politics.holder(this.tab);
    const policy = holder ? POLICIES.find((p) => p.id === holder.policy) : null;
    const tabs = OFFICES.map((o) => `<button class="cat-tab${o.id === this.tab ? ' is-on' : ''}" data-tab="${o.id}">${o.icon} ${o.id === 'governor' ? 'Governor' : o.id === 'senator' ? 'Senator' : 'President'}</button>`).join('');
    const held = holder
      ? `<div class="sh-holder">
          <span class="sh-kicker">${esc(office.title.toUpperCase())} · THIS WEEK</span>
          <strong>@${esc(holder.name)}</strong>
          <em>“${esc(holder.slogan)}” · ${holder.votes.toLocaleString()} votes</em>
          ${policy ? `<div class="sh-law">💼 <b>${esc(policy.name)}</b> · ${esc(policy.does)}</div>` : ''}
        </div>`
      : `<div class="sh-holder sh-empty"><span class="sh-kicker">${esc(office.title.toUpperCase())}</span><strong>No one yet</strong><em>The first election is under way: the winner takes office when the week ends.</em></div>`;
    const cabinet = this.tab === 'governor' ? this.renderCabinet(holder?.id === MY_ID) : '';
    const standing = this.politics.isStanding(this.tab);
    const voted = this.politics.hasVoted(this.tab);
    const ballot = this.politics.candidates(this.tab).map((c) => {
      const law = POLICIES.find((p) => p.id === c.policy);
      const vote = this.mode === 'polling' && !voted ? `<button class="cat-go pump-fill" data-vote="${esc(c.id)}">Vote</button>` : `<span class="pump-full">${c.votes} vote${c.votes === 1 ? '' : 's'}</span>`;
      return `<div class="pump-row"><span class="pump-icon">${c.id === MY_ID ? '⭐' : c.id.startsWith('npc:') ? '🎙️' : '🗳️'}</span><span class="pump-text"><strong>${esc(c.name)}</strong><em>“${esc(c.slogan)}” · ${esc(law?.name ?? '')}</em></span>${vote}</div>`;
    }).join('');
    const voteNote = this.mode === 'polling' ? (voted ? '<p class="music-note">✅ You have voted for this office this week.</p>' : '<p class="music-note">One vote for each office, each week. Thumb in the ink.</p>') : '<p class="music-note">🗳️ Votes are cast at Polling Unit 001, on the island side of the expressway.</p>';
    let run: string;
    if (this.standing) {
      run = `<div class="sh-form"><h4 class="cat-h">Stand for ${esc(office.title)}</h4>
        <input class="fleet-input" data-slogan maxlength="60" placeholder="Your slogan" value="${esc(this.standing.slogan)}">
        <div class="pf-roles">${POLICIES.filter((p) => p.office === this.tab).map((p) => `<button class="pf-role${p.id === this.standing!.policy ? ' is-on' : ''}" data-policy="${p.id}">${esc(p.name)}</button>`).join('')}</div>
        <p class="music-note">${esc(POLICIES.find((p) => p.id === this.standing!.policy)?.does ?? '')}</p>
        <div class="pf-pair"><button class="pf-btn" data-cancel>Not now</button><button class="cat-go" data-stand ${this.busy ? 'disabled' : ''}>Pay ${naira(office.fee)} and stand</button></div></div>`;
    } else if (standing) {
      run = `<button class="cat-go pf-wide" data-rally ${this.busy ? 'disabled' : ''}>📣 Hold a rally · ${naira(RALLY.cost)} (+${RALLY.votes} votes)</button>`;
    } else {
      run = `<button class="pf-btn pf-wide" data-run>🗳️ Run for ${esc(office.title)} · ${naira(office.fee)} nomination form</button>`;
    }
    const due = this.mode === 'house' ? this.politics.due() : [];
    const collect = due.length ? `<button class="cat-go pf-wide" data-collect ${this.busy ? 'disabled' : ''}>💰 Collect ${naira(due.reduce((s, d) => s + d.amount, 0))} · ${esc(due.map((d) => d.label).join(', '))}</button>` : '';
    this.el.innerHTML = `
      <div class="cat-grab" aria-hidden="true"></div>
      <div class="cat-head"><div class="cat-title"><strong>🏛️ Lagos State House</strong><span class="cat-wallet">Governor, laws and the weekly election</span></div><button class="cat-round" data-close aria-label="Close">✕</button></div>
      <div class="cat-tabs">${tabs}</div>
      <div class="cat-body pf-body">
        ${collect}${held}${cabinet}
        <section class="pf-section"><h4>🗳️ THIS WEEK'S ELECTION · closes in ${esc(this.left())}</h4>${voteNote}${ballot}</section>
        ${run}
      </div>`;
  }

  private renderCabinet(governor: boolean): string {
    const cabinet = this.politics.state().cabinet ?? [];
    const rows = cabinet.length ? cabinet.map((c) => `<div class="pf-cvrow"><span>📁</span><div><strong>@${esc(c.name)}</strong><em>${esc(c.role)}</em></div></div>`).join('') : '<p class="music-note">No commissioners named yet.</p>';
    const name = governor
      ? `<div class="sh-appoint">${this.hooks.knownPlayers().slice(0, 6).map((p) => `<div class="pf-row"><span>@${esc(p.name)}</span><select data-appoint="${esc(p.id)}" data-name="${esc(p.name)}"><option value="">Name to…</option>${CABINET_ROLES.map((r) => `<option>${esc(r)}</option>`).join('')}</select></div>`).join('') || '<p class="music-note">Players near you can be named to your cabinet.</p>'}</div>`
      : '';
    return `<section class="pf-section"><h4>📁 THE CABINET</h4>${rows}${name}</section>`;
  }

  private async onClick(event: MouseEvent): Promise<void> {
    const t = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || this.busy) return;
    const d = t.dataset;
    if ('close' in d) return this.close();
    if (d.tab) {
      this.tab = d.tab as OfficeId;
      this.standing = null;
      return this.render();
    }
    if ('run' in d) {
      this.standing = { slogan: '', policy: POLICIES.find((p) => p.office === this.tab)!.id };
      return this.render();
    }
    if ('cancel' in d) {
      this.standing = null;
      return this.render();
    }
    if (d.policy && this.standing) {
      this.standing.policy = d.policy;
      return this.render();
    }
    const act = async (job: () => Promise<{ ok: boolean; reason?: string; amount?: number }>, said: (r: { amount?: number }) => string) => {
      this.busy = true;
      this.render();
      const result: { ok: boolean; reason?: string; amount?: number } = await job().catch(() => ({ ok: false, reason: 'That could not be done just now.' }));
      this.busy = false;
      showGameToast(result.ok ? said(result) : result.reason ?? 'Not done.', result.ok ? 'success' : 'warning', 4000);
      this.render();
    };
    if ('stand' in d && this.standing) {
      const s = this.standing;
      this.standing = null;
      return act(() => this.politics.stand(this.tab, this.hooks.name(), s.slogan, s.policy), () => `🗳️ You are on the ballot. Campaign hard: the votes are counted when the week ends.`);
    }
    if ('rally' in d) return act(() => this.politics.rally(this.tab), () => `📣 The rally filled the square: ${RALLY.votes} more votes.`);
    if (d.vote) return act(() => this.politics.vote(this.tab, d.vote!), () => '🗳️ Thumb in the ink, ballot in the box. Your vote is counted.');
    if ('collect' in d) return act(() => this.politics.collect(), (r) => `💰 ${naira(r.amount ?? 0)} paid into your bank.`);
  }
}
