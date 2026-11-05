/**
 * Skill on the job: while each part of a shift is being acted out, a bar sweeps across the
 * screen and the worker taps (or presses space) as the marker passes through the green. A good
 * tap is a job done well. At the end the shift is rated in stars, and the one in charge tips
 * for two or three of them. Not tapping at all is simply the ordinary pay: nothing is lost.
 */

const CSS = `
#shift-skill{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 150px);transform:translateX(-50%);z-index:8200;width:min(330px,86vw);padding:10px 12px 12px;border-radius:18px;background:rgba(10,14,24,.88);border:1px solid rgba(253,224,71,.45);box-shadow:0 10px 28px rgba(0,0,0,.45);color:#f8fafc;font-family:var(--nl-font,'Outfit',sans-serif);display:none;touch-action:manipulation;user-select:none}
#shift-skill.on{display:block;animation:ss-in .2s ease-out}
@keyframes ss-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
#shift-skill .ss-top{display:flex;justify-content:space-between;font-size:12px;font-weight:800;margin-bottom:7px}
#shift-skill .ss-bar{position:relative;height:26px;border-radius:99px;background:linear-gradient(90deg,#7f1d1d,#b45309 30%,#b45309 70%,#7f1d1d);overflow:hidden}
#shift-skill .ss-zone{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,#16a34a,#4ade80,#16a34a);border-left:2px solid #dcfce7;border-right:2px solid #dcfce7}
#shift-skill .ss-mark{position:absolute;top:-3px;bottom:-3px;width:6px;margin-left:-3px;border-radius:4px;background:#fff;box-shadow:0 0 10px #fff}
#shift-skill .ss-tap{display:block;width:100%;margin-top:8px;padding:10px;border:0;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#1c1917;font-weight:900;font-size:15px}
#shift-skill .ss-hit{position:absolute;left:0;right:0;top:-26px;text-align:center;font-weight:900;font-size:18px;text-shadow:0 2px 6px #000;pointer-events:none}
`;

export interface SkillResult { stars: 1 | 2 | 3; score: number; tip: number }

export class ShiftSkill {
  private static instance: ShiftSkill | null = null;
  private readonly el: HTMLDivElement;
  private zone = { from: 0.4, to: 0.62 };
  private pos = 0;
  private dir = 1;
  private speed = 1.1;
  private raf = 0;
  private last = 0;
  private open = false;
  private tapped: number | null = null;
  private scores: number[] = [];
  private label = 'Tap in the green!';
  private rounds = 0;

  public static get(): ShiftSkill {
    if (!ShiftSkill.instance) ShiftSkill.instance = new ShiftSkill();
    return ShiftSkill.instance;
  }

  private constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.el = document.createElement('div');
    this.el.id = 'shift-skill';
    document.body.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.tap(); });
    window.addEventListener('keydown', (e) => {
      if (!this.open || e.code !== 'Space') return;
      e.preventDefault();
      this.tap();
    });
  }

  /** A shift begins: `label` is what a good tap does ("Lift!", "Serve!") */
  public begin(label: string, rounds: number): void {
    this.scores = [];
    this.label = label;
    this.rounds = rounds;
  }

  /** One part of the shift is being done now: the bar sweeps until `round.end()` */
  public round(): { end(): void } {
    this.tapped = null;
    const width = 0.2 + Math.random() * 0.06;
    const from = 0.15 + Math.random() * (0.7 - width);
    this.zone = { from, to: from + width };
    this.pos = Math.random() < 0.5 ? 0 : 1;
    this.dir = this.pos === 0 ? 1 : -1;
    this.speed = 0.9 + Math.random() * 0.5;
    this.open = true;
    this.draw('');
    this.el.classList.add('on');
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    const tick = (now: number) => {
      if (!this.open) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.tapped === null) {
        this.pos += this.dir * this.speed * dt;
        if (this.pos > 1) { this.pos = 1; this.dir = -1; }
        if (this.pos < 0) { this.pos = 0; this.dir = 1; }
        const mark = this.el.querySelector<HTMLElement>('.ss-mark');
        if (mark) mark.style.left = `${this.pos * 100}%`;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    return {
      end: () => {
        this.scores.push(this.tapped ?? 0);
        this.open = false;
        cancelAnimationFrame(this.raf);
        setTimeout(() => { if (!this.open) this.el.classList.remove('on'); }, 350);
      },
    };
  }

  private tap(): void {
    if (!this.open || this.tapped !== null) return;
    const mid = (this.zone.from + this.zone.to) / 2;
    const half = (this.zone.to - this.zone.from) / 2;
    const off = Math.abs(this.pos - mid);
    this.tapped = off <= half ? 1 - (off / half) * 0.35 : Math.max(0, 0.4 - (off - half) * 2);
    this.draw(this.tapped >= 0.9 ? '🔥 PERFECT!' : this.tapped >= 0.65 ? '👍 Good' : this.tapped > 0 ? '😬 Close' : '❌ Missed');
  }

  /** Tests and keyboard users: a tap as if it were exactly in the middle of the green */
  public tapPerfect(): void {
    if (!this.open || this.tapped !== null) return;
    this.pos = (this.zone.from + this.zone.to) / 2;
    this.tap();
  }

  public get showing(): boolean {
    return this.open;
  }

  private draw(hit: string): void {
    const n = this.scores.length + 1;
    this.el.innerHTML = `
      <div class="ss-top"><span>⚡ ${this.label}</span><span>${n}/${this.rounds}</span></div>
      <div class="ss-bar">${hit ? `<div class="ss-hit">${hit}</div>` : ''}<div class="ss-zone" style="left:${this.zone.from * 100}%;width:${(this.zone.to - this.zone.from) * 100}%"></div><div class="ss-mark" style="left:${this.pos * 100}%"></div></div>
      <button class="ss-tap" type="button">TAP (space)</button>`;
  }

  /** The shift is over: its stars, and the tip they earn on this pay */
  public finish(pay: number): SkillResult {
    const score = this.scores.length ? this.scores.reduce((a, b) => a + b, 0) / this.scores.length : 0;
    const stars: 1 | 2 | 3 = score >= 0.82 ? 3 : score >= 0.55 ? 2 : 1;
    const tip = Math.round((pay * (stars === 3 ? 0.3 : stars === 2 ? 0.15 : 0)) / 50) * 50;
    this.open = false;
    this.el.classList.remove('on');
    return { stars, score, tip };
  }
}
