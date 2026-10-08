import { PhoneSystem } from '../phone/PhoneSystem';
import { BackendService } from '../backend/BackendService';
import type { PhoneAppId } from '../phone/types';
import { HouseDecorationSystem } from '../housing/HouseDecorationSystem';
import { showGameToast } from './GameToast';
import { SoundEngine } from '../audio/SoundEngine';
import { DEFAULT_JOBS } from '../backend/types';
import { CloudSyncService } from '../backend/CloudSyncService';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { UIStateManager } from './UIStateManager';

export class PhoneModal {
  private container: HTMLDivElement;
  private phoneSystem: PhoneSystem;
  private backend: BackendService;
  public isOpen: boolean = false;
  private currentApp: PhoneAppId = 'home';
  private activeContactId: string | null = null;
  private genMinigameStep: number = 0;
  private genMinigameTimer: number = 7;
  private genMinigameActive: boolean = false;
  private danfoMinigameActive: boolean = false;
  private danfoMinigameStep: number = 0;
  private techMinigameActive: boolean = false;
  private techMinigameStep: number = 0;
  private shiftIntervalId: any = null;
  public onOpenPhotoMode?: () => void;
  public onFastTravel?: (pos: { x: number; y: number; z: number }, propName: string) => void;
  private houseCityFilter: string = 'all';
  private meetumoTab: 'lobby' | 'cloud' = 'lobby';

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
    if (this.currentApp === 'jobs') {
      this.startShiftTicker();
    }
    this.render();
    UIStateManager.getInstance().pushModal('phone');
  }

  public close(): void {
    this.isOpen = false;
    this.container.className = 'phone-closed';
    this.stopShiftTicker();
    UIStateManager.getInstance().popModal('phone');
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  public openApp(appId: PhoneAppId): void {
    this.currentApp = appId;
    if (appId === 'jobs') {
      this.startShiftTicker();
    } else {
      this.stopShiftTicker();
    }
    this.render();
  }

  private startShiftTicker(): void {
    if (this.shiftIntervalId) return;
    this.shiftIntervalId = setInterval(() => {
      if (this.isOpen && this.currentApp === 'jobs') {
        const shift = this.backend.getActiveJobShift();
        if (shift) {
          this.render();
        }
      }
    }, 1000);
  }

  private stopShiftTicker(): void {
    if (this.shiftIntervalId) {
      clearInterval(this.shiftIntervalId);
      this.shiftIntervalId = null;
    }
  }

  private render(): void {
    const data = this.backend.getData();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.container.innerHTML = `
      <!-- Floating Close Pill (Matching Screenshot 1 & 4) -->
      <button class="phone-close-floating-pill" id="phone-btn-floating-close">✕ Close</button>

      <div class="smartphone-device">
        <!-- Physical Dynamic Island Pill -->
        <div class="phone-island">
          <span class="island-camera"></span>
        </div>

        <!-- Top Status Bar -->
        <div class="phone-status-bar">
          <span class="phone-time">${timeStr}</span>
          <div class="phone-status-icons">
            <span class="phone-carrier">••• 4G</span>
            <span class="phone-battery">98% 🔋</span>
          </div>
        </div>

        <!-- Phone Screen Content -->
        <div class="phone-screen" id="phone-screen-content">
          ${this.renderAppView(data)}
        </div>

        <!-- Bottom Gesture Home Indicator -->
        <div class="phone-home-indicator" id="phone-home-bar" title="Home Screen / Exit">
          <span class="gesture-pill"></span>
        </div>
      </div>
    `;

    this.setupEvents();
  }

  private renderAppView(data: ReturnType<BackendService['getData']>): string {
    // 1. MESSAGES APP (Matching Screenshot 4)
    if (this.currentApp === 'messages') {
      if (this.activeContactId) {
        const contact = this.phoneSystem.contacts.find((c) => c.id === this.activeContactId) || this.phoneSystem.contacts[0];
        return `
          <div class="chat-app-wrapper">
            <!-- Chat Header -->
            <div class="chat-app-header">
              <button class="chat-header-back" id="msg-back-to-list-btn">‹</button>
              <div class="chat-header-title">@${contact.handle || contact.id}</div>
              <div class="chat-header-actions">
                <button class="chat-act-pill" id="chat-act-invite">Invite over</button>
                <button class="chat-act-pill" id="chat-act-visit">Visit them</button>
                <button class="chat-act-pill pill-gold" id="chat-act-sendmoney">Send money</button>
              </div>
            </div>

            <!-- Messages Thread -->
            <div class="chat-thread" id="chat-thread-box">
              ${contact.messages.map((m) => {
                if (m.sender === 'system' && m.transferAmount) {
                  return `
                    <div class="chat-transfer-badge">
                      <span>💰 You sent them ₦${m.transferAmount.toLocaleString()} • ${m.time}</span>
                    </div>
                  `;
                }

                if (m.sticker) {
                  const stickerEmoji = m.sticker === 'lion' ? '🦁' : m.sticker === 'fire' ? '🔥' : '❤️';
                  return `
                    <div class="chat-sticker-bubble ${m.sender === 'me' ? 'sticker-me' : 'sticker-them'}">
                      <div class="sticker-card">
                        <span class="sticker-emoji">${stickerEmoji}</span>
                        <span class="sticker-caption">${m.stickerCaption || 'Odogwu!'}</span>
                      </div>
                      <span class="bubble-time">${m.time}</span>
                    </div>
                  `;
                }

                return `
                  <div class="bubble ${m.sender === 'me' ? 'bubble-me' : 'bubble-them'}">
                    <span class="bubble-text">${m.text || ''}</span>
                    <span class="bubble-time">${m.time}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Quick Sticker Bar -->
            <div class="chat-quick-stickers">
              <button class="quick-sticker-btn" data-sticker="lion" title="Send Odogwu Lion Sticker">🦁 Odogwu</button>
              <button class="quick-sticker-btn" data-sticker="fire" title="Send E choke Fire Sticker">🔥 E choke!</button>
              <button class="quick-sticker-btn" data-quick-msg="na less">na less</button>
              <button class="quick-sticker-btn" data-quick-msg="Abi you waste the money">Abi you waste money</button>
            </div>

            <!-- Input Bar -->
            <form class="thread-reply-form" id="thread-reply-form">
              <button type="button" class="chat-btn-emoji" id="btn-chat-emoji">😊</button>
              <input type="text" id="thread-input" class="phone-input chat-input-text" placeholder="Message @${contact.handle || contact.id}..." maxlength="80" />
              <button type="button" class="chat-btn-mic" id="btn-chat-mic">🎤</button>
              <button type="submit" class="thread-send-btn">➤</button>
            </form>
          </div>
        `;
      }

      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Messages • NaijaChat</h4>
          <span>💬</span>
        </div>
        <div class="app-body msg-app">
          <div class="contacts-list">
            ${this.phoneSystem.contacts.map((c) => `
              <div class="contact-card" data-contact="${c.id}">
                <span class="contact-avatar">${c.avatar}</span>
                <div class="contact-details">
                  <div class="contact-row">
                    <strong class="contact-name">@${c.handle || c.id} (${c.name})</strong>
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

    // 2. JOBS & WORK MINIGAMES (Track B2)
    if (this.currentApp === 'jobs') {
      const activeShift = this.backend.getActiveJobShift();
      const allJobs = DEFAULT_JOBS;
      const career = data.career || { title: 'Street Hustler', rankLevel: 1, xp: 0, completedGigs: 0 };

      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Jobs & Careers • Naija Hustle</h4>
          <span>💼</span>
        </div>
        <div class="app-body jobs-app">
          <!-- Career Status Card -->
          <div class="career-status-banner">
            <div class="career-title-wrap">
              <span class="career-badge">Rank ${career.rankLevel}</span>
              <h5>${career.title}</h5>
            </div>
            <div class="career-meta">
              <span>⭐ ${career.xp} XP</span> • <span>📦 ${career.completedGigs} Gigs Done</span>
            </div>
          </div>

          <!-- Active Shift Card (if currently working) -->
          ${activeShift ? `
            <div class="active-shift-card">
              <div class="active-shift-header">
                <span class="shift-icon">${activeShift.job.icon}</span>
                <div class="shift-info">
                  <h5>${activeShift.job.title}</h5>
                  <span class="shift-location">${activeShift.job.workplace}</span>
                </div>
                <span class="shift-pay">₦${activeShift.job.salary.toLocaleString()}</span>
              </div>

              <div class="shift-progress-wrap">
                <div class="shift-progress-bar">
                  <div class="shift-progress-fill" style="width: ${Math.round(activeShift.progress * 100)}%;"></div>
                </div>
                <div class="shift-time-label">
                  ${activeShift.isReady ? '<strong style="color: #4ade80;">✅ SHIFT COMPLETE!</strong>' : `<span>⏳ ${activeShift.remainingSecs}s remaining...</span>`}
                </div>
              </div>

              ${activeShift.isReady ? `
                <button class="btn-claim-salary" id="btn-claim-shift-salary">
                  💰 Claim ₦${activeShift.job.salary.toLocaleString()} Salary!
                </button>
              ` : `
                <button class="btn-claim-salary" disabled style="opacity: 0.6; cursor: not-allowed;">
                  💼 Working hard... (${activeShift.remainingSecs}s)
                </button>
              `}
            </div>
          ` : ''}

          <!-- Minigames Showcase / Quick Hustles -->
          ${this.danfoMinigameActive ? `
            <!-- Danfo Conductor Rush Minigame -->
            <div class="nepa-minigame-card danfo-minigame-card">
              <div class="nepa-card-header">
                <span class="nepa-icon">🚌</span>
                <div>
                  <h4>Danfo Conductor Rush • CMS -> Obalende</h4>
                  <small>Call passengers & collect exact fares!</small>
                </div>
              </div>
              <div class="nepa-steps-display">
                <span class="${this.danfoMinigameStep >= 1 ? 'step-done' : ''}">1. Call passengers ("Obalende straight!")</span>
                <span class="${this.danfoMinigameStep >= 2 ? 'step-done' : ''}">2. Return change (₦1,000 note -> ₦600 change)</span>
                <span class="${this.danfoMinigameStep >= 3 ? 'step-done' : ''}">3. Drop passengers smoothly</span>
              </div>
              <div class="nepa-buttons-grid">
                <button class="nepa-step-btn" id="btn-danfo-call">
                  <span>📢</span>
                  <span>Call: "CMS Obalende!"</span>
                </button>
                <button class="nepa-step-btn" id="btn-danfo-change">
                  <span>💵</span>
                  <span>Give ₦600 Change</span>
                </button>
                <button class="nepa-step-btn" id="btn-danfo-drop">
                  <span>🏁</span>
                  <span>Final Bus Stop Drop</span>
                </button>
              </div>
              <button class="btn-cancel-minigame" id="btn-cancel-danfo">Cancel Shift</button>
            </div>
          ` : this.techMinigameActive ? `
            <!-- Tech Bro Yaba Code Sprint Minigame -->
            <div class="nepa-minigame-card tech-minigame-card">
              <div class="nepa-card-header">
                <span class="nepa-icon">💻</span>
                <div>
                  <h4>Yaba CcHub Code Sprint</h4>
                  <small>Fix fintech webhook bugs & deploy pull request!</small>
                </div>
              </div>
              <div class="nepa-steps-display">
                <span class="${this.techMinigameStep >= 1 ? 'step-done' : ''}">1. Fix KudiPoint Webhook 500 error</span>
                <span class="${this.techMinigameStep >= 2 ? 'step-done' : ''}">2. Add Redis Cache layer</span>
                <span class="${this.techMinigameStep >= 3 ? 'step-done' : ''}">3. git push origin main</span>
              </div>
              <div class="nepa-buttons-grid">
                <button class="nepa-step-btn" id="btn-tech-webhook">
                  <span>🪲</span>
                  <span>Fix Webhook Idempotency</span>
                </button>
                <button class="nepa-step-btn" id="btn-tech-cache">
                  <span>⚡</span>
                  <span>Add Redis Cache</span>
                </button>
                <button class="nepa-step-btn" id="btn-tech-deploy">
                  <span>🚀</span>
                  <span>Deploy Production PR</span>
                </button>
              </div>
              <button class="btn-cancel-minigame" id="btn-cancel-tech">Cancel Gig</button>
            </div>
          ` : this.genMinigameActive ? `
            <!-- NEPA Tiger Generator Minigame -->
            <div class="nepa-minigame-card">
              <div class="nepa-card-header">
                <span class="nepa-icon">🔌</span>
                <div>
                  <h4>NEPA took light. The gen won't start</h4>
                  <small>Tap the steps in order (${this.genMinigameTimer}s)</small>
                </div>
              </div>
              <div class="nepa-steps-display">
                <span class="${this.genMinigameStep >= 1 ? 'step-done' : ''}">1. Check the fuel</span>
                <span class="${this.genMinigameStep >= 2 ? 'step-done' : ''}">2. Open the choke</span>
                <span class="${this.genMinigameStep >= 3 ? 'step-done' : ''}">3. Pull the cord</span>
              </div>
              <div class="nepa-buttons-grid">
                <button class="nepa-step-btn" id="btn-nepa-fuel"><span>⛽</span><span>Check fuel</span></button>
                <button class="nepa-step-btn" id="btn-nepa-choke"><span>🔧</span><span>Open choke</span></button>
                <button class="nepa-step-btn" id="btn-nepa-pull"><span>💪</span><span>Pull cord</span></button>
              </div>
              <button class="btn-cancel-minigame" id="btn-cancel-nepa">Cancel</button>
            </div>
          ` : `
            <!-- Quick Interactive Hustle Minigame Triggers -->
            <div class="hustle-minigames-row">
              <button class="hustle-launch-pill" id="btn-launch-danfo-hustle">
                <span>🚌</span>
                <div class="hustle-pill-text">
                  <strong>Danfo Rush</strong>
                  <small>+₦12,500 Cash</small>
                </div>
              </button>
              <button class="hustle-launch-pill" id="btn-launch-tech-hustle">
                <span>💻</span>
                <div class="hustle-pill-text">
                  <strong>CcHub Sprint</strong>
                  <small>+₦25,000 Cash</small>
                </div>
              </button>
              <button class="hustle-launch-pill" id="btn-launch-nepa-hustle">
                <span>⚡</span>
                <div class="hustle-pill-text">
                  <strong>Tiger Gen</strong>
                  <small>+₦20,000 Cash</small>
                </div>
              </button>
            </div>
          `}

          <!-- All Job Shifts List -->
          <div class="app-section-title">Available Shifts & Careers</div>
          <div class="jobs-list">
            ${allJobs.map((job) => `
              <div class="job-card ${activeShift?.job.id === job.id ? 'job-card-active' : ''}">
                <div class="job-header">
                  <span class="job-icon">${job.icon}</span>
                  <div class="job-meta">
                    <h5>${job.title}</h5>
                    <span class="job-company">${job.workplace}</span>
                  </div>
                  <span class="job-pay">₦${job.salary.toLocaleString()}</span>
                </div>
                <p class="job-desc">${job.description}</p>
                <div class="job-footer">
                  <span class="job-cost">⏱️ ${job.shiftDuration}s Shift</span>
                  <button class="btn-job-apply" data-start-job="${job.id}" ${activeShift ? 'disabled style="opacity: 0.5;"' : ''}>
                    ${activeShift?.job.id === job.id ? 'In Progress...' : 'Take Shift'}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 3. BANK (EkoPay)
    if (this.currentApp === 'bank') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>EkoPay Mobile Bank</h4>
          <span>🏦</span>
        </div>
        <div class="app-body bank-app">
          <div class="ekopay-card">
            <span class="card-label">Available Bank Balance</span>
            <h2 class="card-balance">₦${data.bank.balance.toLocaleString()}</h2>
            <div class="card-acct">Acct: ${data.bank.accountNumber} • ${data.username}</div>
          </div>
          <div class="transfer-form" style="margin-top: 14px;">
            <input type="text" id="transfer-tag-input" class="phone-input" placeholder="Recipient @username (e.g. zay_ne)" value="zay_ne" />
            <input type="number" id="transfer-amt-input" class="phone-input" placeholder="Amount (₦)" value="50000" />
            <button class="btn-phone-action" id="btn-send-transfer">Send Instant Transfer</button>
          </div>
        </div>
      `;
    }

    // 4. QUICKCHOP FOOD APP
    if (this.currentApp === 'chowdeck') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>QuickChop Food Delivery</h4>
          <span>🛵</span>
        </div>
        <div class="app-body chowdeck-app">
          <div class="chowdeck-banner">
            <h3>🍲 Hot Lagos Eats Delivered in 15 mins</h3>
          </div>
          <div class="chow-list">
            <div class="chow-item">
              <span>🍛 Special Party Jollof & Fried Plantain</span>
              <button class="btn-order-food" data-food-cost="4500" data-food-name="Party Jollof">Order ₦4,500</button>
            </div>
            <div class="chow-item">
              <span>🥩 Spicy Beef Suya & Cold Chapman</span>
              <button class="btn-order-food" data-food-cost="3800" data-food-name="Beef Suya">Order ₦3,800</button>
            </div>
            <div class="chow-item">
              <span>🐟 Fresh Catfish Pepper Soup</span>
              <button class="btn-order-food" data-food-cost="5500" data-food-name="Pepper Soup">Order ₦5,500</button>
            </div>
          </div>
        </div>
      `;
    }

    // 5. HOUSES & REAL ESTATE (Track B4 Expansion)
    if (this.currentApp === 'houses') {
      const allProps = data.properties || [];
      const ownedOrRentedProps = allProps.filter((p) => p.status === 'owned' || p.status === 'rented' || p.status === 'purchased');
      const filteredProps = allProps.filter((p) => {
        if (this.houseCityFilter === 'all') return true;
        return p.cityId === this.houseCityFilter;
      });

      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Naija Homes & Estates</h4>
          <span>🔑</span>
        </div>
        <div class="app-body houses-app">
          <!-- Active Housing Banner -->
          <div class="housing-status-banner">
            <div class="housing-status-top">
              <span class="housing-title">Real Estate Portfolio</span>
              <span class="housing-count">${ownedOrRentedProps.length} Properties</span>
            </div>
            ${ownedOrRentedProps.length > 0 ? `
              <div class="active-house-summary">
                <span>🏡 Active Base: <strong>${ownedOrRentedProps[0].name}</strong></span>
                <span class="active-house-loc">${ownedOrRentedProps[0].location || ownedOrRentedProps[0].districtId}</span>
              </div>
              <div class="housing-quick-actions">
                <button class="btn-house-quick-rest" data-phone-rest-prop="${ownedOrRentedProps[0].id}">
                  🛏️ Sleep & Recover (100% Vitals)
                </button>
                <button class="btn-house-quick-travel" data-phone-travel-prop="${ownedOrRentedProps[0].id}">
                  🚀 Fast Travel Home
                </button>
              </div>
            ` : `
              <div class="no-housing-banner">
                <span>🏕️ Currently Squatting • Rent or buy your first apartment below to unlock permanent free resting and fast travel!</span>
              </div>
            `}
          </div>

          <!-- City Filter Pills -->
          <div class="housing-city-tabs">
            <button class="btn-city-tab ${this.houseCityFilter === 'all' ? 'active' : ''}" data-house-city="all">All (${allProps.length})</button>
            <button class="btn-city-tab ${this.houseCityFilter === 'lagos' ? 'active' : ''}" data-house-city="lagos">🏖️ Lagos</button>
            <button class="btn-city-tab ${this.houseCityFilter === 'abuja' ? 'active' : ''}" data-house-city="abuja">🏛️ Abuja</button>
            <button class="btn-city-tab ${this.houseCityFilter === 'port_harcourt' ? 'active' : ''}" data-house-city="port_harcourt">🛢️ Port Harcourt</button>
          </div>

          <!-- Properties List -->
          <div class="houses-list">
            ${filteredProps.map((prop) => {
              const isOwned = prop.status === 'owned' || prop.status === 'purchased';
              const isRented = prop.status === 'rented';
              const isOwnedOrRented = isOwned || isRented;
              const statusClass = isOwned ? 'badge-owned' : isRented ? 'badge-rented' : 'badge-available';
              const statusLabel = isOwned ? 'OWNED TITLE' : isRented ? 'LEASED' : 'FOR SALE / LEASE';
              const perks = prop.perks || prop.features || [];

              return `
                <div class="phone-house-card ${isOwnedOrRented ? 'is-resident' : ''}">
                  <div class="house-card-header">
                    <div class="house-icon">${prop.icon}</div>
                    <div class="house-info">
                      <h5>${prop.name}</h5>
                      <span class="house-location">📍 ${prop.location || prop.districtId} • ${prop.type.toUpperCase()}</span>
                    </div>
                    <span class="house-status-badge ${statusClass}">${statusLabel}</span>
                  </div>

                  <div class="house-pricing-row">
                    ${prop.rentalPriceMonthly > 0 ? `
                      <div class="price-chip">
                        <span class="price-lbl">Monthly Lease</span>
                        <span class="price-val">₦${prop.rentalPriceMonthly.toLocaleString()}</span>
                      </div>
                    ` : ''}
                    <div class="price-chip">
                      <span class="price-lbl">Outright Purchase</span>
                      <span class="price-val price-gold">₦${prop.purchasePrice.toLocaleString()}</span>
                    </div>
                  </div>

                  <div class="house-perks-row">
                    ${perks.slice(0, 3).map((p) => `<span class="perk-tag">✨ ${p}</span>`).join('')}
                  </div>

                  <div class="house-card-actions">
                    ${isOwnedOrRented ? `
                      <button class="btn-house-action btn-house-rest" data-phone-rest-prop="${prop.id}">
                        🛏️ Rest & Sleep (100%)
                      </button>
                      <button class="btn-house-action btn-house-travel" data-phone-travel-prop="${prop.id}">
                        🚀 Fast Travel
                      </button>
                    ` : `
                      ${prop.rentalPriceMonthly > 0 ? `
                        <button class="btn-house-action btn-house-rent" data-phone-rent-prop="${prop.id}">
                          🔑 Lease (₦${prop.rentalPriceMonthly.toLocaleString()})
                        </button>
                      ` : ''}
                      <button class="btn-house-action btn-house-buy" data-phone-buy-prop="${prop.id}">
                        📜 Buy Deed (₦${prop.purchasePrice.toLocaleString()})
                      </button>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <button class="btn-phone-action btn-decor-cta" id="btn-open-house-catalogue" style="margin-top: 14px;">
            🛋️ Open Interior Furniture & Decor Catalogue
          </button>
        </div>
      `;
    }

    // 6. MEETUMO: SOCIAL & CLOUD HUB (Track D)
    if (this.currentApp === 'meetumo') {
      const netMgr = NetworkManager.getInstance();
      const cloudSync = CloudSyncService.getInstance();
      const cloudInfo = cloudSync.getSyncInfo();
      const onlinePlayers = netMgr ? netMgr.getOnlinePlayersList() : [
        { id: 'local', name: `${data.username} (You)`, avatar: '🇳🇬', streetCred: data.stats.streetCred, isLocal: true, pingMs: 12, currentEmote: 'idle' }
      ];

      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Meetumo • Social & Cloud Hub</h4>
          <span>🌀</span>
        </div>
        <div class="app-body meetumo-app">
          <!-- Server & Cloud Status Banner -->
          <div class="meetumo-server-banner">
            <div class="server-status-row">
              <span class="server-dot pulse-green"></span>
              <strong>${cloudInfo.serverRegionName}</strong>
              <span class="server-ping">⚡ ${cloudInfo.pingMs}ms</span>
            </div>
            <div class="server-meta-sub">
              <span>🟢 ${onlinePlayers.length} Citizen${onlinePlayers.length === 1 ? '' : 's'} Online</span> •
              <span>☁️ ${cloudInfo.lastSyncedFormatted}</span>
            </div>
          </div>

          <!-- Meetumo Navigation Tabs -->
          <div class="meetumo-tabs-row">
            <button class="btn-meetumo-tab ${this.meetumoTab === 'lobby' ? 'active' : ''}" data-meetumo-tab="lobby">
              👥 Citizens Lobby (${onlinePlayers.length})
            </button>
            <button class="btn-meetumo-tab ${this.meetumoTab === 'cloud' ? 'active' : ''}" data-meetumo-tab="cloud">
              ☁️ EkoCloud Sync
            </button>
          </div>

          ${this.meetumoTab === 'cloud' ? `
            <!-- EkoCloud Sync View -->
            <div class="meetumo-cloud-section">
              <div class="cloud-code-card">
                <span class="cloud-label">Your Unique Cloud Save Code</span>
                <div class="cloud-code-box">
                  <span class="cloud-code-text" id="cloud-display-code">${cloudInfo.backupCode}</span>
                  <button class="btn-copy-code" id="btn-copy-cloud-code" title="Copy Cloud Code">📋 Copy</button>
                </div>
                <small class="cloud-hint">Keep this code to instantly recover all cash, houses, businesses, and cars across devices.</small>
              </div>

              <div class="cloud-actions-grid">
                <button class="btn-meetumo-action btn-cloud-save" id="btn-manual-cloud-save">
                  <span>☁️</span>
                  <span>Sync & Save Now</span>
                </button>
                <button class="btn-meetumo-action btn-cloud-export" id="btn-export-cloud-save">
                  <span>📦</span>
                  <span>Export Full Save</span>
                </button>
              </div>

              <div class="cloud-restore-card">
                <h5>📥 Restore from Cloud or Friend's Code</h5>
                <div class="cloud-restore-input-group">
                  <input type="text" id="cloud-import-input" class="phone-input" placeholder="Paste Cloud Code (e.g. EKO-XXXX-NIG) or Export..." />
                  <button class="btn-phone-action btn-restore-cloud" id="btn-import-cloud-save">
                    Restore Save
                  </button>
                </div>
              </div>

              <!-- Server Region Switcher -->
              <div class="server-region-card">
                <h5>🌐 Select Real-Time Gateway</h5>
                <div class="region-buttons-row">
                  <button class="btn-region-pill ${cloudInfo.serverRegion === 'lagos' ? 'active' : ''}" data-cloud-region="lagos">
                    🏝️ Lagos Broad St (15ms)
                  </button>
                  <button class="btn-region-pill ${cloudInfo.serverRegion === 'abuja' ? 'active' : ''}" data-cloud-region="abuja">
                    🏛️ Abuja FCT (22ms)
                  </button>
                  <button class="btn-region-pill ${cloudInfo.serverRegion === 'port_harcourt' ? 'active' : ''}" data-cloud-region="port_harcourt">
                    🛢️ Port Harcourt (28ms)
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <!-- Citizens Lobby View -->
            <div class="meetumo-lobby-section">
              <div class="lobby-citizens-list">
                ${onlinePlayers.map((p) => `
                  <div class="citizen-card ${p.isLocal ? 'citizen-card-local' : ''}">
                    <div class="citizen-avatar">${p.avatar}</div>
                    <div class="citizen-details">
                      <div class="citizen-title-row">
                        <strong>${p.name}</strong>
                        <span class="citizen-cred-badge">⭐ ${p.streetCred} Cred</span>
                      </div>
                      <span class="citizen-status-sub">
                        ${p.isLocal ? '🟢 You • In Current District' : `⚡ Online • Ping: ${p.pingMs}ms`}
                      </span>
                    </div>

                    <div class="citizen-actions">
                      ${!p.isLocal ? `
                        <button class="btn-wire-citizen" data-wire-recipient="${p.id}" data-wire-name="${p.name}" title="Wire ₦5,000 via EkoPay">
                          💸 Wire ₦5k
                        </button>
                      ` : `
                        <span class="local-player-tag">YOU</span>
                      `}
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Quick P2P Wire Box -->
              <div class="quick-wire-box">
                <h5>⚡ EkoPay Peer-to-Peer Transfer</h5>
                <div class="quick-wire-inputs">
                  <input type="text" id="meetumo-wire-id" class="phone-input" placeholder="Recipient ID or handle" value="${onlinePlayers.find(p => !p.isLocal)?.id || ''}" />
                  <input type="number" id="meetumo-wire-amount" class="phone-input" placeholder="Amount (₦)" value="10000" />
                  <button class="btn-phone-action" id="btn-meetumo-send-wire">
                    💸 Send Instant Wire
                  </button>
                </div>
              </div>
            </div>
          `}
        </div>
      `;
    }

    // DEFAULT: PHONE HOME SCREEN (Matching Screenshot 1 exactly!)
    return `
      <!-- Phone Lockscreen Big Clock & Date -->
      <div class="phone-home-lock-header">
        <div class="phone-lock-time">9:59</div>
        <div class="phone-lock-date">Thursday 8 October · Lagos</div>
      </div>

      <!-- Update Banner Pill (Screenshot 1) -->
      <div class="phone-update-banner">
        <span class="update-icon">⚡</span>
        <span class="update-text">A new update is ready</span>
        <button class="update-refresh-pill" id="btn-phone-refresh">Refresh</button>
      </div>

      <!-- 4x4 Grid of App Icons (Screenshot 1) -->
      <div class="phone-app-grid-4x4">
        <!-- Row 1 -->
        <button class="app-grid-icon-btn" data-app="jobs">
          <div class="app-tile-box bg-jobs">💼</div>
          <span class="app-tile-label">Jobs</span>
        </button>

        <button class="app-grid-icon-btn" data-app="messages">
          <div class="app-tile-box bg-messages">
            💬
            <span class="app-badge-red">8</span>
          </div>
          <span class="app-tile-label">Messages</span>
        </button>

        <button class="app-grid-icon-btn" data-app="meetumo">
          <div class="app-tile-box bg-meetumo">🌀</div>
          <span class="app-tile-label">Meetumo</span>
        </button>

        <button class="app-grid-icon-btn" data-app="eleventhoo">
          <div class="app-tile-box bg-eleventhoo">🔥</div>
          <span class="app-tile-label">Eleventhoo</span>
        </button>

        <!-- Row 2 -->
        <button class="app-grid-icon-btn" data-app="popout">
          <div class="app-tile-box bg-popout">🅿️</div>
          <span class="app-tile-label">PopOut Tickets</span>
        </button>

        <button class="app-grid-icon-btn" data-app="games">
          <div class="app-tile-box bg-games">🎮</div>
          <span class="app-tile-label">Games</span>
        </button>

        <button class="app-grid-icon-btn" data-app="nollywood">
          <div class="app-tile-box bg-nollywood">🎬</div>
          <span class="app-tile-label">Nollywood</span>
        </button>

        <button class="app-grid-icon-btn" data-app="bettips">
          <div class="app-tile-box bg-bettips">
            ⚽
            <span class="app-badge-new">NEW</span>
          </div>
          <span class="app-tile-label">BetTips</span>
        </button>

        <!-- Row 3 -->
        <button class="app-grid-icon-btn" data-app="versiah">
          <div class="app-tile-box bg-versiah">
            🔺
            <span class="app-badge-new">NEW</span>
          </div>
          <span class="app-tile-label">versiah.com</span>
        </button>

        <button class="app-grid-icon-btn" data-app="contacts">
          <div class="app-tile-box bg-contacts">📞</div>
          <span class="app-tile-label">Contacts</span>
        </button>

        <button class="app-grid-icon-btn" data-app="camera">
          <div class="app-tile-box bg-camera" style="background: linear-gradient(135deg, #0284c7, #38bdf8); box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);">📸</div>
          <span class="app-tile-label">Camera</span>
        </button>

        <button class="app-grid-icon-btn" data-app="ride">
          <div class="app-tile-box bg-ride">🚕</div>
          <span class="app-tile-label">Ride</span>
        </button>

        <!-- Row 4 -->
        <button class="app-grid-icon-btn" data-app="chowdeck">
          <div class="app-tile-box bg-chowdeck">🛵</div>
          <span class="app-tile-label">QuickChop</span>
        </button>

        <button class="app-grid-icon-btn" data-app="bank">
          <div class="app-tile-box bg-bank">🏦</div>
          <span class="app-tile-label">Bank</span>
        </button>

        <button class="app-grid-icon-btn" data-app="boutique">
          <div class="app-tile-box bg-boutique">👠</div>
          <span class="app-tile-label">Boutique</span>
        </button>

        <button class="app-grid-icon-btn" data-app="forbes">
          <div class="app-tile-box bg-forbes">👑</div>
          <span class="app-tile-label">Forbes</span>
        </button>
      </div>

      <!-- Frosted Bottom Dock Row (Screenshot 1) -->
      <div class="phone-dock-pill-bar">
        <button class="app-dock-icon-btn" data-app="houses" title="Houses & Real Estate">
          <span class="dock-icon-emoji">🔑</span>
          <span class="dock-label">Houses</span>
        </button>

        <button class="app-dock-icon-btn" data-app="cars" title="Cars & Garage">
          <span class="dock-icon-emoji">🚙</span>
          <span class="dock-label">Cars</span>
        </button>

        <button class="app-dock-icon-btn" data-app="invite" title="Invite Friends">
          <span class="dock-icon-emoji">🔗</span>
          <span class="dock-label">Invite</span>
        </button>

        <button class="app-dock-icon-btn" data-app="health" title="Health & Vitals">
          <span class="dock-icon-emoji">💊</span>
          <span class="dock-label">Health</span>
        </button>
      </div>
    `;
  }

  private setupEvents(): void {
    // Floating top close button
    const floatClose = document.getElementById('phone-btn-floating-close');
    if (floatClose) {
      floatClose.onclick = () => {
        this.close();
      };
    }

    // Bottom home gesture bar
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
        const target = (btn as HTMLElement).getAttribute('data-app') as string;
        if (target === 'camera') {
          this.close();
          this.onOpenPhotoMode?.();
          return;
        }
        this.openApp(target as PhoneAppId);
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

    // Chat Action: Send money in chat (Screenshot 4)
    const actSendMoney = document.getElementById('chat-act-sendmoney');
    if (actSendMoney && this.activeContactId) {
      actSendMoney.onclick = () => {
        const contact = this.phoneSystem.contacts.find((c) => c.id === this.activeContactId)!;
        const amount = 50000;
        const res = this.phoneSystem.transferMoney(contact.handle || contact.id, amount);
        if (res.success) {
          SoundEngine.getInstance().playTransactionSuccess();
          contact.messages.push({
            sender: 'system',
            transferAmount: amount,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          showGameToast(`💸 Transferred ₦${amount.toLocaleString()} to ${contact.name}!`, 'success');
          this.render();
        } else {
          showGameToast(res.message, 'error');
        }
      };
    }

    // Chat Action: Invite over
    const actInvite = document.getElementById('chat-act-invite');
    if (actInvite && this.activeContactId) {
      actInvite.onclick = () => {
        const contact = this.phoneSystem.contacts.find((c) => c.id === this.activeContactId)!;
        contact.messages.push({
          sender: 'me',
          text: 'Come over to my flat in Victoria Island! Generator is on with AC blowing.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        setTimeout(() => {
          contact.messages.push({
            sender: 'them',
            text: 'On my way in an Uber! Keep chilled Chapman ready for me!',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          this.render();
        }, 1200);
        this.render();
      };
    }

    // Chat Quick Stickers (Lion Odogwu & Fire E choke)
    const stickerBtns = this.container.querySelectorAll('[data-sticker]');
    stickerBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        if (!this.activeContactId) return;
        const stickerType = (btn as HTMLElement).getAttribute('data-sticker') as any;
        const contact = this.phoneSystem.contacts.find((c) => c.id === this.activeContactId)!;
        contact.messages.push({
          sender: 'me',
          sticker: stickerType,
          stickerCaption: stickerType === 'lion' ? 'Odogwu!' : 'E choke!',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        this.render();
      };
    });

    // Chat Quick text messages
    const quickMsgBtns = this.container.querySelectorAll('[data-quick-msg]');
    quickMsgBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        if (!this.activeContactId) return;
        const msg = (btn as HTMLElement).getAttribute('data-quick-msg')!;
        this.phoneSystem.sendMessage(this.activeContactId, msg);
        this.render();
      };
    });

    // Chat reply form
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

    // === JOBS & MINIGAMES EVENT HANDLERS (Track B2) ===
    // Minigame Launchers
    document.getElementById('btn-launch-danfo-hustle')?.addEventListener('click', () => {
      this.danfoMinigameActive = true;
      this.danfoMinigameStep = 0;
      this.techMinigameActive = false;
      this.genMinigameActive = false;
      this.render();
    });

    document.getElementById('btn-launch-tech-hustle')?.addEventListener('click', () => {
      this.techMinigameActive = true;
      this.techMinigameStep = 0;
      this.danfoMinigameActive = false;
      this.genMinigameActive = false;
      this.render();
    });

    document.getElementById('btn-launch-nepa-hustle')?.addEventListener('click', () => {
      this.genMinigameActive = true;
      this.genMinigameStep = 0;
      this.danfoMinigameActive = false;
      this.techMinigameActive = false;
      this.render();
    });

    // Danfo Conductor Minigame Steps
    document.getElementById('btn-danfo-call')?.addEventListener('click', () => {
      this.danfoMinigameStep = 1;
      SoundEngine.getInstance().playVehicleHorn('danfo');
      showGameToast('📢 "Obalende straight! Enter with your change!" Bus full of passengers!', 'info');
      this.render();
    });

    document.getElementById('btn-danfo-change')?.addEventListener('click', () => {
      if (this.danfoMinigameStep >= 1) {
        this.danfoMinigameStep = 2;
        SoundEngine.getInstance().playTransactionSuccess();
        showGameToast('💵 Collected ₦1,000 note and returned crisp ₦600 change! Conductor skill 100!', 'success');
        this.render();
      } else {
        showGameToast('❌ Call the bus passengers to board first!', 'warning');
      }
    });

    document.getElementById('btn-danfo-drop')?.addEventListener('click', () => {
      if (this.danfoMinigameStep >= 2) {
        this.danfoMinigameActive = false;
        this.backend.addCash(12500);
        this.backend.addStreetCred(25);
        SoundEngine.getInstance().playTransactionSuccess();
        showGameToast('🏁 CMS to Obalende trip complete! Earned ₦12,500 cash & +25 Street Cred!', 'success', 4500);
        this.render();
      } else {
        showGameToast('❌ Collect all passenger fares before dropping them off!', 'warning');
      }
    });

    document.getElementById('btn-cancel-danfo')?.addEventListener('click', () => {
      this.danfoMinigameActive = false;
      this.render();
    });

    // Tech Bro CcHub Minigame Steps
    document.getElementById('btn-tech-webhook')?.addEventListener('click', () => {
      this.techMinigameStep = 1;
      showGameToast('🪲 Fixed idempotency key duplicate charge bug! API tests passing.', 'info');
      this.render();
    });

    document.getElementById('btn-tech-cache')?.addEventListener('click', () => {
      if (this.techMinigameStep >= 1) {
        this.techMinigameStep = 2;
        showGameToast('⚡ Redis cache layer deployed! Query latency reduced from 850ms to 12ms!', 'info');
        this.render();
      } else {
        showGameToast('❌ Fix the webhook bug first before caching!', 'warning');
      }
    });

    document.getElementById('btn-tech-deploy')?.addEventListener('click', () => {
      if (this.techMinigameStep >= 2) {
        this.techMinigameActive = false;
        this.backend.addCash(25000);
        this.backend.addStreetCred(35);
        SoundEngine.getInstance().playTransactionSuccess();
        showGameToast('🚀 CI/CD build green! Pull request merged to main! Earned ₦25,000 & +35 Street Cred!', 'success', 4500);
        this.render();
      } else {
        showGameToast('❌ Optimize cache before shipping code to production!', 'warning');
      }
    });

    document.getElementById('btn-cancel-tech')?.addEventListener('click', () => {
      this.techMinigameActive = false;
      this.render();
    });

    // NEPA Minigame Steps
    document.getElementById('btn-nepa-fuel')?.addEventListener('click', () => {
      this.genMinigameStep = 1;
      showGameToast('⛽ Tank has fuel! Step 1 complete.', 'info');
      this.render();
    });

    document.getElementById('btn-nepa-choke')?.addEventListener('click', () => {
      if (this.genMinigameStep >= 1) {
        this.genMinigameStep = 2;
        showGameToast('🔧 Choke valve opened wide! Ready to pull!', 'info');
        this.render();
      } else {
        showGameToast('❌ Check fuel first before opening the choke!', 'warning');
      }
    });

    document.getElementById('btn-nepa-pull')?.addEventListener('click', () => {
      if (this.genMinigameStep >= 2) {
        this.genMinigameActive = false;
        this.backend.addCash(20000);
        this.backend.addStreetCred(30);
        SoundEngine.getInstance().playTransactionSuccess();
        showGameToast('🔥 GBRRRR-BRRRR! Tiger generator fired up! Light restored! +₦20,000 cash, +30 Street Cred!', 'success', 4500);
        this.render();
      } else {
        showGameToast('❌ Open the choke and check fuel before pulling the cord!', 'warning');
      }
    });

    document.getElementById('btn-cancel-nepa')?.addEventListener('click', () => {
      this.genMinigameActive = false;
      this.render();
    });

    // Claim Active Job Shift Salary
    document.getElementById('btn-claim-shift-salary')?.addEventListener('click', () => {
      const res = this.backend.completeJobShift();
      if (res.success) {
        SoundEngine.getInstance().playTransactionSuccess();
        showGameToast(`🎉 ${res.message}`, 'success', 4500);
        this.render();
      } else {
        showGameToast(res.message, 'warning');
      }
    });

    // Take Job Shift Buttons
    const jobApplyBtns = this.container.querySelectorAll('[data-start-job]');
    jobApplyBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const jobId = (btn as HTMLElement).getAttribute('data-start-job');
        if (!jobId) return;
        const res = this.backend.startJobShift(jobId);
        if (res.success) {
          showGameToast(res.message, 'success');
          this.startShiftTicker();
          this.render();
        } else {
          showGameToast(res.message, 'warning');
        }
      };
    });

    // Food Order in QuickChop
    const foodOrderBtns = this.container.querySelectorAll('[data-food-cost]');
    foodOrderBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const cost = Number((btn as HTMLElement).getAttribute('data-food-cost')) || 4000;
        const name = (btn as HTMLElement).getAttribute('data-food-name') || 'Hot Food';
        const res = this.backend.consumeFood(name, 55, 45, 20, cost);
        if (res.success) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast(`🛵 QuickChop rider arrived! ${name} delivered! +55% Hunger, +45% Energy!`, 'success');
          this.render();
        } else {
          showGameToast(res.message, 'error');
        }
      };
    });

    // Open house catalogue
    const catBtn = document.getElementById('btn-open-house-catalogue');
    if (catBtn) {
      catBtn.onclick = () => {
        this.close();
        HouseDecorationSystem.getInstance().openCatalogueModal();
      };
    }

    // Housing City Filter Tabs
    const cityTabBtns = this.container.querySelectorAll('[data-house-city]');
    cityTabBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const city = (btn as HTMLElement).getAttribute('data-house-city');
        if (city) {
          this.houseCityFilter = city;
          this.render();
        }
      };
    });

    // Rent Property from Phone
    const rentPropBtns = this.container.querySelectorAll('[data-phone-rent-prop]');
    rentPropBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-phone-rent-prop')!;
        const res = this.backend.rentProperty(id);
        if (res.success) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast(res.message, 'success', 4500);
          this.render();
        } else {
          showGameToast(res.message, 'warning');
        }
      };
    });

    // Buy Property Deed from Phone
    const buyPropBtns = this.container.querySelectorAll('[data-phone-buy-prop]');
    buyPropBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-phone-buy-prop')!;
        const res = this.backend.buyProperty(id);
        if (res.success) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast(res.message, 'success', 5000);
          this.render();
        } else {
          showGameToast(res.message, 'warning');
        }
      };
    });

    // Rest at Property from Phone
    const restPropBtns = this.container.querySelectorAll('[data-phone-rest-prop]');
    restPropBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-phone-rest-prop')!;
        const res = this.backend.restAtProperty(id);
        if (res.success) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast(res.message, 'success', 4500);
          this.render();
        } else {
          showGameToast(res.message, 'info');
        }
      };
    });

    // Fast Travel Home from Phone
    const travelPropBtns = this.container.querySelectorAll('[data-phone-travel-prop]');
    travelPropBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-phone-travel-prop')!;
        const prop = this.backend.getData().properties.find((p) => p.id === id);
        if (prop && prop.streetPosition && this.onFastTravel) {
          this.close();
          this.onFastTravel(prop.streetPosition, prop.name);
        } else if (prop && prop.streetPosition) {
          showGameToast(`📍 Arrived at your residence: ${prop.name}!`, 'success');
          this.close();
        } else {
          showGameToast('Cannot fast travel to this property.', 'info');
        }
      };
    });

    // === MEETUMO SOCIAL & CLOUD HUB EVENTS (Track D) ===
    // Tab switching
    const meetumoTabs = this.container.querySelectorAll('[data-meetumo-tab]');
    meetumoTabs.forEach((tab) => {
      (tab as HTMLElement).onclick = () => {
        const target = (tab as HTMLElement).getAttribute('data-meetumo-tab') as any;
        if (target) {
          this.meetumoTab = target;
          this.render();
        }
      };
    });

    // Copy Cloud Code
    const copyCodeBtn = document.getElementById('btn-copy-cloud-code');
    if (copyCodeBtn) {
      copyCodeBtn.onclick = () => {
        const code = CloudSyncService.getInstance().getSyncInfo().backupCode;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(code);
        }
        SoundEngine.getInstance().playClickSound();
        showGameToast(`📋 Cloud Code ${code} copied to clipboard!`, 'success');
      };
    }

    // Manual Cloud Save
    const manualSaveBtn = document.getElementById('btn-manual-cloud-save');
    if (manualSaveBtn) {
      manualSaveBtn.onclick = () => {
        const ok = CloudSyncService.getInstance().saveToCloud();
        if (ok) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast('☁️ Progress safely synchronized to NaijaCloud!', 'success');
          this.render();
        } else {
          showGameToast('Cloud save failed.', 'warning');
        }
      };
    }

    // Export Cloud Save
    const exportSaveBtn = document.getElementById('btn-export-cloud-save');
    if (exportSaveBtn) {
      exportSaveBtn.onclick = () => {
        const exportStr = CloudSyncService.getInstance().exportBackupString();
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(exportStr);
        }
        SoundEngine.getInstance().playTransactionSuccess();
        showGameToast('📦 Encrypted full save string copied to clipboard! Save or transfer anywhere.', 'success', 6000);
      };
    }

    // Import Cloud Save
    const importSaveBtn = document.getElementById('btn-import-cloud-save');
    if (importSaveBtn) {
      importSaveBtn.onclick = () => {
        const input = (document.getElementById('cloud-import-input') as HTMLInputElement)?.value;
        const res = CloudSyncService.getInstance().importBackupString(input || '');
        if (res.success) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast(res.message, 'success', 6000);
          this.render();
        } else {
          showGameToast(res.message, 'error', 5000);
        }
      };
    }

    // Region Switcher
    const regionBtns = this.container.querySelectorAll('[data-cloud-region]');
    regionBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const reg = (btn as HTMLElement).getAttribute('data-cloud-region') as any;
        if (reg) {
          CloudSyncService.getInstance().setServerRegion(reg);
          SoundEngine.getInstance().playClickSound();
          showGameToast(`🌐 Connected to ${reg.toUpperCase()} Gateway!`, 'info');
          this.render();
        }
      };
    });

    // Wire citizen ₦5,000 quick button
    const wireBtns = this.container.querySelectorAll('[data-wire-recipient]');
    wireBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const recipientId = (btn as HTMLElement).getAttribute('data-wire-recipient')!;
        const name = (btn as HTMLElement).getAttribute('data-wire-name') || recipientId;
        const net = NetworkManager.getInstance();
        if (net) {
          const res = net.sendP2PTransfer(recipientId, 5000, 'Peer-to-Peer Gift');
          if (res.success) {
            SoundEngine.getInstance().playTransactionSuccess();
            showGameToast(`💸 Wired ₦5,000 to ${name}!`, 'success');
            this.render();
          } else {
            showGameToast(res.message, 'warning');
          }
        }
      };
    });

    // Custom P2P wire submit
    const customWireBtn = document.getElementById('btn-meetumo-send-wire');
    if (customWireBtn) {
      customWireBtn.onclick = () => {
        const recId = (document.getElementById('meetumo-wire-id') as HTMLInputElement)?.value.trim();
        const amt = parseInt((document.getElementById('meetumo-wire-amount') as HTMLInputElement)?.value, 10);
        if (!recId) {
          showGameToast('Please specify recipient citizen ID or handle.', 'warning');
          return;
        }
        if (isNaN(amt) || amt <= 0) {
          showGameToast('Please enter a valid transfer amount.', 'warning');
          return;
        }
        const net = NetworkManager.getInstance();
        if (net) {
          const res = net.sendP2PTransfer(recId, amt, 'EkoPay Direct Wire');
          if (res.success) {
            SoundEngine.getInstance().playTransactionSuccess();
            this.render();
          } else {
            showGameToast(res.message, 'warning');
          }
        }
      };
    }
  }
}
