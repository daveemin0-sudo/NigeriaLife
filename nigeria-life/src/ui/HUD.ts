import type { InteractiveObject, World } from '../world/World';
import { Player } from '../player/Player';
import { CharacterCreatorModal } from './CharacterCreator';
import { InventoryModal } from './InventoryModal';
import { ATMModal } from './ATMModal';
import { PhoneModal } from './PhoneModal';
import { EconomyModal } from './EconomyModal';
import { TravelModal } from './TravelModal';
import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';

export class HUD {
  private container: HTMLDivElement;
  private interactionCard: HTMLDivElement;
  private drivingHudEl!: HTMLDivElement;
  private creatorModal!: CharacterCreatorModal;
  private inventoryModal!: InventoryModal;
  private atmModal!: ATMModal;
  public phoneModal!: PhoneModal;
  public economyModal!: EconomyModal;
  public travelModal!: TravelModal;
  private player!: Player;
  private world?: World;
  private backend: BackendService;
  private currentActiveObject: InteractiveObject | null = null;

  public onExitVehicle?: () => void;
  public onHonkVehicle?: () => void;
  public onEnterVehicle?: (vehicleId: string) => void;

  constructor() {
    this.backend = BackendService.getInstance();
    this.inventoryModal = new InventoryModal();
    this.atmModal = new ATMModal();
    this.inventoryModal.onOpenATM = () => this.atmModal.open();
    this.phoneModal = new PhoneModal();
    this.economyModal = new EconomyModal();
    this.travelModal = new TravelModal();

    this.container = document.createElement('div');
    this.container.id = 'hud-overlay';
    this.container.innerHTML = `
      <!-- Top Status Header -->
      <header class="hud-header">
        <div class="hud-location">
          <span class="flag">🇳🇬</span>
          <div class="loc-details">
            <span class="loc-name">Lagos Island</span>
            <span class="loc-sub">Broad Street</span>
          </div>
        </div>

        <div class="hud-actions-center">
          <button class="hud-btn" id="open-inventory-btn" title="Shortcut: Key I">
            <span>🎒</span>
            <span>Bag [I]</span>
          </button>
          <button class="hud-btn wardrobe-btn" id="open-wardrobe-btn" title="Shortcut: Key C">
            <span>👔</span>
            <span>Wardrobe [C]</span>
          </button>
          <button class="hud-btn atm-btn-header" id="open-atm-btn" title="Shortcut: Key B">
            <span>🏧</span>
            <span>ATM [B]</span>
          </button>
          <button class="hud-btn phone-btn-header" id="open-phone-btn" title="Shortcut: Key P">
            <span>📱</span>
            <span>Phone [P]</span>
          </button>
          <button class="hud-btn econ-btn-header" id="open-econ-btn" title="Shortcut: Key E">
            <span>🏢</span>
            <span>Enterprise [E]</span>
          </button>
          <button class="hud-btn travel-btn-header" id="open-travel-btn" title="Shortcut: Key T">
            <span>🚌</span>
            <span>Transit [T]</span>
          </button>
        </div>

        <div class="hud-stats">
          <div class="stat-pill online-pill">
            <span class="stat-icon">🟢</span>
            <span class="stat-val" id="hud-online-count">1 Online</span>
          </div>
          <div class="stat-pill money-pill">
            <span class="stat-icon">💵</span>
            <span class="stat-val" id="hud-money">₦25,000</span>
          </div>
          <div class="stat-pill energy-pill">
            <span class="stat-icon">⚡</span>
            <span class="stat-val" id="hud-energy">100% Energy</span>
          </div>
        </div>
      </header>

      <!-- Bottom Guidance & Quick Emote Bar -->
      <footer class="hud-footer">
        <div class="emote-bar">
          <span class="emote-bar-title">Naija Moves:</span>
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

        <div class="hud-hint">
          <span class="mouse-icon">🖱️</span>
          <span>Click street to walk • Click buildings & NPCs to interact</span>
        </div>
      </footer>

      <!-- Interaction Modal / Card -->
      <div class="interaction-card" id="interaction-card" style="display: none;">
        <button class="card-close" id="card-close">&times;</button>
        <span class="card-tag" id="card-category">Food & Health</span>
        <h2 class="card-title" id="card-title">Mama Put Buka</h2>
        <p class="card-desc" id="card-desc">Hot Jollof rice, plantain, and pepper soup.</p>
        <div class="card-actions">
          <button class="btn-primary" id="card-action-btn">Enter / Order</button>
          <button class="btn-secondary" id="card-biz-btn" style="display: none;">💼 Enterprise & Ownership</button>
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
    `;

    document.body.appendChild(this.container);

    this.interactionCard = document.getElementById('interaction-card') as HTMLDivElement;
    this.drivingHudEl = document.getElementById('driving-hud') as HTMLDivElement;

    const closeBtn = document.getElementById('card-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hideInteractionCard());

    const actionBtn = document.getElementById('card-action-btn') as HTMLButtonElement;
    actionBtn.addEventListener('click', () => this.handleCardAction());

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

    const energyEl = document.getElementById('hud-energy');
    if (energyEl) {
      energyEl.textContent = `${data.stats.energy}% Energy`;
    }
  }

  public init(player: Player, world?: World): void {
    this.player = player;
    this.world = world;
    this.creatorModal = new CharacterCreatorModal(player);

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
        this.economyModal.toggle();
      } else if (e.key.toLowerCase() === 't') {
        this.travelModal.toggle();
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
      }
    });
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

    const data = this.backend.getData();
    const isTenant = data.properties.find((p) => p.buildingId === 'villa-compound')?.status !== 'unowned';

    if (obj.id === 'mama-put') {
      btnEl.textContent = '🍲 Order Jollof Rice & Asun (₦1,500)';
      bizBtn.textContent = '💼 Buka Franchise & Revenue [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'lagos-bank') {
      btnEl.textContent = '🏧 Enter ATM Gallery';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'bet-shop') {
      btnEl.textContent = '⚽ Place Match Ticket (₦1,000)';
      bizBtn.textContent = '💼 POS & Bet9ja Enterprise Hub [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'villa-compound') {
      btnEl.textContent = isTenant ? '🚪 Open / Close Compound Gate' : '🏠 Ring Gate Bell (Visitor)';
      bizBtn.textContent = '🏡 Victoria Estate Property Office [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id.startsWith('veh-')) {
      btnEl.textContent = '🚗 Board & Drive [F]';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'danfo-stop') {
      btnEl.textContent = '🗺️ Lagos Inter-City Danfo Transit [T]';
      bizBtn.textContent = '🚌 Transport Fleet Management [E]';
      bizBtn.style.display = 'inline-block';
    } else if (obj.id === 'npc-hawker') {
      btnEl.textContent = '🥤 Buy Pure Water & Gala (₦200)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-conductor') {
      btnEl.textContent = '🗣️ Board Danfo (₦300)';
      bizBtn.style.display = 'none';
    } else if (obj.id === 'npc-punter') {
      btnEl.textContent = '💬 Gist with Segun';
      bizBtn.style.display = 'none';
    } else {
      btnEl.textContent = 'Enter / Inspect';
      bizBtn.style.display = 'none';
    }

    this.interactionCard.style.display = 'block';
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

  public hideInteractionCard(): void {
    this.interactionCard.style.display = 'none';
    this.currentActiveObject = null;
  }

  private handleCardAction(): void {
    if (!this.currentActiveObject) return;
    const id = this.currentActiveObject.id;

    if (id === 'mama-put') {
      const success = this.backend.spendCash(1500, 'Mama Put Jollof & Asun');
      if (success) {
        this.backend.restoreEnergy(100);
        this.backend.addItem({
          id: 'takeaway_jollof',
          name: 'Takeaway Jollof Rice',
          category: 'food',
          icon: '🍲',
          description: 'Hot party Jollof rice packed in a foil takeaway pack.',
          price: 1500,
          usable: true,
          energyRestore: 50,
        });
        alert('🍲 Oya chop life! Energy fully restored to 100%, and an extra takeaway pack was added to your bag!');
      } else {
        alert('❌ You do not have enough cash in your pocket! Go to the bank ATM to withdraw cash.');
      }
    } else if (id === 'lagos-bank') {
      this.hideInteractionCard();
      this.atmModal.open();
      return;
    } else if (id === 'bet-shop') {
      const success = this.backend.spendCash(1000, 'Bet9ja 5-Game Ticket');
      if (success) {
        // 50% chance of winning quick ticket
        const won = Math.random() < 0.45;
        if (won) {
          const winAmount = 15000;
          this.backend.addCash(winAmount);
          this.backend.addStreetCred(10);
          alert(`🎉 BOOM! Your match ticket came through! Won ₦${winAmount.toLocaleString()} cash! Oya celebration!`);
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
          alert('⚽ Ticket placed! Added to your bag. May your odds favor you!');
        }
      } else {
        alert('❌ Not enough cash! ₦1,000 needed to book ticket.');
      }
    } else if (id === 'npc-hawker') {
      const success = this.backend.spendCash(200, 'Cold Water & Gala');
      if (success) {
        this.backend.restoreEnergy(25);
        this.backend.addItem({
          id: 'water_sachet',
          name: 'Chilled Pure Water Sachet',
          category: 'food',
          icon: '💧',
          description: 'Chilled sachet water to quench Lagos afternoon heat.',
          price: 100,
          usable: true,
          energyRestore: 15,
        });
        alert('🥤 Chilled water and Gala purchased! Added to bag and energy boosted.');
      } else {
        alert('❌ Need ₦200 cash for water & gala!');
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
      const success = this.backend.spendCash(fare, 'Danfo Bus Fare');
      if (success) {
        this.backend.addStreetCred(5);
        alert(`🚌 You entered the Danfo! Fare paid: ₦${fare}. Conductor yelled: "Shift inside make people enter!"`);
      } else {
        alert('❌ "Hold your money first before entering my motor!" - Conductor');
      }
    } else if (id === 'villa-compound') {
      const isTenant = this.backend.getData().properties.find((p) => p.buildingId === 'villa-compound')?.status !== 'unowned';
      if (isTenant && this.world) {
        const isOpen = this.world.buildings.toggleCompoundGate();
        alert(isOpen ? '🚪 Compound gate opened! You can walk into the estate courtyard.' : '🚪 Compound gate closed and secured.');
      } else {
        alert('🔔 Gateman: "Good day Sah! If you want to lease or buy this duplex, check the Estate Office [E]!"');
      }
    } else if (id === 'npc-punter') {
      alert('🗣️ Segun: "Guy, always play over 1.5 goals o! Don\'t play straight win, this league is crazy!"');
    }

    this.hideInteractionCard();
  }

  public updateOnlineCount(count: number): void {
    const el = document.getElementById('hud-online-count');
    if (el) {
      el.textContent = `${count} Online`;
    }
  }
}
