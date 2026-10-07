import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';

export interface TravelDestination {
  id: string;
  name: string;
  tagline: string;
  fare: number;
  icon: string;
  travelTimeSeconds: number;
  perkDescription: string;
  souvenirItem: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
  conductorShout: string;
}

export const LAGOS_DESTINATIONS: TravelDestination[] = [
  {
    id: 'dest_lekki',
    name: 'Lekki Phase 1 & Admiralty Way',
    tagline: 'Island Luxury, Palm Beach Clubs & Art Lounges',
    fare: 800,
    icon: '🏝️',
    travelTimeSeconds: 3,
    perkDescription: 'Recharges 40% Energy with ocean breeze & beach club music.',
    souvenirItem: {
      id: 'lekki_shell',
      name: 'Elegushi Beach Souvenir Shell',
      icon: '🐚',
      description: 'Polished cowrie shell from Admiralty Beach waterfront.',
    },
    conductorShout: 'Lekki straight! Admiralty, Jakande, Agungi! Enter with your exact eight hundred naira!',
  },
  {
    id: 'dest_oshodi',
    name: 'Oshodi Interchange & Computer Village',
    tagline: 'Bustling Commercial Mega-Market & Gadgets Hub',
    fare: 500,
    icon: '💻',
    travelTimeSeconds: 3,
    perkDescription: 'Adds +25 Hustle Experience XP from street trade negotiations.',
    souvenirItem: {
      id: 'otg_drive',
      name: 'High-Speed OTG 128GB Flash Drive',
      icon: '💾',
      description: 'Preloaded with Nigerian Afrobeat anthems & DJ mixtapes.',
    },
    conductorShout: 'Oshodi along! Ikeja, Under-bridge! Watch your pocket, hold your phone tight!',
  },
  {
    id: 'dest_vi',
    name: 'Victoria Island & Eko Atlantic City',
    tagline: 'Skyscrapers, Corporate HQ & Coastal City Boulevard',
    fare: 1200,
    icon: '🏙️',
    travelTimeSeconds: 4,
    perkDescription: 'Boosts +20 Street Cred and prestige reputation.',
    souvenirItem: {
      id: 'vi_cufflinks',
      name: 'Marina Gold-Plated Cufflinks',
      icon: '✨',
      description: 'Luxury executive accessories from Ahmadu Bello Way boutique.',
    },
    conductorShout: 'VI Express! Ozumba Mbadiwe, Eko Hotel, Bar Beach! No fifty naira change o!',
  },
  {
    id: 'dest_ikeja',
    name: 'Ikeja Along & Allen Avenue Night Market',
    tagline: 'Mainland Capital City, Spicy Street Suya & Nightlife',
    fare: 700,
    icon: '🥩',
    travelTimeSeconds: 3,
    perkDescription: 'Restores 60% Hunger with piping hot roadside Suya & onions.',
    souvenirItem: {
      id: 'hot_suya_pack',
      name: 'Allen Ave Spicy Beef Suya',
      icon: '🥩',
      description: 'Smoky grilled beef dusted in authentic Yaji pepper & fresh onions.',
    },
    conductorShout: 'Ikeja along! Maryland, Anthony, Allen! Enter make we move one time!',
  },
];

export class TravelModal {
  private container: HTMLDivElement;
  private backend: BackendService;
  private isOpen: boolean = false;
  private isTraveling: boolean = false;

  constructor() {
    this.backend = BackendService.getInstance();
    this.container = document.createElement('div');
    this.container.id = 'travel-modal';
    this.container.className = 'lagos-modal';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);

    this.backend.subscribe(this.render.bind(this));
    this.setupGlobalShortcuts();
  }

  private setupGlobalShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 't' || e.key === 'T') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        this.toggle();
      }
    });
  }

  public open(): void {
    if (this.isTraveling) return;
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.render(this.backend.getData());
  }

  public close(): void {
    if (this.isTraveling) return;
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private render(data: PlayerAccount): void {
    if (!this.isOpen) return;

    this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="travel-dialog">
        <header class="dialog-header">
          <div class="dialog-title-wrap">
            <span class="dialog-badge">LAGOS METROPOLITAN TRANSIT AUTHORITY (LAMATA)</span>
            <h2>🚌 Broad Street Danfo & BRT Terminus</h2>
            <p>Inter-city travel across Lagos Island, Victoria Island, Lekki, and the Mainland.</p>
          </div>
          <button class="dialog-close-btn" id="travel-close-btn">&times;</button>
        </header>

        <!-- Current Location Banner -->
        <div class="travel-origin-banner">
          <div class="origin-icon">📍</div>
          <div>
            <strong>Departure Station: Broad Street Terminus, Lagos Island</strong>
            <p>Pocket Cash: <strong>₦${data.walletCash.toLocaleString()}</strong> • Bank Balance: <strong>₦${data.bank.balance.toLocaleString()}</strong></p>
          </div>
        </div>

        <!-- Destinations Grid -->
        <div class="destinations-grid">
          ${LAGOS_DESTINATIONS.map((dest) => `
            <div class="dest-card" id="dest-card-${dest.id}">
              <div class="dest-top">
                <span class="dest-icon">${dest.icon}</span>
                <div class="dest-meta">
                  <h4>${dest.name}</h4>
                  <span class="dest-tagline">${dest.tagline}</span>
                </div>
                <span class="dest-fare">₦${dest.fare.toLocaleString()}</span>
              </div>

              <div class="dest-perk">
                <span>🎁 Trip Perk:</span> ${dest.perkDescription}
              </div>

              <div class="dest-conductor-quote">
                <em>"${dest.conductorShout}"</em>
              </div>

              <button class="btn-board-transit" data-dest-id="${dest.id}">
                🚌 Board Danfo (₦${dest.fare.toLocaleString()})
              </button>
            </div>
          `).join('')}
        </div>

        <!-- Travel Overlay Screen (when journey in progress) -->
        <div class="travel-journey-screen" id="travel-journey-screen" style="display: none;">
          <div class="journey-content">
            <div class="journey-bus-anim">🚌💨</div>
            <h3 id="journey-headline">Crossing Third Mainland Bridge...</h3>
            <p id="journey-quote">"Hold your phone tight, express breeze dey blow!"</p>
            <div class="journey-progress-bar">
              <div class="journey-progress-fill" id="journey-fill"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupEvents();
  }

  private setupEvents(): void {
    const closeBtn = document.getElementById('travel-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) (backdrop as HTMLElement).onclick = () => this.close();

    this.container.querySelectorAll('[data-dest-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).getAttribute('data-dest-id')!;
        this.startTravelJourney(id);
      });
    });
  }

  private startTravelJourney(destId: string): void {
    const dest = LAGOS_DESTINATIONS.find((d) => d.id === destId);
    if (!dest) return;

    const data = this.backend.getData();
    if (data.walletCash < dest.fare && data.bank.balance < dest.fare) {
      alert(`❌ Ineffective funds! You need ₦${dest.fare.toLocaleString()} for bus fare to ${dest.name}.`);
      return;
    }

    // Deduct fare
    const paidCash = this.backend.spendCash(dest.fare, `Danfo Bus Fare to ${dest.name}`);
    if (!paidCash) {
      this.backend.withdrawFromATM(dest.fare);
      this.backend.spendCash(dest.fare, `Danfo Bus Fare to ${dest.name}`);
    }

    this.isTraveling = true;
    const journeyScreen = document.getElementById('travel-journey-screen');
    const headline = document.getElementById('journey-headline');
    const quote = document.getElementById('journey-quote');
    const fill = document.getElementById('journey-fill');

    if (journeyScreen && headline && quote && fill) {
      journeyScreen.style.display = 'flex';
      headline.textContent = `En Route to ${dest.name}...`;
      quote.textContent = `"${dest.conductorShout}"`;
      fill.style.width = '0%';

      // Animate progress
      setTimeout(() => {
        fill.style.width = '100%';
      }, 50);

      setTimeout(() => {
        // Complete trip
        this.isTraveling = false;
        journeyScreen.style.display = 'none';
        this.close();

        // Add souvenir item to player inventory
        this.backend.addItem({
          id: `${dest.souvenirItem.id}_${Date.now()}`,
          name: dest.souvenirItem.name,
          category: dest.souvenirItem.id.includes('suya') ? 'food' : 'tool',
          icon: dest.souvenirItem.icon,
          description: dest.souvenirItem.description,
          price: dest.fare * 2,
          usable: dest.souvenirItem.id.includes('suya'),
          energyRestore: 50,
        });

        // Boost street cred & career
        this.backend.addStreetCred(12);
        this.backend.addJobExperience(15);
        if (dest.id === 'dest_lekki') {
          this.backend.restoreEnergy(40);
        } else if (dest.id === 'dest_ikeja') {
          this.backend.restoreEnergy(50);
        }

        alert(
          `🎉 Arrived safely at ${dest.name}!\n\n` +
          `• Added "${dest.souvenirItem.name}" to your bag!\n` +
          `• Earned Street Cred & Lagos transit experience.`
        );
      }, dest.travelTimeSeconds * 1000);
    }
  }
}
