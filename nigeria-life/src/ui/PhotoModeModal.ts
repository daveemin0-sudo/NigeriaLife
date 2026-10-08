import { GameCamera } from '../game/Camera';
import { showGameToast } from './GameToast';

export type PhotoFilterId = 'natural' | 'golden_hour' | 'cyberpunk' | 'vintage' | 'harmattan';

interface FilterPreset {
  id: PhotoFilterId;
  name: string;
  icon: string;
  cssFilter: string;
  description: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'natural',
    name: 'Natural Realism',
    icon: '💎',
    cssFilter: 'none',
    description: 'Crisp, authentic Nigerian daylight grading',
  },
  {
    id: 'golden_hour',
    name: 'Lagos Golden Hour',
    icon: '☀️',
    cssFilter: 'sepia(0.28) saturate(1.38) contrast(1.12) brightness(1.02)',
    description: 'Warm glowing amber sunset over Marina and Lekki',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Eko',
    icon: '🌃',
    cssFilter: 'contrast(1.3) saturate(1.45) hue-rotate(180deg) brightness(0.95)',
    description: 'Hyper-stylized neon nightlife contrast',
  },
  {
    id: 'vintage',
    name: 'Nollywood 90s VHS',
    icon: '🎞️',
    cssFilter: 'sepia(0.42) contrast(1.18) saturate(1.25) brightness(0.92)',
    description: 'Classic Alaba International home video film warmth',
  },
  {
    id: 'harmattan',
    name: 'Harmattan Mist',
    icon: '💨',
    cssFilter: 'sepia(0.35) brightness(1.06) contrast(0.92) saturate(1.08)',
    description: 'Golden Sahara dust haze over the city',
  },
];

export class PhotoModeModal {
  private container: HTMLDivElement;
  private cameraManager: GameCamera;
  private canvasElement: HTMLCanvasElement;
  public isOpen: boolean = false;
  private isUIHidden: boolean = false;
  private hasGrid: boolean = true;
  private hasLetterbox: boolean = true;
  private currentFilter: PhotoFilterId = 'golden_hour';

  // Audio Context for synthetic camera shutter
  private audioCtx: AudioContext | null = null;

  constructor(cameraManager: GameCamera, canvasElement: HTMLCanvasElement) {
    this.cameraManager = cameraManager;
    this.canvasElement = canvasElement;

    this.container = document.createElement('div');
    this.container.id = 'photo-mode-overlay';
    this.container.className = 'photo-mode-hidden';

    document.body.appendChild(this.container);

    // Keyboard hotkey listeners
    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        // Toggle photo mode with [P] if not currently typing in chat/input
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          this.toggle();
        }
      } else if (this.isOpen && (e.key === 'h' || e.key === 'H')) {
        this.toggleUIHidden();
      } else if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });
  }

  public open(): void {
    this.isOpen = true;
    this.isUIHidden = false;
    this.cameraManager.enterPhotoMode();
    this.container.className = 'photo-mode-active';
    this.applyCanvasFilter();
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.cameraManager.exitPhotoMode();
    this.container.className = 'photo-mode-hidden';
    this.canvasElement.style.filter = 'none';
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public toggleUIHidden(): void {
    this.isUIHidden = !this.isUIHidden;
    const hudWrapper = document.getElementById('photo-controls-panel');
    const headerWrapper = document.getElementById('photo-header-panel');
    const hint = document.getElementById('photo-unhide-hint');

    if (hudWrapper) hudWrapper.style.display = this.isUIHidden ? 'none' : 'flex';
    if (headerWrapper) headerWrapper.style.display = this.isUIHidden ? 'none' : 'flex';
    if (hint) hint.style.display = this.isUIHidden ? 'block' : 'none';
  }

  private applyCanvasFilter(): void {
    const preset = FILTER_PRESETS.find((p) => p.id === this.currentFilter) || FILTER_PRESETS[1];
    this.canvasElement.style.filter = preset.cssFilter;
  }

  private playShutterSound(): void {
    try {
      if (!this.audioCtx) {
        const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // Snappy metallic shutter click
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.45, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.1);
    } catch {
      // Audio not permitted or supported
    }
  }

  private triggerFlashAnimation(): void {
    const flash = document.createElement('div');
    flash.className = 'photo-flash-overlay';
    this.container.appendChild(flash);
    setTimeout(() => {
      flash.remove();
    }, 450);
  }

  private capturePhoto(): void {
    this.playShutterSound();
    this.triggerFlashAnimation();

    // Composite current Three.js WebGL frame with selected filter onto offscreen 2D canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvasElement.width;
    tempCanvas.height = this.canvasElement.height;
    const ctx = tempCanvas.getContext('2d');

    if (!ctx) {
      showGameToast('❌ Failed to capture frame buffer', 'error');
      return;
    }

    const preset = FILTER_PRESETS.find((p) => p.id === this.currentFilter) || FILTER_PRESETS[1];
    if (preset.cssFilter !== 'none') {
      ctx.filter = preset.cssFilter;
    }

    ctx.drawImage(this.canvasElement, 0, 0);

    // Apply elegant subtle Nigeria Life watermark in lower corner
    ctx.filter = 'none';
    const watermarkText = 'NIGERIA LIFE • V2 PHOTO MODE';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillText(watermarkText, 42, tempCanvas.height - 38);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(watermarkText, 40, tempCanvas.height - 40);

    tempCanvas.toBlob((blob) => {
      if (!blob) {
        showGameToast('❌ Could not encode screenshot', 'error');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timeTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `NigeriaLife_${this.currentFilter}_${timeTag}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showGameToast('📸 Shot captured and saved to your device!', 'success');
    }, 'image/png');
  }

  private render(): void {
    const preset = FILTER_PRESETS.find((p) => p.id === this.currentFilter) || FILTER_PRESETS[1];

    this.container.innerHTML = `
      <!-- Cinematic Cinema Scope Letterbox Bars -->
      <div class="photo-letterbox-top ${this.hasLetterbox ? 'active' : ''}"></div>
      <div class="photo-letterbox-bottom ${this.hasLetterbox ? 'active' : ''}"></div>

      <!-- Rule of Thirds Grid Overlay -->
      <div class="photo-grid-overlay ${this.hasGrid ? 'active' : ''}">
        <div class="grid-line grid-v-1"></div>
        <div class="grid-line grid-v-2"></div>
        <div class="grid-line grid-h-1"></div>
        <div class="grid-line grid-h-2"></div>
      </div>

      <!-- Viewfinder Crosshairs -->
      <div class="photo-crosshairs">
        <span class="crosshair-bracket tl"></span>
        <span class="crosshair-bracket tr"></span>
        <span class="crosshair-bracket bl"></span>
        <span class="crosshair-bracket br"></span>
      </div>

      <!-- Header Banner -->
      <div class="photo-header-panel" id="photo-header-panel">
        <div class="photo-header-left">
          <div class="photo-logo-tag">📸 NIGERIA LIFE PHOTO STUDIO</div>
          <div class="photo-filter-sublabel">${preset.icon} ${preset.name} — ${preset.description}</div>
        </div>
        <div class="photo-header-right">
          <button class="photo-icon-btn ${this.hasGrid ? 'active' : ''}" id="btn-toggle-grid" title="Toggle Grid [G]">
            📐 Grid
          </button>
          <button class="photo-icon-btn ${this.hasLetterbox ? 'active' : ''}" id="btn-toggle-letterbox" title="Toggle Letterbox [L]">
            🎬 Cinema
          </button>
          <button class="photo-icon-btn" id="btn-hide-ui" title="Hide UI [H]">
            👁️ Hide UI
          </button>
          <button class="photo-close-btn" id="btn-close-photo" title="Exit Photo Mode [ESC]">
            ✕ Exit
          </button>
        </div>
      </div>

      <!-- Unhide UI Overlay Hint -->
      <div class="photo-unhide-hint" id="photo-unhide-hint" style="display: none;">
        Press <kbd>H</kbd> or click anywhere to show controls
      </div>

      <!-- Bottom Camera Controls Dock -->
      <div class="photo-controls-panel" id="photo-controls-panel">
        <!-- Row 1: Filter Presets -->
        <div class="photo-filter-row">
          <span class="photo-row-label">Grade Filter:</span>
          <div class="photo-filter-pills">
            ${FILTER_PRESETS.map(
              (f) => `
              <button class="photo-filter-pill ${f.id === this.currentFilter ? 'selected' : ''}" data-filter="${f.id}">
                ${f.icon} ${f.name}
              </button>
            `
            ).join('')}
          </div>
        </div>

        <!-- Row 2: Lens & Sliders -->
        <div class="photo-sliders-row">
          <!-- Focal Length Lenses -->
          <div class="photo-control-group">
            <span class="photo-group-label">Lens (FOV):</span>
            <div class="lens-button-group">
              <button class="lens-btn ${this.cameraManager.photoFov >= 70 ? 'active' : ''}" data-fov="75">24mm (Wide)</button>
              <button class="lens-btn ${this.cameraManager.photoFov < 70 && this.cameraManager.photoFov >= 55 ? 'active' : ''}" data-fov="60">35mm (Street)</button>
              <button class="lens-btn ${this.cameraManager.photoFov < 55 && this.cameraManager.photoFov >= 40 ? 'active' : ''}" data-fov="48">50mm (Classic)</button>
              <button class="lens-btn ${this.cameraManager.photoFov < 40 ? 'active' : ''}" data-fov="32">85mm (Portrait)</button>
            </div>
          </div>

          <!-- Orbit Yaw -->
          <div class="photo-control-group">
            <span class="photo-group-label">Orbit Angle:</span>
            <input type="range" id="slider-photo-yaw" min="-3.14" max="3.14" step="0.05" value="${this.cameraManager.photoYaw}" class="photo-slider" />
          </div>

          <!-- Height / Elevation -->
          <div class="photo-control-group">
            <span class="photo-group-label">Height:</span>
            <input type="range" id="slider-photo-height" min="0.5" max="3.5" step="0.1" value="${this.cameraManager.photoHeight}" class="photo-slider" />
          </div>

          <!-- Distance Zoom -->
          <div class="photo-control-group">
            <span class="photo-group-label">Distance:</span>
            <input type="range" id="slider-photo-dist" min="2.5" max="18" step="0.2" value="${this.cameraManager.photoDistance}" class="photo-slider" />
          </div>
        </div>

        <!-- Row 3: Action Bar -->
        <div class="photo-actions-row">
          <div class="photo-hints">
            <span class="photo-kbd-hint"><kbd>P</kbd> Photo Mode</span>
            <span class="photo-kbd-hint"><kbd>H</kbd> Hide Controls</span>
            <span class="photo-kbd-hint"><kbd>ESC</kbd> Exit</span>
          </div>

          <!-- Giant Shutter Button -->
          <button class="photo-shutter-btn" id="btn-shutter-action">
            <span class="shutter-inner-ring">
              <span class="shutter-icon">📸</span>
              <span class="shutter-label">TAKE PHOTO</span>
            </span>
          </button>
        </div>
      </div>
    `;

    this.setupEvents();
  }

  private setupEvents(): void {
    // Close button
    const closeBtn = document.getElementById('btn-close-photo');
    if (closeBtn) closeBtn.onclick = () => this.close();

    // Toggle Grid
    const gridBtn = document.getElementById('btn-toggle-grid');
    if (gridBtn) {
      gridBtn.onclick = () => {
        this.hasGrid = !this.hasGrid;
        this.render();
      };
    }

    // Toggle Letterbox
    const letterboxBtn = document.getElementById('btn-toggle-letterbox');
    if (letterboxBtn) {
      letterboxBtn.onclick = () => {
        this.hasLetterbox = !this.hasLetterbox;
        this.render();
      };
    }

    // Hide UI
    const hideBtn = document.getElementById('btn-hide-ui');
    if (hideBtn) {
      hideBtn.onclick = () => this.toggleUIHidden();
    }

    // Unhide UI click on overlay
    const unhideHint = document.getElementById('photo-unhide-hint');
    if (unhideHint) {
      unhideHint.onclick = () => this.toggleUIHidden();
    }
    this.container.onclick = (e) => {
      if (this.isUIHidden && e.target === this.container) {
        this.toggleUIHidden();
      }
    };

    // Filter selection pills
    const filterPills = this.container.querySelectorAll('[data-filter]');
    filterPills.forEach((p) => {
      (p as HTMLElement).onclick = () => {
        const fid = (p as HTMLElement).getAttribute('data-filter') as PhotoFilterId;
        this.currentFilter = fid;
        this.applyCanvasFilter();
        this.render();
      };
    });

    // Lens FOV buttons
    const lensBtns = this.container.querySelectorAll('[data-fov]');
    lensBtns.forEach((b) => {
      (b as HTMLElement).onclick = () => {
        const fov = Number((b as HTMLElement).getAttribute('data-fov')) || 55;
        this.cameraManager.setPhotoFov(fov);
        this.render();
      };
    });

    // Yaw Slider
    const yawSlider = document.getElementById('slider-photo-yaw') as HTMLInputElement;
    if (yawSlider) {
      yawSlider.oninput = () => {
        this.cameraManager.photoYaw = parseFloat(yawSlider.value);
      };
    }

    // Height Slider
    const heightSlider = document.getElementById('slider-photo-height') as HTMLInputElement;
    if (heightSlider) {
      heightSlider.oninput = () => {
        this.cameraManager.photoHeight = parseFloat(heightSlider.value);
      };
    }

    // Distance Slider
    const distSlider = document.getElementById('slider-photo-dist') as HTMLInputElement;
    if (distSlider) {
      distSlider.oninput = () => {
        this.cameraManager.photoDistance = parseFloat(distSlider.value);
      };
    }

    // Shutter Click
    const shutterBtn = document.getElementById('btn-shutter-action');
    if (shutterBtn) {
      shutterBtn.onclick = () => this.capturePhoto();
    }
  }
}
