import { Hustles, TIER_XP, type HustleView } from '../life/Hustles';
import { Ladder, RUNGS } from '../life/Ladder';
import { Album, CARDS, SETS, AGAMAS, SELL_PRICE, type Card } from '../life/Album';
import { esc, naira } from './kit/html';

/**
 * Today: the screen a player opens every day. The day's three hustles and the streak, the
 * Sunday chest, the life ladder from Mushin to Banana Island, the Naija Album with its packs
 * to open, and the season's track. A chip on the HUD shows the streak and how many hustles
 * are done, and lights up when there is a pack to open.
 */

type Tab = 'today' | 'ladder' | 'album' | 'season';

const KIND: Record<string, { label: string; tone: string }> = {
  grind: { label: 'GRIND', tone: '#f59e0b' },
  life: { label: 'LIFE', tone: '#10b981' },
  link: { label: 'LINK-UP', tone: '#ec4899' },
};
const RARITY: Record<string, [string, string]> = {
  common: ['#334155', '#64748b'], rare: ['#1e3a8a', '#3b82f6'], epic: ['#581c87', '#a855f7'], legend: ['#78350f', '#f59e0b'],
};

const CSS = `
#today-panel{position:fixed;inset:0;z-index:8600;display:none;background:radial-gradient(120% 80% at 50% -10%,#1e3a5f 0%,#0b1220 55%,#060a12 100%);color:#e5e7eb;font-family:var(--nl-font, 'Outfit', system-ui, sans-serif);overflow:hidden}
#today-panel.open{display:flex;flex-direction:column;animation:tp-in .28s cubic-bezier(.2,1.2,.4,1)}
@keyframes tp-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.tp-head{display:flex;align-items:center;gap:10px;padding:14px 16px 8px}
.tp-head h2{margin:0;font:400 24px var(--nl-font-display,'Righteous',sans-serif);letter-spacing:.5px;flex:1;background:linear-gradient(90deg,#fde68a,#f59e0b);-webkit-background-clip:text;background-clip:text;color:transparent}
.tp-x{width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;font-size:18px}
.tp-tabs{display:flex;gap:6px;padding:0 12px 10px}
.tp-tab{flex:1;padding:9px 4px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:#cbd5e1;font-weight:700;font-size:13px;position:relative}
.tp-tab.on{background:linear-gradient(135deg,#f59e0b,#ea580c);color:#1c1917;border-color:transparent;box-shadow:0 6px 18px rgba(245,158,11,.35)}
.tp-tab .dot{position:absolute;top:4px;right:6px;width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444}
.tp-body{flex:1;overflow-y:auto;padding:4px 14px 90px;-webkit-overflow-scrolling:touch}
.tp-hero{border-radius:20px;padding:16px;background:linear-gradient(135deg,#7c2d12,#ea580c 55%,#f59e0b);color:#fff7ed;box-shadow:0 10px 30px rgba(234,88,12,.35);display:flex;align-items:center;gap:14px;margin-bottom:12px}
.tp-flame{font-size:46px;filter:drop-shadow(0 0 12px rgba(253,224,71,.8));animation:tp-flick 1.6s ease-in-out infinite}
@keyframes tp-flick{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.08) rotate(2deg)}}
.tp-hero b{display:block;font:400 26px var(--nl-font-display,'Righteous',sans-serif)}
.tp-hero span{font-size:13px;opacity:.92}
.tp-card{border-radius:18px;padding:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);margin-bottom:10px;position:relative;overflow:hidden}
.tp-card.done{background:linear-gradient(135deg,rgba(16,185,129,.18),rgba(255,255,255,.05));border-color:rgba(16,185,129,.5)}
.tp-row{display:flex;align-items:center;gap:12px}
.tp-ico{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:24px;background:rgba(255,255,255,.08);flex:none}
.tp-kind{font-size:10px;font-weight:800;letter-spacing:1.4px}
.tp-title{font-weight:700;font-size:15px;margin:2px 0 6px}
.tp-bar{height:8px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}
.tp-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#f59e0b,#fde047);transition:width .5s}
.tp-meta{display:flex;justify-content:space-between;font-size:12px;color:#94a3b8;margin-top:5px}
.tp-tick{position:absolute;right:12px;top:12px;font-size:20px}
.tp-sec{font-size:12px;font-weight:800;letter-spacing:1.5px;color:#94a3b8;margin:16px 2px 8px;text-transform:uppercase}
.tp-btn{border:0;border-radius:12px;padding:10px 14px;font-weight:800;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#1c1917}
.tp-btn[disabled]{opacity:.45}
.tp-btn.ghost{background:rgba(255,255,255,.1);color:#e5e7eb}
.tp-rung{display:block;padding:12px;border-radius:16px;margin-bottom:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.tp-rung.got{background:linear-gradient(135deg,rgba(245,158,11,.22),rgba(255,255,255,.04));border-color:rgba(245,158,11,.45)}
.tp-rung.here{outline:2px solid #fde047;box-shadow:0 0 22px rgba(253,224,71,.35)}
.tp-rung.lock{opacity:.6}
.tp-rung .n{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:rgba(255,255,255,.1);flex:none}
.tp-rung.got .n{background:#f59e0b;color:#1c1917}
.tp-goal{display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0}
.tp-goal .bar{flex:1}
.tp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.tp-cardface{aspect-ratio:3/4;border-radius:12px;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;border:1px solid rgba(255,255,255,.15);font-size:11px;line-height:1.15}
.tp-cardface .big{font-size:30px;margin-bottom:4px}
.tp-cardface.miss{background:repeating-linear-gradient(135deg,#0f172a 0 8px,#111a2e 8px 16px);color:#475569}
.tp-cardface .x{position:absolute;top:4px;right:6px;font-weight:800;font-size:11px;background:rgba(0,0,0,.4);border-radius:8px;padding:0 5px}
.tp-cardface .sell{position:absolute;bottom:4px;left:4px;right:4px;border:0;border-radius:8px;font-size:10px;font-weight:800;padding:3px;background:rgba(0,0,0,.45);color:#fde68a}
.tp-cardface.legend{box-shadow:0 0 16px rgba(245,158,11,.6)}
.tp-tier{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04);margin-bottom:6px}
.tp-tier.got{background:rgba(245,158,11,.14)}
.tp-tier .t{width:36px;font-weight:800;color:#fbbf24}
#tp-reveal{position:fixed;inset:0;z-index:8700;background:rgba(2,6,23,.88);display:none;align-items:center;justify-content:center;flex-direction:column;gap:18px}
#tp-reveal.open{display:flex}
.tp-flip{display:flex;gap:10px}
.tp-flip .tp-cardface{width:96px;opacity:0;transform:rotateY(90deg) scale(.7);transition:transform .45s cubic-bezier(.2,1.4,.4,1),opacity .3s}
.tp-flip .tp-cardface.show{opacity:1;transform:none}
#hud-today-chip{position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 118px);z-index:5200;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(253,224,71,.5);background:linear-gradient(135deg,rgba(124,45,18,.92),rgba(234,88,12,.92));color:#fff7ed;font-weight:800;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
#hud-today-chip .pk{background:#ef4444;border-radius:99px;padding:1px 6px;animation:tp-flick 1.2s infinite}
@media (min-width:701px){#hud-today-chip{display:none}}
body[data-ui-mode="transit"] #hud-today-chip,body[data-ui-mode="map"] #hud-today-chip,body.ui-modal-open #hud-today-chip{display:none}
`;

export class TodayPanel {
  private readonly el: HTMLDivElement;
  private readonly chip: HTMLButtonElement;
  private readonly reveal: HTMLDivElement;
  private tab: Tab = 'today';
  private scrollToRung = false;
  private isOpen = false;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.id = 'today-panel';
    document.body.appendChild(this.el);
    this.reveal = document.createElement('div');
    this.reveal.id = 'tp-reveal';
    document.body.appendChild(this.reveal);
    this.chip = document.createElement('button');
    this.chip.id = 'hud-today-chip';
    this.chip.type = 'button';
    this.chip.addEventListener('click', () => this.open());
    document.body.appendChild(this.chip);
    this.el.addEventListener('click', (e) => this.onClick(e));
    const redraw = () => { this.drawChip(); if (this.isOpen) this.render(); };
    Hustles.get().subscribe(redraw);
    Album.get().subscribe(redraw);
    Ladder.get().subscribe(redraw);
    this.drawChip();
  }

  public open(tab: Tab = this.tab): void {
    this.tab = tab;
    this.scrollToRung = tab === 'ladder';
    this.isOpen = true;
    this.el.classList.add('open');
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.el.classList.remove('open');
  }

  public get opened(): boolean {
    return this.isOpen;
  }

  private drawChip(): void {
    const h = Hustles.get();
    const packs = Album.get().packs;
    this.chip.innerHTML = `🔥 ${h.streak} <span style="opacity:.6">·</span> ${h.doneToday}/3 today${packs ? ` <span class="pk">🃏${packs}</span>` : ''}`;
    this.chip.title = "Today's hustle, the ladder and your album";
  }

  private render(): void {
    const tabs: Array<[Tab, string, boolean]> = [
      ['today', '🔥 Today', Hustles.get().chest().ready],
      ['ladder', '🧗 Ladder', false],
      ['album', '🃏 Album', Album.get().packs > 0],
      ['season', '⭐ Season', Hustles.get().season().tiers.some((t) => t.reached && !t.claimed)],
    ];
    const body = this.tab === 'today' ? this.today() : this.tab === 'ladder' ? this.ladder() : this.tab === 'album' ? this.album() : this.season();
    const scroll = this.el.querySelector('.tp-body')?.scrollTop ?? 0;
    this.el.innerHTML = `
      <div class="tp-head"><h2>${this.tab === 'album' ? 'Naija Album' : this.tab === 'ladder' ? 'Life Ladder' : this.tab === 'season' ? esc(Hustles.get().seasonName) : "Today's Hustle"}</h2><button class="tp-x" data-act="close" aria-label="Close">✕</button></div>
      <div class="tp-tabs">${tabs.map(([id, label, dot]) => `<button class="tp-tab${id === this.tab ? ' on' : ''}" data-tab="${id}">${label}${dot ? '<span class="dot"></span>' : ''}</button>`).join('')}</div>
      <div class="tp-body" id="tp-body-${this.tab}">${body}</div>`;
    const b = this.el.querySelector<HTMLElement>('.tp-body');
    if (b) b.scrollTop = scroll;
    // The ladder opens where the player stands on it
    if (b && this.tab === 'ladder' && this.scrollToRung) {
      this.scrollToRung = false;
      const here = b.querySelector<HTMLElement>('.tp-rung.here');
      if (here) b.scrollTop = Math.max(0, here.offsetTop - b.offsetTop - 140);
    }
  }

  private hustleCard(h: HustleView): string {
    const k = KIND[h.kind];
    const pct = Math.round((h.progress / h.goal) * 100);
    const amount = (n: number) => (h.unit === '₦' ? naira(n) : h.unit ? `${Math.round(n)} ${h.unit}` : `${Math.round(n)}`);
    return `<div class="tp-card${h.done ? ' done' : ''}" data-hustle="${h.id}">
      ${h.done ? '<span class="tp-tick">✅</span>' : ''}
      <div class="tp-row"><div class="tp-ico">${h.icon}</div><div style="flex:1;min-width:0">
        <div class="tp-kind" style="color:${k.tone}">${k.label}</div>
        <div class="tp-title">${esc(h.title)}</div>
        <div class="tp-bar"><i style="width:${pct}%"></i></div>
        <div class="tp-meta"><span>${amount(h.progress)} / ${amount(h.goal)}</span><span>+${naira(h.reward)}</span></div>
      </div></div></div>`;
  }

  private today(): string {
    const h = Hustles.get();
    const list = h.hustles();
    const chest = h.chest();
    const s = h.season();
    const lad = Ladder.get();
    const next = lad.next;
    const goals = next ? lad.progress(next) : [];
    return `
      <div class="tp-hero"><div class="tp-flame">🔥</div><div><b>${h.streak}-day streak</b><span>${h.streak ? 'Do one hustle a day to keep it burning' : 'Do one hustle today to light your streak'} · best ${h.bestStreak}</span></div></div>
      ${list.map((x) => this.hustleCard(x)).join('')}
      <div class="tp-meta" style="margin:-2px 4px 6px"><span>All three today: bonus cash + 🃏 a card pack</span><span>${h.doneToday}/3</span></div>
      <div class="tp-sec">Sunday chest</div>
      <div class="tp-card"><div class="tp-row"><div class="tp-ico">🎁</div><div style="flex:1">
        <div class="tp-title">${chest.opened ? 'Opened this week' : chest.ready ? 'Ready to open!' : `${chest.days}/${chest.need} full days this week`}</div>
        <div class="tp-bar"><i style="width:${Math.min(100, (chest.days / chest.need) * 100)}%"></i></div>
        <div class="tp-meta"><span>Finish all three hustles on 3 days, open it on Sunday</span></div>
      </div>${chest.ready ? '<button class="tp-btn" data-act="chest" id="tp-open-chest">Open</button>' : ''}</div></div>
      <div class="tp-sec">${esc(s.name)} · tier ${s.tier} · ${s.daysLeft} days left</div>
      <div class="tp-card" data-tab="season" style="cursor:pointer"><div class="tp-bar"><i style="width:${(s.intoTier / TIER_XP) * 100}%"></i></div><div class="tp-meta"><span>${s.intoTier}/${TIER_XP} XP to tier ${Math.min(40, s.tier + 1)}</span><span>View track ›</span></div></div>
      <div class="tp-sec">Your life · ${esc(lad.current.area)}</div>
      <div class="tp-card" data-tab="ladder" style="cursor:pointer"><div class="tp-row"><div class="tp-ico">${lad.current.icon}</div><div style="flex:1">
        <div class="tp-title">${esc(lad.current.title)} in ${esc(lad.current.area)}</div>
        <div class="tp-meta"><span>${next ? `Next: ${esc(next.area)} · ${goals.filter((g) => g.done).length}/${goals.length} goals` : 'You are at the top of Lagos'}</span><span>›</span></div>
      </div></div></div>
      ${Album.get().packs ? `<div class="tp-card" style="border-color:#ef4444"><div class="tp-row"><div class="tp-ico">🃏</div><div style="flex:1"><div class="tp-title">${Album.get().packs} card pack${Album.get().packs === 1 ? '' : 's'} to open</div></div><button class="tp-btn" data-act="pack" id="tp-open-pack">Open</button></div></div>` : ''}`;
  }

  private ladder(): string {
    const lad = Ladder.get();
    const here = lad.rung;
    return [...RUNGS].reverse().map((r) => {
      const got = r.n <= here;
      const isNext = r.n === here + 1;
      const goals = isNext ? lad.progress(r) : [];
      return `<div class="tp-rung${got ? ' got' : ' lock'}${r.n === here ? ' here' : ''}" style="${isNext ? 'opacity:1;display:block' : ''}">
        <div class="tp-row"><div class="n">${r.n === here ? '📍' : r.n + 1}</div><div class="tp-ico" style="width:40px;height:40px;font-size:22px">${r.icon}</div>
          <div style="flex:1"><div class="tp-title" style="margin:0">${esc(r.area)}${r.n === here ? ' · you are here' : ''}</div><div class="tp-meta" style="margin:2px 0 0"><span>${esc(r.title)} · ${esc(r.line)}</span></div></div>
          ${r.reward && !got ? `<div style="font-size:12px;color:#fbbf24;font-weight:800">${naira(r.reward)}</div>` : ''}</div>
        ${goals.map((g) => `<div class="tp-goal">${g.done ? '✅' : '⬜'} <span style="flex:1.4">${esc(g.label)}</span><div class="tp-bar bar"><i style="width:${Math.min(100, (g.have / g.need) * 100)}%"></i></div></div>`).join('')}
      </div>`;
    }).join('');
  }

  private face(card: Card, owned: number, withSell = false): string {
    const [a, b] = RARITY[card.rarity];
    if (!owned) return `<div class="tp-cardface miss" title="${esc(card.how)}"><div class="big">❔</div><b>${esc(card.name)}</b><span style="margin-top:3px">${esc(card.how)}</span></div>`;
    return `<div class="tp-cardface ${card.rarity}" style="background:linear-gradient(160deg,${a},${b})"><div class="big">${card.icon}</div><b>${esc(card.name)}</b><span style="opacity:.8;margin-top:2px;text-transform:capitalize">${card.rarity}</span>${owned > 1 ? `<span class="x">×${owned}</span>` : ''}${withSell && owned > 1 ? `<button class="sell" data-sell="${card.id}">Sell spare ${naira(SELL_PRICE[card.rarity])}</button>` : ''}</div>`;
  }

  private album(): string {
    const al = Album.get();
    return `
      <div class="tp-hero" style="background:linear-gradient(135deg,#1e1b4b,#6d28d9 55%,#db2777)"><div class="tp-flame">🃏</div><div><b>${al.owned}/${CARDS.length} cards</b><span>🦎 ${al.agamas}/${AGAMAS} agamas caught on the walls of Lagos</span></div>
        ${al.packs ? `<button class="tp-btn" data-act="pack" id="tp-open-pack" style="margin-left:auto">Open pack (${al.packs})</button>` : ''}</div>
      ${SETS.map((s) => {
        const cards = CARDS.filter((c) => c.set === s.id);
        const have = cards.filter((c) => al.count(c.id)).length;
        return `<div class="tp-sec">${s.icon} ${esc(s.name)} · ${have}/${cards.length} ${al.setDone(s.id) ? '✅' : `· set pays ${naira(s.reward)}`}</div>
          <div class="tp-grid">${cards.map((c) => this.face(c, al.count(c.id), true)).join('')}</div>`;
      }).join('')}`;
  }

  private season(): string {
    const s = Hustles.get().season();
    return `
      <div class="tp-hero" style="background:linear-gradient(135deg,#0f766e,#0891b2 55%,#6366f1)"><div class="tp-flame">⭐</div><div><b>Tier ${s.tier}/40</b><span>${s.xp.toLocaleString()} XP · ${s.daysLeft} days left in ${esc(s.name)}</span></div></div>
      <div class="tp-meta" style="margin:0 4px 10px"><span>XP from hustles, new places, cards, agamas, the ladder, games and cases</span></div>
      ${s.tiers.map((t) => `<div class="tp-tier${t.reached ? ' got' : ''}"><span class="t">${t.tier}</span><span style="flex:1;font-size:13px">${esc(t.reward)}</span>${t.claimed ? '<span>✅</span>' : t.reached ? `<button class="tp-btn" data-claim="${t.tier}">Claim</button>` : '<span style="opacity:.4">🔒</span>'}</div>`).join('')}`;
  }

  /** Three cards turned over one after another */
  public showPack(cards: Card[]): void {
    if (!cards.length) return;
    this.reveal.innerHTML = `<div style="font:400 26px var(--nl-font-display,'Righteous',sans-serif);color:#fde68a">Card pack</div><div class="tp-flip">${cards.map((c) => this.face(c, 1)).join('')}</div><button class="tp-btn" id="tp-reveal-done">Nice one!</button>`;
    this.reveal.classList.add('open');
    this.reveal.querySelectorAll('.tp-cardface').forEach((f, i) => setTimeout(() => f.classList.add('show'), 250 + i * 420));
    this.reveal.querySelector('#tp-reveal-done')?.addEventListener('click', () => this.reveal.classList.remove('open'));
  }

  private onClick(event: MouseEvent): void {
    const t = event.target as HTMLElement;
    const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab as Tab | undefined;
    if (tab) { this.tab = tab; this.scrollToRung = tab === 'ladder'; this.render(); return; }
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'close') this.close();
    else if (act === 'chest') Hustles.get().openChest();
    else if (act === 'pack') this.showPack(Album.get().openPack());
    const claim = t.closest<HTMLElement>('[data-claim]')?.dataset.claim;
    if (claim) Hustles.get().claimTier(parseInt(claim, 10));
    const sell = t.closest<HTMLElement>('[data-sell]')?.dataset.sell;
    if (sell) Album.get().sellSpare(sell);
  }
}
