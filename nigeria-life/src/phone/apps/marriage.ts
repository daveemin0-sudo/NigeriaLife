import { BackendService } from '../../backend/BackendService';
import {
  Marriage,
  WEDDING_RINGS,
  type RingTierId,
  type WeddingRingSpec,
} from '../../social/Marriage';
import { SPARK_PROFILES, Spark, type SparkProfileId } from '../../social/Spark';
import { chips, empty, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

/**
 * Marriage app on the phone:
 * - Buy engagement and wedding rings (Silver, 18K Gold, Solitaire Diamond).
 * - Propose marriage to your Spark matches (with 60%+ closeness).
 * - Pay traditional wedding ceremony dowry and celebrate your union.
 * - View your marital status, ring, and spouse living in your home.
 */

let syncedAt = 0;
let styled = false;

const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-marriage-style';
  el.textContent = `
    .mr-root { padding: 4px 2px 68px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .mr-hero {
      padding: 12px 14px; border-radius: 16px;
      background: linear-gradient(135deg, #831843 0%, #be185d 55%, #e11d48 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.1));
    }
    .mr-hero-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .mr-hero-tag { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #fecdd3; }
    .mr-hero-badge { font-size: 11px; font-weight: 900; color: #ffe4e6; background: rgba(0,0,0,.28); padding: 2px 8px; border-radius: 999px; }
    .mr-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 900; letter-spacing: -.02em; }
    .mr-hero p { margin: 0; font-size: 11px; color: rgba(255,255,255,.9); line-height: 1.35; }
    .mr-stats {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.2);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;
    }
    .mr-stats div b { display: block; font-size: 13px; font-weight: 900; color: #ffe4e6; font-variant-numeric: tabular-nums; }
    .mr-active {
      padding: 12px; border-radius: 14px;
      background: linear-gradient(135deg, #fff1f2, #ffe4e6);
      border: 1px solid #f43f5e; color: #881337;
      display: flex; flex-direction: column; gap: 5px;
    }
    .mr-active-title { font-size: 13px; font-weight: 900; color: #881337; }
    .mr-active-sub { font-size: 11px; font-weight: 700; color: #9f1239; line-height: 1.35; }
    .mr-card {
      padding: 12px; border-radius: 14px;
      background: var(--lx-surface-solid, #fff); border: 1px solid var(--lx-line, rgba(0,0,0,.08));
      box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
      display: flex; flex-direction: column; gap: 6px; color: var(--lx-ink, #0f172a);
    }
    .mr-card.married { border-color: #e11d48; }
    .mr-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .mr-name { font-size: 13px; font-weight: 900; color: var(--lx-ink, #0f172a); }
    .mr-sub { font-size: 11px; font-weight: 700; color: var(--lx-dim, #64748b); }
    .mr-pill {
      padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 900;
      background: #ffe4e6; color: #9f1239; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .mr-pill.green { background: #dcfce7; color: #166534; }
    .mr-pill.gold { background: #fef3c7; color: #92400e; }
    .mr-meta { font-size: 11px; font-weight: 800; color: #be185d; }
    .mr-desc { font-size: 11px; color: var(--lx-dim, #64748b); line-height: 1.35; }
    .mr-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
    .mr-btn {
      flex: 1; padding: 8px 10px; border-radius: 10px; border: 0;
      background: linear-gradient(135deg, #be185d, #e11d48); color: #fff;
      font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    .mr-btn:disabled { opacity: .45; cursor: not-allowed; }
  `;
  document.head.appendChild(el);
};

function renderRingCard(spec: WeddingRingSpec, owned: boolean, totalFunds: number): string {
  const canAfford = totalFunds >= spec.price;
  return `
    <div class="mr-card ${owned ? 'married' : ''}" data-ring-card="${esc(spec.id)}">
      <div class="mr-card-top">
        <div>
          <div class="mr-name">${spec.icon} ${esc(spec.name)}</div>
          <div class="mr-sub">+${spec.closenessBonus}% Closeness Bonus</div>
        </div>
        <span class="mr-pill ${owned ? 'green' : ''}">${owned ? 'Owned in Bag' : naira(spec.price)}</span>
      </div>
      <div class="mr-desc">${esc(spec.description)}</div>
      <div class="mr-actions">
        ${
          owned
            ? `<button class="mr-btn" disabled>✓ Available for Proposal</button>`
            : `<button class="mr-btn" data-act="buy-ring" data-ring="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>
                ${canAfford ? `Buy Ring (${naira(spec.price)})` : `Need ${naira(spec.price)}`}
              </button>`
        }
      </div>
    </div>
  `;
}

function renderProposalCard(
  profile: (typeof SPARK_PROFILES)[0],
  closeness: number,
  rings: RingTierId[],
  isCurrentSpouse: boolean,
  isEngaged: boolean,
  isMarried: boolean,
): string {
  const meetsCloseness = closeness >= 60;
  const hasRing = rings.length > 0;
  const bestRing = rings.includes('diamond') ? 'diamond' : rings.includes('gold') ? 'gold' : rings[0];

  return `
    <div class="mr-card ${isCurrentSpouse ? 'married' : ''}" data-proposal-card="${esc(profile.id)}">
      <div class="mr-card-top">
        <div>
          <div class="mr-name">❤️ ${esc(profile.name)} (${profile.age})</div>
          <div class="mr-sub">${esc(profile.title)} · 📍 ${esc(profile.area)}</div>
        </div>
        <span class="mr-pill ${meetsCloseness ? 'green' : ''}">${closeness}% Closeness</span>
      </div>
      <div class="mr-meta">Favourite Date: ${esc(profile.venueName)} · ${esc(profile.dateDish)}</div>
      <div class="mr-desc">${esc(profile.bio)}</div>
      <div class="mr-actions">
        ${
          isMarried && isCurrentSpouse
            ? `<button class="mr-btn" disabled>❤️ Currently Married</button>`
            : isEngaged && isCurrentSpouse
              ? `<button class="mr-btn" data-act="hold-wedding" data-spouse="${esc(profile.id)}">
                  🎉 Hold Traditional Wedding &amp; Dowry (₦75,000)
                </button>`
              : isMarried || isEngaged
                ? `<button class="mr-btn" disabled>Already Committed</button>`
                : meetsCloseness && hasRing
                  ? `<button class="mr-btn" data-act="propose-spouse" data-spouse="${esc(profile.id)}" data-ring="${esc(bestRing!)}">
                      💍 Propose Marriage (Use ${esc(WEDDING_RINGS[bestRing!].name)})
                    </button>`
                  : !meetsCloseness
                    ? `<button class="mr-btn" data-spouse="${esc(profile.id)}" disabled>Need 60% Closeness (Go on Spark Dates)</button>`
                    : `<button class="mr-btn" data-spouse="${esc(profile.id)}" disabled>Buy a Wedding Ring First</button>`
        }
      </div>
    </div>
  `;
}

export const marriageApp: PhoneApp = {
  id: 'marriage',
  name: 'Marriage',
  icon: '💍',
  tint: ['#be185d', '#831843'],
  purpose: 'Rings, proposals, weddings & living together',
  badge: () => (Marriage.get().isEngaged() ? 1 : 0),
  render(host) {
    style();
    const marriage = Marriage.get();
    if (Date.now() - syncedAt > 8_000) {
      syncedAt = Date.now();
      void marriage.syncFromServer();
    }

    const tab = host.get<'rings' | 'proposal' | 'home'>('mr.tab', 'rings');
    const rings = marriage.ringsOwned();
    const current = marriage.currentMarriage();
    const isMarried = marriage.isMarried();
    const isEngaged = marriage.isEngaged();
    const data = BackendService.getInstance().getData();
    const totalFunds = data.walletCash + data.bank.balance;
    const spark = Spark.get();
    const matches = spark.matches();

    const banner = current
      ? `
        <div class="mr-active" id="marriage-active-banner">
          <div class="mr-active-title">
            ${current.status === 'married' ? '🏡 Married to ' : '💍 Engaged to '} ${esc(current.spouseName)}
          </div>
          <div class="mr-active-sub">
            Ring: <b>${esc(WEDDING_RINGS[current.ringTier].name)}</b> · Closeness: <b>${current.closeness}%</b>.<br/>
            ${
              current.status === 'married'
                ? `Living together in your Lagos home! Fresh meals in the fridge every day.`
                : `Ready to tie the knot? Pay the dowry and host your traditional wedding ceremony!`
            }
          </div>
        </div>
      `
      : '';

    let content = '';
    if (tab === 'rings') {
      content = Object.values(WEDDING_RINGS)
        .map((spec) => renderRingCard(spec, rings.includes(spec.id), totalFunds))
        .join('');
    } else if (tab === 'proposal') {
      content = SPARK_PROFILES.map((p) => {
        const m = matches.find((match) => match.profileId === p.id);
        const closeness = m?.closeness ?? 0;
        const isCurrentSpouse = current?.spouseId === p.id;
        return renderProposalCard(p, closeness, rings, isCurrentSpouse, isEngaged, isMarried);
      }).join('');
    } else {
      content = current && current.status === 'married'
        ? `
          <div class="mr-card married" id="marriage-home-card">
            <div class="mr-card-top">
              <div>
                <div class="mr-name">🏡 Home Life with ${esc(current.spouseName)}</div>
                <div class="mr-sub">Living in your Lagos residence</div>
              </div>
              <span class="mr-pill green">Spouse at Home</span>
            </div>
            <div class="mr-desc">
              ${esc(current.spouseName)} is standing inside your home parlour. Walk in through the front door to gist, embrace (+25 Social, +20 Fun), and enjoy fresh meals cooked into your fridge daily!
            </div>
          </div>
        `
        : empty(
            '💍',
            'No spouse at home yet',
            'Buy a ring, propose to your favourite Spark partner, and complete your traditional wedding!',
          );
    }

    return {
      title: 'Marriage',
      body: `
        <div class="mr-root">
          <div class="mr-hero">
            <div class="mr-hero-top">
              <span class="mr-hero-tag">Lagos Love &amp; Matrimony</span>
              <span class="mr-hero-badge">${isMarried ? 'Married' : isEngaged ? 'Engaged' : 'Single'}</span>
            </div>
            <h3>Proposals, Weddings &amp; Spouse</h3>
            <p>Buy rings, propose to your Spark date, pay traditional dowry, and live together happily at home.</p>
            <div class="mr-stats">
              <div>Status<b>${isMarried ? 'Married' : isEngaged ? 'Engaged' : 'Single'}</b></div>
              <div>Spouse<b>${current ? esc(current.spouseName.split(' ')[0]!) : 'None'}</b></div>
              <div>Rings Owned<b>${rings.length}/3</b></div>
            </div>
          </div>
          ${banner}
          ${chips('mr.tab', tab, [
            ['rings', `Rings (${rings.length}/3)`],
            ['proposal', 'Proposal & Wedding'],
            ['home', 'Spouse at Home'],
          ])}
          ${content}
        </div>
      `,
    };
  },
  async act(host, action, el) {
    const marriage = Marriage.get();
    if (action === 'buy-ring') {
      const ringId = (el.dataset.ring ?? '') as RingTierId;
      const res = await marriage.buyRing(ringId);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'propose-spouse') {
      const spouseId = (el.dataset.spouse ?? '') as SparkProfileId;
      const ringId = (el.dataset.ring ?? '') as RingTierId;
      const res = await marriage.propose(spouseId, ringId);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'hold-wedding') {
      const res = await marriage.marry(75_000);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
    }
  },
};
