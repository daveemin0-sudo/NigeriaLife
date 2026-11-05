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

function renderRingCard(spec: WeddingRingSpec, owned: boolean, totalFunds: number): string {
  const canAfford = totalFunds >= spec.price;
  return `
    <div class="nl-card ${owned ? 'nl-card--live' : ''}" data-ring-card="${esc(spec.id)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">${spec.icon} ${esc(spec.name)}</div>
          <div class="nl-card-line" style="margin-top:2px;"><span class="nl-tag nl-tag--good">+${spec.closenessBonus}% Closeness Bonus</span></div>
        </div>
        <span class="nl-tag ${owned ? 'nl-tag--good' : 'nl-tag--warn'}">${owned ? 'Owned in Bag' : naira(spec.price)}</span>
      </div>
      <div class="nl-card-line" style="margin-top:4px;">${esc(spec.description)}</div>
      <div style="margin-top:6px;">
        ${
          owned
            ? `<button class="nl-btn nl-btn--block" disabled>✓ Available for Proposal</button>`
            : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="buy-ring" data-ring="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>
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
    <div class="nl-card ${isCurrentSpouse ? 'nl-card--live' : ''}" data-proposal-card="${esc(profile.id)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">❤️ ${esc(profile.name)} (${profile.age})</div>
          <div class="nl-card-line" style="margin-top:2px;">${esc(profile.title)} · <span class="nl-tag">📍 ${esc(profile.area)}</span></div>
        </div>
        <span class="nl-tag ${meetsCloseness ? 'nl-tag--good' : 'nl-tag--muted'}">${closeness}% Closeness</span>
      </div>
      <div class="nl-card-line" style="color:var(--nl-accent); font-weight:700; margin-top:4px;">Favourite Date: ${esc(profile.venueName)} · ${esc(profile.dateDish)}</div>
      <div class="nl-card-line">${esc(profile.bio)}</div>
      <div style="margin-top:6px;">
        ${
          isMarried && isCurrentSpouse
            ? `<button class="nl-btn nl-btn--block" disabled>❤️ Currently Married</button>`
            : isEngaged && isCurrentSpouse
              ? `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="hold-wedding" data-spouse="${esc(profile.id)}">
                  🎉 Hold Traditional Wedding &amp; Dowry (₦75,000)
                </button>`
              : isMarried || isEngaged
                ? `<button class="nl-btn nl-btn--block" disabled>Already Committed</button>`
                : meetsCloseness && hasRing
                  ? `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="propose-spouse" data-spouse="${esc(profile.id)}" data-ring="${esc(bestRing!)}">
                      💍 Propose Marriage (Use ${esc(WEDDING_RINGS[bestRing!].name)})
                    </button>`
                  : !meetsCloseness
                    ? `<button class="nl-btn nl-btn--block" data-spouse="${esc(profile.id)}" disabled>Need 60% Closeness (Go on Spark Dates)</button>`
                    : `<button class="nl-btn nl-btn--block" data-spouse="${esc(profile.id)}" disabled>Buy a Wedding Ring First</button>`
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
        <div class="nl-card nl-card--live mr-active" id="marriage-active-banner">
          <div class="nl-card-title">
            ${current.status === 'married' ? '🏡 Married to ' : '💍 Engaged to '} ${esc(current.spouseName)}
          </div>
          <div class="nl-card-line">
            Ring: <strong>${esc(WEDDING_RINGS[current.ringTier].name)}</strong> · Closeness: <strong>${current.closeness}%</strong>.<br/>
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
          <div class="nl-card nl-card--live" id="marriage-home-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div>
                <div class="nl-card-title">🏡 Home Life with ${esc(current.spouseName)}</div>
                <div class="nl-card-line" style="margin-top:2px;">Living in your Lagos residence</div>
              </div>
              <span class="nl-tag nl-tag--good">Spouse at Home</span>
            </div>
            <div class="nl-card-line" style="margin-top:6px;">
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
        <div class="nl-hero" style="background: linear-gradient(135deg, #831843 0%, #be185d 55%, #e11d48 100%);">
          <span class="nl-hero-label">Lagos Love &amp; Matrimony</span>
          <span class="nl-hero-value" style="font-size:22px;">${isMarried ? '💍 Married' : isEngaged ? '💍 Engaged' : 'Single'}</span>
          <span class="nl-hero-sub">Spouse: <strong>${current ? esc(current.spouseName.split(' ')[0]!) : 'None'}</strong> · Rings Owned: <strong>${rings.length}/3</strong></span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-set="mr.tab" data-value="rings">💍 Rings (${rings.length}/3)</button>
            <button class="nl-btn nl-btn--glass" data-set="mr.tab" data-value="proposal">💒 Proposal</button>
          </div>
        </div>
        ${banner}
        <div class="nl-section">Matrimony &amp; Union</div>
        ${chips('mr.tab', tab, [
          ['rings', `Rings (${rings.length}/3)`],
          ['proposal', 'Proposal & Wedding'],
          ['home', 'Spouse at Home'],
        ])}
        <div class="nl-list" style="margin-top:8px;">
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
