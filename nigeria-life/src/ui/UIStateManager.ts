/**
 * UIStateManager.ts
 * Centralized UI State, Layout Zone, and Modal Stack Manager for NigeriaLife.
 * 
 * Replaces ad-hoc floating UI collisions with a rigorous screen zone and mode architecture.
 * Modes: 'street' | 'interior' | 'world-map' | 'driving' | 'transit' | 'house' | 'modal'
 * Zones: TOP_LEFT, TOP_CENTER, TOP_RIGHT, CENTER, CENTER_LEFT, CENTER_RIGHT,
 *        BOTTOM_LEFT, BOTTOM_CENTER, BOTTOM_RIGHT
 */

export type GameUIMode =
  | 'street'
  | 'interior'
  | 'world-map'
  | 'driving'
  | 'transit'
  | 'house'
  | 'modal';

export type UIZone =
  | 'TOP_LEFT'
  | 'TOP_CENTER'
  | 'TOP_RIGHT'
  | 'CENTER'
  | 'CENTER_LEFT'
  | 'CENTER_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'BOTTOM_RIGHT';

export interface ModalInstance {
  id: string;
  close: () => void;
  isOpen: () => boolean;
}

export class UIStateManager {
  private static instance: UIStateManager;

  private currentMode: GameUIMode = 'street';
  private previousMode: GameUIMode = 'street';
  private modalStack: string[] = [];
  private registeredModals: Map<string, ModalInstance> = new Map();
  private modeListeners: Array<(mode: GameUIMode, prevMode: GameUIMode) => void> = [];

  // Track state flags for layout adaptation
  public isPhoneOpen: boolean = false;
  public isCardOpen: boolean = false;
  public isTouchDevice: boolean = false;

  private constructor() {
    this.isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    // Global Escape key listener to pop modal stack cleanly
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.modalStack.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          this.popTopModal();
        }
      }
    });

    // Handle viewport resize adaptations
    window.addEventListener('resize', () => {
      this.applyLayoutRules();
    });
  }

  public static getInstance(): UIStateManager {
    if (!UIStateManager.instance) {
      UIStateManager.instance = new UIStateManager();
    }
    return UIStateManager.instance;
  }

  // =========================================================================
  // 1. GAME MODE SYSTEM
  // =========================================================================

  public setMode(newMode: GameUIMode): void {
    if (this.currentMode === newMode && newMode !== 'modal') return;

    const prev = this.currentMode;
    if (newMode !== 'modal') {
      this.previousMode = newMode;
    }
    this.currentMode = newMode;

    document.body.setAttribute('data-ui-mode', this.currentMode);

    this.applyLayoutRules();

    this.modeListeners.forEach((listener) => {
      try {
        listener(newMode, prev);
      } catch (err) {
        console.error('[UIStateManager] Mode listener error:', err);
      }
    });
  }

  public getMode(): GameUIMode {
    return this.currentMode;
  }

  public isMode(mode: GameUIMode): boolean {
    return this.currentMode === mode;
  }

  public onModeChange(listener: (mode: GameUIMode, prevMode: GameUIMode) => void): () => void {
    this.modeListeners.push(listener);
    return () => {
      this.modeListeners = this.modeListeners.filter((l) => l !== listener);
    };
  }

  // =========================================================================
  // 2. CENTRALIZED MODAL STACK SYSTEM
  // =========================================================================

  public registerModal(id: string, instance: ModalInstance): void {
    this.registeredModals.set(id, instance);
  }

  public pushModal(id: string): void {
    // Remove if already in stack so it moves to top
    this.modalStack = this.modalStack.filter((m) => m !== id);
    this.modalStack.push(id);

    if (id === 'phone') {
      this.isPhoneOpen = true;
    }

    this.updateModalClasses();
  }

  public popModal(id?: string): void {
    if (id) {
      this.modalStack = this.modalStack.filter((m) => m !== id);
      if (id === 'phone') {
        this.isPhoneOpen = false;
      }
    } else {
      const popped = this.modalStack.pop();
      if (popped === 'phone') {
        this.isPhoneOpen = false;
      }
    }

    this.updateModalClasses();
  }

  public popTopModal(): boolean {
    if (this.modalStack.length === 0) return false;
    const topId = this.modalStack[this.modalStack.length - 1];
    const registered = this.registeredModals.get(topId);
    if (registered) {
      registered.close();
    } else {
      this.popModal(topId);
    }
    return true;
  }

  public isAnyModalOpen(): boolean {
    return this.modalStack.length > 0;
  }

  public getTopModal(): string | null {
    return this.modalStack.length > 0 ? this.modalStack[this.modalStack.length - 1] : null;
  }

  public closeAllModals(): void {
    while (this.modalStack.length > 0) {
      const id = this.modalStack.pop();
      if (id) {
        const modal = this.registeredModals.get(id);
        modal?.close();
      }
    }
    this.isPhoneOpen = false;
    this.updateModalClasses();
  }

  private updateModalClasses(): void {
    const hasModals = this.modalStack.length > 0;
    if (hasModals) {
      document.body.classList.add('ui-modal-open');
      if (this.currentMode !== 'modal') {
        this.setMode('modal');
      }
    } else {
      document.body.classList.remove('ui-modal-open');
      if (this.currentMode === 'modal') {
        this.setMode(this.previousMode || 'street');
      }
    }
    this.applyLayoutRules();
  }

  // =========================================================================
  // 3. ZONE EXCLUSIVITY & LAYOUT ADAPTATION
  // =========================================================================

  public setCardOpen(isOpen: boolean): void {
    this.isCardOpen = isOpen;
    this.applyLayoutRules();
  }

  public applyLayoutRules(): void {
    const mode = this.currentMode;

    // 1. Bottom-Center exclusive priority & Zone Management
    const radarBar = document.getElementById('street-radar-bar');
    const emoteBar = document.querySelector('.emote-bar') as HTMLElement | null;
    const masterNav = document.querySelector('.bottom-master-nav') as HTMLElement | null;
    const drivingHud = document.getElementById('driving-hud');
    const proxPrompt = document.getElementById('hud-proximity-prompt');
    const houseToolbar = document.getElementById('house-decor-bar');
    const houseCatalogueBtn = document.querySelector('.house-catalogue-btn') as HTMLElement | null;
    const cameraWidget = document.getElementById('camera-rotate-widget');
    const interactionCard = document.getElementById('interaction-card');
    const hudOverlay = document.getElementById('hud-overlay');

    if (mode === 'driving') {
      if (hudOverlay) hudOverlay.style.display = 'flex';
      if (radarBar) radarBar.style.display = 'none';
      if (emoteBar) emoteBar.style.display = 'none';
      if (masterNav) masterNav.style.display = 'none';
      if (houseToolbar) houseToolbar.style.display = 'none';
      if (houseCatalogueBtn) houseCatalogueBtn.style.display = 'none';
      if (drivingHud) drivingHud.style.display = 'flex';
      if (proxPrompt) proxPrompt.style.display = 'none';
      if (cameraWidget) cameraWidget.style.display = 'none';
    } else if (mode === 'world-map') {
      if (hudOverlay) hudOverlay.style.display = 'none';
      if (radarBar) radarBar.style.display = 'none';
      if (emoteBar) emoteBar.style.display = 'none';
      if (masterNav) masterNav.style.display = 'none';
      if (drivingHud) drivingHud.style.display = 'none';
      if (proxPrompt) proxPrompt.style.display = 'none';
      if (houseToolbar) houseToolbar.style.display = 'none';
      if (houseCatalogueBtn) houseCatalogueBtn.style.display = 'none';
      if (cameraWidget) cameraWidget.style.display = 'none';
      if (interactionCard) interactionCard.style.display = 'none';
    } else if (mode === 'transit') {
      if (hudOverlay) hudOverlay.style.display = 'none';
      if (radarBar) radarBar.style.display = 'none';
      if (emoteBar) emoteBar.style.display = 'none';
      if (masterNav) masterNav.style.display = 'none';
      if (drivingHud) drivingHud.style.display = 'none';
      if (proxPrompt) proxPrompt.style.display = 'none';
      if (houseToolbar) houseToolbar.style.display = 'none';
      if (houseCatalogueBtn) houseCatalogueBtn.style.display = 'none';
      if (cameraWidget) cameraWidget.style.display = 'none';
      if (interactionCard) interactionCard.style.display = 'none';
    } else if (mode === 'interior') {
      if (hudOverlay) hudOverlay.style.display = 'flex';
      if (radarBar) radarBar.style.display = 'none';
      if (emoteBar) emoteBar.style.display = 'none';
      if (drivingHud) drivingHud.style.display = 'none';
      if (houseToolbar) houseToolbar.style.display = 'none';
      if (houseCatalogueBtn) houseCatalogueBtn.style.display = 'none';
      if (masterNav) masterNav.style.display = 'flex';
      if (cameraWidget) cameraWidget.style.display = 'flex';
    } else if (mode === 'house') {
      if (hudOverlay) hudOverlay.style.display = 'flex';
      if (radarBar) radarBar.style.display = 'none';
      if (emoteBar) emoteBar.style.display = 'none';
      if (drivingHud) drivingHud.style.display = 'none';
      if (masterNav) masterNav.style.display = 'flex';
      if (houseToolbar) houseToolbar.style.display = 'flex';
      if (houseCatalogueBtn) houseCatalogueBtn.style.display = 'flex';
      if (cameraWidget) cameraWidget.style.display = 'flex';
    } else if (mode === 'street') {
      if (hudOverlay) hudOverlay.style.display = 'flex';
      if (drivingHud) drivingHud.style.display = 'none';
      if (houseToolbar) houseToolbar.style.display = 'none';
      if (houseCatalogueBtn) houseCatalogueBtn.style.display = 'none';
      if (masterNav) masterNav.style.display = 'flex';
      if (emoteBar) emoteBar.style.display = 'flex';
      if (cameraWidget) cameraWidget.style.display = 'flex';
      if (radarBar) radarBar.style.display = 'flex';
    }

    // 2. Interaction Card placement adaptation
    if (interactionCard) {
      if (this.isPhoneOpen || this.isTouchDevice) {
        // Phone or touch active; dock card cleanly to center-right panel
        interactionCard.classList.add('card-dock-center-right');
      } else {
        interactionCard.classList.remove('card-dock-center-right');
      }
    }

    // 3. Chat Box collision protection on mobile touch devices
    const chatBox = document.getElementById('street-chat-box');
    if (chatBox) {
      if (this.isTouchDevice) {
        chatBox.classList.add('chat-mobile-adapted');
      } else {
        chatBox.classList.remove('chat-mobile-adapted');
      }
    }
  }
}
