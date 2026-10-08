import { PhoneSystem } from '../phone/PhoneSystem';
import { BackendService } from '../backend/BackendService';
import type { PhoneAppId } from '../phone/types';
import { HouseDecorationSystem } from '../housing/HouseDecorationSystem';

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

    // 2. JOBS & WORK MINIGAME (Matching Screenshot 2)
    if (this.currentApp === 'jobs') {
      const allJobs = this.phoneSystem.jobs;

      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Jobs & Gigs • Trans-Amadi</h4>
          <span>💼</span>
        </div>
        <div class="app-body jobs-app">
          ${this.genMinigameActive ? `
            <!-- NEPA took light Generator Minigame (Screenshot 2) -->
            <div class="nepa-minigame-card">
              <div class="nepa-card-header">
                <span class="nepa-icon">🔌</span>
                <div>
                  <h4>NEPA took light. The gen won't start</h4>
                  <small>Tap the steps in order • Chidinma is watching (${this.genMinigameTimer}s)</small>
                </div>
              </div>

              <div class="nepa-steps-display">
                <span class="${this.genMinigameStep >= 1 ? 'step-done' : ''}">1. Check the fuel</span>
                <span class="${this.genMinigameStep >= 2 ? 'step-done' : ''}">2. Open the choke</span>
                <span class="${this.genMinigameStep >= 3 ? 'step-done' : ''}">3. Pull the cord</span>
              </div>

              <div class="nepa-buttons-grid">
                <button class="nepa-step-btn" id="btn-nepa-choke">
                  <span>🔧</span>
                  <span>Open the choke</span>
                </button>
                <button class="nepa-step-btn" id="btn-nepa-pull">
                  <span>💪</span>
                  <span>Pull the cord</span>
                </button>
                <button class="nepa-step-btn" id="btn-nepa-fuel">
                  <span>⛽</span>
                  <span>Check the fuel</span>
                </button>
              </div>

              <div class="nepa-bottom-choice">
                <button class="nepa-choice-pill" id="btn-nepa-do-it">
                  <strong>Do it</strong>
                  <small>HANDS-ON (+₦25,000 & Cred)</small>
                </button>
                <button class="nepa-choice-pill" id="btn-nepa-pass-it">
                  <strong>Pass it to Chidinma</strong>
                  <small>SAFE BET</small>
                </button>
              </div>
            </div>
          ` : `
            <div class="jobs-overview-banner">
              <button class="btn-trigger-nepa-shift" id="btn-trigger-nepa-demo">
                ⚡ Trigger NEPA Generator Shift Minigame
              </button>
            </div>
          `}

          <div class="app-section-title">Available Shifts & Careers</div>
          <div class="jobs-list">
            ${allJobs.map((job) => `
              <div class="job-card">
                <div class="job-header">
                  <span class="job-icon">${job.icon}</span>
                  <div class="job-meta">
                    <h5>${job.title}</h5>
                    <span class="job-company">${job.company}</span>
                  </div>
                  <span class="job-pay">₦${job.pay.toLocaleString()}</span>
                </div>
                <p class="job-desc">${job.description}</p>
                <div class="job-footer">
                  <span class="job-cost">⚡ ${job.energyCost}% Energy</span>
                  <button class="btn-job-apply" data-start-job="${job.id}">
                    Take Shift
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

    // 4. CHOWDECK FOOD APP
    if (this.currentApp === 'chowdeck') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Chowdeck Food Delivery</h4>
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

    // 5. HOUSES & CARS & BOUTIQUE
    if (this.currentApp === 'houses') {
      return `
        <div class="phone-app-header">
          <button class="phone-back-btn" id="app-back-btn">←</button>
          <h4>Lagos Real Estate & Mansions</h4>
          <span>🔑</span>
        </div>
        <div class="app-body">
          <p style="padding: 10px; font-size: 13px; color: #cbd5e1;">Manage your residential properties and luxury flat interiors.</p>
          <button class="btn-phone-action" id="btn-open-house-catalogue">Open Home Decor Catalogue</button>
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

        <button class="app-grid-icon-btn" data-app="help">
          <div class="app-tile-box bg-help">💡</div>
          <span class="app-tile-label">Help & guide</span>
        </button>

        <button class="app-grid-icon-btn" data-app="ride">
          <div class="app-tile-box bg-ride">🚕</div>
          <span class="app-tile-label">Ride</span>
        </button>

        <!-- Row 4 -->
        <button class="app-grid-icon-btn" data-app="chowdeck">
          <div class="app-tile-box bg-chowdeck">🛵</div>
          <span class="app-tile-label">Chowdeck</span>
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

    // Chat Action: Send money in chat (Screenshot 4)
    const actSendMoney = document.getElementById('chat-act-sendmoney');
    if (actSendMoney && this.activeContactId) {
      actSendMoney.onclick = () => {
        const contact = this.phoneSystem.contacts.find((c) => c.id === this.activeContactId)!;
        const amountStr = prompt(`Send money to @${contact.handle || contact.id}:`, '2000000');
        const amount = Number(amountStr) || 0;
        if (amount > 0) {
          const res = this.phoneSystem.transferMoney(contact.handle || contact.id, amount);
          if (res.success) {
            contact.messages.push({
              sender: 'system',
              transferAmount: amount,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
            this.render();
          } else {
            alert(res.message);
          }
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

    // NEPA Minigame Shift Trigger
    const nepaDemoBtn = document.getElementById('btn-trigger-nepa-demo');
    if (nepaDemoBtn) {
      nepaDemoBtn.onclick = () => {
        this.genMinigameActive = true;
        this.genMinigameStep = 0;
        this.genMinigameTimer = 7;
        this.render();
      };
    }

    // NEPA Minigame Steps
    const chokeBtn = document.getElementById('btn-nepa-choke');
    if (chokeBtn) {
      chokeBtn.onclick = () => {
        if (this.genMinigameStep === 1) {
          this.genMinigameStep = 2;
          this.render();
        } else {
          alert('❌ Check the fuel first before opening the choke!');
        }
      };
    }

    const fuelBtn = document.getElementById('btn-nepa-fuel');
    if (fuelBtn) {
      fuelBtn.onclick = () => {
        if (this.genMinigameStep === 0) {
          this.genMinigameStep = 1;
          this.render();
        }
      };
    }

    const pullBtn = document.getElementById('btn-nepa-pull');
    if (pullBtn) {
      pullBtn.onclick = () => {
        if (this.genMinigameStep === 2) {
          this.genMinigameStep = 3;
          this.genMinigameActive = false;
          this.backend.addCash(25000);
          this.backend.addStreetCred(35);
          alert('🔥 GBRRRR-BRRRR! Generator fired up! Light restored to Trans-Amadi! You earned ₦25,000 cash and +35 Street Cred!');
          this.render();
        } else {
          alert('❌ Open the choke and check fuel before pulling the cord!');
        }
      };
    }

    const doItBtn = document.getElementById('btn-nepa-do-it');
    if (doItBtn) {
      doItBtn.onclick = () => {
        this.genMinigameStep = 1;
        this.render();
      };
    }

    const passItBtn = document.getElementById('btn-nepa-pass-it');
    if (passItBtn) {
      passItBtn.onclick = () => {
        this.genMinigameActive = false;
        alert('Chidinma stepped in and pulled the cord. Safe bet! Job shift complete.');
        this.render();
      };
    }

    // Food Order in Chowdeck
    const foodOrderBtns = this.container.querySelectorAll('[data-food-cost]');
    foodOrderBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const cost = Number((btn as HTMLElement).getAttribute('data-food-cost')) || 4000;
        const name = (btn as HTMLElement).getAttribute('data-food-name') || 'Hot Food';
        const data = this.backend.getData();
        if (data.walletCash >= cost) {
          this.backend.spendCash(cost, `Chowdeck: ${name}`);
          this.backend.restoreEnergy(50);
          alert(`🛵 Chowdeck dispatched! ${name} delivered to you! Restored +50% Energy!`);
        } else {
          alert(`❌ You need ₦${cost} cash to order from Chowdeck.`);
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
  }
}
