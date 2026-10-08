import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';

export interface CatalogueItem {
  id: string;
  name: string;
  category: 'appliances' | 'furniture' | 'power' | 'decor';
  price: number;
  icon: string;
  description: string;
  modelType: string;
}

export const CATALOGUE_ITEMS: CatalogueItem[] = [
  {
    id: 'tiger_gen',
    name: 'Tiger "I-pass-my-neighbour" Generator',
    category: 'power',
    price: 85000,
    icon: '⚡',
    description: 'Iconic Nigerian compact 950W generator. Keeps fan and TV running when NEPA strikes.',
    modelType: 'generator_small',
  },
  {
    id: 'mikano_gen',
    name: 'Mikano 20kVA Silent Soundproof Generator',
    category: 'power',
    price: 1200000,
    icon: '🔋',
    description: 'Industrial heavy-duty diesel generator with automatic changeover. Powers all ACs smoothly.',
    modelType: 'generator_big',
  },
  {
    id: 'smart_tv_75',
    name: '75" 4K Smart OLED TV & Soundbar',
    category: 'appliances',
    price: 450000,
    icon: '📺',
    description: 'Crystal-clear 4K display for streaming Super Eagles and Nollywood classics with stadium sound.',
    modelType: 'tv_75',
  },
  {
    id: 'lontor_fan',
    name: 'Lontor Rechargeable Standing Fan',
    category: 'appliances',
    price: 38000,
    icon: '🌪️',
    description: '16-inch high speed oscillating fan with 12-hour backup battery and night lamp.',
    modelType: 'standing_fan',
  },
  {
    id: 'deep_freezer',
    name: 'Haier Thermocool Inverter Deep Freezer',
    category: 'appliances',
    price: 260000,
    icon: '🧊',
    description: 'Heavy cooling chest freezer. Keeps meat, fish, and chilled Chapman frozen for 100 hours.',
    modelType: 'freezer',
  },
  {
    id: 'water_drum',
    name: '200L Blue Plastic Water Drum & Red Bucket',
    category: 'decor',
    price: 18000,
    icon: '🪣',
    description: 'The undefeated symbol of Nigerian household readiness. Borehole water on tap.',
    modelType: 'drum_bucket',
  },
  {
    id: 'gas_cooker',
    name: '4-Burner Gas Cooker + 12.5kg Cylinder',
    category: 'appliances',
    price: 110000,
    icon: '🍳',
    description: 'Stainless steel cooker with oven and regulator for cooking party jollof and fried plantain.',
    modelType: 'cooker',
  },
  {
    id: 'emerald_sofa',
    name: 'Royal Emerald Velvet Sectional Sofa',
    category: 'furniture',
    price: 320000,
    icon: '🛋️',
    description: 'Deep, plush 3-seater luxury couch with golden embroidery cushions.',
    modelType: 'sofa_emerald',
  },
  {
    id: 'ankara_rug',
    name: 'Circular Orange & Gold Heritage Rug',
    category: 'decor',
    price: 45000,
    icon: '⭕',
    description: 'Handwoven circular floor rug featuring traditional African concentric circle motifs.',
    modelType: 'rug_circle',
  },
  {
    id: 'king_bed',
    name: 'King-Size Royal Bed & Orthopedic Mattress',
    category: 'furniture',
    price: 280000,
    icon: '🛏️',
    description: 'Solid mahogany frame with royal purple duvet and luxury memory foam pillows.',
    modelType: 'king_bed',
  },
  {
    id: 'inverter_solar',
    name: '5kVA Solar Inverter & Tubular Batteries',
    category: 'power',
    price: 650000,
    icon: '☀️',
    description: 'Silent uninterrupted 24/7 green power system. Say goodbye to blackouts permanently.',
    modelType: 'solar_inverter',
  },
  {
    id: 'majesty_palm',
    name: 'Indoor Majesty Palm in Ceramic Pot',
    category: 'decor',
    price: 12000,
    icon: '🪴',
    description: 'Fresh tropical green plant adding oxygen and elegance to the living room.',
    modelType: 'potted_plant',
  },
];

export class HouseDecorationSystem {
  private static instance: HouseDecorationSystem;
  private backend: BackendService;
  public placedItemsGroup: THREE.Group;
  private storageKey = 'nigeria_life_placed_furniture_v1';
  public isBuyMode: boolean = false;
  private modalContainer: HTMLDivElement | null = null;
  public onFurniturePlaced?: (item: CatalogueItem) => void;

  private constructor() {
    this.backend = BackendService.getInstance();
    this.placedItemsGroup = new THREE.Group();
    this.loadSavedFurniture();
  }

  public static getInstance(): HouseDecorationSystem {
    if (!HouseDecorationSystem.instance) {
      HouseDecorationSystem.instance = new HouseDecorationSystem();
    }
    return HouseDecorationSystem.instance;
  }

  public openCatalogueModal(): void {
    if (!this.modalContainer) {
      this.modalContainer = document.createElement('div');
      this.modalContainer.id = 'house-catalogue-modal';
      this.modalContainer.className = 'catalogue-modal-overlay';
      document.body.appendChild(this.modalContainer);
    }

    const data = this.backend.getData();
    this.modalContainer.innerHTML = `
      <div class="catalogue-modal-card">
        <div class="catalogue-header">
          <div class="cat-title-wrap">
            <span class="cat-icon">🏠</span>
            <div>
              <h3>Nigerian Home Decor & Appliance Catalogue</h3>
              <p>Furnish and customize your Lagos residence with authentic appliances & luxury furniture.</p>
            </div>
          </div>
          <button class="cat-close-btn" id="btn-close-catalogue">✕</button>
        </div>

        <div class="cat-balance-row">
          <span>Available Bank / Cash: <strong>₦${(data.walletCash + data.bank.balance).toLocaleString()}</strong></span>
          <span class="cat-tag-pill">✨ Instant Delivery</span>
        </div>

        <div class="cat-grid">
          ${CATALOGUE_ITEMS.map((item) => {
            const canAfford = (data.walletCash + data.bank.balance) >= item.price;
            return `
              <div class="cat-item-card">
                <div class="cat-item-icon">${item.icon}</div>
                <div class="cat-item-info">
                  <h4>${item.name}</h4>
                  <span class="cat-item-cat">${item.category.toUpperCase()}</span>
                  <p class="cat-item-desc">${item.description}</p>
                  <div class="cat-item-footer">
                    <span class="cat-item-price">₦${item.price.toLocaleString()}</span>
                    <button class="btn-buy-furniture" data-item-id="${item.id}" ${canAfford ? '' : 'disabled'}>
                      ${canAfford ? 'Buy & Place' : 'Insufficient Funds'}
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.modalContainer.style.display = 'flex';

    // Setup event listeners
    const closeBtn = document.getElementById('btn-close-catalogue');
    if (closeBtn) {
      closeBtn.onclick = () => {
        this.closeCatalogueModal();
      };
    }

    const buyBtns = this.modalContainer.querySelectorAll('[data-item-id]');
    buyBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const itemId = (btn as HTMLElement).getAttribute('data-item-id')!;
        this.purchaseAndPlace(itemId);
      };
    });
  }

  public closeCatalogueModal(): void {
    if (this.modalContainer) {
      this.modalContainer.style.display = 'none';
    }
  }

  public purchaseAndPlace(itemId: string): void {
    const item = CATALOGUE_ITEMS.find((i) => i.id === itemId);
    if (!item) return;

    const data = this.backend.getData();
    const totalFunds = data.walletCash + data.bank.balance;
    if (totalFunds < item.price) {
      alert(`❌ You need ₦${item.price.toLocaleString()} to purchase this item.`);
      return;
    }

    // Deduct cash or bank balance
    if (data.walletCash >= item.price) {
      this.backend.spendCash(item.price, `Furnishing: ${item.name}`);
    } else {
      const remainder = item.price - data.walletCash;
      this.backend.spendCash(data.walletCash, `Furnishing: ${item.name}`);
      this.backend.withdrawFromATM(remainder);
    }

    // Spawn 3D furniture mesh in apartment
    const mesh = this.createFurniture3DMesh(item.modelType);
    // Position randomly in the living room or near placed items
    const offsetX = (Math.random() - 0.5) * 8;
    const offsetZ = 2 + (Math.random() - 0.5) * 6;
    mesh.position.set(offsetX, 0, offsetZ);
    this.placedItemsGroup.add(mesh);

    // Save to localStorage
    this.savePlacedItem({
      id: item.id,
      modelType: item.modelType,
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
    });

    this.closeCatalogueModal();
    alert(`🎉 Successfully bought "${item.name}"! Delivered and installed in your residence!`);
    this.onFurniturePlaced?.(item);
  }

  public createFurniture3DMesh(modelType: string): THREE.Group {
    const group = new THREE.Group();

    if (modelType === 'generator_small') {
      // Tiger "I-pass-my-neighbour" generator (Red fuel tank, black frame)
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.7, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 })
      );
      frame.position.y = 0.35;
      group.add(frame);

      const tank = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }) // Red tank
      );
      tank.position.y = 0.75;
      group.add(tank);

      const pullCord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b })
      );
      pullCord.rotation.z = Math.PI / 2;
      pullCord.position.set(0.42, 0.4, 0);
      group.add(pullCord);
    } else if (modelType === 'generator_big') {
      // Mikano Silent Soundproof 20kVA (Large green canopy with exhaust)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, metalness: 0.3 })
      );
      body.position.y = 0.8;
      group.add(body);

      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.8 })
      );
      exhaust.position.set(0.8, 1.8, 0);
      group.add(exhaust);
    } else if (modelType === 'standing_fan') {
      // Lontor standing fan
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x0284c7 })
      );
      base.position.y = 0.04;
      group.add(base);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x0f172a })
      );
      pole.position.y = 0.74;
      group.add(pole);

      const cage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, wireframe: true })
      );
      cage.rotation.x = Math.PI / 2;
      cage.position.set(0, 1.45, 0.05);
      group.add(cage);
    } else if (modelType === 'rug_circle') {
      // Circular Orange & White rug matching Image 5
      const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 2.5, 32),
        new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.9, side: THREE.DoubleSide })
      );
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.02;
      group.add(outerRing);

      const innerDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1.4, 32),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 })
      );
      innerDisc.rotation.x = -Math.PI / 2;
      innerDisc.position.y = 0.022;
      group.add(innerDisc);
    } else if (modelType === 'drum_bucket') {
      // Blue drum & red bucket
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 1.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
      );
      drum.position.y = 0.75;
      group.add(drum);

      const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.28, 0.6, 16),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
      );
      bucket.position.set(0.85, 0.3, 0);
      group.add(bucket);
    } else if (modelType === 'freezer') {
      // White Haier Thermocool chest freezer
      const freezer = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.1, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      freezer.position.y = 0.55;
      group.add(freezer);
    } else if (modelType === 'cooker') {
      // Gas cooker & red cylinder
      const stove = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
      );
      stove.position.y = 0.55;
      group.add(stove);

      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.8, 14),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
      );
      cyl.position.set(0.9, 0.4, 0);
      group.add(cyl);
    } else if (modelType === 'potted_plant') {
      // Potted palm
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.22, 0.6, 14),
        new THREE.MeshStandardMaterial({ color: 0xfef08a })
      );
      pot.position.y = 0.3;
      group.add(pot);

      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 1.1, 5),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
        );
        leaf.rotation.z = 0.35 * (i % 2 === 0 ? 1 : -1);
        leaf.rotation.y = (i * Math.PI) / 2.5;
        leaf.position.set(0, 0.9, 0);
        group.add(leaf);
      }
    } else {
      // Generic luxury prop
      const prop = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.9, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x059669 })
      );
      prop.position.y = 0.45;
      group.add(prop);
    }

    return group;
  }

  private savePlacedItem(data: { id: string; modelType: string; position: { x: number; y: number; z: number } }): void {
    try {
      const existing = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      existing.push(data);
      localStorage.setItem(this.storageKey, JSON.stringify(existing));
    } catch {
      // Ignore storage errors
    }
  }

  private loadSavedFurniture(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      saved.forEach((item: any) => {
        const mesh = this.createFurniture3DMesh(item.modelType);
        if (item.position) {
          mesh.position.set(item.position.x, item.position.y, item.position.z);
        }
        this.placedItemsGroup.add(mesh);
      });
    } catch {
      // Ignore errors
    }
  }
}
