import type { InteractiveObject, World } from '../world/World';
import { Player } from '../player/Player';
import { CharacterCreatorModal } from './CharacterCreator';
import { InventoryModal } from './InventoryModal';
import { ATMModal } from './ATMModal';
import { PhoneModal } from './PhoneModal';
import { EconomyModal } from './EconomyModal';
import { TravelModal } from './TravelModal';
import { InterStateModal } from './InterStateModal';
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
  public interstateModal!: InterStateModal;
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
    this.interstateModal = new InterStateModal();

    this.container = document.createElement('div');
    this.container.id = 'hud-overlay';
    this.container.innerHTML = `
      <!-- Top Status Header -->
      <header class="hud-header">
        <div class="hud-location">
          <span class="flag">🇳🇬</span>
          <div class="loc-details">
            <span class="loc-name" id="hud-loc-name">Lagos Island</span>
            <span class="loc-sub" id="hud-loc-sub">Broad Street</span>
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
          <button class="hud-btn interstate-btn-header" id="open-interstate-btn" title="Inter-State Flights & Coaches (Lagos <-> Abuja FCT) [Shortcut: Key M]">
            <span>✈️</span>
            <span>Inter-State [M]</span>
          </button>
          <button class="hud-btn weather-btn" id="hud-weather-btn" title="Toggle Lagos Weather (Sunny / Rainstorm)">
            <span id="hud-weather-icon">☀️</span>
            <span id="hud-weather-label">Sunny</span>
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
      }
    });
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
    } else if (id === 'vi-tower') {
      alert('🏢 Eko Atlantic Corporate Concierge: "Welcome to the Financial District! Top-tier investments, private equity desks, and crypto fintechs are based here."');
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
        alert('🍾 QUILOX VIP TABLE IS LIT! Bottle sparklers flaming, DJ spinning Wizkid & Burna Boy, Dom Pérignon poured! Energy 100%, Street Cred +35! You are officially balling!');
      } else {
        alert('❌ Need ₦25,000 cash for Quilox VIP Table & champagne! Go to the ATM to withdraw funds.');
      }
    } else if (id === 'amala-shitta') {
      const success = this.backend.spendCash(2000, 'Hot Amala Dudu + Abula & Goat Meat');
      if (success) {
        this.backend.restoreEnergy(100);
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
        alert('🍲 OYA CHOP AMALA! Steaming hot Amala Dudu served with yellow Gbegiri, green Ewedu & tender Goat Meat! 100% Energy restored, Street Cred +15!');
      } else {
        alert('❌ Need ₦2,000 cash for hot Amala & Goat Meat!');
      }
    } else if (id === 'nepa-generator') {
      const success = this.backend.spendCash(1200, '5L Mobil Petrol for Tiger Generator');
      if (success) {
        this.backend.restoreEnergy(20);
        this.backend.addStreetCred(20);
        alert('⚡ *KPA-KPA-KPA-VROOOOM!* Tiger generator cranked up! Blue smoke puffs and the entire market roars: "UP NEPA! OYA LIGHT DON ENTER!" Street Cred +20!');
      } else {
        alert('❌ Need ₦1,200 cash for 5 litres of generator petrol!');
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
        alert('🔌 20,000mAh Power Bank purchased from Otigba market! Added to bag. Never get stranded on 1% battery again!');
      } else {
        alert('❌ Need ₦5,000 cash for the power bank!');
      }
    } else if (id === 'lekki-bridge') {
      const success = this.backend.spendCash(500, 'Lekki Toll Transit');
      if (success) {
        this.backend.addStreetCred(5);
        alert('🌉 Toll paid! Barrier green light lifted: "Welcome to Lekki Phase 1 & Admiralty Way!"');
      } else {
        alert('❌ Need ₦500 cash for bridge toll fee!');
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
        alert('🎨 Exclusive Nigerian Batik artwork purchased! Added to bag. Street Cred skyrocketed by +35!');
      } else {
        alert('❌ Ineffective funds! ₦12,000 needed for the gallery artwork.');
      }
    } else if (id === 'npc-punter') {
      alert('🗣️ Segun: "Guy, always play over 1.5 goals o! Don\'t play straight win, this league is crazy!"');
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
        alert('⛰️ Stood at the pinnacle of power! Aso Rock Presidential Plaque purchased and added to bag. Street Cred +20!');
      } else {
        alert('❌ Need ₦1,500 cash for the commemorative souvenir plaque!');
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
        alert('🕌 Visited the magnificent National Mosque! Chilled spiced Zobo drink acquired, energy refreshed, Street Cred +15!');
      } else {
        alert('❌ Need ₦500 for the visitor pack & zobo!');
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
        alert('⛪ Admired the neo-gothic spire and pipe organ at National Christian Centre! Blessed with peaceful spirit and Street Cred +15!');
      } else {
        alert('❌ Need ₦500 cash offering!');
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
        alert('📜 Official Federal Contractor registration submitted! Verified BPP Certificate issued to bag. Capital Street Cred +50!');
      } else {
        alert('❌ Need ₦5,000 cash for the federal procurement registration documentation!');
      }
    } else if (id === 'abuja-cab') {
      const success = this.backend.spendCash(800, 'Federal Green Cab Fare');
      if (success) {
        this.backend.addStreetCred(5);
        if (this.player) {
          this.player.mesh.position.z -= 30;
        }
        alert('🚕 Green Cab dropped you off smoothly by Shehu Shagari Way & Maitama Junction! "Oga drop here! Well done sir!"');
      } else {
        alert('❌ Need ₦800 cash for green cab fare!');
      }
    } else if (id === 'abuja-interstate-hub') {
      this.hideInteractionCard();
      this.interstateModal.open('abuja');
      return;
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
