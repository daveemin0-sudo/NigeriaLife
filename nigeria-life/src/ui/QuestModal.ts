import { QuestManager } from '../quests/QuestManager';
import type { QuestCity } from '../quests/QuestTypes';
import { SoundEngine } from '../audio/SoundEngine';
import { UIStateManager } from './UIStateManager';
import { draw, forget } from './kit/StableView';

export class QuestModal {
  private container: HTMLDivElement;
  private questManager: QuestManager;
  public isOpen: boolean = false;
  private selectedCity: QuestCity = 'lagos';

  constructor() {
    this.questManager = QuestManager.getInstance();
    this.container = document.createElement('div');
    this.container.id = 'quest-modal-wrapper';
    this.container.className = 'quest-modal-closed';
    document.body.appendChild(this.container);

    this.questManager.subscribe(() => {
      if (this.isOpen) {
        this.render();
      }
    });
  }

  public open(): void {
    this.isOpen = true;
    this.container.className = 'quest-modal-open';
    forget(this.container);
    this.render();
    UIStateManager.getInstance().pushModal('quest');
  }

  public close(): void {
    this.isOpen = false;
    this.container.className = 'quest-modal-closed';
    UIStateManager.getInstance().popModal('quest');
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private render(): void {
    const cityQuests = this.questManager.getQuestsByCity(this.selectedCity);
    const activeQuest = this.questManager.getActiveQuest();

    const html = `
      <div class="quest-modal-backdrop" id="quest-backdrop"></div>
      <div class="quest-modal-dialog">
        <!-- Header -->
        <div class="quest-modal-header">
          <div class="quest-header-title-box">
            <span class="quest-modal-icon">🎯</span>
            <div>
              <h3>Story Quests & Narrative</h3>
              <p>Climb from the trenches to nationwide influence across Nigeria</p>
            </div>
          </div>
          <button class="quest-modal-close-btn" id="quest-modal-close">&times;</button>
        </div>

        <!-- City Filter Tabs -->
        <div class="quest-city-tabs">
          <button class="quest-tab-btn ${this.selectedCity === 'lagos' ? 'active' : ''}" data-city="lagos">
            🏖️ Lagos Arc
          </button>
          <button class="quest-tab-btn ${this.selectedCity === 'abuja' ? 'active' : ''}" data-city="abuja">
            🏛️ Abuja Arc
          </button>
          <button class="quest-tab-btn ${this.selectedCity === 'port_harcourt' ? 'active' : ''}" data-city="port_harcourt">
            🛢️ Port Harcourt Arc
          </button>
        </div>

        <!-- Quest List for Selected City -->
        <div class="quest-modal-body">
          <div class="quest-cards-list">
            ${cityQuests.map((q) => {
              const isCurrent = activeQuest?.id === q.id;
              const statusClass = q.status;
              const statusLabel =
                q.status === 'completed'
                  ? '🏆 Completed'
                  : isCurrent
                  ? '🎯 Active Mission'
                  : q.status === 'available'
                  ? '⚡ Available'
                  : '🔒 Locked';

              return `
                <div class="quest-card ${isCurrent ? 'quest-card-active' : ''} quest-card-${statusClass}">
                  <div class="quest-card-top">
                    <div class="quest-card-left">
                      <span class="quest-giver-avatar">${q.giverAvatar}</span>
                      <div class="quest-card-info">
                        <div class="quest-card-title-row">
                          <h4>Ch. ${q.chapterNumber}: ${q.title}</h4>
                          <span class="quest-status-badge badge-${statusClass}">${statusLabel}</span>
                        </div>
                        <span class="quest-arc-tag">${q.arcName} • Giver: ${q.giverName} (${q.giverRole})</span>
                      </div>
                    </div>
                  </div>

                  <p class="quest-card-desc">${q.description}</p>

                  <div class="quest-card-objectives">
                    <span class="obj-header-title">Mission Objectives:</span>
                    ${q.objectives.map((obj) => `
                      <div class="quest-obj-row ${obj.isCompleted ? 'obj-done' : ''}">
                        <span class="obj-checkbox">${obj.isCompleted ? '✓' : '○'}</span>
                        <span class="obj-text">${obj.description}</span>
                      </div>
                    `).join('')}
                  </div>

                  <div class="quest-card-footer">
                    <div class="quest-rewards-pill">
                      <span>💰 ₦${q.rewards.cash.toLocaleString()}</span>
                      <span>⭐ +${q.rewards.streetCred} Cred</span>
                      <span>💡 +${q.rewards.careerXp} XP</span>
                      ${q.rewards.itemReward ? `<span>${q.rewards.itemReward.icon} ${q.rewards.itemReward.name}</span>` : ''}
                    </div>

                    <div class="quest-card-actions">
                      ${q.status === 'available' ? `
                        <button class="btn-track-quest" data-track-id="${q.id}">Track Mission</button>
                      ` : isCurrent ? `
                        <button class="btn-tracking-active" disabled>Tracking</button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    draw(this.container, html, { drawn: () => this.setupEvents() });
  }

  private setupEvents(): void {
    document.getElementById('quest-modal-close')?.addEventListener('click', () => this.close());
    document.getElementById('quest-backdrop')?.addEventListener('click', () => this.close());

    // City tab switching
    const tabBtns = this.container.querySelectorAll('[data-city]');
    tabBtns.forEach((tab) => {
      (tab as HTMLElement).onclick = () => {
        this.selectedCity = (tab as HTMLElement).getAttribute('data-city') as QuestCity;
        forget(this.container);
        this.render();
      };
    });

    // Track quest button
    const trackBtns = this.container.querySelectorAll('[data-track-id]');
    trackBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const id = (btn as HTMLElement).getAttribute('data-track-id')!;
        SoundEngine.getInstance().playTransactionSuccess();
        this.questManager.setActiveQuest(id);
        this.render();
      };
    });
  }
}
