import { LookPreview } from './LookPreview';
import {
  ATTIRE_PRESETS,
  SKIN_TONES,
  HEADWEAR_OPTIONS,
  WARDROBE_CATALOGUE,
  type AttireStyle,
  type HeadwearType,
  type ModularClothingItem,
  type ClothingCategory,
} from '../player/CharacterCustomization';
import { Player } from '../player/Player';
import { BackendService } from '../backend/BackendService';
import type { OriginDestiny } from '../backend/types';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';

export class CharacterCreatorModal {
  private container: HTMLDivElement;
  private player: Player;
  private backend: BackendService;
  public isOpen: boolean = false;
  private activeTab: 'look' | 'wardrobe' | 'presets' = 'look';
  private categoryFilter: 'all' | ClothingCategory = 'all';

  constructor(player: Player) {
    this.player = player;
    this.backend = BackendService.getInstance();

    this.container = document.createElement('div');
    this.container.id = 'character-creator-modal';
    this.container.style.display = 'none';

    this.render();
    document.body.appendChild(this.container);
    this.setupEvents();
  }

  public open(tab: 'look' | 'wardrobe' | 'presets' = 'look'): void {
    this.isOpen = true;
    this.activeTab = tab;
    this.container.style.display = 'flex';
    this.render();
    this.setupEvents();
    UIStateManager.getInstance().pushModal('character-creator');
  }

  public close(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
    UIStateManager.getInstance().popModal('character-creator');
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private isItemEquipped(item: ModularClothingItem): boolean {
    const cfg = this.player.config;
    if (item.category === 'top') return cfg.topId === item.id;
    if (item.category === 'bottom') return cfg.bottomId === item.id;
    if (item.category === 'shoes') return cfg.shoesId === item.id;
    if (item.category === 'headwear') return cfg.headwearId === item.id;
    if (item.category === 'bag') return cfg.bagId === item.id;
    if (item.category === 'accessory') return cfg.accessoryId === item.id;
    return false;
  }

  private isItemOwned(item: ModularClothingItem): boolean {
    const owned = this.player.config.ownedClothingIds || [];
    return owned.includes(item.id);
  }

  private equipItem(item: ModularClothingItem): void {
    const cfg = this.player.config;
    if (item.category === 'top') cfg.topId = item.id;
    else if (item.category === 'bottom') {
      cfg.bottomId = item.id;
      cfg.trousersColor = '#' + item.color.toString(16).padStart(6, '0');
    } else if (item.category === 'shoes') cfg.shoesId = item.id;
    else if (item.category === 'headwear') cfg.headwearId = item.id;
    else if (item.category === 'bag') cfg.bagId = item.id;
    else if (item.category === 'accessory') cfg.accessoryId = item.id;

    if (!cfg.ownedClothingIds) cfg.ownedClothingIds = [];
    if (!cfg.ownedClothingIds.includes(item.id)) cfg.ownedClothingIds.push(item.id);

    this.player.applyCustomization(cfg);
    showGameToast(`✨ Equipped: ${item.name}`, 'success', 2800);
    this.render();
    this.setupEvents();
  }

  private unequipCategory(category: ClothingCategory): void {
    const cfg = this.player.config;
    if (category === 'bag') cfg.bagId = undefined;
    else if (category === 'headwear') cfg.headwearId = undefined;
    else if (category === 'accessory') {
      cfg.accessoryId = undefined;
      cfg.hasShades = false;
      cfg.hasGoldChain = false;
      cfg.hasCoralBeads = false;
    }
    this.player.applyCustomization(cfg);
    showGameToast(`Removed ${category} item`, 'info', 2200);
    this.render();
    this.setupEvents();
  }

  private buyAndEquip(item: ModularClothingItem): void {
    const acc = this.backend.getData();
    const totalFunds = acc.walletCash + acc.bank.balance;

    if (totalFunds < item.price) {
      showGameToast(
        `Insufficient Funds! You need ₦${item.price.toLocaleString()} for ${item.name}. (You have ₦${totalFunds.toLocaleString()})`,
        'error',
        4000
      );
      return;
    }

    const tx = this.backend.processTransaction({
      type: 'SHOP_PURCHASE',
      amount: item.price,
      description: `Boutique Purchase: ${item.name}`,
      source: acc.walletCash >= item.price ? 'wallet' : 'bank',
    });

    if (!tx.success) {
      showGameToast(tx.message, 'error', 3500);
      return;
    }

    this.equipItem(item);
    showGameToast(`🛍️ Purchased & Equipped ${item.name} for ₦${item.price.toLocaleString()}!`, 'success', 4000);
  }

  /** The studio pictures of the look as it is now */
  private showPreview(): void {
    const shot = LookPreview.shoot(this.player.config);
    if (!shot) return;
    const full = document.getElementById('look-full') as HTMLImageElement | null;
    const face = document.getElementById('look-face') as HTMLImageElement | null;
    if (full) full.src = shot.full;
    if (face) face.src = shot.face;
  }

  /** The face and the hair: head shapes, hairstyles and colours, beards, the build, the skin */
  private lookPanel(): string {
    const cfg = this.player.config;
    const female = cfg.gender === 'female';
    const opt = (key: string, value: string, label: string, on: boolean, art = '') =>
      `<button type="button" class="look-opt${on ? ' is-on' : ''}" data-key="${key}" data-value="${value}">${art}<span>${label}</span></button>`;
    const heads: Array<[string, string, string]> = [
      ['round', 'Round', 'M20 6c8 0 13 6 13 14s-5 15-13 15S7 28 7 20 12 6 20 6z'],
      ['oval', 'Oval', 'M20 4c7 0 11 7 11 15s-4 17-11 17S9 27 9 19 13 4 20 4z'],
      ['long', 'Long', 'M20 3c6 0 10 6 10 15s-3 19-10 19-10-10-10-19S14 3 20 3z'],
      ['square', 'Square', 'M10 8c3-3 17-3 20 0 2 4 2 18-1 23-4 4-14 4-18 0-3-5-3-19-1-23z'],
      ['heart', 'Heart', 'M8 9c4-5 20-5 24 0 1 9-4 21-12 26C12 30 7 18 8 9z'],
      ['diamond', 'Diamond', 'M20 3c4 4 11 9 11 15s-6 14-11 18C15 32 9 24 9 18S16 7 20 3z'],
    ];
    const headArt = (d: string) => `<svg viewBox="0 0 40 40" width="34" height="34"><path d="${d}" fill="#d8b49a" stroke="#6b4430" stroke-width="2"/></svg>`;
    const hairs: Array<[string, string]> = female
      ? [['box_braids', 'Box braids'], ['cornrows', 'Cornrows'], ['bun', 'Bun'], ['ponytail', 'Ponytail'], ['afro', 'Afro'], ['twists', 'Twists'], ['bantu_knots', 'Bantu knots'], ['bob_wig', 'Bob wig'], ['long_wig', 'Long wig'], ['dreads', 'Locs'], ['low_cut', 'Low cut']]
      : [['low_cut', 'Low cut'], ['waves', '360 waves'], ['fade', 'Fade'], ['buzz', 'Buzz'], ['afro', 'Afro'], ['high_top', 'High-top'], ['twists', 'Twists'], ['dreads', 'Locs'], ['cornrows', 'Cornrows'], ['bald', 'Bald']];
    const colours: Array<[string, string]> = [['#0b0908', 'Black'], ['#2b1b12', 'Dark brown'], ['#5a2e1b', 'Auburn'], ['#b07a3b', 'Honey blonde'], ['#5c1a2b', 'Burgundy'], ['#8a8a8a', 'Grey']];
    const beards: Array<[string, string]> = [['none', 'Clean'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['goatee', 'Goatee'], ['full', 'Full beard'], ['chinstrap', 'Chinstrap']];
    const builds: Array<[string, string]> = [['slim', 'Slim'], ['average', 'Average'], ['broad', 'Broad']];
    const skins: Array<[string, string]> = [['#3b2416', 'Deep'], ['#4a2c1d', 'Dark'], ['#5c3722', 'Rich'], ['#6b4430', 'Brown'], ['#7a4b33', 'Warm'], ['#8d5a3b', 'Caramel'], ['#a36d4a', 'Honey'], ['#c08a63', 'Light']];
    const currentHair = cfg.hair ?? (female ? 'box_braids' : 'low_cut');
    return `
      <div class="look-studio">
        <div class="look-photos"><img id="look-full" alt="You, full length" /><img id="look-face" alt="Your face" /></div>
        <div class="look-section"><div class="look-title">You are</div><div class="look-row">${opt('gender', 'male', 'Man', !female)}${opt('gender', 'female', 'Woman', female)}</div></div>
        <div class="look-section"><div class="look-title">Head shape</div><div class="look-row">${heads.map(([v, l, d]) => opt('headShape', v, l, (cfg.headShape ?? (female ? 'oval' : 'round')) === v, headArt(d))).join('')}</div></div>
        <div class="look-section"><div class="look-title">Skin</div><div class="look-row">${skins.map(([v, l]) => opt('skinTone', v, l, cfg.skinTone === v, `<i class="look-dot" style="background:${v}"></i>`)).join('')}</div></div>
        <div class="look-section"><div class="look-title">Hairstyle</div><div class="look-row">${hairs.map(([v, l]) => opt('hair', v, l, currentHair === v)).join('')}</div></div>
        <div class="look-section"><div class="look-title">Hair colour</div><div class="look-row">${colours.map(([v, l]) => opt('hairColor', v, l, (cfg.hairColor ?? '#0b0908') === v, `<i class="look-dot" style="background:${v}"></i>`)).join('')}</div></div>
        ${female ? '' : `<div class="look-section"><div class="look-title">Beard</div><div class="look-row">${beards.map(([v, l]) => opt('beard', v, l, (cfg.beard ?? 'none') === v)).join('')}</div></div>`}
        <div class="look-section"><div class="look-title">Build</div><div class="look-row">${builds.map(([v, l]) => opt('build', v, l, (cfg.build ?? 'average') === v)).join('')}</div></div>
        <div class="look-hint">Hats from the wardrobe (a fila, a gele) are worn over your hair.</div>
      </div>`;
  }

  private render(): void {
    const cfg = this.player.config;
    const accountData = this.backend.getData();
    const currentDestiny = accountData.originDestiny || 'lapo';
    const totalCash = accountData.walletCash;
    const totalBank = accountData.bank.balance;

    const filteredWardrobe = WARDROBE_CATALOGUE.filter((item) => {
      if (this.categoryFilter !== 'all' && item.category !== this.categoryFilter) return false;
      if (item.gender && item.gender !== 'unisex' && item.gender !== cfg.gender) return false;
      return true;
    });

    this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="creator-dialog" style="max-width: 680px;">
        <header class="dialog-header">
          <div class="dialog-title-wrap">
            <span class="dialog-badge">NIGERIA LIFE • MODULAR WARDROBE STUDIO</span>
            <h2>👔 Wardrobe & Character Studio</h2>
            <div style="display: flex; gap: 16px; margin-top: 6px; font-size: 13px; color: #66736c;">
              <span>💵 Cash: <strong style="color: #0e7a4e;">₦${totalCash.toLocaleString()}</strong></span>
              <span>🏦 Bank: <strong style="color: #0f1a14;">₦${totalBank.toLocaleString()}</strong></span>
            </div>
          </div>
          <button class="dialog-close-btn" id="creator-close-btn">&times;</button>
        </header>

        <!-- Studio Mode Tabs -->
        <div style="display: flex; gap: 8px; padding: 12px 24px; background: transparent; border-bottom: 1px solid rgba(15, 26, 20, 0.08);">
          <button id="tab-btn-look" style="flex: 1; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; background: ${this.activeTab === 'look' ? '#0e7a4e' : '#ffffff'}; color: ${this.activeTab === 'look' ? '#ffffff' : '#66736c'};">
            💇 Look
          </button>
          <button id="tab-btn-wardrobe" style="flex: 1; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; background: ${this.activeTab === 'wardrobe' ? '#0e7a4e' : '#ffffff'}; color: ${this.activeTab === 'wardrobe' ? '#ffffff' : '#66736c'};">
            🛍️ Modular Wardrobe Market
          </button>
          <button id="tab-btn-presets" style="flex: 1; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; background: ${this.activeTab === 'presets' ? '#0e7a4e' : '#ffffff'}; color: ${this.activeTab === 'presets' ? '#ffffff' : '#66736c'};">
            🌟 Origin Destiny & Face
          </button>
        </div>

        <div class="dialog-body" style="padding: 20px 24px; max-height: 65vh; overflow-y: auto;">
          ${
            this.activeTab === 'look' ? this.lookPanel() : this.activeTab === 'wardrobe'
              ? `
            <!-- Wardrobe Category Filters -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px;">
              ${[
                { id: 'all', label: '✨ All' },
                { id: 'top', label: '👘 Tops & Tunics' },
                { id: 'bottom', label: '👖 Trousers & Skirts' },
                { id: 'shoes', label: '👞 Footwear' },
                { id: 'bag', label: '🎒 Bags & Packs' },
                { id: 'headwear', label: '👑 Headwear' },
                { id: 'accessory', label: '💎 Bling & Beads' },
              ]
                .map(
                  (c) => `
                <button class="wardrobe-filter-btn ${this.categoryFilter === c.id ? 'active' : ''}" 
                  data-cat="${c.id}" 
                  style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid ${this.categoryFilter === c.id ? '#0e7a4e' : 'rgba(15,26,20,0.1)'}; background: ${this.categoryFilter === c.id ? '#e6f4ec' : '#ffffff'}; color: ${this.categoryFilter === c.id ? '#0e7a4e' : '#2f3a34'};">
                  ${c.label}
                </button>
              `
                )
                .join('')}
            </div>

            <!-- Items Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
              ${filteredWardrobe
                .map((item) => {
                  const equipped = this.isItemEquipped(item);
                  const owned = this.isItemOwned(item);
                  const colorHex = '#' + item.color.toString(16).padStart(6, '0');

                  return `
                  <div class="wardrobe-item-card" style="display: flex; flex-direction: column; justify-content: space-between; background: #ffffff; border: 1px solid ${equipped ? '#0e7a4e' : 'rgba(15, 26, 20, 0.08)'}; border-radius: 12px; padding: 14px; transition: transform 0.18s, border-color 0.18s;">
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 22px;">${item.icon}</span>
                          <span style="width: 14px; height: 14px; border-radius: 50%; background-color: ${colorHex}; border: 1px solid rgba(15,26,20,0.18); display: inline-block;"></span>
                          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #66736c; letter-spacing: 0.5px;">${item.category}</span>
                        </div>
                        ${equipped ? `<span style="font-size: 11px; font-weight: 800; color: #0e7a4e; background: #e6f4ec; padding: 2px 8px; border-radius: 6px;">EQUIPPED</span>` : ''}
                      </div>

                      <h4 style="font-size: 15px; font-weight: 700; color: #0f1a14; margin: 0 0 4px 0;">${item.name}</h4>
                      <p style="font-size: 12px; color: #66736c; margin: 0 0 12px 0; line-height: 1.4;">${item.description}</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid rgba(15, 26, 20, 0.08);">
                      <span style="font-size: 14px; font-weight: 800; color: #0f1a14;">₦${item.price.toLocaleString()}</span>
                      ${
                        equipped
                          ? `<button class="btn-unequip-item" data-cat="${item.category}" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Unequip</button>`
                          : owned
                            ? `<button class="btn-equip-item" data-item-id="${item.id}" style="padding: 6px 14px; background: #0e7a4e; color: #ffffff; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">Equip</button>`
                            : `<button class="btn-buy-item" data-item-id="${item.id}" style="padding: 6px 14px; background: #ffffff; color: #0f1a14; border: 1px solid rgba(14, 122, 78, 0.35); border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;">Buy & Wear</button>`
                      }
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          `
              : `
            <!-- Section 0: The Viral Origin Destiny (Nepo vs Lapo vs Tech Bro) -->
            <div class="creator-section origin-destiny-section">
              <div class="destiny-section-header">
                <div>
                  <label class="section-label">🌟 Origin Destiny Spawn (Choose or Spin Your Fate)</label>
                  <p class="destiny-subtitle">Sets your starting capital, loans, exclusive items, and social class.</p>
                </div>
                <button type="button" class="btn-spin-destiny" id="btn-spin-destiny">🎲 Spin Random Fate</button>
              </div>

              <div class="destiny-grid">
                <div class="destiny-card ${currentDestiny === 'nepo' ? 'active' : ''}" data-destiny="nepo">
                  <div class="destiny-card-top">
                    <span class="destiny-badge nepo-badge">👑 BANANA ISLAND HEIR</span>
                    <span class="destiny-capital">₦2.5M Cash • ₦10M Bank</span>
                  </div>
                  <h4>Nepo Spawn</h4>
                  <p>Born into billionaire connections. Starts with Centurion Black card, Cartier shades, and Penthouse pass.</p>
                  <div class="destiny-perks">
                    <span>✨ ₦12.5M Total Net Worth</span>
                    <span>✨ 100% Max Energy & Food</span>
                    <span>✨ Luxury VIP Club Access</span>
                  </div>
                </div>

                <div class="destiny-card ${currentDestiny === 'lapo' ? 'active' : ''}" data-destiny="lapo">
                  <div class="destiny-card-top">
                    <span class="destiny-badge lapo-badge">⚡ GRASSROOTS HUSTLER</span>
                    <span class="destiny-capital">₦2,500 Cash • ₦50K Loan</span>
                  </div>
                  <h4>Lapo Spawn</h4>
                  <p>Starting from the trenches of Oshodi & Mushin with a Lapo microloan. High hunger, maximum street respect.</p>
                  <div class="destiny-perks">
                    <span>🔥 +80 Maximum Street Cred</span>
                    <span>🔥 Weekly Loan Repayments</span>
                    <span>🔥 Danfo Commuter Pass</span>
                  </div>
                </div>

                <div class="destiny-card ${currentDestiny === 'tech_bro' ? 'active' : ''}" data-destiny="tech_bro">
                  <div class="destiny-card-top">
                    <span class="destiny-badge tech-badge">💻 YABA STARTUP FOUNDER</span>
                    <span class="destiny-capital">₦150K Cash • ₦750K Bank</span>
                  </div>
                  <h4>Tech Bro Spawn</h4>
                  <p>Funded software founder earning remote foreign contracts. Armed with M3 MacBook, solar power bank & USD card.</p>
                  <div class="destiny-perks">
                    <span>🚀 M3 Max MacBook Pro</span>
                    <span>🚀 Virtual USD Visa Card</span>
                    <span>🚀 Solar Fast Power Bank</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 1: Character Name -->
            <div class="creator-section">
              <label class="section-label">Character Name</label>
              <input type="text" id="cfg-name-input" class="text-input" value="${cfg.name}" placeholder="Enter name...">
            </div>

            <!-- Section 2: Skin Tone -->
            <div class="creator-section">
              <label class="section-label">Melanin & Skin Tone</label>
              <div class="skin-palette">
                ${SKIN_TONES.map(
                  (tone) => `
                  <button class="skin-swatch ${cfg.skinTone === tone.hex ? 'active' : ''}" 
                    data-skin="${tone.hex}" 
                    style="background-color: ${tone.hex}" 
                    title="${tone.name}"></button>
                `
                ).join('')}
              </div>
            </div>

            <!-- Section 3: Attire / Style -->
            <div class="creator-section">
              <label class="section-label">Attire & Native Fabrics (Quick Presets)</label>
              <div class="preset-grid">
                ${Object.entries(ATTIRE_PRESETS)
                  .map(
                    ([key, val]) => `
                  <button class="preset-card ${cfg.attire === key ? 'active' : ''}" data-attire="${key}">
                    <span class="preset-swatch" style="background-color: #${val.color.toString(16).padStart(6, '0')}"></span>
                    <div class="preset-info">
                      <span class="preset-name">${val.name}</span>
                      <span class="preset-desc">${val.label}</span>
                    </div>
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- Section 4: Traditional Caps & Hair -->
            <div class="creator-section">
              <label class="section-label">Headwear & Caps</label>
              <div class="pill-grid">
                ${HEADWEAR_OPTIONS.map(
                  (h) => `
                  <button class="pill-btn ${cfg.headwear === h.id ? 'active' : ''}" data-headwear="${h.id}">
                    ${h.name}
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <!-- Section 5: Accessories & Bling -->
            <div class="creator-section">
              <label class="section-label">Accessories & Swag</label>
              <div class="checkbox-row">
                <label class="toggle-control">
                  <input type="checkbox" id="cfg-shades-check" ${cfg.hasShades ? 'checked' : ''}>
                  <span>🕶️ Designer Sunglasses</span>
                </label>
                <label class="toggle-control">
                  <input type="checkbox" id="cfg-chain-check" ${cfg.hasGoldChain ? 'checked' : ''}>
                  <span>🥇 Cuban Gold Chain</span>
                </label>
                <label class="toggle-control">
                  <input type="checkbox" id="cfg-coral-check" ${cfg.hasCoralBeads ? 'checked' : ''}>
                  <span>📿 Royal Coral Beads</span>
                </label>
              </div>
            </div>
          `
          }
        </div>

        <footer class="dialog-footer" style="padding: 16px 24px; border-top: 1px solid rgba(15, 26, 20, 0.08); display: flex; justify-content: flex-end;">
          <button class="btn-save" id="creator-save-btn">✨ Confirm & Step Out into Lagos</button>
        </footer>
      </div>
    `;
  }

  private setupEvents(): void {
    const closeBtn = document.getElementById('creator-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) (backdrop as HTMLElement).onclick = () => this.close();

    const saveBtn = document.getElementById('creator-save-btn');
    if (saveBtn) saveBtn.onclick = () => this.close();

    // Tab buttons
    const tabLook = document.getElementById('tab-btn-look');
    if (tabLook) {
      tabLook.onclick = () => {
        this.activeTab = 'look';
        this.render();
        this.setupEvents();
      };
    }
    // The look's choices: each changes the person at once, shown in the studio picture
    this.container.querySelectorAll<HTMLElement>('.look-opt').forEach((btn) => {
      btn.onclick = () => {
        const cfg = this.player.config as unknown as Record<string, unknown>;
        const key = btn.dataset.key!;
        cfg[key] = btn.dataset.value;
        if (key === 'gender') {
          cfg.hair = undefined;
          cfg.beard = 'none';
        }
        this.player.applyCustomization(this.player.config);
        this.render();
        this.setupEvents();
      };
    });
    if (this.activeTab === 'look') requestAnimationFrame(() => this.showPreview());
    const tabWardrobe = document.getElementById('tab-btn-wardrobe');
    if (tabWardrobe) {
      tabWardrobe.onclick = () => {
        this.activeTab = 'wardrobe';
        this.render();
        this.setupEvents();
      };
    }

    const tabPresets = document.getElementById('tab-btn-presets');
    if (tabPresets) {
      tabPresets.onclick = () => {
        this.activeTab = 'presets';
        this.render();
        this.setupEvents();
      };
    }

    // Wardrobe Category Filters
    const filterBtns = this.container.querySelectorAll('.wardrobe-filter-btn');
    filterBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        this.categoryFilter = (btn as HTMLElement).getAttribute('data-cat') as any;
        this.render();
        this.setupEvents();
      };
    });

    // Buy item buttons
    const buyBtns = this.container.querySelectorAll('.btn-buy-item');
    buyBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const itemId = (btn as HTMLElement).getAttribute('data-item-id');
        const item = WARDROBE_CATALOGUE.find((i) => i.id === itemId);
        if (item) this.buyAndEquip(item);
      };
    });

    // Equip item buttons
    const equipBtns = this.container.querySelectorAll('.btn-equip-item');
    equipBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const itemId = (btn as HTMLElement).getAttribute('data-item-id');
        const item = WARDROBE_CATALOGUE.find((i) => i.id === itemId);
        if (item) this.equipItem(item);
      };
    });

    // Unequip buttons
    const unequipBtns = this.container.querySelectorAll('.btn-unequip-item');
    unequipBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const cat = (btn as HTMLElement).getAttribute('data-cat') as ClothingCategory;
        if (cat) this.unequipCategory(cat);
      };
    });

    // Presets Tab Events
    if (this.activeTab === 'presets') {
      const destinyCards = this.container.querySelectorAll('.destiny-card');
      destinyCards.forEach((card) => {
        (card as HTMLElement).onclick = () => {
          const dest = (card as HTMLElement).getAttribute('data-destiny') as OriginDestiny;
          if (dest) {
            const res = this.backend.applyOriginDestiny(dest);
            if (!res.applied) {
              showGameToast(`🔒 ${res.title}: ${res.message}`, 'warning', 4000);
              return;
            }
            destinyCards.forEach((c) => c.classList.remove('active'));
            card.classList.add('active');

            if (dest === 'nepo') {
              this.player.config.hasShades = true;
              this.player.config.hasGoldChain = true;
              this.player.applyCustomization(this.player.config);
            }
            showGameToast(`🌟 ${res.title}: ${res.message}`, 'success', 4000);
          }
        };
      });

      const spinBtn = document.getElementById('btn-spin-destiny');
      if (spinBtn) {
        spinBtn.onclick = () => {
          const pool: OriginDestiny[] = ['nepo', 'lapo', 'tech_bro'];
          const chosen = pool[Math.floor(Math.random() * pool.length)];
          const res = this.backend.applyOriginDestiny(chosen);
          if (!res.applied) {
            showGameToast(`🔒 ${res.title}: ${res.message}`, 'warning', 4000);
            return;
          }

          destinyCards.forEach((c) => {
            if (c.getAttribute('data-destiny') === chosen) {
              c.classList.add('active');
            } else {
              c.classList.remove('active');
            }
          });

          if (chosen === 'nepo') {
            this.player.config.hasShades = true;
            this.player.config.hasGoldChain = true;
            this.player.applyCustomization(this.player.config);
          }

          showGameToast(`🎲 ${res.title}: ${res.message}`, 'success', 4500);
        };
      }

      const nameInput = document.getElementById('cfg-name-input') as HTMLInputElement;
      if (nameInput) {
        nameInput.oninput = () => {
          this.player.config.name = nameInput.value;
          this.player.applyCustomization(this.player.config);
        };
      }

      const skinSwatches = this.container.querySelectorAll('.skin-swatch');
      skinSwatches.forEach((btn) => {
        (btn as HTMLElement).onclick = () => {
          const hex = (btn as HTMLElement).getAttribute('data-skin')!;
          this.player.config.skinTone = hex;
          this.player.applyCustomization(this.player.config);
          skinSwatches.forEach((s) => s.classList.remove('active'));
          btn.classList.add('active');
        };
      });

      const attireCards = this.container.querySelectorAll('.preset-card');
      attireCards.forEach((card) => {
        (card as HTMLElement).onclick = () => {
          const attireKey = (card as HTMLElement).getAttribute('data-attire')! as AttireStyle;
          this.player.config.attire = attireKey;
          this.player.config.topId = undefined; // clear modular override to use preset
          this.player.applyCustomization(this.player.config);
          attireCards.forEach((c) => c.classList.remove('active'));
          card.classList.add('active');
        };
      });

      const headwearPills = this.container.querySelectorAll('.pill-btn');
      headwearPills.forEach((pill) => {
        (pill as HTMLElement).onclick = () => {
          const headKey = (pill as HTMLElement).getAttribute('data-headwear')! as HeadwearType;
          this.player.config.headwear = headKey;
          this.player.config.headwearId = undefined;
          this.player.applyCustomization(this.player.config);
          headwearPills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
        };
      });

      const shadesCheck = document.getElementById('cfg-shades-check') as HTMLInputElement;
      if (shadesCheck) {
        shadesCheck.onchange = () => {
          this.player.config.hasShades = shadesCheck.checked;
          this.player.applyCustomization(this.player.config);
        };
      }

      const chainCheck = document.getElementById('cfg-chain-check') as HTMLInputElement;
      if (chainCheck) {
        chainCheck.onchange = () => {
          this.player.config.hasGoldChain = chainCheck.checked;
          this.player.applyCustomization(this.player.config);
        };
      }

      const coralCheck = document.getElementById('cfg-coral-check') as HTMLInputElement;
      if (coralCheck) {
        coralCheck.onchange = () => {
          this.player.config.hasCoralBeads = coralCheck.checked;
          this.player.applyCustomization(this.player.config);
        };
      }
    }
  }
}
