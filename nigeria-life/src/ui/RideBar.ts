import type { RideService } from '../phone/services/RideService';
import { showGameToast } from './GameToast';

/** On the street while a booked ride is coming: how long, then "Get in" once it is at the kerb. */
export class RideBar {
  private readonly el: HTMLDivElement;
  private readonly text: HTMLSpanElement;
  private readonly go: HTMLButtonElement;
  private readonly cancel: HTMLButtonElement;
  private shown = '';
  private readonly rides: RideService;

  constructor(rides: RideService) {
    this.rides = rides;
    this.el = document.createElement('div');
    this.el.id = 'ride-bar';
    this.el.className = 'ride-bar';
    this.el.hidden = true;
    this.el.innerHTML = '<span class="ride-bar-text"></span><button type="button" id="ride-getin" class="ride-bar-go">Get in</button><button type="button" id="ride-bar-cancel" class="ride-bar-x" aria-label="Cancel the ride">✕</button>';
    this.text = this.el.querySelector('.ride-bar-text') as HTMLSpanElement;
    this.go = this.el.querySelector('#ride-getin') as HTMLButtonElement;
    this.cancel = this.el.querySelector('#ride-bar-cancel') as HTMLButtonElement;
    this.go.addEventListener('click', () => {
      const result = this.rides.getIn();
      if (!result.ok && result.reason) showGameToast(result.reason, 'warning', 3200);
      this.update();
    });
    this.cancel.addEventListener('click', () => {
      if (this.rides.cancel().ok) showGameToast('Ride cancelled. You were not charged.', 'info', 2600);
      this.update();
    });
    document.body.appendChild(this.el);
  }

  public update(): void {
    const ride = this.rides.ride;
    const live = ride && ride.stage !== 'on_trip' ? ride : null;
    const key = live ? `${live.stage}|${Math.ceil(live.eta)}|${live.boarding}` : '';
    if (key === this.shown) return;
    this.shown = key;
    this.el.hidden = !live;
    if (!live) return;
    const name = live.vehicle.label.replace(/\s+to\s+.*$/i, '');
    const here = live.stage === 'driver_here';
    this.text.textContent = live.boarding
      ? `${live.vehicle.icon} Getting in…`
      : here
        ? `${live.vehicle.icon} ${name} is at the kerb${live.fare > 0 ? ` · ₦${live.fare.toLocaleString()}` : ''}`
        : `${live.vehicle.icon} ${name} coming · ${Math.max(1, Math.ceil(live.eta))}s`;
    this.go.hidden = !here || live.boarding;
    this.cancel.hidden = live.boarding;
  }
}
