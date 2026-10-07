import {
  ATTIRE_PRESETS,
  SKIN_TONES,
  HEADWEAR_OPTIONS,
  type AttireStyle,
  type HeadwearType,
} from '../player/CharacterCustomization';
import { Player } from '../player/Player';

export class CharacterCreatorModal {
  private container: HTMLDivElement;
  private player: Player;
  private isOpen: boolean = false;

  constructor(player: Player) {
    this.player = player;

    this.container = document.createElement('div');
    this.container.id = 'character-creator-modal';
    this.container.style.display = 'none';

    this.render();
    document.body.appendChild(this.container);
    this.setupEvents();
  }

  public open(): void {
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.render();
    this.setupEvents();
  }

  public close(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private render(): void {
    const cfg = this.player.config;

    this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="creator-dialog">
        <header class="dialog-header">
          <div class="dialog-title-wrap">
            <span class="dialog-badge">NIGERIA LIFE • V1</span>
            <h2>👔 Wardrobe & Character Studio</h2>
            <p>Customize your Lagos look, attire, traditional caps, and jewelry.</p>
          </div>
          <button class="dialog-close-btn" id="creator-close-btn">&times;</button>
        </header>

        <div class="dialog-body">
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
            <label class="section-label">Attire & Native Fabrics</label>
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
            </div>
          </div>
        </div>

        <footer class="dialog-footer">
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

    // Name input
    const nameInput = document.getElementById('cfg-name-input') as HTMLInputElement;
    if (nameInput) {
      nameInput.oninput = () => {
        this.player.config.name = nameInput.value;
        this.player.applyCustomization(this.player.config);
      };
    }

    // Skin Tone Swatches
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

    // Attire Cards
    const attireCards = this.container.querySelectorAll('.preset-card');
    attireCards.forEach((card) => {
      (card as HTMLElement).onclick = () => {
        const attireKey = (card as HTMLElement).getAttribute('data-attire')! as AttireStyle;
        this.player.config.attire = attireKey;
        this.player.applyCustomization(this.player.config);
        attireCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
      };
    });

    // Headwear Pills
    const headwearPills = this.container.querySelectorAll('.pill-btn');
    headwearPills.forEach((pill) => {
      (pill as HTMLElement).onclick = () => {
        const headKey = (pill as HTMLElement).getAttribute('data-headwear')! as HeadwearType;
        this.player.config.headwear = headKey;
        this.player.applyCustomization(this.player.config);
        headwearPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
      };
    });

    // Shades Checkbox
    const shadesCheck = document.getElementById('cfg-shades-check') as HTMLInputElement;
    if (shadesCheck) {
      shadesCheck.onchange = () => {
        this.player.config.hasShades = shadesCheck.checked;
        this.player.applyCustomization(this.player.config);
      };
    }

    // Gold Chain Checkbox
    const chainCheck = document.getElementById('cfg-chain-check') as HTMLInputElement;
    if (chainCheck) {
      chainCheck.onchange = () => {
        this.player.config.hasGoldChain = chainCheck.checked;
        this.player.applyCustomization(this.player.config);
      };
    }
  }
}
