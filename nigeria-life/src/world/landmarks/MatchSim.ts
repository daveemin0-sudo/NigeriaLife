/**
 * A football match, as something to watch.
 *
 * Twenty-two players hold their shape, the nearest one chases the ball, passes go between
 * team-mates, shots are taken near goal and some go in. It is a show, not a game anyone
 * plays: nothing here can be controlled, and it should never be described as a playable
 * football simulation. The stadium draws it in the round; a television can draw the same
 * match flat (see `drawBroadcast`).
 *
 * The pitch runs along x. Team 0 attacks toward +x, team 1 toward -x. Positions are in
 * metres from the centre spot.
 */

export interface MatchPlayer {
  team: 0 | 1;
  x: number;
  z: number;
  /** Where they stand when nothing is happening */
  homeX: number;
  homeZ: number;
  keeper: boolean;
}

const FORMATION: Array<[number, number, boolean?]> = [
  [-0.94, 0, true],
  [-0.62, -0.62], [-0.66, -0.2], [-0.66, 0.2], [-0.62, 0.62],
  [-0.3, -0.4], [-0.34, 0], [-0.3, 0.4],
  [-0.02, -0.5], [0.06, 0], [-0.02, 0.5],
];

/** Game minutes in a match, and how many real seconds one takes to play out */
const MATCH_MINUTES = 90;
export const MATCH_SECONDS = 240;
const BREAK_SECONDS = 20;
/** How often a shot on target is kept out */
const SAVED = 0.84;
/** The fixed step a match is played in when it has to come out the same every time (a league match) */
export const MATCH_STEP = 0.1;

export class MatchSim {
  public readonly halfLength: number;
  public readonly halfWidth: number;
  public readonly teams: [string, string];
  public readonly players: MatchPlayer[] = [];
  public ball = { x: 0, z: 0, vx: 0, vz: 0, height: 0 };
  public score: [number, number] = [0, 0];
  /** Seconds since kick-off, real time */
  public clock = 0;
  /** Counts up for a moment after a goal: the crowd is on its feet while it is above zero */
  public celebrating = 0;
  public lastScorer: 0 | 1 | null = null;
  /** Bumped at every goal, so anything watching can tell a new one from the last */
  public goals = 0;
  public saves = 0;
  /** Which match this is, counting from the first: a ticket is for one match */
  public matchNumber = 1;
  private holder: MatchPlayer | null = null;
  private holdFor = 0;
  private seed: number;
  /** How good each side is (1 is ordinary): a better side's shots beat the keeper more often */
  private readonly strength: [number, number];
  private fixedSteps = 0;

  constructor(length = 36, width = 24, teams: [string, string] = ['Eko United', 'Rivers Stars'], seed = 7, strength: [number, number] = [1, 1]) {
    this.halfLength = length / 2;
    this.halfWidth = width / 2;
    this.teams = teams;
    this.seed = seed;
    this.strength = strength;
    for (const team of [0, 1] as const) {
      const side = team === 0 ? 1 : -1;
      for (const [fx, fz, keeper] of FORMATION) {
        const homeX = fx * this.halfLength * side;
        const homeZ = fz * this.halfWidth;
        this.players.push({ team, x: homeX, z: homeZ, homeX, homeZ, keeper: !!keeper });
      }
    }
    this.kickOff(0);
  }

  /** The same match every time: a small generator of its own, not the browser's */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  private kickOff(team: 0 | 1): void {
    for (const player of this.players) {
      player.x = player.homeX;
      player.z = player.homeZ;
    }
    this.ball = { x: 0, z: 0, vx: 0, vz: 0, height: 0 };
    this.holder = this.players.find((player) => player.team === team && !player.keeper && Math.abs(player.homeZ) < 0.1 && Math.abs(player.homeX) < this.halfLength * 0.2) ?? null;
    this.holdFor = 1.2;
  }

  /** How often a shot on target from this side is kept out: the plain rate between equals */
  private saveRate(shooting: 0 | 1): number {
    const [a, b] = this.strength;
    if (a === b) return SAVED;
    const ratio = shooting === 0 ? a / b : b / a;
    return Math.max(0.6, Math.min(0.95, 1 - (1 - SAVED) * ratio));
  }

  /** Plays on in fixed steps to this many seconds after kick-off, so the same seed always gives the same match. */
  public playTo(seconds: number): void {
    const whole = Math.round(MATCH_SECONDS / MATCH_STEP);
    const target = Math.min(whole, Math.floor(seconds / MATCH_STEP + 1e-9));
    while (this.fixedSteps < target) {
      this.update(MATCH_STEP);
      this.fixedSteps += 1;
    }
    // Counted in whole steps, so the final whistle is not missed by a rounding of the clock
    if (this.fixedSteps >= whole) this.clock = Math.max(this.clock, MATCH_SECONDS);
  }

  /** The minute on the scoreboard clock. */
  public get minute(): number {
    return Math.min(MATCH_MINUTES, Math.floor((this.clock / MATCH_SECONDS) * MATCH_MINUTES));
  }

  public get fullTime(): boolean {
    return this.clock >= MATCH_SECONDS;
  }

  public update(delta: number): void {
    const step = Math.min(delta, 0.1);
    this.clock += step;
    if (this.celebrating > 0) this.celebrating = Math.max(0, this.celebrating - step);

    if (this.clock >= MATCH_SECONDS + BREAK_SECONDS) {
      // A new match
      this.matchNumber += 1;
      this.clock = 0;
      this.score = [0, 0];
      this.lastScorer = null;
      this.kickOff(0);
      return;
    }
    if (this.fullTime) {
      // The players walk back to their places at the whistle
      for (const player of this.players) this.moveToward(player, player.homeX, player.homeZ, 3 * step);
      return;
    }

    // Players drift with the play: the team with the ball pushes up, the other drops back
    const attacking = this.holder?.team ?? (this.ball.vx > 0 ? 0 : 1);
    for (const player of this.players) {
      if (player === this.holder) continue;
      if (player.keeper) {
        this.moveToward(player, player.homeX, Math.max(-3, Math.min(3, this.ball.z * 0.4)), 4 * step);
        continue;
      }
      const forward = player.team === 0 ? 1 : -1;
      const push = (player.team === attacking ? 0.22 : -0.1) * this.halfLength * forward;
      const tx = player.homeX + push + (this.ball.x - player.homeX) * 0.25;
      const tz = player.homeZ + (this.ball.z - player.homeZ) * 0.3;
      this.moveToward(player, tx, tz, 5 * step);
    }

    if (this.holder) {
      // Whoever has it runs at goal for a moment, then passes or shoots
      const forward = this.holder.team === 0 ? 1 : -1;
      this.moveToward(this.holder, this.holder.x + forward * 4, this.holder.z * 0.9, 6 * step);
      this.ball.x = this.holder.x + forward * 0.5;
      this.ball.z = this.holder.z;
      this.ball.height = 0;
      this.holdFor -= step;
      if (this.holdFor <= 0) this.release(this.holder);
      return;
    }

    // The ball is loose or in flight
    this.ball.x += this.ball.vx * step;
    this.ball.z += this.ball.vz * step;
    this.ball.vx *= 1 - 0.5 * step;
    this.ball.vz *= 1 - 0.5 * step;
    this.ball.height = Math.max(0, this.ball.height - 3 * step);

    // In the net?
    if (Math.abs(this.ball.x) >= this.halfLength) {
      const defending: 0 | 1 = this.ball.x > 0 ? 1 : 0;
      const keeper = this.players.find((player) => player.keeper && player.team === defending)!;
      // Most shots on target are saved: the keeper gathers the ball and plays on
      if (Math.abs(this.ball.z) < 3.4 && this.random() < this.saveRate(defending === 1 ? 0 : 1)) {
        this.saves += 1;
        this.ball.x = Math.sign(this.ball.x) * (this.halfLength - 0.6);
        keeper.z = this.ball.z;
        this.holder = keeper;
        this.holdFor = 1.4;
      } else if (Math.abs(this.ball.z) < 3.4) {
        const scorer: 0 | 1 = this.ball.x > 0 ? 0 : 1;
        this.score[scorer] += 1;
        this.lastScorer = scorer;
        this.goals += 1;
        this.celebrating = 5;
        this.kickOff(scorer === 0 ? 1 : 0);
      } else {
        // Wide: a goal kick
        this.ball.x = Math.sign(this.ball.x) * (this.halfLength - 0.6);
        this.holder = keeper;
        this.holdFor = 1;
      }
      return;
    }
    if (Math.abs(this.ball.z) > this.halfWidth) {
      this.ball.z = Math.sign(this.ball.z) * this.halfWidth;
      this.ball.vz *= -0.4;
    }

    // The nearest player to a slow ball takes it
    let nearest: MatchPlayer | null = null;
    let best = Infinity;
    for (const player of this.players) {
      const distance = Math.hypot(player.x - this.ball.x, player.z - this.ball.z);
      if (distance < best) {
        best = distance;
        nearest = player;
      }
    }
    if (nearest) {
      this.moveToward(nearest, this.ball.x, this.ball.z, 8 * step);
      if (best < 0.9 && Math.hypot(this.ball.vx, this.ball.vz) < 14) {
        this.holder = nearest;
        this.holdFor = 0.6 + this.random() * 1.4;
      }
    }
  }

  private release(from: MatchPlayer): void {
    const forward = from.team === 0 ? 1 : -1;
    const goalX = forward * this.halfLength;
    const toGoal = Math.abs(goalX - from.x);
    this.holder = null;
    if (toGoal < this.halfLength * 0.5 && this.random() < 0.4) {
      // A shot: on target more often from close in
      const aim = (this.random() - 0.5) * (toGoal < 8 ? 6 : 11);
      const length = Math.hypot(goalX - from.x, aim - from.z) || 1;
      this.ball.vx = ((goalX - from.x) / length) * 24;
      this.ball.vz = ((aim - from.z) / length) * 24;
      this.ball.height = 1.2;
      return;
    }
    // A pass to a team-mate further up the pitch
    const mates = this.players.filter((player) => player.team === from.team && player !== from && !player.keeper && (player.x - from.x) * forward > -3);
    const to = mates.length ? mates[Math.floor(this.random() * mates.length)] : null;
    const tx = to ? to.x + forward * 2 : from.x + forward * 8;
    const tz = to ? to.z : from.z;
    const length = Math.hypot(tx - from.x, tz - from.z) || 1;
    const pace = 11 + this.random() * 5;
    this.ball.vx = ((tx - from.x) / length) * pace;
    this.ball.vz = ((tz - from.z) / length) * pace;
  }

  private moveToward(player: MatchPlayer, x: number, z: number, most: number): void {
    const dx = x - player.x;
    const dz = z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) return;
    const go = Math.min(distance, most);
    player.x = Math.max(-this.halfLength, Math.min(this.halfLength, player.x + (dx / distance) * go));
    player.z = Math.max(-this.halfWidth, Math.min(this.halfWidth, player.z + (dz / distance) * go));
  }

  /** The line a scoreboard shows. */
  public scoreLine(): string {
    return `${this.teams[0]} ${this.score[0]} - ${this.score[1]} ${this.teams[1]}`;
  }

  /** The same match drawn flat, as a television would show it: the pitch from above, the players, the ball and the score. */
  public drawBroadcast(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bar = Math.round(height * 0.14);
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, width, height);
    const pitchH = height - bar;
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#166534' : '#15803d';
      ctx.fillRect((i * width) / stripes, bar, width / stripes + 1, pitchH);
    }
    const px = (x: number) => ((x + this.halfLength) / (this.halfLength * 2)) * (width - 16) + 8;
    const pz = (z: number) => bar + ((z + this.halfWidth) / (this.halfWidth * 2)) * (pitchH - 12) + 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px(-this.halfLength), pz(-this.halfWidth), px(this.halfLength) - px(-this.halfLength), pz(this.halfWidth) - pz(-this.halfWidth));
    ctx.beginPath();
    ctx.moveTo(px(0), pz(-this.halfWidth));
    ctx.lineTo(px(0), pz(this.halfWidth));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px(0), pz(0), (pitchH / (this.halfWidth * 2)) * 3.2, 0, Math.PI * 2);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.strokeRect(side < 0 ? px(-this.halfLength) : px(this.halfLength - 5), pz(-6), px(-this.halfLength + 5) - px(-this.halfLength), pz(6) - pz(-6));
    }
    for (const player of this.players) {
      ctx.fillStyle = player.keeper ? '#facc15' : player.team === 0 ? '#f8fafc' : '#dc2626';
      ctx.beginPath();
      ctx.arc(px(player.x), pz(player.z), Math.max(3, height * 0.022), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(px(this.ball.x), pz(this.ball.z) - this.ball.height * 3, Math.max(2, height * 0.014), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, bar);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 ${Math.round(bar * 0.56)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(this.scoreLine(), 10, bar / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.celebrating > 0 ? '#facc15' : '#94a3b8';
    ctx.fillText(this.celebrating > 0 ? 'GOAL!' : this.fullTime ? 'FULL TIME' : `${this.minute}'`, width - 10, bar / 2);
  }
}
