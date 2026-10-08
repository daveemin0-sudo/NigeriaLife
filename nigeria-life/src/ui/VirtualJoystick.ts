/**
 * Virtual Joystick and Mobile Action Controls for NigeriaLife.
 * Provides console-quality dual-thumb mobile controls:
 * 1. Left thumb dynamic analog joystick for 360-degree walking and steering
 * 2. Right thumb circular action cluster:
 *    - ⚡ Sprint (Shift toggle)
 *    - ✋ Interact / Talk (E key)
 *    - 🚗 Enter/Exit Vehicle (F key)
 *    - 📢 Horn / Honk (H key)
 * 3. Responsive auto-detection for mobile/touch screens or manual toggle
 */

export class VirtualJoystick {
  private container: HTMLDivElement;
  private joystickBase: HTMLDivElement;
  private joystickThumb: HTMLDivElement;
  private actionsCluster: HTMLDivElement;

  private activeTouchId: number | null = null;
  private baseCenter = { x: 0, y: 0 };
  private maxRadius = 46; // Max thumbpad deflection in pixels

  // Simulated keys emitted to InputManager
  public activeKeys: Record<string, boolean> = {
    w: false,
    s: false,
    a: false,
    d: false,
    shift: false,
  };

  public isVisible: boolean = false;
  public onInteract?: () => void;
  public onToggleVehicle?: () => void;
  public onHonk?: () => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'virtual-mobile-controls';
    this.container.className = 'mobile-controls-hidden';

    // 1. Joystick Base & Nub
    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'v-joystick-base';

    this.joystickThumb = document.createElement('div');
    this.joystickThumb.className = 'v-joystick-thumb';
    this.joystickBase.appendChild(this.joystickThumb);

    this.container.appendChild(this.joystickBase);

    // 2. Action Buttons Cluster
    this.actionsCluster = document.createElement('div');
    this.actionsCluster.className = 'v-actions-cluster';
    this.actionsCluster.innerHTML = `
      <button class="v-action-btn btn-sprint" id="v-btn-sprint" title="Sprint (Hold/Toggle)">⚡</button>
      <button class="v-action-btn btn-interact" id="v-btn-interact" title="Interact / Talk (E)">✋</button>
      <button class="v-action-btn btn-vehicle" id="v-btn-vehicle" title="Enter / Exit Vehicle (F)">🚗</button>
      <button class="v-action-btn btn-horn" id="v-btn-horn" title="Honk Horn (H)">📢</button>
    `;
    this.container.appendChild(this.actionsCluster);

    document.body.appendChild(this.container);

    this.setupTouchListeners();
    this.setupButtonListeners();

    // Auto-enable if touch screen detected
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    if (isTouchDevice) {
      this.show();
    }
  }

  public show(): void {
    this.isVisible = true;
    this.container.className = 'mobile-controls-active';
  }

  public hide(): void {
    this.isVisible = false;
    this.container.className = 'mobile-controls-hidden';
    this.resetJoystick();
  }

  public toggle(): boolean {
    if (this.isVisible) this.hide();
    else this.show();
    return this.isVisible;
  }

  private resetJoystick(): void {
    this.activeTouchId = null;
    this.joystickThumb.style.transform = `translate(0px, 0px)`;
    this.activeKeys['w'] = false;
    this.activeKeys['s'] = false;
    this.activeKeys['a'] = false;
    this.activeKeys['d'] = false;
  }

  private setupTouchListeners(): void {
    // Touch start on joystick zone
    this.joystickBase.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (this.activeTouchId === null && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          this.activeTouchId = t.identifier;
          const rect = this.joystickBase.getBoundingClientRect();
          this.baseCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          this.updateJoystickPosition(t.clientX, t.clientY);
        }
      },
      { passive: false }
    );

    // Touch move
    window.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (this.activeTouchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.activeTouchId) {
            this.updateJoystickPosition(t.clientX, t.clientY);
            break;
          }
        }
      },
      { passive: false }
    );

    // Touch end & cancel
    const handleTouchEnd = (e: TouchEvent) => {
      if (this.activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === this.activeTouchId) {
          this.resetJoystick();
          break;
        }
      }
    };

    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  }

  private updateJoystickPosition(clientX: number, clientY: number): void {
    const dx = clientX - this.baseCenter.x;
    const dy = clientY - this.baseCenter.y;
    const distance = Math.hypot(dx, dy);

    const clampedDist = Math.min(this.maxRadius, distance);
    const angle = Math.atan2(dy, dx);

    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    this.joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

    // Deadzone threshold (12% of max radius)
    const deadzone = this.maxRadius * 0.18;
    if (distance < deadzone) {
      this.activeKeys['w'] = false;
      this.activeKeys['s'] = false;
      this.activeKeys['a'] = false;
      this.activeKeys['d'] = false;
      return;
    }

    // Directional thresholds
    const normX = thumbX / this.maxRadius;
    const normY = thumbY / this.maxRadius;

    this.activeKeys['w'] = normY < -0.3;
    this.activeKeys['s'] = normY > 0.3;
    this.activeKeys['a'] = normX < -0.3;
    this.activeKeys['d'] = normX > 0.3;
  }

  private setupButtonListeners(): void {
    // 1. Sprint Button (Tap to toggle or hold)
    const sprintBtn = document.getElementById('v-btn-sprint');
    if (sprintBtn) {
      sprintBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.activeKeys['shift'] = !this.activeKeys['shift'];
        sprintBtn.classList.toggle('active', this.activeKeys['shift']);
      });
    }

    // 2. Interact Button
    const interactBtn = document.getElementById('v-btn-interact');
    if (interactBtn) {
      interactBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.onInteract?.();
      });
    }

    // 3. Vehicle Toggle Button
    const vehBtn = document.getElementById('v-btn-vehicle');
    if (vehBtn) {
      vehBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.onToggleVehicle?.();
      });
    }

    // 4. Horn Button
    const hornBtn = document.getElementById('v-btn-horn');
    if (hornBtn) {
      hornBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.onHonk?.();
      });
    }
  }
}
