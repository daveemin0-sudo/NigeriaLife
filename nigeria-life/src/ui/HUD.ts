import * as THREE from 'three';
import type { InteractiveObject, InteractionTarget, World } from '../world/World';
import { VendorUI } from './VendorUI';
import { STREET_VENDORS } from '../world/StreetVendors';
import { Player } from '../player/Player';
import type { CityId } from '../cities/CityTypes';
import { CharacterCreatorModal } from './CharacterCreator';
import { InventoryModal } from './InventoryModal';
import { ATMModal } from './ATMModal';
import { PhoneModal } from './PhoneModal';
import { EconomyModal } from './EconomyModal';
import { TravelModal } from './TravelModal';
import { InterStateModal } from './InterStateModal';
import { WorldMapUI } from './WorldMapUI';
import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';
import { WorldDataManager } from '../world/data/WorldDataManager';
import type { MapBusiness } from '../world/data/WorldDataTypes';
import { HouseDecorationSystem } from '../housing/HouseDecorationSystem';
import { SoundEngine } from '../audio/SoundEngine';
import { QuestManager } from '../quests/QuestManager';
import { QuestModal } from './QuestModal';
import type { StoryQuest } from '../quests/QuestTypes';
import { CloudSyncService } from '../backend/CloudSyncService';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';
import { emitGameEvent } from '../game/GameEvents';
import { InteractionDirector } from '../interactions/InteractionDirector';
import { waveAt, greet, shakeHands, chatWith, gestureToward, cannotShakeHands, standingWith } from '../interactions/Social';

/** Map landmarks that have no interior, matched to the street object where their activity happens */
const LANDMARK_STREET_SPOTS: Record<string, string> = {
  quilox_vi: 'quilox-club',
  national_stadium: 'surulere-stadium',
  nike_art_gallery: 'nike-art-gallery',
  computer_village: 'cv-plaza',
  cchub_yaba: 'yaba-cchub',
  lekki_bridge: 'lekki-bridge',
  eko_atlantic_tower: 'vi-tower',
};

export class HUD {
  private container: HTMLDivElement;
  private interactionCard: HTMLDivElement;
  private drivingHudEl!: HTMLDivElement;
  public proximityPromptEl: HTMLDivElement | null = null;
  public promptLabelEl: HTMLSpanElement | null = null;
  public currentInteractionTarget: InteractionTarget | null = null;
  private creatorModal!: CharacterCreatorModal;
  private inventoryModal!: InventoryModal;
  private atmModal!: ATMModal;
  public phoneModal!: PhoneModal;
  public economyModal!: EconomyModal;
  public travelModal!: TravelModal;
  public interstateModal!: InterStateModal;
  public worldMapUI!: WorldMapUI;
  public questModal!: QuestModal;
  private questManager: QuestManager;
  private player!: Player;
  private world?: World;
  private backend: BackendService;
  public currentActiveObject: InteractiveObject | null = null;

  public onExitVehicle?: () => void;
  public onHonkVehicle?: () => void;
  public onEnterVehicle?: (vehicleId: string) => void;
  public onEnterInterior?: (buildingId: string) => void;
  public onExitInterior?: () => void;
  /** Opens the buka's menu; a table number seats the player at that table */
  public onOpenBukaMenu?: (preferTable?: number) => void;
  public onShopAction?: (objectId: string) => void;
  public onVendorAction?: (objectId: string) => void;
  /** A plot of land's board was used: open what is known about that plot */
  public onPlotAction?: (plotId: string) => void;
  /** Stations inside buildings that are used by walking up and doing something with the hands or talking */
  private static readonly ACTED_OUT = /^(hosp_|police_|unilag_|airport_|bank_)/;
  private actingOut = false;
  /** Sitting down with someone: can it be done, and do it */
  public canSitWith?: (objectId: string) => boolean;
  public onSitWith?: (objectId: string) => void;
  /** Starts something at home: the id of the bed, sofa, fridge or drum that was used */
  public onHomeActivity?: (objectId: string) => void;
  public onNavigateMode?: (mode: 'street' | 'home' | 'map') => void;
  public onRadarNavigate?: (destId: string) => void;
  public onRotateCamera?: (deltaYaw: number) => void;
  public onResetCamera?: () => void;
  public onCycleCameraPreset?: () => string;
  public onOpenPhotoMode?: () => void;
  public currentNavMode: 'street' | 'home' | 'map' = 'street';

  constructor() {
    this.backend = BackendService.getInstance();
    this.inventoryModal = new InventoryModal();
    this.atmModal = new ATMModal();
    this.inventoryModal.onOpenATM = () => this.atmModal.open();
    // At the bank's own machine, the player is seen taking the cash or feeding it in
    this.atmModal.onCashMoved = () => {
      if (this.world?.interiorManager.currentInterior?.type !== 'bank' || !this.player) return;
      InteractionDirector.get().perform({ id: 'atm cash', actor: this.player.actor, animation: { arms: 'reach' }, seconds: 0.9 });
    };
    this.phoneModal = new PhoneModal();
    this.phoneModal.onFastTravel = (pos, name) => {
      this.currentNavMode = 'street';
      this.worldMapUI.close();
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'flex';
      const decorBar = document.getElementById('house-decor-bar');
      if (decorBar) decorBar.style.display = 'none';
      this.player?.mesh.position.set(pos.x, pos.y, pos.z);
      this.showNotification(`📍 Arrived at your residence: ${name}!`);
      this.onNavigateMode?.('street');
    };
    this.economyModal = new EconomyModal();
    this.economyModal.onFastTravel = this.phoneModal.onFastTravel;
    this.travelModal = new TravelModal();
    this.interstateModal = new InterStateModal();
    this.worldMapUI = new WorldMapUI();
    this.questManager = QuestManager.getInstance();
    this.questModal = new QuestModal();

    this.container = document.createElement('div');
    this.container.id = 'hud-overlay';
    this.container.innerHTML = `
      <!-- Top Status Header (Viral Lagos Life Replica) -->
      <header class="hud-header">
        <!-- Top Left Badges (Match, Music, Gem Hunt & Mission Tracker) -->
        <div class="hud-top-left-badges">
          <div class="top-badge quest-badge" id="badge-super-eagles" title="Story Quests & Narrative Missions">
            <span class="badge-icon">🎯</span>
            <div class="badge-text">
              <span class="badge-title">Naija Story Quests</span>
              <span class="badge-sub">Multi-City Narrative</span>
            </div>
          </div>
          <div class="top-badge music-badge" id="badge-afrobeats" title="Play Afrobeats Radio">
            <span class="badge-icon">🎶</span>
            <div class="badge-text">
              <span class="badge-title">Play some music</span>
              <span class="badge-sub">+2 Mood Boost</span>
            </div>
          </div>
          <div class="top-badge gem-badge" id="badge-gem-hunt" title="Daily Naira Gem Quest">
            <span class="badge-icon">💎</span>
            <div class="badge-text">
              <span class="badge-title">Daily gem hunt</span>
              <span class="badge-sub">87,691 found • Next: ₦3,000</span>
            </div>
          </div>

          <!-- HUD Active Mission Tracker Card (Track B3) -->
          <div class="hud-quest-tracker" id="hud-quest-tracker">
            <div class="quest-tracker-header" id="quest-tracker-click-header" title="Open Nigeria Story Quests & Missions">
              <span class="tracker-icon">🎯</span>
              <div class="tracker-title-box">
                <span class="tracker-arc" id="tracker-quest-arc">LAGOS ARC</span>
                <h5 class="tracker-title" id="tracker-quest-title">Ch. 1: Mainland Hustle</h5>
              </div>
              <button class="btn-tracker-toggle" id="btn-tracker-toggle" title="Minimize/Expand Tracker">▾</button>
            </div>
            <div class="tracker-body" id="tracker-body">
              <div class="tracker-objectives" id="tracker-objectives-list">
                <div class="tracker-obj-item">
                  <span class="obj-dot">○</span>
                  <span>Complete any street job shift or hustle minigame</span>
                </div>
              </div>
              <div class="tracker-reward-line">
                <span id="tracker-rewards-text">💰 ₦15,000 • ⭐ +20 Cred</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Center Floating Pill Bar -->
        <div class="hud-center-pill-bar">
          <div class="pill-item time-pill" id="hud-time-pill" title="Click to cycle Time of Day (Midday / Sunset / Night / Morning)" style="cursor: pointer;">
            <span id="hud-weather-icon">☀️</span>
            <span id="hud-clock-val">Wed 7 • 1:18 PM</span>
          </div>
          <div class="pill-item mood-pill" id="pill-mood" title="Current Character Mood">
            <span id="hud-mood-icon">😄</span>
            <span id="hud-mood-val">Very Happy</span>
          </div>
          <div class="hud-vitals-bar" id="hud-vitals-bar">
            <div class="vital-item vital-health" title="Health">
              <span class="vital-icon">❤️</span>
              <div class="vital-track"><div class="vital-fill" id="vital-fill-health" style="width: 100%;"></div></div>
              <span class="vital-val" id="vital-val-health">100%</span>
            </div>
            <div class="vital-item vital-energy" title="Energy">
              <span class="vital-icon">⚡</span>
              <div class="vital-track"><div class="vital-fill" id="vital-fill-energy" style="width: 100%;"></div></div>
              <span class="vital-val" id="vital-val-energy">100%</span>
            </div>
            <div class="vital-item vital-hunger" title="Hunger">
              <span class="vital-icon">🍗</span>
              <div class="vital-track"><div class="vital-fill" id="vital-fill-hunger" style="width: 80%;"></div></div>
              <span class="vital-val" id="vital-val-hunger">80%</span>
            </div>
            <div class="vital-item vital-cred" title="Street Cred">
              <span class="vital-icon">⭐</span>
              <div class="vital-track"><div class="vital-fill" id="vital-fill-cred" style="width: 25%;"></div></div>
              <span class="vital-val" id="vital-val-cred">25</span>
            </div>
          </div>
          <div class="pill-item online-pill" id="hud-online-pill" title="Toggle FPS & Render Stats [F3]" style="cursor: pointer;">
            <span>👥</span>
            <span>17.6m • <strong style="color: #4ade80;">🟢 85k online</strong></span>
          </div>
          <div class="pill-item perf-pill" id="hud-perf-pill" style="display: none; font-size: 11px; background: rgba(0,0,0,0.65); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8;">
            <span id="perf-fps">60 FPS</span> • <span id="perf-ms">16ms</span> • <span id="perf-draws">40 draws</span>
          </div>
          <button class="sound-toggle-btn" id="hud-sound-toggle" title="Toggle Afrobeats Radio">🔊</button>
          <div class="pill-item money-pill-large" id="pill-money-wrap">
            <span id="hud-money">₦25,000</span>
            <button class="btn-quick-deposit" id="btn-quick-topup" title="Withdraw / Deposit at Bank ATM">+</button>
          </div>
        </div>

        <!-- Top Right Mini District Indicator & Camera View Switcher -->
        <div class="hud-top-right-group">
          <button class="btn-camera-view-toggle" id="btn-camera-view-toggle" title="Switch Camera View [V] (Third-Person / Street / Isometric / Aerial)">
            <span>🎥</span>
            <span id="cam-preset-label">STREET</span>
          </button>
          <button class="btn-camera-view-toggle" id="btn-photo-mode-toggle" title="Photo Mode [P] • Snap & Grade Shots" style="border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.15); color: #38bdf8;">
            <span>📸</span>
            <span>PHOTO</span>
          </button>
          <button class="btn-camera-view-toggle hud-cloud-pill" id="hud-btn-cloud-sync" title="Multiplayer & EkoCloud Hub • Click to Open Meetumo" style="border-color: rgba(34, 197, 94, 0.4); background: rgba(34, 197, 94, 0.15); color: #4ade80;">
            <span class="cloud-dot-live">🟢</span>
            <span id="hud-online-count">1 Online</span> • <span id="hud-cloud-status">☁️ Synced</span>
          </button>
          <div class="hud-location">
            <span class="flag">🇳🇬</span>
            <div class="loc-details">
              <span class="loc-name" id="hud-loc-name">Lagos Island</span>
              <span class="loc-sub" id="hud-loc-sub">Broad Street</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Street Distance Radar (Appears during Street Walk) -->
      <div class="street-radar-bar" id="street-radar-bar">
        <div class="radar-header-pill">
          <span>📍</span>
          <span id="radar-loc-title">Herbert Macaulay Way • Tejuosho Junction</span>
        </div>
        <div class="radar-pills-row">
          <button class="radar-pill" data-dest="dest_cchub">💡 CcHub - 410m</button>
          <button class="radar-pill" data-dest="dest_quilox">🍾 Quilox VIP - 350m</button>
          <button class="radar-pill" data-dest="dest_amala">🍲 Amala Shitta - 220m</button>
          <button class="radar-pill" data-dest="dest_lekki">🌉 Lekki Bridge - 850m</button>
          <button class="radar-pill" data-dest="dest_ikeja">🔌 Computer Village - 600m</button>
        </div>
      </div>

      <!-- Aerial Map City Switcher Bar (Appears when Map is active) -->
      <div class="map-city-switcher" id="map-city-switcher" style="display: none;">
        <div class="city-switch-tabs">
          <button class="city-tab active" data-city="lagos">🏖️ Lagos</button>
          <button class="city-tab" data-city="abuja">⛰️ Abuja</button>
          <button class="city-tab" data-city="port_harcourt">🛢️ Port Harcourt</button>
        </div>
        <div class="map-filter-pills">
          <button class="map-filter-btn active" id="btn-walk-street">🚶 Walk Street</button>
          <button class="map-filter-btn" id="btn-open-interstate">✈️ Book Flights [M]</button>
        </div>
      </div>

      <!-- House Mode Toolbar (Buy mode on top-left, 88 Catalogue on bottom-center) (Screenshot 5) -->
      <div class="house-decor-bar" id="house-decor-bar" style="display: none;">
        <button class="house-buy-mode-btn" id="btn-house-buy-mode">Buy mode</button>
        <button class="house-catalogue-btn" id="btn-house-catalogue">
          <span style="font-size: 15px;">㗊</span>
          <span>Catalogue</span>
        </button>
      </div>

      <!-- Bottom Master Navigation Bar (Home | Buy | Map | Phone) -->
      <div class="bottom-master-nav">
        <button class="master-nav-item" id="nav-btn-home" title="Apartment Flat Interior">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
        </button>
        <button class="master-nav-item" id="nav-btn-buy" title="Real Estate, Cars & Businesses">
          <span class="nav-icon">🛍️</span>
          <span class="nav-label">Buy</span>
        </button>
        <button class="master-nav-item" id="nav-btn-map" title="Aerial City World Map">
          <span class="nav-icon">🗺️</span>
          <span class="nav-label">Map</span>
        </button>
        <button class="master-nav-item" id="nav-btn-phone" title="Smartphone OS [Key P]">
          <span class="nav-icon">📱</span>
          <span class="nav-label">Phone</span>
          <span class="nav-badge">8</span>
        </button>
      </div>

      <!-- Bottom Guidance & Quick Emote Bar -->
      <footer class="hud-footer">
        <div class="emote-bar">
          <span class="emote-bar-title">Moves:</span>
          <button class="emote-btn" id="emote-zanku" title="Shortcut: Key 1">
            <span>🕺</span>
            <span>Zanku [1]</span>
          </button>
          <button class="emote-btn" id="emote-groove" title="Shortcut: Key 2">
            <span>🎶</span>
            <span>Afrobeats [2]</span>
          </button>
          <button class="emote-btn" id="emote-salute" title="Shortcut: Key 3">
            <span>🫡</span>
            <span>Salute [3]</span>
          </button>
        </div>
      </footer>

      <!-- Floating Camera Orbit Controls (360° View) -->
      <div class="camera-rotate-widget" id="camera-rotate-widget">
        <button class="cam-rot-btn" id="btn-cam-left" title="Rotate View Left [Q] or Right-Click Drag">
          <span>↺</span>
          <span class="cam-btn-lbl">Q</span>
        </button>
        <button class="cam-rot-btn cam-center" id="btn-cam-reset" title="Reset Camera View [⊙]">
          <span>⊙</span>
        </button>
        <button class="cam-rot-btn" id="btn-cam-right" title="Rotate View Right [R] or Right-Click Drag">
          <span class="cam-btn-lbl">R</span>
          <span>↻</span>
        </button>
      </div>

      <!-- Interaction Modal / Card -->
      <div class="interaction-card" id="interaction-card" style="display: none;">
        <button class="card-close" id="card-close">&times;</button>
        <span class="card-tag" id="card-category">Food & Health</span>
        <h2 class="card-title" id="card-title">Mama Put Buka</h2>
        <p class="card-desc" id="card-desc">Hot Jollof rice, plantain, and pepper soup.</p>
        <div id="card-biz-meta" style="display: none; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #94a3b8;">Status: <strong id="card-biz-status" style="color: #4ade80;">OPEN</strong></span>
            <span style="color: #94a3b8;">Owner: <strong id="card-biz-owner" style="color: #f8fafc;">NPC</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Daily Revenue: <strong id="card-biz-revenue" style="color: #fbbf24;">₦45,000</strong></span>
            <span style="color: #38bdf8; font-weight: 500;">Commercial Hub</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-primary" id="card-action-btn">Enter / Order</button>
          <button class="btn-secondary" id="card-biz-btn" style="display: none;">💼 View Business [E]</button>
        </div>
        <div class="card-social" id="card-social" style="display: none;">
          <span class="card-social-label" id="card-social-label">Stranger</span>
          <button class="card-social-btn" id="card-wave-btn" style="display: none;">👋 Wave</button>
          <button class="card-social-btn" id="card-greet-btn" style="display: none;">🙏 Greet</button>
          <button class="card-social-btn" id="card-shake-btn" style="display: none;">🤝 Shake hands</button>
          <button class="card-social-btn" id="card-chat-btn" style="display: none;">💬 Chat</button>
          <button class="card-social-btn" id="card-sit-btn" style="display: none;">🪑 Sit together</button>
        </div>
      </div>

      <!-- Driving HUD Widget (Speedometer & Controls) -->
      <div class="driving-hud-panel" id="driving-hud" style="display: none;">
        <div class="speedo-box">
          <span class="speedo-val" id="speedo-val">0</span>
          <span class="speedo-unit">KM/H</span>
        </div>
        <div class="driving-meta-box">
          <h4 id="driving-veh-name">Danfo Minibus</h4>
          <span class="driving-hint">WASD / Arrows to Drive • SPACE Handbrake</span>
        </div>
        <div class="driving-actions-bar">
          <button class="btn-hud-horn" id="btn-drive-horn" title="Honk Horn [Key H]">📢 Honk [H]</button>
          <button class="btn-hud-exit-veh" id="btn-drive-exit" title="Exit Vehicle [Key F]">🚪 Exit [F]</button>
        </div>
      </div>

      <!-- Contextual Interaction Proximity Prompt Pill -->
      <div class="hud-proximity-prompt" id="hud-proximity-prompt" style="display: none;">
        <span class="prompt-key-badge">E</span>
        <span class="prompt-label" id="hud-prompt-label">Enter Hospital</span>
      </div>
    `;

    document.body.appendChild(this.container);

    this.interactionCard = document.getElementById('interaction-card') as HTMLDivElement;
    this.drivingHudEl = document.getElementById('driving-hud') as HTMLDivElement;
    this.proximityPromptEl = document.getElementById('hud-proximity-prompt') as HTMLDivElement;
    this.promptLabelEl = document.getElementById('hud-prompt-label') as HTMLSpanElement;

    this.proximityPromptEl?.addEventListener('click', () => {
      this.executeCurrentInteraction();
    });

    const closeBtn = document.getElementById('card-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hideInteractionCard());

    const actionBtn = document.getElementById('card-action-btn') as HTMLButtonElement;
    actionBtn.addEventListener('click', () => this.handleCardAction());

    // Wave, greet, shake hands or chat with whoever this card is about; they answer in kind
    const social = (buttonId: string, kind: 'wave' | 'greet' | 'handshake' | 'chat') => {
      document.getElementById(buttonId)?.addEventListener('click', () => {
        const obj = this.currentActiveObject;
        this.hideInteractionCard();
        if (!obj) return;
        const me = this.player.actor;
        const person = InteractionDirector.get().actorFor(obj.id);

        if (!person) {
          // Another player online: the gesture is made here and they are told about it
          if (!obj.id.startsWith('remote_player_') || (kind !== 'wave' && kind !== 'greet')) return;
          const made = gestureToward(kind, me, obj.mesh.position.clone());
          if (made.ok) NetworkManager.getInstance()?.sendSocial(obj.id.replace('remote_player_', ''), kind);
          else this.showNotification('Finish what you are doing first.');
          return;
        }

        const interiors = this.world?.interiorManager;
        const inside = interiors?.isPlayerInside() ?? false;
        const options = { nav: inside ? interiors?.getActiveNav() ?? null : null, standAt: inside ? obj.interactionPoint : undefined };
        const result = kind === 'wave' ? waveAt(me, person)
          : kind === 'greet' ? greet(me, person)
          : kind === 'handshake' ? shakeHands(me, person, options)
          : chatWith(me, person, options);
        if (!result.ok) {
          this.showNotification(result.reason && result.reason !== 'busy' ? result.reason : 'Finish what you are doing first.');
        }
      });
    };
    social('card-wave-btn', 'wave');
    social('card-greet-btn', 'greet');
    social('card-shake-btn', 'handshake');
    social('card-chat-btn', 'chat');

    document.getElementById('card-sit-btn')?.addEventListener('click', () => {
      const obj = this.currentActiveObject;
      this.hideInteractionCard();
      if (obj) this.onSitWith?.(obj.id);
    });

    const bizBtn = document.getElementById('card-biz-btn') as HTMLButtonElement;
    bizBtn.addEventListener('click', () => {
      if (this.currentActiveObject) {
        this.economyModal.open(this.currentActiveObject.id);
        this.hideInteractionCard();
      }
    });

    // Subscribe to live backend updates
    this.backend.subscribe(this.onDataUpdate.bind(this));
  }

  private onDataUpdate(data: PlayerAccount): void {
    const moneyEl = document.getElementById('hud-money');
    if (moneyEl) {
      moneyEl.textContent = `₦${data.walletCash.toLocaleString()}`;
    }

    const health = Math.round(data.stats.health ?? 100);
    const energy = Math.round(data.stats.energy);
    const hunger = Math.round(data.stats.hunger);
    const cred = Math.round(data.stats.streetCred);

    const hFill = document.getElementById('vital-fill-health');
    const hVal = document.getElementById('vital-val-health');
    if (hFill && hVal) {
      hFill.style.width = `${health}%`;
      hVal.textContent = `${health}%`;
      hFill.parentElement?.classList.toggle('vital-critical', health < 25);
    }

    const eFill = document.getElementById('vital-fill-energy');
    const eVal = document.getElementById('vital-val-energy');
    if (eFill && eVal) {
      eFill.style.width = `${energy}%`;
      eVal.textContent = `${energy}%`;
      eFill.parentElement?.classList.toggle('vital-critical', energy < 20);
    }

    const huFill = document.getElementById('vital-fill-hunger');
    const huVal = document.getElementById('vital-val-hunger');
    if (huFill && huVal) {
      huFill.style.width = `${hunger}%`;
      huVal.textContent = `${hunger}%`;
      huFill.parentElement?.classList.toggle('vital-critical', hunger < 20);
    }

    const cFill = document.getElementById('vital-fill-cred');
    const cVal = document.getElementById('vital-val-cred');
    if (cFill && cVal) {
      cFill.style.width = `${cred}%`;
      cVal.textContent = `${cred}`;
    }

    // Dynamic Mood
    const moodIcon = document.getElementById('hud-mood-icon');
    const moodVal = document.getElementById('hud-mood-val');
    if (moodIcon && moodVal) {
      if (hunger <= 0 || health < 30) {
        moodIcon.textContent = '😫';
        moodVal.textContent = 'Starving';
      } else if (hunger < 25) {
        moodIcon.textContent = '🤤';
        moodVal.textContent = 'Hungry';
      } else if (energy < 20) {
        moodIcon.textContent = '😴';
        moodVal.textContent = 'Exhausted';
      } else if (energy > 75 && hunger > 70) {
        moodIcon.textContent = '🔥';
        moodVal.textContent = 'Odogwu Fresh';
      } else {
        moodIcon.textContent = '😄';
        moodVal.textContent = 'Very Happy';
      }
    }
  }

  public init(player: Player, world?: World): void {
    this.player = player;
    this.world = world;
    if (world) this.economyModal.setWorld(world);
    this.creatorModal = new CharacterCreatorModal(player);

    const uiState = UIStateManager.getInstance();
    uiState.registerModal('character-creator', {
      id: 'character-creator',
      close: () => this.creatorModal.close(),
      isOpen: () => this.creatorModal.isOpen,
    });
    uiState.registerModal('inventory', {
      id: 'inventory',
      close: () => this.inventoryModal.close(),
      isOpen: () => this.inventoryModal.isOpen,
    });
    uiState.registerModal('atm', {
      id: 'atm',
      close: () => this.atmModal.close(),
      isOpen: () => this.atmModal.isOpen,
    });
    uiState.registerModal('economy', {
      id: 'economy',
      close: () => this.economyModal.close(),
      isOpen: () => this.economyModal.isOpen,
    });
    uiState.registerModal('travel', {
      id: 'travel',
      close: () => this.travelModal.close(),
      isOpen: () => this.travelModal.isOpen,
    });
    uiState.registerModal('interstate', {
      id: 'interstate',
      close: () => this.interstateModal.close(),
      isOpen: () => this.interstateModal.isOpen,
    });
    uiState.registerModal('phone', {
      id: 'phone',
      close: () => this.phoneModal.close(),
      isOpen: () => this.phoneModal.isOpen,
    });
    uiState.registerModal('quest', {
      id: 'quest',
      close: () => this.questModal.close(),
      isOpen: () => this.questModal.isOpen,
    });
    uiState.registerModal('house-catalogue', {
      id: 'house-catalogue',
      close: () => HouseDecorationSystem.getInstance().closeCatalogueModal(),
      isOpen: () => HouseDecorationSystem.getInstance().isCatalogueOpen(),
    });

    document.getElementById('open-wardrobe-btn')?.addEventListener('click', () => {
      this.creatorModal.toggle();
    });

    document.getElementById('open-inventory-btn')?.addEventListener('click', () => {
      this.inventoryModal.toggle();
    });

    document.getElementById('open-atm-btn')?.addEventListener('click', () => {
      this.atmModal.open();
    });

    document.getElementById('open-phone-btn')?.addEventListener('click', () => {
      this.phoneModal.toggle();
    });

    document.getElementById('open-econ-btn')?.addEventListener('click', () => {
      this.economyModal.toggle();
    });

    document.getElementById('open-travel-btn')?.addEventListener('click', () => {
      this.travelModal.toggle();
    });

    document.getElementById('open-interstate-btn')?.addEventListener('click', () => {
      this.interstateModal.toggle(this.world?.cityManager.currentCityId);
    });

    document.getElementById('hud-weather-btn')?.addEventListener('click', () => {
      if (this.world) {
        const newW = this.world.weather.toggleWeather();
        this.updateWeatherButton(newW);
      }
    });

    document.getElementById('btn-drive-exit')?.addEventListener('click', () => {
      this.onExitVehicle?.();
    });

    document.getElementById('btn-drive-horn')?.addEventListener('click', () => {
      this.onHonkVehicle?.();
    });

    // Emote buttons
    document.getElementById('emote-zanku')?.addEventListener('click', () => {
      this.player.playEmote('zanku', 4.0);
    });

    document.getElementById('emote-groove')?.addEventListener('click', () => {
      this.player.playEmote('groove', 4.0);
    });

    document.getElementById('emote-salute')?.addEventListener('click', () => {
      this.player.playEmote('salute', 3.0);
    });

    // Camera Orbit & View Controls
    document.getElementById('btn-cam-left')?.addEventListener('click', () => {
      this.onRotateCamera?.(Math.PI / 4);
    });

    document.getElementById('btn-cam-right')?.addEventListener('click', () => {
      this.onRotateCamera?.(-Math.PI / 4);
    });

    document.getElementById('btn-cam-reset')?.addEventListener('click', () => {
      this.onResetCamera?.();
    });

    document.getElementById('btn-camera-view-toggle')?.addEventListener('click', () => {
      if (this.onCycleCameraPreset) {
        const next = this.onCycleCameraPreset();
        const names: Record<string, string> = {
          close: '3RD PERSON',
          street: 'STREET',
          isometric: 'ISOMETRIC',
          aerial: 'AERIAL',
        };
        const lbl = document.getElementById('cam-preset-label');
        if (lbl) lbl.textContent = names[next] || next.toUpperCase();
        this.showNotification(`📷 Camera View: ${names[next] || next}`);
      }
    });

    document.getElementById('btn-photo-mode-toggle')?.addEventListener('click', () => {
      this.onOpenPhotoMode?.();
    });

    // Afrobeats Street Radio & Master Sound Toggles
    const toggleRadioFn = () => {
      const active = SoundEngine.getInstance().toggleRadio();
      const soundBtn = document.getElementById('hud-sound-toggle');
      if (soundBtn) {
        soundBtn.textContent = active ? '🎶' : '🔊';
        soundBtn.style.color = active ? '#38bdf8' : '#fff';
      }
      this.showNotification(active ? '📻 Afrobeats Radio: ON (112 BPM Groove)' : '📻 Afrobeats Radio: OFF');
    };

    document.getElementById('hud-sound-toggle')?.addEventListener('click', toggleRadioFn);
    document.getElementById('badge-afrobeats')?.addEventListener('click', toggleRadioFn);

    // Performance Diagnostics Toggle (Click or F3)
    const togglePerfFn = () => {
      const perfPill = document.getElementById('hud-perf-pill');
      if (perfPill) {
        const isHidden = perfPill.style.display === 'none';
        perfPill.style.display = isHidden ? 'flex' : 'none';
        this.showNotification(isHidden ? '📊 Performance Diagnostics: ON' : '📊 Performance Diagnostics: OFF');
      }
    };
    document.getElementById('hud-online-pill')?.addEventListener('click', togglePerfFn);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        togglePerfFn();
      }
    });

    // Bottom Master Navigation Bar (Home, Buy, Map, Phone)
    const navHomeBtn = document.getElementById('nav-btn-home');
    const navBuyBtn = document.getElementById('nav-btn-buy');
    const navMapBtn = document.getElementById('nav-btn-map');
    const navPhoneBtn = document.getElementById('nav-btn-phone');

    const updateNavActive = (activeId: string) => {
      [navHomeBtn, navBuyBtn, navMapBtn, navPhoneBtn].forEach((btn) => btn?.classList.remove('active'));
      if (activeId) document.getElementById(activeId)?.classList.add('active');
    };

    navHomeBtn?.addEventListener('click', () => {
      this.currentNavMode = 'home';
      updateNavActive('nav-btn-home');
      this.worldMapUI.close();
      UIStateManager.getInstance().setMode('house');
      this.onNavigateMode?.('home');
    });

    navBuyBtn?.addEventListener('click', () => {
      this.economyModal.toggle();
    });

    navMapBtn?.addEventListener('click', () => {
      this.currentNavMode = 'map';
      updateNavActive('nav-btn-map');
      this.worldMapUI.open();
      this.onNavigateMode?.('map');
    });

    navPhoneBtn?.addEventListener('click', () => {
      this.phoneModal.toggle();
    });

    document.getElementById('btn-walk-street')?.addEventListener('click', () => {
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      UIStateManager.getInstance().setMode('street');
      this.onNavigateMode?.('street');
    });

    // Wire House Decor Bar buttons
    document.getElementById('btn-house-catalogue')?.addEventListener('click', () => {
      HouseDecorationSystem.getInstance().openCatalogueModal();
    });

    document.getElementById('btn-house-buy-mode')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      const decor = HouseDecorationSystem.getInstance();
      decor.isBuyMode = !decor.isBuyMode;
      btn.classList.toggle('active', decor.isBuyMode);
      btn.textContent = decor.isBuyMode ? 'Exit Buy mode' : 'Buy mode';
      this.showNotification(decor.isBuyMode ? '🛋️ Buy Mode Active: Open Catalogue to place items' : 'Live Resident Mode');
    });

    // Wire WorldMapUI event handlers
    this.worldMapUI.onCloseMap = () => {
      this.currentNavMode = 'street';
      updateNavActive('');
      UIStateManager.getInstance().setMode('street');
      this.onNavigateMode?.('street');
    };

    this.worldMapUI.onTravelToDistrict = (district) => {
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      UIStateManager.getInstance().setMode('street');
      this.player.mesh.position.copy(district.streetSpawnPoint);
      this.onNavigateMode?.('street');
    };

    this.worldMapUI.onTravelWithTransport = (dest, transport, enterInside) => {
      // 1. If transport requires fare, deduct cash from wallet
      if (transport.fare > 0) {
        const success = this.backend.spendCash(
          transport.fare,
          `Transport (${transport.label}) to ${dest.name}`,
          'TRAVEL_COST'
        );
        if (!success) {
          this.showDialogueModal({
            speakerName: transport.label,
            speakerRole: 'Transit Booking Terminal',
            speakerAvatar: '⚠️',
            dialogueText: `Insufficient cash (₦${transport.fare.toLocaleString()}) for ${transport.label}! You can walk on foot for free.`,
          });
          return false;
        }
        emitGameEvent('drive', { city: this.world?.cityManager.currentCityId });
      }

      // 2. Return to street mode
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      UIStateManager.getInstance().setMode('street');
      this.onNavigateMode?.('street');

      // 3. Teleport player character right outside the destination entrance
      this.player.mesh.position.copy(dest.streetPosition);
      this.player.position.copy(dest.streetPosition);
      this.player.mesh.rotation.y = 0;
      this.player.stopMoving();

      // 4. Update HUD location badge, then either walk straight in or wait at the door
      this.updateLocation(dest.name, `${dest.category} • ${dest.districtName}`);
      if (enterInside && dest.isEnterable) {
        setTimeout(() => this.onEnterInterior?.(dest.interiorId), 50);
      } else {
        this.showNotification(`${transport.icon} Arrived via ${transport.label} at ${dest.name}! Press [E] to enter.`);
      }
      return true;
    };

    // Places with no interior of their own: arrive at the spot on the street where their activity is
    this.worldMapUI.onTravelToLandmark = (lm) => {
      const spot = this.world?.interactiveObjects.find((o) => o.id === LANDMARK_STREET_SPOTS[lm.id]);
      const district = WorldDataManager.getInstance().getDistrictById(lm.districtId);
      if (!spot && !district) return;

      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      UIStateManager.getInstance().setMode('street');
      this.onNavigateMode?.('street');

      const arriveAt = spot ? spot.interactionPoint : district!.streetSpawnPoint;
      this.player.mesh.position.set(arriveAt.x, 0, arriveAt.z);
      this.player.stopMoving();
      if (spot) {
        this.showInteractionCard(spot);
      } else {
        this.showNotification(`📍 Arrived in ${district!.name}, near ${lm.name}.`);
      }
    };

    this.worldMapUI.onInterstateTravel = (destCityId) => {
      this.interstateModal.open((destCityId as any) || this.world?.cityManager.currentCityId);
    };

    this.worldMapUI.onSelectDistrictFromChips = (districtId) => {
      this.world?.worldMap.focusOnDistrict(districtId);
    };

    this.worldMapUI.onSwitchCityTab = (cityId) => {
      if (this.world) {
        this.world.worldMap.switchCity(cityId);
        this.worldMapUI.updateCityHeader(cityId);
        this.world.cityManager.switchCity(cityId as any, this.player, (newObjs) => {
          if (this.world) this.world.interactiveObjects = newObjs;
        });
      }
    };

    this.worldMapUI.onTravelToProperty = (prop) => {
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      UIStateManager.getInstance().setMode('street');
      this.player.mesh.position.set(prop.streetPosition.x, prop.streetPosition.y, prop.streetPosition.z);
      this.world?.highlightStreetProperty(prop.streetPosition, prop.name);
      this.onNavigateMode?.('street');
    };

    this.worldMapUI.onPropertyUpdated = () => {
      this.world?.worldMap.renderer.refreshPropertyMarkers();
    };

    this.worldMapUI.onOpenEconomy = (propId) => {
      this.economyModal.open(propId);
    };

    this.worldMapUI.onEnterInterior = (buildingId) => {
      this.currentNavMode = 'street';
      updateNavActive('');
      this.worldMapUI.close();
      const radar = document.getElementById('street-radar-bar');
      if (radar) radar.style.display = 'flex';
      this.onNavigateMode?.('street');
      setTimeout(() => {
        this.onEnterInterior?.(buildingId);
      }, 50);
    };

    if (this.world) {
      this.world.worldMap.onHoverItem = (item, screenPos) => {
        this.worldMapUI.showHoverTooltip(item, screenPos);
      };

      this.world.worldMap.onSelectItem = (event) => {
        if (event.type === 'district') {
          this.worldMapUI.showDistrictDetails(event.item as any);
        } else if (event.type === 'landmark') {
          this.worldMapUI.showLandmarkDetails(event.item as any);
        } else if (event.type === 'property') {
          this.worldMapUI.showPropertyDetails(event.item as any);
        }
      };
    }

    document.getElementById('btn-open-interstate')?.addEventListener('click', () => {
      this.interstateModal.toggle(this.world?.cityManager.currentCityId);
    });

    // Cloud & Multiplayer Hub Pill
    document.getElementById('hud-btn-cloud-sync')?.addEventListener('click', () => {
      this.phoneModal.open();
      this.phoneModal.openApp('meetumo');
    });

    CloudSyncService.getInstance().subscribe((info) => {
      const cloudStatusEl = document.getElementById('hud-cloud-status');
      if (cloudStatusEl) {
        cloudStatusEl.textContent = `☁️ ${info.lastSyncedFormatted}`;
      }
    });

    // City tabs inside aerial map view
    document.querySelectorAll('.city-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.city-tab').forEach((t) => t.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const city = target.getAttribute('data-city') as CityId;
        if (city && this.world) {
          this.world.cityManager.switchCity(city, this.player, (newObjs) => {
            if (this.world) this.world.interactiveObjects = newObjs;
          });
        }
      });
    });

    // Top left badges & Story Quest Tracker
    document.getElementById('badge-super-eagles')?.addEventListener('click', () => {
      this.questModal.open();
    });

    document.getElementById('quest-tracker-click-header')?.addEventListener('click', () => {
      this.questModal.open();
    });

    document.getElementById('btn-tracker-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const body = document.getElementById('tracker-body');
      const btn = document.getElementById('btn-tracker-toggle');
      if (body) {
        const isCollapsed = body.style.display === 'none';
        body.style.display = isCollapsed ? 'block' : 'none';
        if (btn) btn.textContent = isCollapsed ? '▾' : '▸';
      }
    });

    // Wire quest manager updates & initialize tracker
    this.questManager.subscribe((activeQuest) => {
      this.onQuestUpdate(activeQuest);
    });
    this.onQuestUpdate(this.questManager.getActiveQuest());

    document.getElementById('badge-afrobeats')?.addEventListener('click', () => {
      this.player.playEmote('groove', 5.0);
      this.showDialogueModal({
        speakerName: 'Lagos Sound City',
        speakerRole: 'Afrobeats FM 99.9',
        speakerAvatar: '🎶',
        soundType: 'cheer',
        dialogueText: 'Now Blasting: Asake - "Amapiano" & Burna Boy - "City Boys" 🎧 Lagos energy turned to maximum! Mood boosted!',
        rewards: { energy: 20 },
      });
    });

    document.getElementById('badge-gem-hunt')?.addEventListener('click', () => {
      const reward = 3000;
      const claim = this.backend.claimTimedPayout('daily_gem_hunt', reward, 'Daily Naira Gem Hunt', 24 * 60 * 60 * 1000);
      if (!claim.success) {
        const hours = Math.max(1, Math.ceil(claim.waitMs / 3600000));
        this.showDialogueModal({
          speakerName: 'Lagos City Secret',
          speakerRole: 'Daily Naira Gem Hunt',
          speakerAvatar: '💎',
          dialogueText: `You already found today's gem. The next one appears in about ${hours} hour${hours === 1 ? '' : 's'}.`,
        });
        return;
      }
      this.backend.addStreetCred(10);
      this.showDialogueModal({
        speakerName: 'Lagos City Secret',
        speakerRole: 'Daily Naira Gem Hunt',
        speakerAvatar: '💎',
        soundType: 'win',
        dialogueText: `Daily Naira Gem Hunt completed! Discovered hidden Lagos Gem! +₦${reward.toLocaleString()} cash credited to your wallet!`,
        rewards: { cash: reward, streetCred: 10 },
      });
    });

    // Radar pills navigation
    document.querySelectorAll('.radar-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const dest = target.getAttribute('data-dest');
        if (dest) {
          this.onRadarNavigate?.(dest);
        }
      });
    });

    // Quick ATM topup button
    document.getElementById('btn-quick-topup')?.addEventListener('click', () => {
      this.atmModal.open();
    });

    // Sound toggle button
    document.getElementById('hud-sound-toggle')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLElement;
      if (btn.textContent === '🔊') {
        btn.textContent = '🔈';
      } else {
        btn.textContent = '🔊';
      }
    });

    // Time-of-day click cycle (Midday -> Golden Hour -> Night -> Morning)
    document.getElementById('hud-time-pill')?.addEventListener('click', () => {
      this.world?.skyEnvironment.cycleTimeOfDay();
    });

    // Camera Orbit Controls Buttons
    document.getElementById('btn-cam-left')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onRotateCamera?.(Math.PI / 4); // 45 degrees left
    });

    document.getElementById('btn-cam-right')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onRotateCamera?.(-Math.PI / 4); // 45 degrees right
    });

    document.getElementById('btn-cam-reset')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onResetCamera?.();
    });

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.key.toLowerCase() === 'c') {
        this.creatorModal.toggle();
      } else if (e.key.toLowerCase() === 'i') {
        this.inventoryModal.toggle();
      } else if (e.key.toLowerCase() === 'b') {
        this.atmModal.open();
      } else if (e.key.toLowerCase() === 'p') {
        this.phoneModal.toggle();
      } else if (e.key.toLowerCase() === 'e') {
        if (this.currentInteractionTarget) {
          e.preventDefault();
          this.executeCurrentInteraction();
        } else if (this.interactionCard && this.interactionCard.style.display !== 'none' && this.currentActiveObject) {
          e.preventDefault();
          this.handleCardAction();
        } else {
          this.economyModal.toggle();
        }
      } else if (e.key.toLowerCase() === 'q') {
        this.questModal.toggle();
      } else if (e.key.toLowerCase() === 't') {
        this.travelModal.toggle();
      } else if (e.key.toLowerCase() === 'm') {
        this.interstateModal.toggle(this.world?.cityManager.currentCityId);
      } else if (e.key === '1') {
        this.player.playEmote('zanku', 4.0);
      } else if (e.key === '2') {
        this.player.playEmote('groove', 4.0);
      } else if (e.key === '3') {
        this.player.playEmote('salute', 3.0);
      } else if (e.key === 'Escape') {
        this.hideInteractionCard();
        this.creatorModal.close();
        this.inventoryModal.close();
        this.atmModal.close();
        this.phoneModal.close();
        this.economyModal.close();
        this.travelModal.close();
        this.interstateModal.close();
        this.questModal.close();
      }
    });
  }

  /** Opens the bag, the wardrobe and the other screens the HUD owns, for anything that needs to (the phone, the player's own menu). */
  public openInventory(): void {
    this.inventoryModal.open();
  }

  public openWardrobe(): void {
    if (!this.creatorModal.isOpen) this.creatorModal.toggle();
  }

  public openAtm(): void {
    this.atmModal.open();
  }

  public setProximityTarget(target: InteractionTarget | null): void {
    this.currentInteractionTarget = target;
    if (!this.proximityPromptEl || !this.promptLabelEl) return;

    if (!target) {
      this.proximityPromptEl.style.display = 'none';
      return;
    }

    this.promptLabelEl.textContent = target.label;
    this.proximityPromptEl.style.display = 'flex';
  }

  public executeCurrentInteraction(): void {
    if (!this.currentInteractionTarget) return;
    const target = this.currentInteractionTarget;
    console.log(`[Interaction] executing: ${target.id}`);

    if (target.action === 'enter-interior') {
      const interiorId = target.interiorId || target.id;
      this.setProximityTarget(null);
      this.hideInteractionCard();
      this.onEnterInterior?.(interiorId);
    } else if (target.action === 'exit-interior') {
      this.setProximityTarget(null);
      this.hideInteractionCard();
      this.onExitInterior?.();
    } else if (target.action === 'enter-vehicle') {
      this.setProximityTarget(null);
      this.hideInteractionCard();
      this.onEnterVehicle?.(target.id);
    } else {
      this.showInteractionCard(target.interactiveObject);
    }
  }

  public updateLocation(name: string, sub: string): void {
    const nameEl = document.getElementById('hud-loc-name');
    const subEl = document.getElementById('hud-loc-sub');
    if (nameEl && nameEl.textContent !== name) nameEl.textContent = name;
    if (subEl && subEl.textContent !== sub) subEl.textContent = sub;
  }

  public updateWeatherButton(type: 'sunny' | 'rainy'): void {
    const iconEl = document.getElementById('hud-weather-icon');
    const labelEl = document.getElementById('hud-weather-label');
    if (iconEl) iconEl.textContent = type === 'sunny' ? '☀️' : '🌧️';
    if (labelEl) labelEl.textContent = type === 'sunny' ? 'Sunny' : 'Rainy';
  }

  public onQuestUpdate(quest: StoryQuest | null): void {
    const trackerEl = document.getElementById('hud-quest-tracker');
    if (!trackerEl) return;

    if (!quest) {
      trackerEl.style.display = 'none';
      return;
    }

    trackerEl.style.display = 'flex';
    const arcEl = document.getElementById('tracker-quest-arc');
    const titleEl = document.getElementById('tracker-quest-title');
    const objListEl = document.getElementById('tracker-objectives-list');
    const rewardsEl = document.getElementById('tracker-rewards-text');

    if (arcEl) arcEl.textContent = `${quest.city.toUpperCase().replace('_', ' ')} ARC • ${quest.arcName}`;
    if (titleEl) titleEl.textContent = `Ch. ${quest.chapterNumber}: ${quest.title}`;

    if (objListEl) {
      objListEl.innerHTML = quest.objectives
        .map((obj) => {
          const countStr = obj.targetCount && obj.targetCount > 1 
            ? ` (${obj.currentCount || 0}/${obj.targetCount})` 
            : '';
          const checkIcon = obj.isCompleted ? '✅' : '○';
          const completedClass = obj.isCompleted ? 'obj-done' : '';
          return `
            <div class="tracker-obj-item ${completedClass}">
              <span class="obj-dot">${checkIcon}</span>
              <span>${obj.description}${countStr}</span>
            </div>
          `;
        })
        .join('');
    }

    if (rewardsEl) {
      let rew = `💰 ₦${quest.rewards.cash.toLocaleString()} • ⭐ +${quest.rewards.streetCred} Cred`;
      if (quest.rewards.careerXp) {
        rew += ` • 💼 +${quest.rewards.careerXp} XP`;
      }
      if (quest.rewards.itemReward) {
        rew += ` • ${quest.rewards.itemReward.icon} ${quest.rewards.itemReward.name}`;
      }
      rewardsEl.textContent = rew;
    }
  }

  public showInteractionCard(obj: InteractiveObject): void {
    this.currentActiveObject = obj;
    const categoryEl = document.getElementById('card-category')!;
    const titleEl = document.getElementById('card-title')!;
    const descEl = document.getElementById('card-desc')!;
    const btnEl = document.getElementById('card-action-btn')!;
    const bizBtn = document.getElementById('card-biz-btn') as HTMLButtonElement;

    categoryEl.textContent = obj.category;
    titleEl.textContent = obj.name;
    descEl.textContent = obj.description;

    const bizMeta = document.getElementById('card-biz-meta');
    const bizStatus = document.getElementById('card-biz-status');
    const bizOwner = document.getElementById('card-biz-owner');
    const bizRev = document.getElementById('card-biz-revenue');

    const businesses = WorldDataManager.getInstance().getBusinesses();
    const matchedBiz = businesses.find((b: MapBusiness) =>
      b.id === obj.id ||
      (obj.id === 'mama-put' && b.id === 'biz_mama_put') ||
      (obj.id === 'bet-shop' && b.id === 'biz_bet9ja') ||
      (obj.id === 'yaba-cchub' && b.id === 'biz_yaba_cchub') ||
      ((obj.id === 'cv-plaza' || obj.id === 'slot-gadgets') && b.id === 'biz_otigba_gadgets') ||
      (obj.id === 'amala-shitta' && b.id === 'biz_surulere_buka') ||
      ((obj.id === 'vi-lounge' || obj.id === 'quilox-club') && b.id === 'biz_quilox') ||
      (obj.id === 'pharmacy' && b.id === 'biz_lekki_clinic') ||
      (obj.id === 'mechanic' && b.id === 'biz_gods_grace_mechanic') ||
      (obj.id === 'fuel-station' && b.id === 'biz_oando_station') ||
      (obj.id === 'vi-tower' && b.id === 'biz_eko_atlantic_fin')
    );

    if (matchedBiz && bizMeta && bizStatus && bizOwner && bizRev) {
      bizMeta.style.display = 'block';
      bizStatus.textContent = matchedBiz.status.toUpperCase();
      bizOwner.textContent = matchedBiz.ownerId || 'NPC';
      bizRev.textContent = `₦${matchedBiz.income.toLocaleString()}`;
    } else if (bizMeta) {
      bizMeta.style.display = 'none';
    }

    if (obj.id === 'mama-put') {
      btnEl.textContent = '🍲 Enter Buka & Mama Put [E]';
      bizBtn.textContent = '💼 Business Office';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'lagos-bank') {
      btnEl.textContent = '🏦 Enter Bank & Wealth Hub [E]';
      bizBtn.textContent = '🏧 Instant ATM';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'lagos-hospital' || obj.id === 'dest_lagos_hospital') {
      btnEl.textContent = '🏥 Enter St. Nicholas General Hospital [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'unilag-campus' || obj.id === 'dest_lagos_unilag') {
      btnEl.textContent = '🎓 Enter University of Lagos (UNILAG) [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'mma-airport' || obj.id === 'dest_lagos_airport') {
      btnEl.textContent = '✈️ Enter Murtala Muhammed Intl Airport (LOS) [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'police-station' || obj.id === 'dest_lagos_police') {
      btnEl.textContent = '👮 Enter Area Command Police Station [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'interior_exit_door') {
      btnEl.textContent = '🚪 Exit to Street [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_reception') {
      btnEl.textContent = '📋 Register & Check Vitals (₦500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_doctor_desk') {
      btnEl.textContent = '🩺 Full Medical Diagnosis & Treatment (₦2,500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_ward_bed') {
      btnEl.textContent = '🛏️ Rest on Clinical Ward Bed (Full Recovery)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'hosp_pharmacy') {
      btnEl.textContent = '💊 Buy Coartem Malaria Medicine (₦1,800)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'unilag_lecture_podium') {
      btnEl.textContent = '📚 Attend Faculty Lecture (+30 Knowledge)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'unilag_library_desk') {
      btnEl.textContent = '📖 Yakubu Gowon Library Deep Study (+40 Knowledge)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'unilag_admin_portal') {
      btnEl.textContent = '📝 Register Semester Courses & Print Docket (₦1,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'unilag_quad_gist') {
      btnEl.textContent = '💬 Student Quad Social Gist (+25 Social, +20 Energy)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'airport_checkin_desk') {
      btnEl.textContent = '🧳 FAAN Check-in & Baggage Weighing (₦1,500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'airport_security_gate') {
      btnEl.textContent = '🛂 Biometric Security & Metal Detector Screening';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'airport_flight_abuja') {
      btnEl.textContent = '✈️ Board Flight LOS-ABV to Abuja FCT (₦35,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'airport_flight_ph') {
      btnEl.textContent = '✈️ Board Flight LOS-PHC to Port Harcourt (₦32,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'airport_vip_lounge') {
      btnEl.textContent = '🥂 EagleWings Executive VIP Lounge Access (₦5,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bank_atm_station') {
      btnEl.textContent = '🏧 Withdraw ₦10,000 Cash';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bank_teller_station') {
      btnEl.textContent = '💱 Foreign Remittance Wire Pickup (+₦25,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bank_manager_desk') {
      btnEl.textContent = '💼 Apply for Lagos SME Loan (+₦50,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'buka_food_counter' || obj.id === 'interior_npc_npc_mama_nkechi') {
      btnEl.textContent = '📋 See the menu';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'buka_table_vip') {
      btnEl.textContent = '🪑 Sit here & order';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'interior_npc_npc_waiter_segun') {
      btnEl.textContent = '📋 Ask Segun for the menu';
      bizBtn.style.display = 'none';
    } else if (obj.id.startsWith('shop_shelf_')) {
      btnEl.textContent = '🛒 See what is on this shelf';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'shop_checkout' || obj.id === 'interior_npc_npc_shop_cashier') {
      btnEl.textContent = '🧾 Basket & pay';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'supermarket') {
      btnEl.textContent = '🛒 Enter Everyday Supermarket [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'police_front_desk') {
      btnEl.textContent = '📝 Area Command Desk & Clearance Services [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'police_holding_cell') {
      btnEl.textContent = '⚖️ Detention Cell & Citizen Bail Bond [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'street-checkpoint') {
      btnEl.textContent = '🛑 Approach Highway & Police Checkpoint [E]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-workstation') {
      btnEl.textContent = '💻 Complete Remote Tech Sprint (+₦12,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id.startsWith('interior_npc_')) {
      btnEl.textContent = `💬 Gist & Consult ${obj.name}`;
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bet-shop') {
      btnEl.textContent = '⚽ Place Match Ticket (₦1,000)';
      bizBtn.textContent = '💼 POS & NaijaBet Mega Hub [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'villa-compound' || obj.id === 'palm-view-flats') {
      btnEl.textContent = '🏠 Enter Apartment / Residence [E]';
      bizBtn.textContent = '🏡 Victoria Estate Property Office [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id.startsWith('veh-')) {
      btnEl.textContent = '🚗 Board & Drive [F]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'danfo-stop') {
      btnEl.textContent = '🗺️ Lagos Inter-City Danfo Transit [T]';
      bizBtn.textContent = '🚌 Transport Fleet Management [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'vi-tower') {
      btnEl.textContent = '🏢 Enter Corporate Penthouse Reception';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'vi-lounge' || obj.id === 'quilox-club') {
      btnEl.textContent = '🍾 Order Dom Pérignon & VIP Table with Sparklers (₦25,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'amala-shitta') {
      btnEl.textContent = '🍲 Order Hot Amala Dudu + Abula & Goat Meat (₦2,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'nepa-generator') {
      btnEl.textContent = '⚡ Pull Starter Cord & Pour ₦1,200 Fuel ("UP NEPA!")';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'cv-plaza') {
      btnEl.textContent = '🔌 Buy 20,000mAh Power Bank & Cable (₦5,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'lekki-bridge') {
      btnEl.textContent = '🌉 Pay Lekki-Ikoyi Toll & Cross Bridge (₦500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'nike-art-gallery') {
      btnEl.textContent = '🎨 Purchase Handcrafted Adire Art (₦12,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'aso-rock-lookout') {
      btnEl.textContent = '⛰️ Admire Geological Monolith & Presidential Lookout';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-mosque') {
      btnEl.textContent = '🕌 Tour National Mosque Architecture';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-christian-centre') {
      btnEl.textContent = '⛪ Visit National Christian Centre Sanctuary';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-secretariat') {
      btnEl.textContent = '📜 Federal Government Procurement & Contracts';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-cab') {
      btnEl.textContent = '🚕 Board Federal Green Cab to Maitama (₦800)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'abuja-interstate-hub') {
      btnEl.textContent = '✈️ Book Flight / Luxury Coach to Lagos [M]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-tv') {
      btnEl.textContent = '📺 Sit down & watch the match';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-bed') {
      btnEl.textContent = '🛏️ Lie down & sleep';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-drum') {
      btnEl.textContent = '🚿 Take a bucket bath';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-fridge') {
      btnEl.textContent = '🧊 Eat something from your bag';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-sofa') {
      btnEl.textContent = '🛋️ Relax on Living Room Sofa (Energy +30%)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-pet') {
      btnEl.textContent = '🐕 Pet Bingo & Feed Biscuit (Mood Boost +40%)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-hawker') {
      btnEl.textContent = '🥤 Buy Pure Water & Gala (₦200)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-conductor') {
      btnEl.textContent = '🚌 Board Danfo Shuttle (₦300)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-punter') {
      btnEl.textContent = '💬 Gist with Segun (NaijaBet)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'pharmacy') {
      btnEl.textContent = '💊 Buy Medicine & First Aid (₦1,500)';
      bizBtn.textContent = '💼 Pharmacy Enterprise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'slot-gadgets') {
      btnEl.textContent = '📱 Buy 20,000mAh Power Bank & Charger (₦8,500)';
      bizBtn.textContent = '💼 Slot Tech Enterprise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'barber-shop') {
      btnEl.textContent = '💈 Executive Fade & Beard Grooming (₦2,500)';
      bizBtn.textContent = '💼 Barbershop Enterprise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'fuel-station') {
      btnEl.textContent = '⛽ Buy 10L Petrol Keg & Cold Drink (₦8,500)';
      bizBtn.textContent = '💼 NaijaPetro Forecourt Franchise [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'mechanic') {
      btnEl.textContent = '🔧 Tune Up Engine & Vehicle Overhaul (₦6,000)';
      bizBtn.textContent = "💼 God's Grace Workshop [E]";
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'construction-site') {
      btnEl.textContent = '👷 Work Construction Day Shift (+₦6,500 Cash)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'palm-view-flats') {
      btnEl.textContent = '🏢 Inspect 2-Bedroom Apartment Flat';
      bizBtn.textContent = '🏡 Palm View Property Office [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'npc-suya') {
      btnEl.textContent = '🥩 Buy Hot Spicy Beef Suya & Onions (₦1,500)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-emeka') {
      btnEl.textContent = '📱 Screen & Battery Phone Diagnostic (₦3,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-mechanic') {
      btnEl.textContent = '🛠️ Work Mechanic Apprentice Shift (+₦4,000 Gig)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-warden') {
      btnEl.textContent = '👮 Ask for Lagos Traffic & Safety Directions';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-chief') {
      btnEl.textContent = '👑 Greet Elder with Respect ("E nle o, Kabiyesi!")';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-aunty') {
      btnEl.textContent = '👗 Buy Premium Hollandais Wax Fabric (₦18,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-banker') {
      btnEl.textContent = '📈 Invest in 90-Day Federal Treasury Bills (₦50,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'yaba-cchub') {
      btnEl.textContent = '💻 Join Tech Hackathon & Remote Sprint (+₦15,000)';
      bizBtn.textContent = '🚀 Co-Creation Tech Incubator [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'surulere-stadium') {
      btnEl.textContent = '🏃 Athletic Track Workout & Football Training (₦1,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'mma-airport') {
      btnEl.textContent = '✈️ Book Interstate Flight to Abuja / Port Harcourt [M]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'ajah-estate') {
      btnEl.textContent = '👷 Work Construction Framing Shift (+₦8,500 Cash)';
      bizBtn.textContent = '🏡 Ajah Peninsula Properties [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'balogun-market') {
      btnEl.textContent = '👗 Buy Wholesale Ankara Fabric Bale (₦6,000)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-bed') {
      btnEl.textContent = '🛏️ Sleep in Bed & Deep Rest (100% Energy & Health)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-drum') {
      btnEl.textContent = '🚿 Fetch Water & Bath from Drum (+30 Energy, +20 Health)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'flat-pet') {
      btnEl.textContent = '🐶 Pet Bingo the Dog (+15 Mood, +5 Cred)';
      bizBtn.style.display = 'none';
    } else if (obj.id.startsWith('remote_player_')) {
      btnEl.textContent = '🤝 Citizen Interaction & EkoPay [E]';
      bizBtn.style.display = 'none';
    } else {
      btnEl.textContent = 'Enter / Inspect';
      bizBtn.style.display = 'none';
    }

    if (VendorUI.sells(obj.id)) {
      btnEl.textContent = `🛍️ See what ${STREET_VENDORS[obj.id].name} is selling`;
      bizBtn.style.display = 'none';
    }
    if (obj.id.startsWith('plot_')) {
      btnEl.textContent = '📋 Inspect this plot';
      bizBtn.style.display = 'none';
    }

    // Anyone the interaction system can direct can be waved at, greeted, spoken to; another player can be waved at and greeted
    const person = InteractionDirector.get().actorFor(obj.id);
    const otherPlayer = obj.id.startsWith('remote_player_');
    const show = (buttonId: string, on: boolean) => {
      const button = document.getElementById(buttonId);
      if (button) button.style.display = on ? 'inline-block' : 'none';
    };
    show('card-wave-btn', !!person || otherPlayer);
    show('card-greet-btn', !!person || otherPlayer);
    show('card-shake-btn', !!person && cannotShakeHands(this.player.actor, person, { nav: this.world?.interiorManager.isPlayerInside() ? this.world.interiorManager.getActiveNav() : null }) === null);
    show('card-chat-btn', !!person);
    show('card-sit-btn', this.canSitWith?.(obj.id) ?? false);
    const socialRow = document.getElementById('card-social');
    if (socialRow) socialRow.style.display = person || otherPlayer ? 'flex' : 'none';
    const standingLabel = document.getElementById('card-social-label');
    if (standingLabel) {
      const standing = person ? standingWith(person) : 'stranger';
      standingLabel.textContent = otherPlayer ? 'Player' : standing === 'friend' ? 'Friend' : standing === 'acquaintance' ? 'Knows you' : 'Stranger';
      standingLabel.dataset.standing = standing;
    }

    this.interactionCard.style.display = 'block';
    UIStateManager.getInstance().setCardOpen(true);
  }

  public showDrivingHUD(vehicleName: string): void {
    if (this.drivingHudEl) {
      this.drivingHudEl.style.display = 'flex';
      const nameEl = document.getElementById('driving-veh-name');
      if (nameEl) nameEl.textContent = vehicleName;
    }
  }

  public hideDrivingHUD(): void {
    if (this.drivingHudEl) {
      this.drivingHudEl.style.display = 'none';
    }
  }

  public updateDrivingHUD(speedMps: number): void {
    const speedValEl = document.getElementById('speedo-val');
    if (speedValEl) {
      const kmh = Math.round(Math.abs(speedMps) * 3.6);
      speedValEl.textContent = kmh.toString();
    }
  }

  public updateOnlineCount(count: number): void {
    const onlineEl = document.getElementById('hud-online-count');
    if (onlineEl) {
      onlineEl.textContent = `${count} Online`;
    }
  }

  public showDialogueModal(options: {
    speakerName: string;
    speakerRole?: string;
    speakerAvatar?: string;
    dialogueText: string;
    soundType?: 'cash' | 'medical' | 'aviation' | 'academic' | 'general' | 'win' | 'cheer' | 'tech';
    rewards?: {
      cash?: number;
      health?: number;
      energy?: number;
      streetCred?: number;
      knowledge?: number;
      item?: {
        name: string;
        icon: string;
        category?: string;
      };
    };
    choices?: Array<{
      id: string;
      label: string;
      badge?: string;
      onSelect: () => void;
    }>;
    onConfirm?: () => void;
  }): void {
    // Play Web Audio chime for video game feedback
    this.playAudioChime(options.soundType || 'general');

    // Remove any existing dialog modal
    const existing = document.getElementById('game-dialogue-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'game-dialogue-overlay';
    overlay.className = 'game-dialogue-overlay';

    let rewardsHtml = '';
    if (options.rewards) {
      if (options.rewards.cash) {
        rewardsHtml += `<div class="dialogue-reward-pill reward-cash">💵 +₦${options.rewards.cash.toLocaleString()} Cash</div>`;
      }
      if (options.rewards.health) {
        rewardsHtml += `<div class="dialogue-reward-pill reward-health">💚 +${options.rewards.health}% Health</div>`;
      }
      if (options.rewards.energy) {
        rewardsHtml += `<div class="dialogue-reward-pill reward-energy">⚡ +${options.rewards.energy}% Energy</div>`;
      }
      if (options.rewards.streetCred) {
        rewardsHtml += `<div class="dialogue-reward-pill reward-cred">⭐ +${options.rewards.streetCred} Street Cred</div>`;
      }
      if (options.rewards.knowledge) {
        rewardsHtml += `<div class="dialogue-reward-pill reward-knowledge">📚 +${options.rewards.knowledge} Knowledge</div>`;
      }
      if (options.rewards.item) {
        rewardsHtml += `<div class="dialogue-reward-pill reward-item">${options.rewards.item.icon} ${options.rewards.item.name}</div>`;
      }
    }

    const hasChoices = Boolean(options.choices && options.choices.length > 0);
    let choicesHtml = '';
    if (hasChoices) {
      choicesHtml = `
        <div class="dialogue-choices-row" id="dialogue-choices-row">
          ${options.choices!.map((c, idx) => `
            <button class="dialogue-choice-btn" data-choice-index="${idx}">
              <div class="choice-left">
                <span class="choice-num">[${idx + 1}]</span>
                <span class="choice-label">${c.label}</span>
              </div>
              ${c.badge ? `<span class="choice-badge">${c.badge}</span>` : ''}
            </button>
          `).join('')}
        </div>
        <div class="dialogue-choices-hint">Press 1-${options.choices!.length} or click an option above • [ESC] to dismiss</div>
      `;
    }

    overlay.innerHTML = `
      <div class="game-dialogue-card">
        <div class="dialogue-card-header">
          <div class="dialogue-avatar-box">${options.speakerAvatar || '💬'}</div>
          <div class="dialogue-speaker-meta">
            <span class="dialogue-speaker-name">${options.speakerName}</span>
            <span class="dialogue-speaker-role">${options.speakerRole || 'Lagos Citizen'}</span>
          </div>
        </div>
        <div class="dialogue-speech-box">
          "${options.dialogueText}"
        </div>
        ${rewardsHtml ? `<div class="dialogue-rewards-row">${rewardsHtml}</div>` : ''}
        ${choicesHtml}
        ${!hasChoices ? `
          <button class="dialogue-confirm-btn" id="dialogue-confirm-btn">
            <span>Oya Continue [E]</span>
            <span>✨</span>
          </button>
        ` : ''}
      </div>
    `;

    document.body.appendChild(overlay);
    UIStateManager.getInstance().registerModal('dialogue', {
      id: 'dialogue',
      close: () => close(),
      isOpen: () => Boolean(document.getElementById('game-dialogue-overlay')),
    });
    UIStateManager.getInstance().pushModal('dialogue');

    const close = () => {
      window.removeEventListener('keydown', handleKey);
      overlay.remove();
      UIStateManager.getInstance().popModal('dialogue');
      options.onConfirm?.();
    };

    const handleKey = (e: KeyboardEvent) => {
      if (hasChoices) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= options.choices!.length) {
          e.preventDefault();
          const selected = options.choices![num - 1];
          close();
          selected.onSelect();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
          return;
        }
      } else {
        if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    if (hasChoices) {
      overlay.querySelectorAll('.dialogue-choice-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt((btn as HTMLElement).dataset.choiceIndex || '0', 10);
          const selected = options.choices![idx];
          close();
          if (selected) {
            selected.onSelect();
          }
        });
      });
    } else {
      overlay.querySelector('#dialogue-confirm-btn')?.addEventListener('click', close);
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  private playAudioChime(type: string): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'cash') {
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'medical') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.25);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'aviation') {
        osc.frequency.setValueAtTime(739.99, now);
        osc.frequency.setValueAtTime(554.37, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'academic') {
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(880.00, now + 0.1);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'tech') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880.00, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch {
      // AudioContext fallback
    }
  }

  public hideInteractionCard(): void {
    this.interactionCard.style.display = 'none';
    this.currentActiveObject = null;
    UIStateManager.getInstance().setCardOpen(false);
  }

  /**
   * Things done at a desk, a machine or a counter are seen to be done: the player walks up,
   * faces it and uses it, and what it does happens part-way through. Returns true if that
   * has been started (or cannot be, because the player is half-way through a door).
   */
  private actOut(obj: InteractiveObject): boolean {
    const interiors = this.world?.interiorManager;
    if (!interiors?.isPlayerInside() || !this.player) return false;
    const actor = this.player.actor;
    const director = InteractionDirector.get();
    if (director.interrupt(actor) === 'locked') return true;

    const target = obj.mesh.getWorldPosition(new THREE.Vector3());
    const facing = Math.hypot(target.x - obj.interactionPoint.x, target.z - obj.interactionPoint.z) > 0.4 ? target : undefined;
    const withHands = /atm|bed|cell|gate|podium|portal/.test(obj.id);
    this.hideInteractionCard();
    return director.perform({
      id: `use ${obj.id}`,
      actor,
      point: obj.interactionPoint,
      target: facing,
      nav: interiors.getActiveNav(),
      ifStuck: 'snap',
      speed: 5,
      animation: { arms: withHands ? 'reach' : 'talk' },
      seconds: withHands ? 0.9 : 1.2,
      effectAt: 0.6,
      effect: () => {
        this.currentActiveObject = obj;
        this.actingOut = true;
        try {
          this.handleCardAction();
        } finally {
          this.actingOut = false;
          if (this.interactionCard.style.display === 'none') this.currentActiveObject = null;
        }
      },
    }).ok;
  }

  private handleCardAction(): void {
    if (!this.currentActiveObject) return;
    const id = this.currentActiveObject.id;
    if (!this.actingOut && HUD.ACTED_OUT.test(id) && this.actOut(this.currentActiveObject)) return;
    this.questManager.triggerEvent('interact_object', { objectId: id });

    if (VendorUI.sells(id)) {
      // Bought hand to hand in the street; the list only starts it
      this.hideInteractionCard();
      this.onVendorAction?.(id);
      return;
    }

    if (id.startsWith('plot_')) {
      this.hideInteractionCard();
      this.onPlotAction?.(id.slice(5));
      return;
    }

    if (id.startsWith('remote_player_')) {
      this.hideInteractionCard();
      const rawId = id.replace('remote_player_', '');
      const net = NetworkManager.getInstance();
      const citizenName = this.currentActiveObject?.name || `@${rawId.substring(0, 8)}`;

      this.showDialogueModal({
        speakerName: citizenName,
        speakerRole: 'Lagos Island Citizen (Online)',
        speakerAvatar: '🇳🇬',
        soundType: 'general',
        dialogueText: `You approach ${citizenName} strolling along Broad Street! How do you want to interact?`,
        choices: [
          {
            id: 'wire_gift',
            label: 'Send ₦1,000 EkoPay Cash Gift',
            badge: '₦1,000 Wire',
            onSelect: () => {
              if (net) {
                const sent = net.sendP2PTransfer(rawId, 1000, 'Street Cash Gift');
                if (!sent.success) showGameToast(sent.message, 'warning');
              } else {
                showGameToast('Network unavailable.', 'warning');
              }
            },
          },
          {
            id: 'wire_big_gift',
            label: 'Send ₦5,000 Big Boy VIP Cash Gift',
            badge: '₦5,000 Wire',
            onSelect: () => {
              if (net) {
                const sent = net.sendP2PTransfer(rawId, 5000, 'VIP Respect Wire');
                if (!sent.success) showGameToast(sent.message, 'warning');
              } else {
                showGameToast('Network unavailable.', 'warning');
              }
            },
          },
          {
            id: 'sync_dance',
            label: 'Perform Synchronized Zanku Dance',
            badge: 'Zanku Emote',
            onSelect: () => {
              this.player.playEmote('zanku', 4.0);
              if (net) {
                net.syncEmote('zanku');
              }
              showGameToast(`🔥 Busting Zanku dance moves with ${citizenName}!`, 'success');
            },
          },
          {
            id: 'salute_peer',
            label: 'Give Respectful Military Salute',
            badge: 'Salute',
            onSelect: () => {
              this.player.playEmote('salute', 3.0);
              if (net) {
                net.syncEmote('salute');
              }
              showGameToast(`🫡 Saluted ${citizenName}! Respect acknowledged.`, 'info');
            },
          },
          {
            id: 'send_chat',
            label: 'Send Quick Gist ("How far boss!")',
            badge: 'Quick Chat',
            onSelect: () => {
              if (net) {
                net.sendChatMessage(`How far, @${citizenName}! Safe journey across Lagos!`);
                showGameToast(`💬 Chat broadcasted to ${citizenName}!`, 'info');
              }
            },
          },
        ],
      });
      return;
    }

    if (id === 'mama-put') {
      this.hideInteractionCard();
      this.onEnterInterior?.('restaurant');
      return;
    } else if (id === 'lagos-bank') {
      this.hideInteractionCard();
      this.onEnterInterior?.('bank');
      return;
    } else if (id === 'lagos-hospital' || id === 'dest_lagos_hospital') {
      this.hideInteractionCard();
      this.onEnterInterior?.('hospital');
      return;
    } else if (id === 'unilag-campus' || id === 'dest_lagos_unilag') {
      this.hideInteractionCard();
      this.onEnterInterior?.('university');
      return;
    } else if (id === 'mma-airport' || id === 'dest_lagos_airport') {
      this.hideInteractionCard();
      this.onEnterInterior?.('airport');
      return;
    } else if (id === 'police-station' || id === 'dest_lagos_police') {
      this.hideInteractionCard();
      this.onEnterInterior?.('police');
      return;
    } else if (id === 'supermarket') {
      this.hideInteractionCard();
      this.onEnterInterior?.('shop');
      return;
    } else if (id.startsWith('shop_shelf_') || id === 'shop_checkout' || id === 'interior_npc_npc_shop_cashier') {
      // Shopping is acted out in the shop: basket, shelves, till. The sheet only asks for it.
      this.hideInteractionCard();
      this.onShopAction?.(id);
      return;
    } else if (id === 'villa-compound' || id === 'palm-view-flats') {
      this.hideInteractionCard();
      this.onEnterInterior?.('residence');
      return;
    } else if (id === 'interior_exit_door') {
      this.hideInteractionCard();
      this.onExitInterior?.();
      return;
    } else if (id === 'flat-bed' || id === 'flat-tv' || id === 'flat-drum' || id === 'flat-fridge') {
      // Acted out in the room: lie down, sit, reach into the fridge, bathe
      this.hideInteractionCard();
      this.onHomeActivity?.(id);
      return;
    } else if (id === 'flat-pet') {
      this.backend.addStreetCred(5);
      this.player.playEmote('groove', 3.0);
      this.showDialogueModal({
        speakerName: 'Bingo the Dog',
        speakerRole: 'Faithful Nigerian Companion',
        speakerAvatar: '🐶',
        soundType: 'cheer',
        dialogueText: 'Woof woof! Bingo wags his tail happily and nuzzles your palm! Your mood surges to maximum joy.',
        rewards: { streetCred: 5, energy: 10 },
      });
      return;
    } else if (id === 'hosp_reception') {
      const success = this.backend.spendCash(500, 'Hospital Triage Registration');
      if (success) {
        this.backend.restoreHealth(20);
        this.showDialogueModal({
          speakerName: 'Nurse Chidinma',
          speakerRole: 'Senior Triage Nurse • St. Nicholas Hospital',
          speakerAvatar: '🩺',
          soundType: 'medical',
          dialogueText: 'Registration complete! Blood pressure 120/80. Doctor Adeleke is waiting in Consultation Room 1.',
          rewards: { health: 20 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Hospital Triage Desk',
          speakerRole: 'Patient Admissions',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦500 cash for hospital patient vitals registration!',
        });
      }
      return;
    } else if (id === 'hosp_doctor_desk') {
      const success = this.backend.spendCash(2500, 'Doctor Adeleke Medical Consultation');
      if (success) {
        this.backend.restoreHealth(100);
        this.backend.restoreEnergy(50);
        this.backend.addStreetCred(10);
        this.showDialogueModal({
          speakerName: 'Dr. Adeleke',
          speakerRole: 'Chief Medical Consultant • St. Nicholas Hospital',
          speakerAvatar: '👨‍⚕️',
          soundType: 'medical',
          dialogueText: 'Your diagnosis is looking good! Administered a high-potency vitamin injection. Health fully restored to 100%!',
          rewards: { health: 100, energy: 50, streetCred: 10 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Consultation Desk',
          speakerRole: 'Dr. Adeleke Office',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦2,500 cash for full clinical medical consultation!',
        });
      }
      return;
    } else if (id === 'hosp_ward_bed') {
      this.backend.restoreHealth(100);
      this.backend.restoreEnergy(100);
      this.showDialogueModal({
        speakerName: 'Ward Recovery Attendant',
        speakerRole: 'Clinical Inpatient Ward',
        speakerAvatar: '🛏️',
        soundType: 'medical',
        dialogueText: 'You rest peacefully on the medical bed. The saline drip cleanses your system. 100% Health & Energy restored!',
        rewards: { health: 100, energy: 100 },
      });
      return;
    } else if (id === 'hosp_pharmacy') {
      const success = this.backend.spendCash(1800, 'Coartem Malaria Pack');
      if (success) {
        this.backend.addItem({
          id: `coartem_${Date.now()}`,
          name: 'Coartem Malaria Dose',
          category: 'medicine',
          icon: '💊',
          description: 'Gold standard fast-acting anti-malarial blister pack.',
          price: 1800,
          usable: true,
          energyRestore: 40,
        });
        this.showDialogueModal({
          speakerName: 'Pharm. Kemi',
          speakerRole: 'Dispensary Lead • St. Nicholas Central Pharmacy',
          speakerAvatar: '💊',
          soundType: 'medical',
          dialogueText: 'Here is your Coartem dose! Added to your bag. Take two tablets twice daily with water.',
          rewards: { item: { name: 'Coartem Malaria Pack', icon: '💊', category: 'medicine' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Dispensary Counter',
          speakerRole: 'Pharmacy',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,800 cash for Coartem malaria medicine!',
        });
      }
      return;
    } else if (id === 'unilag_lecture_podium') {
      this.backend.addStreetCred(15);
      this.backend.restoreEnergy(10);
      this.showDialogueModal({
        speakerName: 'Prof. Balogun',
        speakerRole: 'Faculty of Science • UNILAG Akoka',
        speakerAvatar: '📚',
        soundType: 'academic',
        dialogueText: 'Excellent question from the hall! Attendance recorded on the department register. Great Akokite! +30 Academic Knowledge!',
        rewards: { knowledge: 30, streetCred: 15, energy: 10 },
      });
      return;
    } else if (id === 'unilag_library_desk') {
      this.backend.addStreetCred(20);
      this.backend.restoreEnergy(10);
      this.showDialogueModal({
        speakerName: 'Yakubu Gowon Archives',
        speakerRole: 'UNILAG Central Library',
        speakerAvatar: '📖',
        soundType: 'academic',
        dialogueText: 'You immerse yourself in the Law & Engineering journals in Yakubu Gowon Library. Academic research mastery unlocked!',
        rewards: { knowledge: 40, streetCred: 20, energy: 10 },
      });
      return;
    } else if (id === 'unilag_admin_portal') {
      const success = this.backend.spendCash(1000, 'Semester Course Registration & Docket Printing');
      if (success) {
        this.backend.addItem({
          id: `unilag_docket_${Date.now()}`,
          name: 'UNILAG Stamped Examination Docket',
          category: 'document',
          icon: '📄',
          description: 'Official verified course registration docket signed by the Faculty Dean.',
          price: 1000,
          usable: false,
        });
        this.backend.addStreetCred(10);
        this.showDialogueModal({
          speakerName: 'Academic Affairs Officer',
          speakerRole: 'Senate Building Portal Desk',
          speakerAvatar: '📝',
          soundType: 'academic',
          dialogueText: 'Courses submitted successfully! Here is your verified exam docket for the semester. Added to your inventory!',
          rewards: { streetCred: 10, item: { name: 'UNILAG Examination Docket', icon: '📄', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Portal Admin',
          speakerRole: 'Course Registration',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,000 cash for faculty docket printing and exam clearance!',
        });
      }
      return;
    } else if (id === 'unilag_quad_gist') {
      this.backend.restoreEnergy(30);
      this.backend.addStreetCred(15);
      this.showDialogueModal({
        speakerName: 'Comrade Femi & Chidinma',
        speakerRole: 'Student Union Quad',
        speakerAvatar: '💬',
        soundType: 'cheer',
        dialogueText: 'Guy, no dulling! Unilag life na cruise plus focus. You share roasted suya and sweet vibes at the love garden!',
        rewards: { energy: 30, streetCred: 15 },
      });
      return;
    } else if (id === 'airport_checkin_desk') {
      const success = this.backend.spendCash(1500, 'FAAN Checked Luggage Handling');
      if (success) {
        this.backend.addItem({
          id: `boarding_pass_${Date.now()}`,
          name: 'First Class Boarding Pass (LOS)',
          category: 'document',
          icon: '🎫',
          description: 'Official FAAN priority boarding pass for interstate domestic departures.',
          price: 1500,
          usable: true,
          energyRestore: 10,
        });
        this.showDialogueModal({
          speakerName: 'FAAN Check-in Staff',
          speakerRole: 'Wazobia Air Concourse Desk • MMA2 Terminal',
          speakerAvatar: '🧳',
          soundType: 'aviation',
          dialogueText: 'Baggage tag 073-LOS tagged priority! Here is your boarding pass. Please proceed directly to screening.',
          rewards: { item: { name: 'First Class Boarding Pass (LOS)', icon: '🎫', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Terminal Desk',
          speakerRole: 'FAAN Baggage Handling',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,500 cash for FAAN priority luggage check-in!',
        });
      }
      return;
    } else if (id === 'airport_security_gate') {
      this.backend.addStreetCred(10);
      this.showDialogueModal({
        speakerName: 'Officer Ngozi',
        speakerRole: 'FAAN Aviation Security Commander',
        speakerAvatar: '🛂',
        soundType: 'aviation',
        dialogueText: 'Metal detector clear! Biometrics matched with NIMC database. Have a safe journey, welcome to Lagos airside!',
        rewards: { streetCred: 10 },
      });
      return;
    } else if (id === 'airport_flight_abuja') {
      const success = this.backend.spendCash(35000, 'Flight LOS to ABV (Abuja)');
      if (success) {
        this.backend.addStreetCred(50);
        this.backend.restoreEnergy(100);
        this.showDialogueModal({
          speakerName: 'Capt. Ibrahim',
          speakerRole: 'Wazobia Air • Flight WZ-214 to Abuja',
          speakerAvatar: '✈️',
          soundType: 'aviation',
          dialogueText: 'Cabin doors armed. Non-stop executive flight from Lagos to Nnamdi Azikiwe Intl Airport, Abuja FCT completed! Welcome to Abuja!',
          rewards: { streetCred: 50, energy: 100 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Wazobia Air Ticketing',
          speakerRole: 'Gate 1 Departures',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦35,000 cash for direct flight ticket to Abuja FCT!',
        });
      }
      return;
    } else if (id === 'airport_flight_ph') {
      const success = this.backend.spendCash(32000, 'Flight LOS to PHC (Port Harcourt)');
      if (success) {
        this.backend.addStreetCred(50);
        this.backend.restoreEnergy(100);
        this.showDialogueModal({
          speakerName: 'EagleWings Flight Crew',
          speakerRole: 'Gate 2 • Flight EW-712 to Port Harcourt',
          speakerAvatar: '✈️',
          soundType: 'aviation',
          dialogueText: 'Direct flight to Port Harcourt International Airport (Omagwa) completed! Welcome to the Garden City!',
          rewards: { streetCred: 50, energy: 100 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'EagleWings Ticketing',
          speakerRole: 'Gate 2 Departures',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦32,000 cash for flight ticket to Port Harcourt!',
        });
      }
      return;
    } else if (id === 'airport_vip_lounge') {
      const success = this.backend.spendCash(5000, 'VIP Concourse Lounge Pass');
      if (success) {
        this.backend.restoreHealth(100);
        this.backend.restoreEnergy(100);
        this.backend.addStreetCred(25);
        this.showDialogueModal({
          speakerName: 'EagleWings VIP Host',
          speakerRole: 'MMA2 Concourse Lounge',
          speakerAvatar: '🥂',
          soundType: 'win',
          dialogueText: 'Welcome to the executive lounge! Chilled vintage drinks, AC, high-speed Wi-Fi and gourmet snacks served. 100% Health & Energy restored!',
          rewards: { health: 100, energy: 100, streetCred: 25 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'VIP Lounge Concierge',
          speakerRole: 'Executive Suite',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦5,000 cash for VIP lounge access!',
        });
      }
      return;
    } else if (id === 'bank_atm_station') {
      // The branch ATM is the player's own account: it moves their money, it does not create any
      this.hideInteractionCard();
      this.atmModal.open();
      return;
    } else if (id === 'bank_teller_station') {
      const claim = this.backend.claimTimedPayout('diaspora_remittance', 25000, 'Diaspora Remittance Pickup', 24 * 60 * 60 * 1000);
      if (claim.success) {
        this.backend.addStreetCred(15);
        this.showDialogueModal({
          speakerName: 'Teller Ngozi',
          speakerRole: 'Foreign Remittance Desk',
          speakerAvatar: '💱',
          soundType: 'cash',
          dialogueText: 'Diaspora foreign wire transfer verified! ₦25,000 cash paid over the counter. Street Cred +15!',
          rewards: { cash: 25000, streetCred: 15 },
        });
      } else {
        const hours = Math.max(1, Math.ceil(claim.waitMs / 3600000));
        this.showDialogueModal({
          speakerName: 'Teller Ngozi',
          speakerRole: 'Foreign Remittance Desk',
          speakerAvatar: '💱',
          dialogueText: `No wire is waiting for you right now. Your family abroad sends one a day; check back in about ${hours} hour${hours === 1 ? '' : 's'}.`,
        });
      }
      return;
    } else if (id === 'bank_manager_desk') {
      const loan = this.backend.getData().activeLoan;
      if (loan) {
        const repaid = this.backend.repayLoan();
        if (repaid.success) {
          this.backend.addStreetCred(30);
        }
        this.showDialogueModal({
          speakerName: 'Manager Bankole',
          speakerRole: 'Branch Manager • Eko Commercial Bank',
          speakerAvatar: repaid.success ? '💼' : '⚠️',
          soundType: repaid.success ? 'cash' : undefined,
          dialogueText: repaid.success
            ? `${repaid.message} Your credit record is clean and you may borrow again. Street Cred +30!`
            : `${repaid.message} Come back with the full amount in your wallet or bank account.`,
          rewards: repaid.success ? { streetCred: 30 } : undefined,
        });
      } else {
        const borrowed = this.backend.takeLoan('Eko Commercial Bank', 50000, 55000);
        this.showDialogueModal({
          speakerName: 'Manager Bankole',
          speakerRole: 'Branch Manager • Eko Commercial Bank',
          speakerAvatar: '💼',
          soundType: 'cash',
          dialogueText: `Lagos SME Business Loan approved! ${borrowed.message} Return to this desk to repay it.`,
          rewards: { cash: 50000 },
        });
      }
      return;
    } else if (id === 'buka_food_counter' || id === 'interior_npc_npc_mama_nkechi' || id === 'interior_npc_npc_waiter_segun') {
      // Ordering is acted out in the room: seat, cook, waiter, plate. The menu only starts it.
      this.hideInteractionCard();
      this.onOpenBukaMenu?.();
      return;
    } else if (id === 'buka_table_vip') {
      this.hideInteractionCard();
      this.onOpenBukaMenu?.(0);
      return;
    } else if (id === 'street-checkpoint') {
      this.hideInteractionCard();
      const data = this.backend.getData();
      const hasPapers = data.inventory.some((i: any) => i.category === 'document' || i.id.includes('docket') || i.id.includes('clearance'));
      this.showDialogueModal({
        speakerName: 'Inspector Danjuma & LASTMA Team',
        speakerRole: 'Federal Highway & Area Command Joint Patrol',
        speakerAvatar: '👮‍♂️',
        soundType: 'general',
        dialogueText: 'Stop there! Turn off ignition and present yourself! Routine vehicle particulars and security verification. Show me your roadworthiness particulars now!',
        choices: [
          {
            id: 'checkpoint_papers',
            label: hasPapers || data.stats.streetCred >= 25 ? 'Present Valid Particulars & Road Clearance' : 'Present Expired Papers & Plead Goodwill',
            badge: hasPapers || data.stats.streetCred >= 25 ? 'Clearance Verified' : 'Risk Warning',
            onSelect: () => {
              if (hasPapers || data.stats.streetCred >= 25) {
                this.backend.addStreetCred(20);
                this.backend.restoreEnergy(15);
                this.showDialogueModal({
                  speakerName: 'Inspector Danjuma',
                  speakerRole: 'Highway Joint Patrol Commander',
                  speakerAvatar: '🫡',
                  soundType: 'win',
                  dialogueText: 'Inspector salutes! "Everything intact and certified! Your roadworthiness is clean. Respect to law-abiding citizens! Move on oga!"',
                  rewards: { streetCred: 20, energy: 15 },
                });
              } else {
                this.backend.addStreetCred(5);
                this.showDialogueModal({
                  speakerName: 'Inspector Danjuma',
                  speakerRole: 'Highway Patrol',
                  speakerAvatar: '⚠️',
                  soundType: 'general',
                  dialogueText: 'Inspector shakes head: "Your particulars are incomplete! Because you cooperated calmly, we give you a warning citation today. Go to the Area Command and get your papers right!"',
                  rewards: { streetCred: 5 },
                });
              }
            },
          },
          {
            id: 'checkpoint_pure_water',
            label: 'Offer ₦500 "Pure Water & Cold Minerals" Goodwill',
            badge: '₦500 Cash',
            onSelect: () => {
              const success = this.backend.spendCash(500, 'Checkpoint Pure Water Goodwill');
              if (success) {
                this.backend.addStreetCred(15);
                this.showDialogueModal({
                  speakerName: 'Inspector Danjuma & Corporal',
                  speakerRole: 'Joint Patrol Checkpoint',
                  speakerAvatar: '🧃',
                  soundType: 'cash',
                  dialogueText: 'Officers burst into hearty smiles: "Hahaha, oga you be real man of the people! You respect the uniform and understand the Lagos heat! Safe journey, road is clear for you!"',
                  rewards: { streetCred: 15 },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Inspector Danjuma',
                  speakerRole: 'Joint Patrol Checkpoint',
                  speakerAvatar: '⚠️',
                  dialogueText: 'Inspector frowns: "You don\'t even have ₦500 for pure water in your pockets! Park by the curb and sort yourself out!"',
                });
              }
            },
          },
          {
            id: 'checkpoint_vip',
            label: 'Flash VIP & Area Commander Connection',
            badge: 'Requires 40+ Cred',
            onSelect: () => {
              if (data.stats.streetCred >= 40) {
                this.backend.addStreetCred(35);
                this.backend.restoreEnergy(20);
                this.player.playEmote('salute', 2.5);
                this.showDialogueModal({
                  speakerName: 'Inspector Danjuma',
                  speakerRole: 'Joint Patrol Checkpoint',
                  speakerAvatar: '🎖️',
                  soundType: 'win',
                  dialogueText: 'Inspector instantly snaps to attention! "Ah! Big Boss! We didn\'t recognize your convoy! Sgt. Danladi spoke highly of your goodwill at Area Command! Highway is yours, sir!"',
                  rewards: { streetCred: 35, energy: 20 },
                });
              } else {
                this.backend.addStreetCred(-5);
                this.showDialogueModal({
                  speakerName: 'Inspector Danjuma',
                  speakerRole: 'Joint Patrol Checkpoint',
                  speakerAvatar: '😠',
                  soundType: 'general',
                  dialogueText: 'Inspector scowls: "Who be your VIP?! Which connection?! Stop dropping names that don\'t know you! Show your papers or pay citation!"',
                });
              }
            },
          },
        ],
      });
      return;
    } else if (id === 'police_front_desk') {
      this.hideInteractionCard();
      this.showDialogueModal({
        speakerName: 'Sgt. Danladi',
        speakerRole: 'Lagos State Area Command Desk Sergeant',
        speakerAvatar: '👮',
        soundType: 'general',
        dialogueText: 'Welcome to Lagos State Area Command Headquarters. We operate 24/7 for citizen safety and order. State your official business citizen!',
        choices: [
          {
            id: 'pfd_incident_report',
            label: 'File Official Citizen Incident Report',
            badge: '₦500 Admin Fee',
            onSelect: () => {
              const success = this.backend.spendCash(500, 'Citizen Incident Report Documentation');
              if (success) {
                this.backend.addStreetCred(25);
                this.backend.restoreEnergy(10);
                this.showDialogueModal({
                  speakerName: 'Sgt. Danladi',
                  speakerRole: 'Desk Sergeant',
                  speakerAvatar: '📝',
                  soundType: 'general',
                  dialogueText: 'Report documented in the Area Command master logbook! Reference Number: #NIG-8492. Official stamp applied. +25 Street Cred!',
                  rewards: { streetCred: 25, energy: 10 },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Sgt. Danladi',
                  speakerRole: 'Desk Sergeant',
                  speakerAvatar: '⚠️',
                  dialogueText: '₦500 administrative documentation fee required for formal incident logging.',
                });
              }
            },
          },
          {
            id: 'pfd_clearance_cert',
            label: 'Obtain Official Police Character Clearance (CID)',
            badge: '₦3,500 Fee',
            onSelect: () => {
              const success = this.backend.spendCash(3500, 'CID Character Clearance Certificate');
              if (success) {
                this.backend.addItem({
                  id: `police_clearance_${Date.now()}`,
                  name: 'Nigeria Police Good Conduct Certificate',
                  category: 'document',
                  icon: '📜',
                  description: 'Official stamped certificate of good conduct from the Inspector General CID registry.',
                  price: 3500,
                  usable: false,
                });
                this.backend.addStreetCred(40);
                this.showDialogueModal({
                  speakerName: 'Sgt. Danladi',
                  speakerRole: 'Desk Sergeant',
                  speakerAvatar: '📜',
                  soundType: 'win',
                  dialogueText: 'Fingerprint biometrics verified against national criminal registry. Zero priors! Here is your official stamped Certificate of Character Clearance! Added to inventory!',
                  rewards: { streetCred: 40, item: { name: 'Police Character Clearance Certificate', icon: '📜', category: 'document' } },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Sgt. Danladi',
                  speakerRole: 'Desk Sergeant',
                  speakerAvatar: '⚠️',
                  dialogueText: '₦3,500 required for official CID biometric fingerprinting and document sealing.',
                });
              }
            },
          },
          {
            id: 'pfd_security_gist',
            label: 'Inquire About Neighborhood Safety & Checkpoints',
            badge: 'Free Guidance',
            onSelect: () => {
              this.backend.addStreetCred(10);
              this.showDialogueModal({
                speakerName: 'Sgt. Danladi',
                speakerRole: 'Desk Sergeant',
                speakerAvatar: '💡',
                soundType: 'academic',
                dialogueText: '"Tip for navigating Lagos: Always keep valid vehicle registration, driver\'s license, or student dockets. At night checkpoints, turn on your cabin interior light so officers can see inside. Law and order protects everyone!"',
                rewards: { streetCred: 10, knowledge: 20 },
              });
            },
          },
        ],
      });
      return;
    } else if (id === 'police_holding_cell') {
      this.hideInteractionCard();
      this.showDialogueModal({
        speakerName: 'Detention Cell Block & Detainee Kazeem',
        speakerRole: 'Area Command Holding Cell Block',
        speakerAvatar: '⚖️',
        soundType: 'general',
        dialogueText: 'Inside the holding cell, Kazeem clutches the steel bars: "Bros abeg help me! They arrested me for driving one-way near Ikeja bus stop! My mother is waiting for me at home!"',
        choices: [
          {
            id: 'cell_bail_kazeem',
            label: 'Post Citizen Bail Bond for Kazeem',
            badge: '₦5,000 Cash',
            onSelect: () => {
              const success = this.backend.spendCash(5000, 'Citizen Bail Bond for Kazeem');
              if (success) {
                this.backend.addStreetCred(50);
                this.backend.restoreEnergy(20);
                this.backend.addItem({
                  id: `lucky_charm_${Date.now()}`,
                  name: 'Kazeem\'s Hustler Lucky Charm',
                  category: 'luxury',
                  icon: '🧿',
                  description: 'A beaded Yoruba good-luck wristband given by grateful citizen Kazeem.',
                  price: 2500,
                  usable: true,
                  energyRestore: 25,
                });
                this.showDialogueModal({
                  speakerName: 'Kazeem & Sgt. Danladi',
                  speakerRole: 'Holding Cell Release',
                  speakerAvatar: '🎉',
                  soundType: 'win',
                  dialogueText: 'Cell door clangs open! Kazeem kneels in tears of joy: "Boss! May your pocket never run dry! Take this lucky wristband my grandmother blessed for me! I swear I will never enter one-way again!"',
                  rewards: { streetCred: 50, energy: 20, item: { name: 'Kazeem\'s Hustler Lucky Charm', icon: '🧿', category: 'luxury' } },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Holding Cell Sergeant',
                  speakerRole: 'Detention Block',
                  speakerAvatar: '⚠️',
                  dialogueText: 'Need ₦5,000 cash to satisfy official bail bond recognizance!',
                });
              }
            },
          },
          {
            id: 'cell_give_food',
            label: 'Buy Gala & Cold Water for Detainees',
            badge: '₦500 Cash',
            onSelect: () => {
              const success = this.backend.spendCash(500, 'Detainee Refreshment');
              if (success) {
                this.backend.addStreetCred(20);
                this.backend.restoreEnergy(10);
                this.showDialogueModal({
                  speakerName: 'Detainee Kazeem',
                  speakerRole: 'Holding Cell',
                  speakerAvatar: '🙏',
                  soundType: 'cheer',
                  dialogueText: 'Kazeem gratefully sips the chilled water and shares the snack: "Thank you my brother! Human kindness is rare in this city. God go surely promote your hustle!"',
                  rewards: { streetCred: 20, energy: 10 },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Holding Cell Guard',
                  speakerRole: 'Detention Block',
                  speakerAvatar: '⚠️',
                  dialogueText: 'Need ₦500 cash for canteen refreshment.',
                });
              }
            },
          },
          {
            id: 'cell_leave',
            label: 'Step Back from Holding Cell',
            badge: 'Leave',
            onSelect: () => {
              this.hideInteractionCard();
            },
          },
        ],
      });
      return;
    } else if (id === 'interior_npc_npc_sgt_danladi') {
      this.hideInteractionCard();
      this.showDialogueModal({
        speakerName: 'Sgt. Danladi',
        speakerRole: 'Lagos State Area Command Desk Sergeant',
        speakerAvatar: '👮‍♂️',
        soundType: 'general',
        dialogueText: '"Lagos is peaceful when everyone respects the law. We coordinate with LASTMA, highway patrols, and local community vigilantes across all districts."',
        choices: [
          {
            id: 'danladi_tips',
            label: 'Ask for advice on road safety & checkpoint etiquette',
            badge: '+15 Knowledge',
            onSelect: () => {
              this.backend.addStreetCred(15);
              this.showDialogueModal({
                speakerName: 'Sgt. Danladi',
                speakerRole: 'Desk Sergeant',
                speakerAvatar: '💡',
                soundType: 'academic',
                dialogueText: '"Never argue aggressively with an armed officer on highway patrol. Keep your composure, show your valid particulars, and speak with dignity. Professionalism opens doors across Nigeria."',
                rewards: { knowledge: 15, streetCred: 10 },
              });
            },
          },
          {
            id: 'danladi_welfare',
            label: 'Contribute to Station Welfare & Generator Fuel Fund',
            badge: '₦2,000 Cash',
            onSelect: () => {
              const success = this.backend.spendCash(2000, 'Station Welfare Contribution');
              if (success) {
                this.backend.addStreetCred(35);
                this.showDialogueModal({
                  speakerName: 'Sgt. Danladi',
                  speakerRole: 'Desk Sergeant',
                  speakerAvatar: '🤝',
                  soundType: 'win',
                  dialogueText: '"May God bless your pocket immensely! With fuel in our patrol generator, we can process night emergency cases without blackout. You are a true partner in security!"',
                  rewards: { streetCred: 35 },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Sgt. Danladi',
                  speakerRole: 'Desk Sergeant',
                  speakerAvatar: '⚠️',
                  dialogueText: 'Need ₦2,000 cash for station generator fuel contribution.',
                });
              }
            },
          },
        ],
      });
      return;
    } else if (id === 'interior_npc_npc_constable_emeka') {
      this.hideInteractionCard();
      this.showDialogueModal({
        speakerName: 'Constable Emeka',
        speakerRole: 'Investigating Officer • Lagos Area Command',
        speakerAvatar: '👮',
        soundType: 'general',
        dialogueText: '"Good day citizen! I handle fingerprint records and lost item investigations. Anything we can assist you with?"',
        choices: [
          {
            id: 'emeka_lost_items',
            label: 'Inquire About Lost & Found Property Registry',
            badge: '+10 Knowledge',
            onSelect: () => {
              this.backend.addStreetCred(10);
              this.showDialogueModal({
                speakerName: 'Constable Emeka',
                speakerRole: 'Investigating Officer',
                speakerAvatar: '📂',
                soundType: 'general',
                dialogueText: '"If you ever lose a wallet or phone in a yellow Danfo or Keke, come report here immediately with the bus route and registration. We often recover property through the transport unions!"',
                rewards: { streetCred: 10, knowledge: 15 },
              });
            },
          },
          {
            id: 'emeka_drink',
            label: 'Gift Chilled Malta Drink to Officer on Duty',
            badge: '₦400 Cash',
            onSelect: () => {
              const success = this.backend.spendCash(400, 'Malta for Constable Emeka');
              if (success) {
                this.backend.addStreetCred(20);
                this.showDialogueModal({
                  speakerName: 'Constable Emeka',
                  speakerRole: 'Investigating Officer',
                  speakerAvatar: '🥤',
                  soundType: 'cheer',
                  dialogueText: '"Ah, chilled Malta in this hot afternoon! Thank you my brother! You have a good heart. Whenever you pass by this station, you are always welcome!"',
                  rewards: { streetCred: 20 },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Constable Emeka',
                  speakerRole: 'Investigating Officer',
                  speakerAvatar: '⚠️',
                  dialogueText: 'Need ₦400 cash for chilled drink.',
                });
              }
            },
          },
        ],
      });
      return;
    } else if (id === 'interior_npc_npc_suspect_kazeem') {
      this.hideInteractionCard();
      this.showDialogueModal({
        speakerName: 'Detainee Kazeem',
        speakerRole: 'Detained Citizen • Cell Block 1',
        speakerAvatar: '😢',
        soundType: 'general',
        dialogueText: '"Bros, please talk to Sgt. Danladi at the desk or use the bail terminal to get me out! ₦5,000 bail bond will set me free. My family is anxious at home!"',
        choices: [
          {
            id: 'kazeem_bail_direct',
            label: 'Pay ₦5,000 Bail Bond for Kazeem immediately',
            badge: '₦5,000 Cash',
            onSelect: () => {
              const success = this.backend.spendCash(5000, 'Citizen Bail Bond for Kazeem');
              if (success) {
                this.backend.addStreetCred(50);
                this.backend.restoreEnergy(20);
                this.backend.addItem({
                  id: `lucky_charm_${Date.now()}`,
                  name: 'Kazeem\'s Hustler Lucky Charm',
                  category: 'luxury',
                  icon: '🧿',
                  description: 'A beaded Yoruba good-luck wristband given by grateful citizen Kazeem.',
                  price: 2500,
                  usable: true,
                  energyRestore: 25,
                });
                this.showDialogueModal({
                  speakerName: 'Kazeem & Sgt. Danladi',
                  speakerRole: 'Holding Cell Release',
                  speakerAvatar: '🎉',
                  soundType: 'win',
                  dialogueText: 'Cell door clangs open! Kazeem kneels in tears of joy: "Boss! May your pocket never run dry! Take this lucky wristband! I swear I will never enter one-way again!"',
                  rewards: { streetCred: 50, energy: 20, item: { name: 'Kazeem\'s Hustler Lucky Charm', icon: '🧿', category: 'luxury' } },
                });
              } else {
                this.showDialogueModal({
                  speakerName: 'Holding Cell Sergeant',
                  speakerRole: 'Detention Block',
                  speakerAvatar: '⚠️',
                  dialogueText: 'Need ₦5,000 cash to satisfy official bail bond recognizance!',
                });
              }
            },
          },
          {
            id: 'kazeem_comfort',
            label: 'Console Kazeem and promise to return soon',
            badge: 'Console',
            onSelect: () => {
              this.backend.addStreetCred(5);
              this.showDialogueModal({
                speakerName: 'Kazeem',
                speakerRole: 'Holding Cell',
                speakerAvatar: '🙏',
                soundType: 'general',
                dialogueText: '"Thank you boss! Please don\'t forget me here! May God bless you!"',
                rewards: { streetCred: 5 },
              });
            },
          },
        ],
      });
      return;
    } else if (id === 'flat-workstation') {
      const gig = this.backend.performGig(12000, 25, 'Remote Tech Sprint');
      if (gig.success) {
        this.backend.addStreetCred(20);
        this.showDialogueModal({
          speakerName: 'Senior Engineering Manager',
          speakerRole: 'Remote Tech Sprint',
          speakerAvatar: '💻',
          soundType: 'cash',
          dialogueText: 'Pull request approved and merged! ₦12,000 remote salary credited to your wallet! Energy -25%, Street Cred +20!',
          rewards: { cash: 12000, streetCred: 20 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Senior Engineering Manager',
          speakerRole: 'Remote Tech Sprint',
          speakerAvatar: '⚠️',
          dialogueText: gig.message,
        });
      }
      return;
    } else if (id.startsWith('interior_npc_')) {
      this.showDialogueModal({
        speakerName: this.currentActiveObject.name,
        speakerRole: this.currentActiveObject.category || 'Resident / Staff',
        speakerAvatar: '💬',
        soundType: 'general',
        dialogueText: this.currentActiveObject.description,
      });
      return;
    } else if (id === 'bet-shop') {
      const success = this.backend.spendCash(1000, 'NaijaBet 5-Game Ticket');
      if (success) {
        // 6% of ₦15,000 on a ₦1,000 ticket: the house keeps an edge, so betting is not an income
        const won = Math.random() < 0.06;
        if (won) {
          const winAmount = 15000;
          this.backend.addCash(winAmount, 'NaijaBet Accumulator Win', 'WINNINGS');
          this.backend.addStreetCred(10);
          this.showDialogueModal({
            speakerName: 'NaijaBet Cashier',
            speakerRole: 'Ticket Payout Terminal',
            speakerAvatar: '🎉',
            soundType: 'win',
            dialogueText: `BOOM! Your 5-game accumulator came through! Won ₦${winAmount.toLocaleString()} cash! Oya celebration!`,
            rewards: { cash: winAmount, streetCred: 10 },
          });
        } else {
          this.backend.addItem({
            id: `ticket_${Date.now()}`,
            name: 'Weekend Match Slip',
            category: 'document',
            icon: '🎫',
            description: 'Arsenal vs Chelsea accumulator ticket. Fingers crossed!',
            price: 1000,
            usable: false,
          });
          this.showDialogueModal({
            speakerName: 'Segun (Odds Guru)',
            speakerRole: 'NaijaBet Regular',
            speakerAvatar: '⚽',
            soundType: 'general',
            dialogueText: 'Ticket placed! Added to your bag. May your odds favor you this weekend!',
            rewards: { item: { name: 'Weekend Match Slip', icon: '🎫' } },
          });
        }
      } else {
        this.showDialogueModal({
          speakerName: 'NaijaBet Counter',
          speakerRole: 'Booking Cashier',
          speakerAvatar: '⚠️',
          dialogueText: 'Not enough cash! ₦1,000 needed to book your accumulator slip.',
        });
      }
    } else if (id.startsWith('veh-')) {
      this.hideInteractionCard();
      this.onEnterVehicle?.(id);
      return;
    } else if (id === 'danfo-stop') {
      this.hideInteractionCard();
      this.travelModal.open();
      return;
    } else if (id === 'npc-conductor') {
      const fare = 300;
      const success = this.backend.spendCash(fare, 'Danfo Bus Fare', 'TRAVEL_COST');
      if (success) {
        emitGameEvent('drive');
        this.backend.addStreetCred(5);
        if (this.player) {
          this.player.mesh.position.set(-8.5, 0, -55);
        }
        this.showDialogueModal({
          speakerName: 'Danfo Conductor',
          speakerRole: 'CMS / Obalende Route',
          speakerAvatar: '🚌',
          soundType: 'cheer',
          dialogueText: `Paid ₦${fare} fare! Conductor shouts: "Tejuosho Junction drop off! Oya alight, next passenger enter!" You commuted swiftly across Broad Street.`,
          rewards: { streetCred: 5 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Danfo Conductor',
          speakerRole: 'Transit Conductor',
          speakerAvatar: '⚠️',
          dialogueText: '"Hold your ₦300 exact change first before entering my motor!"',
        });
      }
    } else if (id === 'villa-compound') {
      const villa = this.backend.getData().properties.find((p) => p.buildingId === 'villa-compound' || p.id === 'prop_villa_estate');
      const isTenant = villa ? (villa.status === 'owned' || villa.status === 'rented' || villa.status === 'purchased') : false;
      if (isTenant && this.world) {
        const isOpen = this.world.buildings.toggleCompoundGate();
        this.showDialogueModal({
          speakerName: 'Estate Security Gate',
          speakerRole: 'Compound Access',
          speakerAvatar: '🚪',
          soundType: 'general',
          dialogueText: isOpen ? 'Compound gate opened! You can walk into the estate courtyard.' : 'Compound gate closed and secured.',
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Estate Gateman',
          speakerRole: 'Palm View Compound Security',
          speakerAvatar: '🔔',
          soundType: 'general',
          dialogueText: 'Good day Sah! If you want to lease or buy this duplex, check the Estate Office [E]!',
        });
      }
    } else if (id === 'vi-tower') {
      this.showDialogueModal({
        speakerName: 'Corporate Concierge',
        speakerRole: 'Eko Atlantic Financial Tower',
        speakerAvatar: '🏢',
        soundType: 'general',
        dialogueText: 'Welcome to the Financial District! Top-tier investments, private equity desks, and crypto fintechs are based here.',
      });
    } else if (id === 'vi-lounge' || id === 'quilox-club') {
      const success = this.backend.spendCash(25000, 'Quilox Dom Pérignon & VIP Sparklers Table');
      if (success) {
        this.backend.restoreEnergy(100);
        this.backend.addStreetCred(35);
        this.backend.addItem({
          id: `dom_perignon_${Date.now()}`,
          name: 'Dom Pérignon Vintage Champagne',
          category: 'food',
          icon: '🍾',
          description: 'Vintage French champagne served with blazing sparklers on Victoria Island.',
          price: 65000,
          usable: true,
          energyRestore: 50,
        });
        this.player?.playEmote('groove', 5.0);
        this.showDialogueModal({
          speakerName: 'Quilox VIP Host',
          speakerRole: 'Victoria Island Nightclub',
          speakerAvatar: '🍾',
          soundType: 'win',
          dialogueText: 'QUILOX VIP TABLE IS LIT! Bottle sparklers flaming, DJ spinning Wizkid & Burna Boy, Dom Pérignon poured! You are officially balling!',
          rewards: { energy: 100, streetCred: 35, item: { name: 'Dom Pérignon Vintage Champagne', icon: '🍾' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Quilox VIP Bouncer',
          speakerRole: 'VIP Table Reservations',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦25,000 cash for Quilox VIP Table & champagne! Go to the ATM to withdraw funds.',
        });
      }
    } else if (id === 'amala-shitta') {
      const success = this.backend.spendCash(2000, 'Hot Amala Dudu + Abula & Goat Meat', 'FOOD_PURCHASE');
      if (success) {
        this.backend.consumeFood('Hot Amala Dudu & Goat Meat', 85, 60, 30);
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `amala_takeaway_${Date.now()}`,
          name: 'Amala Shitta Takeaway Wrap',
          category: 'food',
          icon: '🍲',
          description: 'Steaming hot yam flour amala with ewedu, gbegiri, and spicy goat meat.',
          price: 2000,
          usable: true,
          energyRestore: 60,
        });
        this.showDialogueModal({
          speakerName: 'Iya Amala Shitta',
          speakerRole: 'Traditional Buka Matron',
          speakerAvatar: '🍲',
          soundType: 'cheer',
          dialogueText: 'OYA CHOP AMALA! Steaming hot Amala Dudu served with yellow Gbegiri, green Ewedu & tender Goat Meat! 100% Energy restored!',
          rewards: { energy: 100, streetCred: 15, item: { name: 'Amala Shitta Takeaway Wrap', icon: '🍲' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Amala Shitta Cashier',
          speakerRole: 'Buka Counter',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦2,000 cash for hot Amala & Goat Meat platter!',
        });
      }
    } else if (id === 'nepa-generator') {
      const success = this.backend.spendCash(1200, '5L Mobil Petrol for Tiger Generator');
      if (success) {
        this.backend.restoreEnergy(20);
        this.backend.addStreetCred(20);
        this.showDialogueModal({
          speakerName: 'Tiger Gen Station',
          speakerRole: 'Market Power Hub',
          speakerAvatar: '⚡',
          soundType: 'win',
          dialogueText: '*KPA-KPA-KPA-VROOOOM!* Tiger generator cranked up! Blue smoke puffs and the entire market roars: "UP NEPA! OYA LIGHT DON ENTER!"',
          rewards: { energy: 20, streetCred: 20 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Fuel Point Attendant',
          speakerRole: 'Generator Fuel Hub',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,200 cash for 5 litres of generator petrol!',
        });
      }
    } else if (id === 'cv-plaza') {
      const success = this.backend.spendCash(5000, 'Otigba 20,000mAh Power Bank');
      if (success) {
        this.backend.addStreetCred(10);
        this.backend.addItem({
          id: `powerbank_${Date.now()}`,
          name: 'Otigba 20,000mAh Fast Power Bank',
          category: 'tool',
          icon: '🔋',
          description: 'Heavy-duty power bank with fast-charging cables for uninterrupted Lagos hustle.',
          price: 5000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Otigba Gadget Vendor',
          speakerRole: 'Computer Village Plaza',
          speakerAvatar: '🔋',
          soundType: 'tech',
          dialogueText: '20,000mAh Power Bank tested and packed! Added to your bag. Never get stranded on 1% battery again!',
          rewards: { streetCred: 10, item: { name: 'Otigba 20,000mAh Fast Power Bank', icon: '🔋', category: 'tool' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Computer Village Vendor',
          speakerRole: 'Otigba Plaza',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦5,000 cash for the 20,000mAh fast-charge power bank!',
        });
      }
    } else if (id === 'lekki-bridge') {
      const success = this.backend.spendCash(500, 'Lekki Toll Transit');
      if (success) {
        this.backend.addStreetCred(5);
        this.showDialogueModal({
          speakerName: 'LCC Toll Attendant',
          speakerRole: 'Lekki-Ikoyi Link Bridge',
          speakerAvatar: '🌉',
          soundType: 'cash',
          dialogueText: 'Toll barrier lifted! Green light: "Welcome to Lekki Phase 1 & Admiralty Way!" Smooth cruising!',
          rewards: { streetCred: 5 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'LCC Toll Booth',
          speakerRole: 'Toll Gate',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦500 cash for bridge toll fee!',
        });
      }
    } else if (id === 'nike-art-gallery') {
      const success = this.backend.spendCash(12000, 'Handmade Nike Art Adire Batik');
      if (success) {
        this.backend.addStreetCred(35);
        this.backend.addItem({
          id: `adire_art_${Date.now()}`,
          name: 'Nike Art Adire Batik Masterpiece',
          category: 'document',
          icon: '🎨',
          description: 'Indigo-dyed handcrafted textile artwork from Nike Art Gallery.',
          price: 25000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Chief Nike Okundaye',
          speakerRole: 'Founder • Nike Art Gallery',
          speakerAvatar: '🎨',
          soundType: 'win',
          dialogueText: 'Exquisite masterpiece! Authentic handcrafted Osogbo indigo Adire Batik textile artwork added to your bag! Street Cred +35!',
          rewards: { streetCred: 35, item: { name: 'Nike Art Adire Batik Masterpiece', icon: '🎨', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Gallery Curator',
          speakerRole: 'Art Sales Desk',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦12,000 cash for the master handcrafted batik artwork!',
        });
      }
    } else if (id === 'yaba-cchub') {
      const gig = this.backend.performGig(15000, 30, 'CcHub Hackathon Sprint');
      if (gig.success) {
        this.backend.addStreetCred(25);
        this.backend.addItem({
          id: `github_token_${Date.now()}`,
          name: 'CcHub High-Yield Smart Contract',
          category: 'document',
          icon: '💻',
          description: 'Deployed web3 micro-service for a Silicon Valley fintech client.',
          price: 25000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'CcHub Incubator Lead',
          speakerRole: '6th Floor Innovation Hub • Yaba',
          speakerAvatar: '💻',
          soundType: 'tech',
          dialogueText: 'CCHUB HACKATHON DELIVERED! You pulled an all-night code sprint at Herbert Macaulay Way. Earned ₦15,000 cash, +25 Street Cred, and deployed your code! Energy -30%',
          rewards: { cash: 15000, streetCred: 25, item: { name: 'CcHub High-Yield Smart Contract', icon: '💻', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'CcHub Incubator Lead',
          speakerRole: '6th Floor Innovation Hub • Yaba',
          speakerAvatar: '⚠️',
          dialogueText: gig.message,
        });
      }
    } else if (id === 'surulere-stadium') {
      const success = this.backend.spendCash(1000, 'Teslim Balogun Stadium Pass');
      if (success) {
        this.backend.restoreEnergy(50);
        this.backend.addStreetCred(15);
        this.player?.playEmote('groove', 4.0);
        this.showDialogueModal({
          speakerName: 'Coach Bassey',
          speakerRole: 'Teslim Balogun Athletic Track',
          speakerAvatar: '🏃',
          soundType: 'cheer',
          dialogueText: 'SURULERE ATHLETIC WORKOUT! Ran intensive laps around the Teslim Balogun tartan track! Energy boosted +50, Street Cred +15!',
          rewards: { energy: 50, streetCred: 15 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Stadium Turnstile',
          speakerRole: 'Teslim Balogun Gate',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,000 cash for stadium athletic track pass!',
        });
      }
    } else if (id === 'mma-airport') {
      this.hideInteractionCard();
      this.interstateModal.toggle(this.world?.cityManager.currentCityId);
      return;
    } else if (id === 'ajah-estate') {
      const gig = this.backend.performGig(8500, 25, 'Ajah Site Labour');
      if (gig.success) {
        this.backend.addStreetCred(10);
        this.showDialogueModal({
          speakerName: 'Site Foreman Sunday',
          speakerRole: 'Ajah Construction Project',
          speakerAvatar: '👷',
          soundType: 'cash',
          dialogueText: 'AJAH SITE LABOUR COMPLETED! Mixed mortar, hoisted hollow blocks, and finished framing! Earned ₦8,500 cash on the spot! Energy -25%',
          rewards: { cash: 8500, streetCred: 10 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Site Foreman Sunday',
          speakerRole: 'Ajah Construction Project',
          speakerAvatar: '⚠️',
          dialogueText: gig.message,
        });
      }
    } else if (id === 'balogun-market') {
      const success = this.backend.spendCash(6000, 'Wholesale Ankara Bundle');
      if (success) {
        this.backend.addStreetCred(20);
        this.backend.addItem({
          id: `ankara_bundle_${Date.now()}`,
          name: 'Balogun Luxury Ankara Fabric Bale',
          category: 'document',
          icon: '👗',
          description: 'High-grade 6-yard Dutch Wax print direct from Balogun wholesale merchants.',
          price: 14000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Alhaja Kudirat',
          speakerRole: 'Balogun Wholesale Merchant',
          speakerAvatar: '👗',
          soundType: 'win',
          dialogueText: 'BALOGUN MARKET WHOLESALE! Bought 6 yards of vibrant premium Ankara wax fabric for ₦6,000! Added to your inventory!',
          rewards: { streetCred: 20, item: { name: 'Balogun Luxury Ankara Fabric Bale', icon: '👗', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Balogun Market Stall',
          speakerRole: 'Wholesale Fabric Merchant',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦6,000 cash for wholesale fabric bundle!',
        });
      }
    } else if (id === 'npc-punter') {
      this.showDialogueModal({
        speakerName: 'Segun (Odds Guru)',
        speakerRole: 'NaijaBet Regular',
        speakerAvatar: '🗣️',
        soundType: 'general',
        dialogueText: 'Guy, always play over 1.5 goals o! Don\'t play straight win, this league is crazy!',
      });
    } else if (id === 'aso-rock-lookout') {
      const success = this.backend.spendCash(1500, 'Aso Rock Souvenir Plaque');
      if (success) {
        this.backend.restoreEnergy(30);
        this.backend.addStreetCred(20);
        this.backend.addItem({
          id: `aso_rock_plaque_${Date.now()}`,
          name: 'Aso Rock Presidential Plaque',
          category: 'document',
          icon: '⛰️',
          description: 'Official commemorative stone souvenir plaque of the Aso Rock Monolith & Three Arms Zone.',
          price: 3500,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Protocol Officer',
          speakerRole: 'Three Arms Zone Lookout',
          speakerAvatar: '⛰️',
          soundType: 'win',
          dialogueText: 'Stood at the pinnacle of power! Aso Rock Presidential Plaque purchased and added to bag. Capital Street Cred +20!',
          rewards: { energy: 30, streetCred: 20, item: { name: 'Aso Rock Presidential Plaque', icon: '⛰️', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Souvenir Stand',
          speakerRole: 'Aso Rock Lookout',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,500 cash for the commemorative souvenir plaque!',
        });
      }
    } else if (id === 'abuja-mosque') {
      const success = this.backend.spendCash(500, 'Mosque Visit & Chilled Zobo');
      if (success) {
        this.backend.restoreEnergy(60);
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `abuja_zobo_${Date.now()}`,
          name: 'Abuja Spiced Zobo Drink',
          category: 'food',
          icon: '🧃',
          description: 'Chilled hibiscus tea with ginger, clove, and pineapple.',
          price: 500,
          usable: true,
          energyRestore: 35,
        });
        this.showDialogueModal({
          speakerName: 'Ustaz Ahmed',
          speakerRole: 'National Mosque Hospitality',
          speakerAvatar: '🕌',
          soundType: 'general',
          dialogueText: 'Visited the magnificent National Mosque! Chilled spiced Zobo drink acquired, energy refreshed, Street Cred +15!',
          rewards: { energy: 60, streetCred: 15, item: { name: 'Abuja Spiced Zobo Drink', icon: '🧃', category: 'food' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Visitor Welcome Stall',
          speakerRole: 'National Mosque',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦500 for the visitor pack & zobo!',
        });
      }
    } else if (id === 'abuja-christian-centre') {
      const success = this.backend.spendCash(500, 'Ecumenical Fellowship Offering');
      if (success) {
        this.backend.restoreEnergy(60);
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `unity_hymnal_${Date.now()}`,
          name: 'National Unity Hymnal & Medallion',
          category: 'document',
          icon: '📖',
          description: 'Commemorative unity hymnal from the National Christian Centre.',
          price: 1000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Sanctuary Host',
          speakerRole: 'National Christian Centre',
          speakerAvatar: '⛪',
          soundType: 'general',
          dialogueText: 'Admired the neo-gothic spire and pipe organ at National Christian Centre! Blessed with peaceful spirit and Street Cred +15!',
          rewards: { energy: 60, streetCred: 15, item: { name: 'National Unity Hymnal & Medallion', icon: '📖', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Sanctuary Desk',
          speakerRole: 'National Christian Centre',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦500 cash offering!',
        });
      }
    } else if (id === 'abuja-secretariat') {
      const success = this.backend.spendCash(5000, 'Federal Government Tender Form');
      if (success) {
        this.backend.addStreetCred(50);
        this.backend.addItem({
          id: `fgn_cert_${Date.now()}`,
          name: 'Official Federal Contractor Certificate',
          category: 'document',
          icon: '📜',
          description: 'Registered Bureau of Public Procurement (BPP) Federal Contractor Certificate #FGN-2026.',
          price: 15000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Federal Tender Director',
          speakerRole: 'Bureau of Public Procurement (BPP)',
          speakerAvatar: '📜',
          soundType: 'win',
          dialogueText: 'Official Federal Contractor registration submitted! Verified BPP Certificate issued to bag. Capital Street Cred +50!',
          rewards: { streetCred: 50, item: { name: 'Official Federal Contractor Certificate', icon: '📜', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Procurement Registry',
          speakerRole: 'Federal Secretariat',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦5,000 cash for the federal procurement registration documentation!',
        });
      }
    } else if (id === 'abuja-cab') {
      const success = this.backend.spendCash(800, 'Federal Green Cab Fare', 'TRAVEL_COST');
      if (success) {
        emitGameEvent('drive', { city: 'abuja' });
        this.backend.addStreetCred(5);
        if (this.player) {
          this.player.mesh.position.z -= 30;
        }
        this.showDialogueModal({
          speakerName: 'Malam Garba',
          speakerRole: 'Federal Green Cab Driver',
          speakerAvatar: '🚕',
          soundType: 'cash',
          dialogueText: 'Green Cab dropped you off smoothly by Shehu Shagari Way & Maitama Junction! "Oga drop here! Well done sir!"',
          rewards: { streetCred: 5 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Green Cab Driver',
          speakerRole: 'Abuja Taxi Rank',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦800 cash for green cab fare!',
        });
      }
    } else if (id === 'abuja-interstate-hub') {
      this.hideInteractionCard();
      this.interstateModal.open('abuja');
      return;
    } else if (id === 'mma-airport') {
      this.hideInteractionCard();
      this.interstateModal.open('lagos');
      return;
    } else if (id === 'flat-tv') {
      this.backend.restoreEnergy(25);
      this.backend.addStreetCred(10);
      this.player?.playEmote('groove', 4.0);
      this.showDialogueModal({
        speakerName: 'SuperSport Naija',
        speakerRole: 'Living Room TV',
        speakerAvatar: '📺',
        soundType: 'cheer',
        dialogueText: 'GOOOOAL! Osimhen scores for Super Eagles! 🦅 The whole flat erupts in wild celebration! Energy +25, Mood: Electric!',
        rewards: { energy: 25, streetCred: 10 },
      });
    } else if (id === 'flat-bed') {
      this.backend.restAtHome();
      this.showDialogueModal({
        speakerName: 'Bedroom Sanctuary',
        speakerRole: 'Rest & Recovery',
        speakerAvatar: '🛏️',
        soundType: 'win',
        dialogueText: 'Sweet dreams! You slept peacefully under the ceiling fan. Energy & Health fully restored to 100%!',
        rewards: { energy: 100 },
      });
    } else if (id === 'flat-drum') {
      this.backend.restoreEnergy(40);
      this.showDialogueModal({
        speakerName: 'Lagos Bathroom Ritual',
        speakerRole: 'Blue Drum & Red Bowl',
        speakerAvatar: '🪣',
        soundType: 'cheer',
        dialogueText: 'SPLASH! Cold water bath from the iconic blue drum with red bowl! You feel super clean, fresh and sharp! Energy +40%!',
        rewards: { energy: 40 },
      });
    } else if (id === 'flat-sofa') {
      this.backend.restoreEnergy(30);
      this.showDialogueModal({
        speakerName: 'Living Room Lounge',
        speakerRole: 'Couch Relaxation',
        speakerAvatar: '🛋️',
        soundType: 'general',
        dialogueText: 'Chilled out on the living room sofa enjoying cold malt drink. Energy +30%!',
        rewards: { energy: 30 },
      });
    } else if (id === 'pharmacy') {
      const success = this.backend.spendCash(1500, 'Yaba Pharmacy First Aid & Coartem');
      if (success) {
        this.backend.restoreEnergy(50);
        this.backend.addItem({
          id: `first_aid_${Date.now()}`,
          name: 'First Aid Kit & Coartem',
          category: 'tool',
          icon: '💊',
          description: 'Emergency medical health kit with anti-malaria tablets and vitamins.',
          price: 2500,
          usable: true,
          energyRestore: 50,
        });
        this.showDialogueModal({
          speakerName: 'Pharm. Toyin',
          speakerRole: 'Yaba Central Pharmacy',
          speakerAvatar: '💊',
          soundType: 'medical',
          dialogueText: 'Yaba Central Pharmacy: Quality medications dispensed! Energy boosted +50% and First Aid Kit added to your bag!',
          rewards: { energy: 50, item: { name: 'First Aid Kit & Coartem', icon: '💊', category: 'tool' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Pharmacy Counter',
          speakerRole: 'Medicine Dispensary',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,500 cash for pharmacy medications!',
        });
      }
    } else if (id === 'slot-gadgets') {
      const success = this.backend.spendCash(8500, 'Slot 20,000mAh Power Bank & Charger');
      if (success) {
        this.backend.addStreetCred(15);
        this.backend.addItem({
          id: `powerbank_slot_${Date.now()}`,
          name: 'Slot 20,000mAh Dual-Port Power Bank',
          category: 'gadget',
          icon: '🔋',
          description: 'High-capacity fast-charging power bank with braided nylon cables.',
          price: 12000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Slot Sales Team',
          speakerRole: 'Slot Systems Ikeja',
          speakerAvatar: '📱',
          soundType: 'tech',
          dialogueText: 'Slot Gadgets: High-capacity power bank & fast charger purchased! Added to bag. Street Cred +15!',
          rewards: { streetCred: 15, item: { name: 'Slot 20,000mAh Dual-Port Power Bank', icon: '🔋', category: 'gadget' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Slot Sales Desk',
          speakerRole: 'Slot Systems',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦8,500 cash for the power bank & charger!',
        });
      }
    } else if (id === 'barber-shop') {
      const success = this.backend.spendCash(2500, 'Executive Fade & Beard Grooming');
      if (success) {
        this.backend.restoreEnergy(40);
        this.backend.addStreetCred(25);
        this.player?.playEmote('groove', 4.0);
        this.showDialogueModal({
          speakerName: 'Master Kazeem',
          speakerRole: 'Fresh Cut Barbershop',
          speakerAvatar: '💈',
          soundType: 'cheer',
          dialogueText: 'Fresh Cut Barbershop: Sharp executive fade with peppermint beard oil! You look clean! Street Cred +25!',
          rewards: { energy: 40, streetCred: 25 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Barbershop Reception',
          speakerRole: 'Fresh Cut Barbershop',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦2,500 cash for the haircut!',
        });
      }
    } else if (id === 'fuel-station') {
      const success = this.backend.spendCash(8500, '10L Petrol Fuel Keg');
      if (success) {
        this.backend.addStreetCred(10);
        this.backend.addItem({
          id: `fuel_keg_${Date.now()}`,
          name: '10L Premium Petrol (Fuel Keg)',
          category: 'tool',
          icon: '⛽',
          description: 'Yellow jerrycan filled with 10 litres of premium fuel for your generator or car.',
          price: 8500,
          usable: true,
          energyRestore: 0,
        });
        this.showDialogueModal({
          speakerName: 'NaijaPetro Pump Attendant',
          speakerRole: 'NaijaPetro Energy Station',
          speakerAvatar: '⛽',
          soundType: 'cash',
          dialogueText: 'NaijaPetro Energy: 10 Litres of petrol fueled! Ready for your car or home generator!',
          rewards: { streetCred: 10, item: { name: '10L Premium Petrol (Fuel Keg)', icon: '⛽', category: 'tool' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Fuel Attendant',
          speakerRole: 'NaijaPetro Filling Station',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦8,500 cash for 10L fuel!',
        });
      }
    } else if (id === 'mechanic') {
      const success = this.backend.spendCash(6000, 'Vehicle Tune Up & Oil Change');
      if (success) {
        this.backend.addStreetCred(20);
        this.backend.addItem({
          id: `engine_oil_${Date.now()}`,
          name: 'Castrol High-Grade Engine Oil',
          category: 'tool',
          icon: '🛢️',
          description: 'High-viscosity synthetic lubricant for vehicle engine overhaul.',
          price: 6000,
          usable: true,
        });
        this.showDialogueModal({
          speakerName: 'Master Tayo',
          speakerRole: "God's Grace Auto Works",
          speakerAvatar: '🔧',
          soundType: 'win',
          dialogueText: "God's Grace Auto Works: Engine serviced, spark plugs cleaned, and fresh engine oil poured! Vehicle running at peak performance!",
          rewards: { streetCred: 20, item: { name: 'Castrol High-Grade Engine Oil', icon: '🛢️', category: 'tool' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Workshop Office',
          speakerRole: "God's Grace Auto Works",
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦6,000 cash for vehicle service!',
        });
      }
    } else if (id === 'construction-site') {
      const wage = 6500;
      const energyDepleted = this.backend.performGig(wage, 25, 'Construction Site Day Shift').success;
      if (energyDepleted) {
        this.backend.addStreetCred(10);
        this.showDialogueModal({
          speakerName: 'Site Supervisor Sunday',
          speakerRole: 'Commercial High-Rise Site',
          speakerAvatar: '👷',
          soundType: 'cash',
          dialogueText: `Tough day shift completed! Carried sandcrete blocks and mixed concrete. +₦${wage.toLocaleString()} cash paid into your pocket! Energy -25%`,
          rewards: { cash: wage, streetCred: 10 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Site Safety Officer',
          speakerRole: 'Construction Site Gate',
          speakerAvatar: '⚠️',
          dialogueText: 'You are too exhausted! (Need at least 25% Energy). Eat at Mama Put or sleep in your apartment first.',
        });
      }
    } else if (id === 'palm-view-flats') {
      this.hideInteractionCard();
      this.economyModal.open('palm-view-flats');
      return;
    } else if (id === 'npc-suya') {
      const success = this.backend.spendCash(1500, 'Hot Spicy Beef Suya', 'FOOD_PURCHASE');
      if (success) {
        emitGameEvent('eat');
        this.backend.restoreEnergy(60);
        this.backend.addItem({
          id: `suya_wrap_${Date.now()}`,
          name: 'Spicy Beef Suya Wrap',
          category: 'food',
          icon: '🥩',
          description: 'Charcoal-grilled Nigerian beef suya coated in fragrant yaji spice and sliced onions.',
          price: 1500,
          usable: true,
          energyRestore: 60,
        });
        this.showDialogueModal({
          speakerName: 'Mallam Bisi',
          speakerRole: 'Suya Grill Master',
          speakerAvatar: '🥩',
          soundType: 'cheer',
          dialogueText: 'Gaskiya! Fresh hot suya wrapped with extra yaji pepper and sliced onions! Oya enjoy!',
          rewards: { energy: 60, item: { name: 'Spicy Beef Suya Wrap', icon: '🥩', category: 'food' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Mallam Bisi',
          speakerRole: 'Suya Spot',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦1,500 cash for hot suya!',
        });
      }
    } else if (id === 'npc-emeka') {
      const success = this.backend.spendCash(3000, 'Phone Calibration & 5G SIM');
      if (success) {
        this.backend.addStreetCred(10);
        this.backend.addItem({
          id: `naijacom_sim_${Date.now()}`,
          name: '5G NaijaCom High-Speed Data SIM',
          category: 'gadget',
          icon: '📶',
          description: 'High-speed broadband SIM card with 10GB pre-loaded data bundle.',
          price: 3000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Emeka Phone Tech',
          speakerRole: 'Broad Street Electronics',
          speakerAvatar: '📱',
          soundType: 'tech',
          dialogueText: 'Phone charging port cleaned, firmware flashed, and 5G NaijaCom data SIM activated!',
          rewards: { streetCred: 10, item: { name: '5G NaijaCom High-Speed Data SIM', icon: '📶', category: 'gadget' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Emeka Phone Tech',
          speakerRole: 'Electronics Booth',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦3,000 cash for phone service & 5G SIM!',
        });
      }
    } else if (id === 'npc-mechanic') {
      const gigWage = 4000;
      const energyDepleted = this.backend.performGig(gigWage, 15, 'Auto Workshop Gig').success;
      if (energyDepleted) {
        this.backend.addStreetCred(10);
        this.showDialogueModal({
          speakerName: 'Master Tayo',
          speakerRole: "God's Grace Auto Works",
          speakerAvatar: '🛠️',
          soundType: 'cash',
          dialogueText: `Good job boy! You helped align the alternator belt and brake pads. Take ₦${gigWage.toLocaleString()} cash for your pocket! Energy -15%`,
          rewards: { cash: gigWage, streetCred: 10 },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Master Tayo',
          speakerRole: 'Mechanic Pit',
          speakerAvatar: '⚠️',
          dialogueText: 'Too exhausted for manual workshop labor! Rest first.',
        });
      }
    } else if (id === 'npc-warden') {
      this.backend.addStreetCred(10);
      this.player?.playEmote('salute', 3.0);
      this.showDialogueModal({
        speakerName: 'Sgt. Bello',
        speakerRole: 'LASTMA Traffic Commander',
        speakerAvatar: '👮',
        soundType: 'general',
        dialogueText: 'Always obey traffic signals and cross at zebra lines! Broad Street traffic flows smoothly when citizens stay sharp! Street Cred +10!',
        rewards: { streetCred: 10 },
      });
    } else if (id === 'npc-chief') {
      this.backend.addStreetCred(25);
      this.player?.playEmote('salute', 3.0);
      this.showDialogueModal({
        speakerName: 'Chief Alabi',
        speakerRole: 'Elders Council • Island Dignitary',
        speakerAvatar: '👑',
        soundType: 'win',
        dialogueText: 'God bless you my child! In Lagos, integrity, perseverance and courage will open doors that ordinary money cannot open. Respect +25!',
        rewards: { streetCred: 25 },
      });
    } else if (id === 'npc-aunty') {
      const success = this.backend.spendCash(18000, 'Original Hollandais Wax Fabric');
      if (success) {
        this.backend.addStreetCred(30);
        this.backend.addItem({
          id: `ankara_hollandais_${Date.now()}`,
          name: 'Original Hollandais Wax Fabric (6 Yards)',
          category: 'document',
          icon: '👗',
          description: 'Prestigious Dutch wax cotton fabric with vibrant gold and indigo peacock motifs.',
          price: 25000,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Mama Nkechi',
          speakerRole: 'Balogun Luxury Fabrics',
          speakerAvatar: '👗',
          soundType: 'win',
          dialogueText: 'Original Vlisco Hollandais Dutch Wax! You have great taste my customer! Street Cred +30!',
          rewards: { streetCred: 30, item: { name: 'Original Hollandais Wax Fabric (6 Yards)', icon: '👗', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Mama Nkechi',
          speakerRole: 'Fabric Shop',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦18,000 cash for authentic Hollandais wax fabric!',
        });
      }
    } else if (id === 'npc-banker') {
      const cost = 50000;
      const paid = this.backend.pay(cost, '90-Day FGN Treasury Bill');
      if (paid) {
        this.backend.addStreetCred(40);
        this.backend.addItem({
          id: `tbill_${Date.now()}`,
          name: '90-Day FGN Treasury Bill Note (18.5% ROI)',
          category: 'document',
          icon: '📈',
          description: 'Official Central Bank sovereign security yielding 18.5% annual risk-free return.',
          price: 59250,
          usable: false,
        });
        this.showDialogueModal({
          speakerName: 'Tunde Bankole',
          speakerRole: 'Investment VP • Eko Commercial Bank',
          speakerAvatar: '📈',
          soundType: 'win',
          dialogueText: 'Treasury bill registered with CSCS clearing depository! You will earn guaranteed 18.5% sovereign yield upon maturity! Street Cred +40!',
          rewards: { streetCred: 40, item: { name: '90-Day FGN Treasury Bill Note (18.5% ROI)', icon: '📈', category: 'document' } },
        });
      } else {
        this.showDialogueModal({
          speakerName: 'Tunde Bankole',
          speakerRole: 'Investment Banking VP',
          speakerAvatar: '⚠️',
          dialogueText: 'Need ₦50,000 in cash or bank balance to purchase Treasury Bills!',
        });
      }
    }

    this.hideInteractionCard();
  }

  public showNotification(msg: string): void {
    let toast = document.getElementById('hud-floating-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hud-floating-toast';
      toast.style.cssText = `
        position: fixed;
        top: 84px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(56, 189, 248, 0.5);
        color: #f8fafc;
        padding: 10px 22px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 189, 248, 0.3);
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    if ((this as any)._toastTimeout) {
      clearTimeout((this as any)._toastTimeout);
    }
    (this as any)._toastTimeout = setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
      }
    }, 2800);
  }
}
