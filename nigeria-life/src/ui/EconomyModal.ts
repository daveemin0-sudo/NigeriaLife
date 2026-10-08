import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';
import type { World } from '../world/World';
import { showGameToast } from './GameToast';

export class EconomyModal {
  private container: HTMLDivElement;
  private backend: BackendService;
  private world?: World;
  private isOpen: boolean = false;
  private activeTab: 'businesses' | 'properties' | 'career' = 'businesses';
  private highlightedBuildingId: string | null = null;

  constructor(world?: World) {
    this.backend = BackendService.getInstance();
    this.world = world;
    this.container = document.createElement('div');
    this.container.id = 'economy-modal';
    this.container.className = 'lagos-modal';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);

    this.backend.subscribe(this.render.bind(this));
    this.setupGlobalShortcuts();
  }

  private setupGlobalShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'e' || e.key === 'E') {
        // Ignore if typing in input
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        this.toggle();
      }
    });
  }

  public open(highlightBuildingId?: string): void {
    this.isOpen = true;
    this.highlightedBuildingId = highlightBuildingId || null;
    if (highlightBuildingId === 'villa-compound') {
      this.activeTab = 'properties';
    } else if (highlightBuildingId) {
      this.activeTab = 'businesses';
    }
    this.container.style.display = 'flex';
    this.render(this.backend.getData());

    // Scroll to highlighted item if present
    if (this.highlightedBuildingId) {
      setTimeout(() => {
        const el = document.getElementById(`biz-item-${this.highlightedBuildingId}`) ||
          document.getElementById(`prop-item-${this.highlightedBuildingId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-pulse');
        }
      }, 100);
    }
  }

  public close(): void {
    this.isOpen = false;
    this.highlightedBuildingId = null;
    this.container.style.display = 'none';
  }

  public toggle(highlightBuildingId?: string): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(highlightBuildingId);
    }
  }

  private render(data: PlayerAccount): void {
    if (!this.isOpen) return;

    const totalValuation = data.businesses.reduce(
      (sum, b) => sum + (b.owned ? b.purchasePrice : 0),
      0
    );

    const totalIncomePerMin = data.businesses.reduce((sum, b) => {
      if (!b.owned) return sum;
      let inc = b.baseIncomePerCycle;
      for (const u of b.upgrades) {
        if (u.purchased) inc += u.bonusIncomePerCycle;
      }
      return sum + inc;
    }, 0);

    const totalPending = data.businesses.reduce(
      (sum, b) => sum + (b.owned ? b.pendingRevenue : 0),
      0
    );

    this.container.innerHTML = `
      <div class="modal-dialog economy-dialog">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="modal-tag">🏛️ Lagos Island Commercial Exchange</span>
            <h2>Enterprises & Property Hub</h2>
            <p>Acquire commercial storefronts, earn automated cashflow, and secure prime Lagos real estate.</p>
          </div>
          <button class="modal-close-btn" id="econ-close-btn">&times;</button>
        </div>

        <!-- Performance Metrics Banner -->
        <div class="econ-metrics-grid">
          <div class="econ-metric-card">
            <span class="metric-title">Portfolio Valuation</span>
            <div class="metric-val">₦${totalValuation.toLocaleString()}</div>
            <span class="metric-sub">${data.businesses.filter((b) => b.owned).length} Owned Enterprises</span>
          </div>

          <div class="econ-metric-card highlight">
            <span class="metric-title">Passive Cashflow Rate</span>
            <div class="metric-val text-emerald">+₦${totalIncomePerMin.toLocaleString()} <small>/ min</small></div>
            <span class="metric-sub">Direct to Enterprise Vault</span>
          </div>

          <div class="econ-metric-card pending-card">
            <span class="metric-title">Unclaimed Profits</span>
            <div class="metric-val text-gold">₦${totalPending.toLocaleString()}</div>
            <button class="btn-claim-all-econ" id="btn-econ-claim-all" ${totalPending <= 0 ? 'disabled' : ''}>
              💰 Transfer to Bank
            </button>
          </div>

          <div class="econ-metric-card">
            <span class="metric-title">Career Standing</span>
            <div class="metric-val" style="font-size: 16px; margin-top: 4px;">🏆 ${data.career.title}</div>
            <span class="metric-sub">Level ${data.career.rankLevel} • ${(data.career.bonusMultiplier * 100).toFixed(0)}% Pay Multiplier</span>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="econ-tab-bar">
          <button class="econ-tab-btn ${this.activeTab === 'businesses' ? 'active' : ''}" data-tab="businesses">
            🏢 Commercial Enterprises (${data.businesses.length})
          </button>
          <button class="econ-tab-btn ${this.activeTab === 'properties' ? 'active' : ''}" data-tab="properties">
            🏡 Prime Real Estate (${data.properties.length})
          </button>
          <button class="econ-tab-btn ${this.activeTab === 'career' ? 'active' : ''}" data-tab="career">
            💼 Hustle & Career Ladder
          </button>
        </div>

        <!-- Tab Content -->
        <div class="econ-tab-content">
          ${this.renderActiveTab(data)}
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderActiveTab(data: PlayerAccount): string {
    if (this.activeTab === 'businesses') {
      return `
        <div class="econ-items-list">
          ${data.businesses.map((biz) => {
            const currentIncome =
              biz.baseIncomePerCycle +
              biz.upgrades.reduce((s, u) => s + (u.purchased ? u.bonusIncomePerCycle : 0), 0);
            return `
              <div class="econ-item-card ${biz.owned ? 'is-owned' : ''}" id="biz-item-${biz.buildingId}">
                <div class="econ-card-top">
                  <div class="econ-icon-box">${biz.icon}</div>
                  <div class="econ-info-box">
                    <div class="econ-item-header">
                      <h3>${biz.name}</h3>
                      <span class="econ-badge ${biz.owned ? 'badge-owned' : 'badge-price'}">
                        ${biz.owned ? `⭐ OWNED • Tier ${biz.level}` : `₦${biz.purchasePrice.toLocaleString()}`}
                      </span>
                    </div>
                    <span class="econ-category">📍 Broad St. • ${biz.category}</span>
                  </div>
                </div>

                ${biz.owned ? `
                  <div class="econ-financials-box">
                    <div class="fin-stat">
                      <span>Cashflow Rate:</span>
                      <strong>+₦${currentIncome.toLocaleString()} / min</strong>
                    </div>
                    <div class="fin-stat">
                      <span>Accumulated Profit:</span>
                      <strong class="text-gold">₦${biz.pendingRevenue.toLocaleString()}</strong>
                    </div>
                    <button class="btn-claim-single" data-claim-biz="${biz.id}" ${biz.pendingRevenue <= 0 ? 'disabled' : ''}>
                      Claim ₦${biz.pendingRevenue.toLocaleString()}
                    </button>
                  </div>

                  <!-- Upgrades Tree -->
                  <div class="econ-upgrades-section">
                    <h4>Equipment Upgrades & Expansion:</h4>
                    <div class="upgrades-grid">
                      ${biz.upgrades.map((u) => `
                        <div class="econ-upgrade-pill ${u.purchased ? 'bought' : ''}">
                          <div class="upg-meta">
                            <strong>${u.name}</strong>
                            <p>${u.description}</p>
                            <span class="text-emerald">+₦${u.bonusIncomePerCycle.toLocaleString()} / min</span>
                          </div>
                          ${u.purchased
                            ? `<span class="upg-active-badge">✅ Installed</span>`
                            : `<button class="btn-purchase-upg" data-upg-biz="${biz.id}" data-upg-id="${u.id}">
                                Install (₦${u.cost.toLocaleString()})
                               </button>`
                          }
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : `
                  <p class="econ-unowned-pitch">
                    This commercial premise is currently vacant on Broad Street. Acquire the franchise to establish a guaranteed <strong>+₦${biz.baseIncomePerCycle.toLocaleString()}/min</strong> automated income stream.
                  </p>
                  <div class="econ-action-bar">
                    <button class="btn-econ-buy" data-buy-biz="${biz.id}">
                      💼 Acquire Enterprise (₦${biz.purchasePrice.toLocaleString()})
                    </button>
                  </div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (this.activeTab === 'properties') {
      return `
        <div class="econ-items-list">
          ${data.properties.map((prop) => {
            const isOwnedOrRented = prop.status === 'owned' || prop.status === 'rented' || prop.status === 'purchased';
            const perksList = prop.perks || prop.features || [];
            return `
            <div class="econ-item-card property-card ${isOwnedOrRented ? 'is-owned' : ''}" id="prop-item-${prop.buildingId || prop.id}">
              <div class="econ-card-top">
                <div class="econ-icon-box">${prop.icon}</div>
                <div class="econ-info-box">
                  <div class="econ-item-header">
                    <h3>${prop.name}</h3>
                    <span class="econ-badge ${prop.status === 'purchased' || prop.status === 'owned' ? 'badge-owned' : prop.status === 'rented' ? 'badge-rent' : 'badge-price'}">
                      ${prop.status.toUpperCase()}
                    </span>
                  </div>
                  <span class="econ-category">📍 ${prop.location || prop.districtId} • ${prop.type.toUpperCase()}</span>
                </div>
              </div>

              <div class="prop-perks-list">
                ${perksList.map((p) => `<div class="prop-perk-row">✨ ${p}</div>`).join('')}
              </div>

              ${isOwnedOrRented ? `
                <div class="prop-owner-controls">
                  <button class="btn-prop-rest" data-rest-prop="${prop.id}">
                    🛏️ Rest & Sleep in Bedroom (Instant 100% ⚡ Recharge)
                  </button>

                  ${prop.buildingId === 'villa-compound' ? `
                    <button class="btn-gate-toggle" id="btn-toggle-compound-gate">
                      🚪 Toggle Security Gate (Driveway Access)
                    </button>
                  ` : ''}
                </div>
              ` : `
                <div class="prop-purchase-actions">
                  <button class="btn-rent-prop" data-rent-prop="${prop.id}">
                    🔑 Lease Property (₦${prop.rentalPriceMonthly.toLocaleString()} / mo)
                  </button>
                  <button class="btn-buy-prop" data-buy-prop="${prop.id}">
                    📜 Outright Deed of Sale (₦${prop.purchasePrice.toLocaleString()})
                  </button>
                </div>
              `}
            </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Career Tab
    return `
      <div class="career-overview-container">
        <div class="career-rank-hero">
          <div class="hero-trophy">🏆</div>
          <div>
            <h3>Current Rank: ${data.career.title}</h3>
            <p>Level ${data.career.rankLevel} • ${data.career.completedGigs} Gigs Completed</p>
          </div>
          <div class="hero-badge">x${data.career.bonusMultiplier} Pay Boost</div>
        </div>

        <div class="career-progress-section">
          <div class="progress-labels">
            <span>Experience Points: ${data.career.xp} XP</span>
            <span>Next Rank: ${data.career.rankLevel >= 3 ? 'Max Rank' : data.career.rankLevel === 2 ? '300 XP (Lagos Chief)' : '100 XP (Senior Hustler)'}</span>
          </div>
          <div class="career-progress-bar">
            <div class="progress-fill" style="width: ${Math.min(100, (data.career.xp / 300) * 100)}%;"></div>
          </div>
        </div>

        <div class="career-milestones">
          <h4>Rank Hierarchy & Privileges:</h4>
          <div class="milestone-card ${data.career.rankLevel >= 1 ? 'completed' : ''}">
            <div class="ms-num">1</div>
            <div>
              <strong>Street Hustler</strong>
              <p>Entry-level street gigs: Danfo Conductor, gala hawking, POS operations. Base 1.0x pay.</p>
            </div>
          </div>
          <div class="milestone-card ${data.career.rankLevel >= 2 ? 'completed' : ''}">
            <div class="ms-num">2</div>
            <div>
              <strong>Senior Hustler / Supervisor (100 XP)</strong>
              <p>Route management & agency coordination. +25% earnings boost on all jobs across Lagos.</p>
            </div>
          </div>
          <div class="milestone-card ${data.career.rankLevel >= 3 ? 'completed' : ''}">
            <div class="ms-num">3</div>
            <div>
              <strong>Lagos Island Chief / Executive (300 XP)</strong>
              <p>Highest street respect. +50% earnings boost, access to exclusive high-society real estate deals.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    // Close button
    document.getElementById('econ-close-btn')?.addEventListener('click', () => this.close());

    // Tab buttons
    this.container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = (btn as HTMLElement).getAttribute('data-tab') as any;
        this.render(this.backend.getData());
      });
    });

    // Claim all profits
    document.getElementById('btn-econ-claim-all')?.addEventListener('click', () => {
      const res = this.backend.collectBusinessRevenue();
      showGameToast(res.message, res.totalCollected > 0 ? 'success' : 'info');
      this.render(this.backend.getData());
    });

    // Claim single business
    this.container.querySelectorAll('[data-claim-biz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-claim-biz')!;
        const res = this.backend.collectBusinessRevenue(id);
        showGameToast(res.message, res.totalCollected > 0 ? 'success' : 'info');
        this.render(this.backend.getData());
      });
    });

    // Buy Business
    this.container.querySelectorAll('[data-buy-biz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-buy-biz')!;
        const res = this.backend.buyBusiness(id);
        showGameToast(res.message, res.success ? 'success' : 'error');
        this.render(this.backend.getData());
      });
    });

    // Buy Upgrade
    this.container.querySelectorAll('[data-upg-biz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bizId = (btn as HTMLElement).getAttribute('data-upg-biz')!;
        const upgId = (btn as HTMLElement).getAttribute('data-upg-id')!;
        const res = this.backend.upgradeBusiness(bizId, upgId);
        showGameToast(res.message, res.success ? 'success' : 'error');
        this.render(this.backend.getData());
      });
    });

    // Rent Property
    this.container.querySelectorAll('[data-rent-prop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-rent-prop')!;
        const res = this.backend.rentProperty(id);
        showGameToast(res.message, res.success ? 'success' : 'error');
        this.render(this.backend.getData());
      });
    });

    // Buy Property
    this.container.querySelectorAll('[data-buy-prop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-buy-prop')!;
        const res = this.backend.buyProperty(id);
        showGameToast(res.message, res.success ? 'success' : 'error');
        this.render(this.backend.getData());
      });
    });

    // Rest at Property
    this.container.querySelectorAll('[data-rest-prop]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-rest-prop')!;
        const res = this.backend.restAtProperty(id);
        showGameToast(res.message, res.success ? 'success' : 'info');
        this.render(this.backend.getData());
      });
    });

    // Toggle Compound Gate in 3D
    document.getElementById('btn-toggle-compound-gate')?.addEventListener('click', () => {
      if (this.world) {
        const isOpen = this.world.buildings.toggleCompoundGate();
        showGameToast(isOpen ? '🚪 Compound gate opened! You can walk into the estate courtyard.' : '🚪 Compound gate secured and closed.', 'info');
      }
    });
  }
}
