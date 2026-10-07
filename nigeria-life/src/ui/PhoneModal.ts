import { PhoneSystem } from '../phone/PhoneSystem';
import { BackendService } from '../backend/BackendService';
import type { PhoneAppId } from '../phone/types';

export class PhoneModal {
  private container: HTMLDivElement;
  private phoneSystem: PhoneSystem;
  private backend: BackendService;
  public isOpen: boolean = false;
  private currentApp: PhoneAppId = 'home';
  private activeContactId: string | null = null;

  constructor() {
    this.phoneSystem = PhoneSystem.getInstance();
    this.backend = BackendService.getInstance();

    this.container = document.createElement('div');
    this.container.id = 'smartphone-wrapper';
    this.container.className = 'phone-closed';

    document.body.appendChild(this.container);
    this.render();
  }

  public open(): void {
    this.isOpen = true;
    this.container.className = 'phone-open';
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.container.className = 'phone-closed';
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  public openApp(appId: PhoneAppId): void {
    this.currentApp = appId;
    this.render();
  }

  private render(): void {
    const data = this.backend.getData();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.container.innerHTML = `
      <div class="smartphone-device">
        <!-- Physical Speaker & Dynamic Island -->
        <div class="phone-island">
          <span class="island-camera"></span>
        </div>

        <!-- Top Status Bar -->
        <div class="phone-status-bar">
          <span class="phone-time">${timeStr}</span>
          <div class="phone-status-icons">
            <span class="phone-carrier">MTN 5G</span>
            <span class="phone-battery">98% 🔋</span>
          </div>
        </div>

        <!-- Phone Screen Content -->
        <div class="phone-screen" id="phone-screen-content">
          ${this.renderAppView(data)}
        </div>

        <!-- Bottom Gesture Navigation Bar -->
        <div class="phone-home-indicator" id="phone-home-bar" title="Home Screen / Exit">
          <span class="gesture-pill"></span>
        </div>
      </div>
    `;

    this.setupEvents();
  }

  private renderAppView(data: ReturnType<BackendService['getData']>): string {
    if (this.currentApp === 'bank') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>EkoPay Mobile Bank</h4>
          <span>🟢</span>
        </div>
        <div class="app-body bank-app">
          <div class="ekopay-card">
            <span class="card-label">Available Bank Balance</span>
            <h2 class="card-balance">₦${data.bank.balance.toLocaleString()}</h2>
            <div class="card-acct">Acct: ${data.bank.accountNumber} • ${data.username}</div>
          </div>

          <div class="bank-actions-grid">
            <button class="bank-action-btn" id="btn-airtime-mtn">
              <span>📱</span>
              <span>Recharge ₦1,000</span>
            </button>
            <button class="bank-action-btn" id="btn-transfer-quick">
              <span>💸</span>
              <span>Send ₦5,000</span>
            </button>
          </div>

          <div class="app-section-title">Quick Transfer to Tag</div>
          <div class="transfer-form">
            <input type="text" id="transfer-tag-input" class="phone-input" placeholder="Recipient @username (e.g. emeka)" />
            <input type="number" id="transfer-amt-input" class="phone-input" placeholder="Amount (₦)" value="5000" />
            <button class="btn-phone-action" id="btn-send-transfer">Send Instant Transfer</button>
          </div>

          <div class="app-section-title">Recent Transactions</div>
          <div class="mini-tx-list">
            ${data.bank.transactions.slice(0, 3).map((tx) => `
              <div class="mini-tx-item">
                <span>${tx.description}</span>
                <strong class="${tx.type}">₦${tx.amount.toLocaleString()}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.currentApp === 'messages') {
      if (this.activeContactId) {
        const contact = this.phoneSystem.contacts.find((c) => c.id === this.activeContactId)!;
        return `
          <div class="phone-app-header">
            <button class="phone-back-btn" id="msg-back-to-list-btn">←</button>
            <div class="chat-header-user">
              <span>${contact.avatar}</span>
              <div>
                <h5>${contact.name}</h5>
                <span class="chat-user-sub">${contact.status}</span>
              </div>
            </div>
          </div>
          <div class="chat-thread" id="chat-thread-box">
            ${contact.messages.map((m) => `
              <div class="bubble ${m.sender === 'me' ? 'bubble-me' : 'bubble-them'}">
                <span class="bubble-text">${m.text}</span>
                <span class="bubble-time">${m.time}</span>
              </div>
            `).join('')}
          </div>
          <form class="thread-reply-form" id="thread-reply-form">
            <input type="text" id="thread-input" class="phone-input" placeholder="Type a message..." maxlength="70" />
            <button type="submit" class="thread-send-btn">➤</button>
          </form>
        `;
      }

      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>NaijaChat (WhatsApp)</h4>
          <span>💬</span>
        </div>
        <div class="app-body msg-app">
          <div class="contacts-list">
            ${this.phoneSystem.contacts.map((c) => `
              <div class="contact-card" data-contact="${c.id}">
                <span class="contact-avatar">${c.avatar}</span>
                <div class="contact-details">
                  <div class="contact-row">
                    <strong class="contact-name">${c.name}</strong>
                    ${c.unread ? '<span class="unread-dot"></span>' : ''}
                  </div>
                  <span class="contact-preview">${c.lastMessage}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.currentApp === 'jobs') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Hustle9ja • Jobs & Gigs</h4>
          <span>💼</span>
        </div>
        <div class="app-body jobs-app">
          <p class="jobs-intro">Pick up street hustles & remote tasks to earn extra Naira cash!</p>
          <div class="jobs-list">
            ${this.phoneSystem.jobs.map((job) => `
              <div class="job-card">
                <div class="job-top">
                  <span class="job-icon">${job.icon}</span>
                  <div>
                    <h5>${job.title}</h5>
                    <span class="job-company">${job.company}</span>
                  </div>
                </div>
                <p class="job-desc">${job.description}</p>
                <div class="job-bottom">
                  <span class="job-pay">+₦${job.pay.toLocaleString()}</span>
                  <button class="btn-job-apply" data-job="${job.id}">Work Shift (-${job.energyCost}% ⚡)</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.currentApp === 'dating') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>FindLuv Lagos • Dating</h4>
          <span>💖</span>
        </div>
        <div class="app-body dating-app">
          <div class="dating-cards-container">
            ${this.phoneSystem.datingProfiles.map((p) => `
              <div class="dating-card">
                <div class="dating-avatar">${p.avatar}</div>
                <h3 class="dating-name">${p.name}, ${p.age}</h3>
                <span class="dating-loc">📍 ${p.location}</span>
                <p class="dating-bio">"${p.bio}"</p>
                <div class="dating-actions">
                  <button class="btn-date-action dislike">❌ Pass</button>
                  <button class="btn-date-action like" data-like="${p.id}">💚 Match</button>
                </div>
              </div>
            `).slice(0, 1).join('')}
          </div>
        </div>
      `;
    }

    if (this.currentApp === 'map') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>EkoMaps • Broad St. GPS</h4>
          <span>🗺️</span>
        </div>
        <div class="app-body map-app">
          <div class="mini-radar-map">
            <div class="radar-point player-point" style="top: 50%; left: 50%;" title="You">🟢</div>
            <div class="radar-point bank-point" style="top: 25%; left: 75%;" title="Eko Bank">🏦</div>
            <div class="radar-point food-point" style="top: 38%; left: 25%;" title="Mama Put">🍲</div>
            <div class="radar-point bet-point" style="top: 65%; left: 78%;" title="Bet9ja">⚽</div>
            <div class="radar-point bus-point" style="top: 70%; left: 28%;" title="Danfo Stop">🚌</div>
          </div>
          <div class="map-legend">
            <div>🟢 You (Broad St. Center)</div>
            <div>🏦 Eko Commercial Bank & ATM</div>
            <div>🍲 Mama Put Bukateria</div>
            <div>⚽ Bet9ja Sports Hub</div>
            <div>🚌 Danfo Terminus</div>
          </div>
        </div>
      `;
    }

    if (this.currentApp === 'music') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Afrobeats Radio • Naija Wave</h4>
          <span>🎧</span>
        </div>
        <div class="app-body music-app">
          <div class="music-disc-wrapper">
            <div class="music-disc">
              <span class="disc-emoji">🎵</span>
            </div>
          </div>
          <div class="music-track-info">
            <h4>Lonely At The Top</h4>
            <p>Asake • Work of Art (2023)</p>
            <span class="vibe-status">🔥 Vibes: 100% Street Energy</span>
          </div>
          <div class="music-controls">
            <button class="btn-music-ctrl">⏮️</button>
            <button class="btn-music-ctrl play-btn" id="btn-toggle-beats">▶️ Play Vibe</button>
            <button class="btn-music-ctrl">⏭️</button>
          </div>
          <div class="music-playlist">
            <div class="track-row active"><span>1. Lonely At The Top - Asake</span><span>3:24</span></div>
            <div class="track-row"><span>2. City Boys - Burna Boy</span><span>2:45</span></div>
            <div class="track-row"><span>3. Ojuelegba - Wizkid</span><span>3:35</span></div>
            <div class="track-row"><span>4. Buga (Won Sen Mi) - Kizz Daniel</span><span>3:05</span></div>
          </div>
        </div>
      `;
    }

    if (this.currentApp === 'invest') {
      const totalPending = data.businesses.reduce((sum, b) => sum + (b.owned ? b.pendingRevenue : 0), 0);
      const totalIncomePerMin = data.businesses.reduce((sum, b) => {
        if (!b.owned) return sum;
        let inc = b.baseIncomePerCycle;
        for (const u of b.upgrades) {
          if (u.purchased) inc += u.bonusIncomePerCycle;
        }
        return sum + inc;
      }, 0);

      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Invest9ja • Enterprise Hub</h4>
          <span>📈</span>
        </div>
        <div class="app-body invest-app">
          <!-- Overview Card -->
          <div class="invest-summary-card">
            <div class="summary-top">
              <span class="summary-label">Passive Income Rate</span>
              <span class="summary-badge">🇳🇬 Active</span>
            </div>
            <h2 class="summary-amount">+₦${totalIncomePerMin.toLocaleString()}<small style="font-size: 13px; font-weight: normal; color: #94a3b8;"> / min</small></h2>
            <div class="summary-pending">
              <span>Pending Profit: <strong style="color: #4ade80;">₦${totalPending.toLocaleString()}</strong></span>
              <button class="btn-collect-all" id="btn-collect-all-revenue" ${totalPending <= 0 ? 'disabled' : ''}>
                💰 Collect
              </button>
            </div>
            <div class="career-pill">
              <span>🏆 Rank: <strong>${data.career.title}</strong></span>
              <span>XP: ${data.career.xp} (x${data.career.bonusMultiplier} Pay)</span>
            </div>
          </div>

          <!-- Section: Businesses -->
          <div class="app-section-title">Commercial Enterprises</div>
          <div class="invest-list">
            ${data.businesses.map((biz) => {
              const currentIncome = biz.baseIncomePerCycle + biz.upgrades.reduce((s, u) => s + (u.purchased ? u.bonusIncomePerCycle : 0), 0);
              return `
                <div class="invest-card ${biz.owned ? 'owned' : ''}">
                  <div class="invest-card-header">
                    <span class="invest-icon">${biz.icon}</span>
                    <div class="invest-meta">
                      <h5>${biz.name}</h5>
                      <span class="invest-cat">${biz.category}</span>
                    </div>
                    <span class="invest-status-tag ${biz.owned ? 'tag-owned' : 'tag-buy'}">
                      ${biz.owned ? `OWNED • Lv.${biz.level}` : `₦${biz.purchasePrice.toLocaleString()}`}
                    </span>
                  </div>

                  ${biz.owned ? `
                    <div class="invest-stats-row">
                      <span>Rate: +₦${currentIncome.toLocaleString()}/min</span>
                      <span>Pending: <strong style="color: #4ade80;">₦${biz.pendingRevenue.toLocaleString()}</strong></span>
                    </div>
                    <div class="invest-actions-row">
                      <button class="btn-biz-collect" data-collect-biz="${biz.id}" ${biz.pendingRevenue <= 0 ? 'disabled' : ''}>
                        Claim ₦${biz.pendingRevenue.toLocaleString()}
                      </button>
                    </div>
                    <div class="upgrades-container">
                      <div class="upgrades-title">Upgrades & Equipment:</div>
                      ${biz.upgrades.map((u) => `
                        <div class="upgrade-row">
                          <div class="upgrade-info">
                            <strong>${u.name}</strong>
                            <small>+₦${u.bonusIncomePerCycle.toLocaleString()}/min</small>
                          </div>
                          ${u.purchased
                            ? `<span class="badge-installed">✅ Active</span>`
                            : `<button class="btn-buy-upgrade" data-upgrade-biz="${biz.id}" data-upgrade-id="${u.id}">
                                ₦${u.cost.toLocaleString()}
                               </button>`
                          }
                        </div>
                      `).join('')}
                    </div>
                  ` : `
                    <p class="invest-desc">Yields <strong>+₦${biz.baseIncomePerCycle.toLocaleString()}</strong> automated income every minute.</p>
                    <button class="btn-buy-biz" data-buy-biz="${biz.id}">
                      💼 Acquire (₦${biz.purchasePrice.toLocaleString()})
                    </button>
                  `}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Section: Real Estate -->
          <div class="app-section-title" style="margin-top: 18px;">Prime Lagos Real Estate</div>
          <div class="invest-list">
            ${data.properties.map((prop) => `
              <div class="invest-card property-card ${prop.status !== 'unowned' ? 'owned' : ''}">
                <div class="invest-card-header">
                  <span class="invest-icon">${prop.icon}</span>
                  <div class="invest-meta">
                    <h5>${prop.name}</h5>
                    <span class="invest-cat">${prop.location}</span>
                  </div>
                  <span class="invest-status-tag ${prop.status === 'purchased' ? 'tag-owned' : prop.status === 'rented' ? 'tag-rent' : 'tag-buy'}">
                    ${prop.status.toUpperCase()}
                  </span>
                </div>

                <div class="prop-perks">
                  ${prop.perks.map((pk) => `<div class="perk-bullet">✨ ${pk}</div>`).join('')}
                </div>

                ${prop.status !== 'unowned' ? `
                  <div class="prop-actions">
                    <button class="btn-prop-rest" data-rest-prop="${prop.id}">
                      🛏️ Rest & Recharge (100% ⚡)
                    </button>
                  </div>
                ` : `
                  <div class="prop-buy-options">
                    <button class="btn-prop-rent" data-rent-prop="${prop.id}">
                      🔑 Lease (₦${prop.rentalPriceMonthly.toLocaleString()}/mo)
                    </button>
                    <button class="btn-prop-buy" data-buy-prop="${prop.id}">
                      📜 Buy Deed (₦${prop.purchasePrice.toLocaleString()})
                    </button>
                  </div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Default: Home Screen
    return `
      <div class="home-app-grid">
        <button class="app-icon-btn" data-app="bank">
          <div class="icon-bubble bank-bg">🏦</div>
          <span>EkoPay</span>
        </button>
        <button class="app-icon-btn" data-app="invest">
          <div class="icon-bubble invest-bg">🏢</div>
          <span>Invest9ja</span>
        </button>
        <button class="app-icon-btn" data-app="messages">
          <div class="icon-bubble msg-bg">💬</div>
          <span>NaijaChat</span>
        </button>
        <button class="app-icon-btn" data-app="map">
          <div class="icon-bubble map-bg">🗺️</div>
          <span>EkoMaps</span>
        </button>
        <button class="app-icon-btn" data-app="jobs">
          <div class="icon-bubble jobs-bg">💼</div>
          <span>Hustle9ja</span>
        </button>
        <button class="app-icon-btn" data-app="dating">
          <div class="icon-bubble dating-bg">💖</div>
          <span>FindLuv</span>
        </button>
        <button class="app-icon-btn" data-app="music">
          <div class="icon-bubble music-bg">🎵</div>
          <span>Afrobeats</span>
        </button>
      </div>

      <!-- Quick Glance Widget -->
      <div class="home-glance-widget">
        <div class="widget-row">
          <span>🇳🇬 Lagos Island</span>
          <span>31°C ☀️</span>
        </div>
        <div class="widget-balance">
          <span>Wallet Cash: <strong>₦${data.walletCash.toLocaleString()}</strong></span>
        </div>
      </div>
    `;
  }

  private setupEvents(): void {
    // Bottom Home Indicator (Returns to Home or closes)
    const homeBar = document.getElementById('phone-home-bar');
    if (homeBar) {
      homeBar.onclick = () => {
        if (this.currentApp !== 'home') {
          this.currentApp = 'home';
          this.activeContactId = null;
          this.render();
        } else {
          this.close();
        }
      };
    }

    // Back button in app headers
    const backBtn = document.getElementById('app-back-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        this.currentApp = 'home';
        this.activeContactId = null;
        this.render();
      };
    }

    // App icons click
    const appButtons = this.container.querySelectorAll('[data-app]');
    appButtons.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const target = (btn as HTMLElement).getAttribute('data-app') as PhoneAppId;
        this.openApp(target);
      };
    });

    // Contact card click
    const contactCards = this.container.querySelectorAll('[data-contact]');
    contactCards.forEach((c) => {
      (c as HTMLElement).onclick = () => {
        const id = (c as HTMLElement).getAttribute('data-contact')!;
        this.activeContactId = id;
        this.render();
      };
    });

    const msgBackBtn = document.getElementById('msg-back-to-list-btn');
    if (msgBackBtn) {
      msgBackBtn.onclick = () => {
        this.activeContactId = null;
        this.render();
      };
    }

    // Thread reply form
    const replyForm = document.getElementById('thread-reply-form') as HTMLFormElement;
    if (replyForm && this.activeContactId) {
      replyForm.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('thread-input') as HTMLInputElement;
        const text = input.value.trim();
        if (!text) return;

        this.phoneSystem.sendMessage(this.activeContactId!, text);
        this.render();
      };
    }

    // Job apply buttons
    const jobButtons = this.container.querySelectorAll('[data-job]');
    jobButtons.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const jobId = (btn as HTMLElement).getAttribute('data-job')!;
        const res = this.phoneSystem.workJob(jobId);
        alert(res.message);
        this.render();
      };
    });

    // Transfer send button
    const sendBtn = document.getElementById('btn-send-transfer');
    if (sendBtn) {
      sendBtn.onclick = () => {
        const tagInput = document.getElementById('transfer-tag-input') as HTMLInputElement;
        const amtInput = document.getElementById('transfer-amt-input') as HTMLInputElement;
        const tag = tagInput.value.trim() || 'friend';
        const amount = Number(amtInput.value) || 0;

        const res = this.phoneSystem.transferMoney(tag, amount);
        alert(res.message);
        this.render();
      };
    }

    // Quick Airtime button
    const airtimeBtn = document.getElementById('btn-airtime-mtn');
    if (airtimeBtn) {
      airtimeBtn.onclick = () => {
        const res = this.phoneSystem.buyAirtime('MTN', 1000);
        alert(res.message);
        this.render();
      };
    }

    // Dating like
    const likeBtn = this.container.querySelector('[data-like]');
    if (likeBtn) {
      (likeBtn as HTMLElement).onclick = () => {
        alert("🎉 It's a Match! Zainab added you to NaijaChat!");
        this.currentApp = 'messages';
        this.render();
      };
    }

    // === INVEST9JA APP EVENTS ===

    // Collect all business profits
    const collectAllBtn = document.getElementById('btn-collect-all-revenue');
    if (collectAllBtn) {
      collectAllBtn.onclick = () => {
        const res = this.backend.collectBusinessRevenue();
        alert(res.message);
        this.render();
      };
    }

    // Collect individual business
    const collectBizBtns = this.container.querySelectorAll('[data-collect-biz]');
    collectBizBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-collect-biz')!;
        const res = this.backend.collectBusinessRevenue(id);
        alert(res.message);
        this.render();
      };
    });

    // Buy Business
    const buyBizBtns = this.container.querySelectorAll('[data-buy-biz]');
    buyBizBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-buy-biz')!;
        const res = this.backend.buyBusiness(id);
        alert(res.message);
        this.render();
      };
    });

    // Buy Upgrade
    const upgBtns = this.container.querySelectorAll('[data-upgrade-biz]');
    upgBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const bizId = (btn as HTMLElement).getAttribute('data-upgrade-biz')!;
        const upgId = (btn as HTMLElement).getAttribute('data-upgrade-id')!;
        const res = this.backend.upgradeBusiness(bizId, upgId);
        alert(res.message);
        this.render();
      };
    });

    // Rent property
    const rentPropBtns = this.container.querySelectorAll('[data-rent-prop]');
    rentPropBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-rent-prop')!;
        const res = this.backend.buyProperty(id, true);
        alert(res.message);
        this.render();
      };
    });

    // Buy property
    const buyPropBtns = this.container.querySelectorAll('[data-buy-prop]');
    buyPropBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-buy-prop')!;
        const res = this.backend.buyProperty(id, false);
        alert(res.message);
        this.render();
      };
    });

    // Rest at property
    const restPropBtns = this.container.querySelectorAll('[data-rest-prop]');
    restPropBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-rest-prop')!;
        const res = this.backend.restAtProperty(id);
        alert(res.message);
        this.render();
      };
    });

    // Play music vibe simulation
    const playBeatsBtn = document.getElementById('btn-toggle-beats');
    if (playBeatsBtn) {
      playBeatsBtn.onclick = () => {
        alert('🎵 Asake - Lonely At The Top is blasting! Energy vibes peaking in Lagos!');
      };
    }
  }
}
