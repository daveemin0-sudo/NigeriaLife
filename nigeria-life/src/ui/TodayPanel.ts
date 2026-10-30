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
#today-panel{position:fixed;inset:0;z-index:8600;display:none;background:#f3f5f4;color:#0f1a14;font-family:var(--nl-font, 'Outfit', system-ui, sans-serif);overflow:hidden}
#today-panel.open{display:flex;flex-direction:column;animation:tp-in .32s cubic-bezier(.16,1,.3,1)}
@keyframes tp-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.tp-head{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 16px) 16px 10px}
.tp-head h2{margin:0;font:800 26px/1.1 var(--nl-font);letter-spacing:-.02em;flex:1;color:#0f1a14}
.tp-x{width:38px;height:38px;border-radius:50%;border:1px solid rgba(15,26,20,.08);background:#fff;color:#66736c;font-size:16px;box-shadow:0 2px 6px rgba(12,28,20,.08);cursor:pointer}
.tp-tabs{display:flex;gap:4px;margin:0 14px 12px;padding:4px;border-radius:14px;background:#e6ebe8}
.tp-tab{flex:1;padding:9px 4px;border-radius:11px;border:0;background:transparent;color:#66736c;font:700 13px var(--nl-font);position:relative;cursor:pointer;transition:background .2s,color .2s}
.tp-tab.on{background:#fff;color:#0f1a14;font-weight:800;box-shadow:0 3px 10px rgba(12,28,20,.14),0 1px 2px rgba(12,28,20,.08)}
.tp-tab .dot{position:absolute;top:5px;right:7px;width:8px;height:8px;border-radius:50%;background:#e11d48;box-shadow:0 0 0 2px #fff}
.tp-body{flex:1;overflow-y:auto;padding:2px 14px 90px;-webkit-overflow-scrolling:touch}
.tp-hero{position:relative;overflow:hidden;border-radius:24px;padding:18px;background:linear-gradient(140deg,#f2cf6b 0%,#d9a93a 45%,#a8761a 100%);color:#2a1c04;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 14px 30px rgba(168,118,26,.3);display:flex;align-items:center;gap:14px;margin-bottom:14px}
.tp-hero::after{content:'';position:absolute;right:-50px;top:-70px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.35),rgba(255,255,255,0) 70%);pointer-events:none}
.tp-flame{font-size:44px;width:64px;height:64px;border-radius:20px;display:grid;place-items:center;background:rgba(255,255,255,.35);flex:none;animation:tp-flick 1.6s ease-in-out infinite}
@keyframes tp-flick{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.06) rotate(2deg)}}
.tp-hero b{display:block;font:800 26px/1.1 var(--nl-font);letter-spacing:-.02em;color:#1f1503}
.tp-hero span{font-size:13px;font-weight:600;color:#4a3608}
.tp-card{border-radius:20px;padding:14px;background:#fff;border:1px solid rgba(15,26,20,.07);box-shadow:0 1px 2px rgba(12,28,20,.04),0 6px 16px rgba(12,28,20,.05);margin-bottom:10px;position:relative;overflow:hidden}
.tp-card.done{background:linear-gradient(135deg,#e6f4ec,#fff 70%);border-color:rgba(14,122,78,.35)}
.tp-row{display:flex;align-items:center;gap:12px}
.tp-ico{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:24px;background:#eef1ef;flex:none}
.tp-kind{font-size:10px;font-weight:800;letter-spacing:1.2px}
.tp-title{font-weight:800;font-size:15px;margin:2px 0 7px;color:#0f1a14;letter-spacing:-.01em}
.tp-bar{height:8px;border-radius:99px;background:#e6ebe8;overflow:hidden}
.tp-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#17ab6c,#0e7a4e);transition:width .5s}
.tp-meta{display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#66736c;margin-top:6px}
.tp-tick{position:absolute;right:12px;top:12px;font-size:20px}
.tp-sec{font-size:11.5px;font-weight:800;letter-spacing:1.2px;color:#66736c;margin:18px 2px 8px;text-transform:uppercase}
.tp-btn{border:0;border-radius:14px;padding:11px 16px;font:800 14px var(--nl-font);background:linear-gradient(135deg,#17ab6c,#0e7a4e 55%,#095c3a);color:#fff;box-shadow:0 8px 18px rgba(14,122,78,.26);cursor:pointer}
.tp-btn[disabled]{opacity:.45;box-shadow:none}
.tp-btn.ghost{background:#fff;color:#0f1a14;border:1px solid rgba(15,26,20,.1);box-shadow:0 1px 2px rgba(12,28,20,.06)}
.tp-rung{display:block;padding:12px;border-radius:18px;margin-bottom:8px;background:#fff;border:1px solid rgba(15,26,20,.07);box-shadow:0 1px 2px rgba(12,28,20,.04)}
.tp-rung.got{background:linear-gradient(135deg,#fbf2dd,#fff 70%);border-color:rgba(195,143,34,.4)}
.tp-rung.here{outline:2px solid #0e7a4e;outline-offset:1px;box-shadow:0 8px 22px rgba(14,122,78,.18)}
.tp-rung.lock{opacity:.6}
.tp-rung .n{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:#eef1ef;color:#2f3a34;flex:none}
.tp-rung.got .n{background:linear-gradient(135deg,#f2cf6b,#c38f22);color:#2a1c04}
.tp-goal{display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0;color:#2f3a34}
.tp-goal .bar{flex:1}
.tp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.tp-cardface{aspect-ratio:3/4;border-radius:14px;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;border:1px solid rgba(255,255,255,.4);font-size:11px;line-height:1.15;color:#fff;box-shadow:0 6px 14px rgba(12,28,20,.16)}
.tp-cardface .big{font-size:30px;margin-bottom:4px}
.tp-cardface.miss{background:repeating-linear-gradient(135deg,#eef1ef 0 8px,#e6ebe8 8px 16px);color:#9aa59f;border-color:rgba(15,26,20,.06);box-shadow:none}
.tp-cardface .x{position:absolute;top:4px;right:6px;font-weight:800;font-size:11px;background:rgba(0,0,0,.28);border-radius:8px;padding:0 5px}
.tp-cardface .sell{position:absolute;bottom:4px;left:4px;right:4px;border:0;border-radius:8px;font-size:10px;font-weight:800;padding:3px;background:rgba(255,255,255,.9);color:#7a5410}
.tp-cardface.legend{box-shadow:0 0 0 2px #f2cf6b,0 8px 20px rgba(195,143,34,.45)}
.tp-tier{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:#fff;border:1px solid rgba(15,26,20,.06);margin-bottom:6px}
.tp-tier.got{background:#fbf2dd;border-color:rgba(195,143,34,.35)}
.tp-tier .t{width:36px;font-weight:800;color:#a8761a}
#tp-reveal{position:fixed;inset:0;z-index:8700;background:rgba(12,28,20,.6);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;flex-direction:column;gap:18px;color:#fff}
#tp-reveal.open{display:flex}
.tp-flip{display:flex;gap:10px}
.tp-flip .tp-cardface{width:96px;opacity:0;transform:rotateY(90deg) scale(.7);transition:transform .45s cubic-bezier(.2,1.4,.4,1),opacity .3s}
.tp-flip .tp-cardface.show{opacity:1;transform:none}
#hud-today-chip{position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 118px);z-index:5200;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-weight:800;font-size:12px}
#hud-today-chip .pk{background:#e11d48;color:#fff;border-radius:99px;padding:1px 6px;animation:tp-flick 1.2s infinite}
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
