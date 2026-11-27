/**
 * Shared open-air park atmosphere: lawn horizon skirts past the plot rails, distant tree
 * fringe and sky band (no grey void), walking visitors, and soft crowd / highlife ambience.
 * Geometry and materials are shared; no per-frame allocations.
 */
import * as THREE from 'three';
import { SoundEngine } from '../../audio/SoundEngine';

const LAWN_APRON_R = 190;
const CITY_FRINGE_R = 220;
const SKY_BAND_R = 230;

const LAWN_MAT = new THREE.MeshStandardMaterial({
  color: 0x4d7c0f,
  roughness: 0.95,
  metalness: 0.02,
});
const LAWN_FAR_MAT = new THREE.MeshBasicMaterial({ color: 0x3f6212 });
const PATH_MAT = new THREE.MeshStandardMaterial({
  color: 0xa8a29e,
  roughness: 0.9,
  metalness: 0.04,
});
const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.85 });
const CANOPY_MAT = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });
const CANOPY_ALT_MAT = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });
const STONE_MAT = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.88 });
const SKY_BAND_MAT = new THREE.MeshBasicMaterial({
  color: 0x87c5e8,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
  depthWrite: false,
});
/** Soft distant city / building tips on the horizon (Lagos Island feel) */
const CITY_MAT = new THREE.MeshBasicMaterial({ color: 0x64748b });

const BODY_GEO = new THREE.CapsuleGeometry(0.22, 0.55, 4, 8);
const HEAD_GEO = new THREE.SphereGeometry(0.18, 8, 6);
const LEG_GEO = new THREE.BoxGeometry(0.12, 0.9, 0.12);
const TRUNK_GEO = new THREE.CylinderGeometry(0.18, 0.28, 3.4, 6);
const CANOPY_GEO = new THREE.SphereGeometry(1.7, 8, 6);
const CANOPY_SMALL_GEO = new THREE.SphereGeometry(1.15, 7, 5);

type ParkLife = {
  walkers: Array<{
    group: THREE.Group;
    t: number;
    speed: number;
    points: Array<[number, number]>;
    legL: THREE.Object3D;
    legR: THREE.Object3D;
  }>;
  canopyPulse: THREE.Mesh[];
  ambienceOn: boolean;
};

let activeLife: ParkLife | null = null;
let ambienceGain: GainNode | null = null;
let ambienceSources: AudioNode[] = [];

function makePerson(outfit: number, skin = 0x8d5524): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.7 }));
  body.position.y = 0.85;
  const head = new THREE.Mesh(HEAD_GEO, new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 }));
  head.position.y = 1.45;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const legL = new THREE.Mesh(LEG_GEO, legMat);
  legL.position.set(-0.12, 0.45, 0);
  legL.scale.set(0.9, 0.55, 0.9);
  const legR = legL.clone();
  legR.position.x = 0.12;
  g.add(body, head, legL, legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

function makeTree(x: number, z: number, scale = 1, alt = false): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(TRUNK_GEO, TRUNK_MAT);
  trunk.position.y = 1.7 * scale;
  trunk.scale.setScalar(scale);
  const canopy = new THREE.Mesh(scale > 0.85 ? CANOPY_GEO : CANOPY_SMALL_GEO, alt ? CANOPY_ALT_MAT : CANOPY_MAT);
  canopy.position.y = 3.5 * scale;
  canopy.scale.setScalar(scale);
  g.add(trunk, canopy);
  g.position.set(x, 0, z);
  g.userData.canopy = canopy;
  return g;
}

function startParkAmbience(): void {
  const engine = SoundEngine.getInstance();
  const audio = engine.audio();
  const ctx = audio?.ctx ?? null;
  const master = audio?.master ?? null;
  if (!ctx || !master || engine.isMuted) return;
  stopParkAmbience();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  ambienceGain = gain;

  // Crowd murmur — soft noise bed
  const crowdBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const cd = crowdBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < cd.length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.985 + white * 0.015;
    cd[i] = last;
  }
  const crowdSrc = ctx.createBufferSource();
  crowdSrc.buffer = crowdBuf;
  crowdSrc.loop = true;
  const crowdFilter = ctx.createBiquadFilter();
  crowdFilter.type = 'bandpass';
  crowdFilter.frequency.value = 480;
  crowdFilter.Q.value = 0.75;
  const crowdGain = ctx.createGain();
  crowdGain.gain.value = 0.11;
  crowdSrc.connect(crowdFilter);
  crowdFilter.connect(crowdGain);
  crowdGain.connect(gain);
  crowdSrc.start();

  // Distant highlife / stage bed — two soft detuned tones with slow LFO
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.035;
  toneGain.connect(gain);
  const freqs = [196, 247, 294];
  const oscNodes: AudioNode[] = [];
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const og = ctx.createGain();
    og.gain.value = 0.22;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08 + Math.random() * 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain);
    lfoGain.connect(og.gain);
    osc.connect(og);
    og.connect(toneGain);
    osc.start();
    lfo.start();
    oscNodes.push(osc, og, lfo, lfoGain);
  }

  // Soft birds / leaf rustle — brighter noise whisper
  const leafBuf = ctx.createBuffer(1, ctx.sampleRate * 2.5, ctx.sampleRate);
  const ld = leafBuf.getChannelData(0);
  last = 0;
  for (let i = 0; i < ld.length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.92 + white * 0.08;
    ld[i] = last * (0.4 + 0.6 * Math.sin(i * 0.001));
  }
  const leafSrc = ctx.createBufferSource();
  leafSrc.buffer = leafBuf;
  leafSrc.loop = true;
  const leafFilter = ctx.createBiquadFilter();
  leafFilter.type = 'highpass';
  leafFilter.frequency.value = 1200;
  const leafGain = ctx.createGain();
  leafGain.gain.value = 0.04;
  leafSrc.connect(leafFilter);
  leafFilter.connect(leafGain);
  leafGain.connect(gain);
  leafSrc.start();

  ambienceSources = [crowdSrc, crowdFilter, crowdGain, toneGain, leafSrc, leafFilter, leafGain, ...oscNodes];
  gain.gain.setTargetAtTime(1, ctx.currentTime, 0.9);
}

function stopParkAmbience(): void {
  if (ambienceGain) {
    try {
      ambienceGain.gain.setTargetAtTime(0, ambienceGain.context.currentTime, 0.3);
    } catch { /* already closed */ }
    const g = ambienceGain;
    setTimeout(() => {
      try { g.disconnect(); } catch { /* ok */ }
    }, 600);
  }
  for (const node of ambienceSources) {
    try {
      if ('stop' in node && typeof (node as AudioBufferSourceNode).stop === 'function') {
        (node as AudioBufferSourceNode).stop();
      }
      node.disconnect();
    } catch { /* ok */ }
  }
  ambienceSources = [];
  ambienceGain = null;
}

/**
 * Attach lawn horizon skirts, fringe trees, path apron beyond rails, and park life.
 * Call from an open-air venue builder with the room group.
 */
export function attachOpenAirPark(group: THREE.Group, length: number, width = 40): void {
  const halfL = length / 2;
  const halfW = width / 2;

  // --- Horizon skirts: kill the grey void past the finite plot ---
  const skirts = new THREE.Group();
  skirts.name = 'open_air_park_skirts';

  // Wide lawn disc under and past the plot on every side
  const apron = new THREE.Mesh(new THREE.CircleGeometry(LAWN_APRON_R, 56), LAWN_MAT);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -0.1, 0);
  apron.receiveShadow = true;
  skirts.add(apron);

  // Farther green ring so edges never drop into void
  const farLawn = new THREE.Mesh(new THREE.CircleGeometry(CITY_FRINGE_R, 48), LAWN_FAR_MAT);
  farLawn.rotation.x = -Math.PI / 2;
  farLawn.position.set(0, -0.16, 0);
  skirts.add(farLawn);

  // Soft sky band
  const skyBand = new THREE.Mesh(new THREE.CylinderGeometry(SKY_BAND_R, SKY_BAND_R, 52, 48, 1, true), SKY_BAND_MAT);
  skyBand.position.set(0, 20, 0);
  skirts.add(skyBand);

  // Distant Lagos Island city tips on the far ring (colonial-prison → arts park still sits in the city)
  const city = new THREE.Group();
  city.name = 'open_air_park_city_fringe';
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.1;
    const r = 165 + (i % 5) * 6;
    const h = 4 + (i % 7) * 1.8 + (i % 3) * 0.6;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2 + (i % 3) * 0.8, h, 2.2), CITY_MAT);
    box.position.set(Math.sin(a) * r, h / 2 - 0.05, Math.cos(a) * r);
    city.add(box);
  }
  skirts.add(city);

  group.add(skirts);

  // Path apron strips past the plot rails so gravel continues into the lawn
  const pathPast = new THREE.Group();
  pathPast.name = 'open_air_park_path_apron';
  const longPath = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, length + 28), PATH_MAT);
  longPath.position.set(0, -0.02, 2);
  pathPast.add(longPath);
  const crossPath = new THREE.Mesh(new THREE.BoxGeometry(width + 24, 0.04, 3.4), PATH_MAT);
  crossPath.position.set(0, -0.02, 10);
  pathPast.add(crossPath);
  group.add(pathPast);

  // Soft invisible back rail (parks are enclosed; beaches leave the waterline open)
  const railMat = new THREE.MeshBasicMaterial({ visible: false });
  const backRail = new THREE.Mesh(new THREE.BoxGeometry(width + 1, 1.2, 0.5), railMat);
  backRail.name = 'open_air_rail';
  backRail.position.set(0, 0.6, -halfL - 0.25);
  group.add(backRail);

  // Remnant stone plinths / memorial stubs past the prison wall line (heritage feel beyond the plot)
  for (let i = 0; i < 5; i++) {
    const stub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7 + (i % 2) * 0.4, 0.7), STONE_MAT);
    stub.position.set(-14 + i * 7, 0.35, -halfL - 6 - (i % 3));
    group.add(stub);
  }

  // Fringe trees past the rails — dense enough that the horizon reads as park, not void
  const fringe = new THREE.Group();
  fringe.name = 'open_air_park_fringe_trees';
  const canopyPulse: THREE.Mesh[] = [];
  const treeSpots: Array<[number, number, number, boolean]> = [
    // Behind stage / prison wall
    [-22, -halfL - 4, 1.05, false], [-14, -halfL - 8, 0.95, true], [-6, -halfL - 5, 1.15, false],
    [4, -halfL - 9, 1.0, true], [12, -halfL - 4, 1.1, false], [20, -halfL - 7, 0.9, true],
    // Sides
    [-halfW - 5, -10, 1.0, false], [-halfW - 8, 0, 1.15, true], [-halfW - 4, 10, 0.95, false],
    [-halfW - 10, 16, 1.05, true], [halfW + 5, -8, 1.1, true], [halfW + 9, 2, 0.95, false],
    [halfW + 4, 12, 1.15, true], [halfW + 8, -14, 1.0, false],
    // Toward entrance / street side
    [-18, halfL + 4, 1.0, true], [-8, halfL + 7, 1.1, false], [6, halfL + 5, 0.95, true],
    [16, halfL + 8, 1.05, false], [-24, halfL - 2, 0.9, false], [24, halfL - 4, 1.0, true],
    // Outer ring
    [-30, -2, 1.2, true], [30, 4, 1.15, false], [-28, 14, 1.0, false], [28, -12, 1.05, true],
    [0, -halfL - 14, 1.25, false], [-16, 22, 1.0, true], [14, 22, 1.1, false],
  ];
  for (const [x, z, s, alt] of treeSpots) {
    const tree = makeTree(x, z, s, alt);
    fringe.add(tree);
    const canopy = tree.userData.canopy as THREE.Mesh | undefined;
    if (canopy) canopyPulse.push(canopy);
  }
  group.add(fringe);

  // Walkers on the lawns and paths (crowd life)
  const walkers: ParkLife['walkers'] = [];
  const routes: Array<{ outfit: number; points: Array<[number, number]> }> = [
    { outfit: 0x2563eb, points: [[-8, 12], [-4, 8], [2, 12], [-2, 14], [-8, 12]] },
    { outfit: 0xdb2777, points: [[10, 6], [14, 2], [12, -2], [8, 4], [10, 6]] },
    { outfit: 0xf97316, points: [[-12, -2], [-10, -6], [-6, -4], [-14, 2], [-12, -2]] },
    { outfit: 0xf8fafc, points: [[4, -6], [0, -8], [-4, -6], [2, -4], [4, -6]] },
    { outfit: 0x16a34a, points: [[-6, 4], [0, 6], [6, 4], [2, 0], [-6, 4]] },
    { outfit: 0x7c3aed, points: [[8, 12], [4, 14], [0, 10], [6, 8], [8, 12]] },
    { outfit: 0x0ea5e9, points: [[-14, 8], [-16, 4], [-12, 0], [-10, 6], [-14, 8]] },
    { outfit: 0xfacc15, points: [[14, -8], [10, -10], [6, -8], [12, -6], [14, -8]] },
  ];
  for (const route of routes) {
    const person = makePerson(route.outfit);
    person.position.set(route.points[0][0], 0, route.points[0][1]);
    group.add(person);
    walkers.push({
      group: person,
      t: Math.random() * 3,
      speed: 0.1 + Math.random() * 0.07,
      points: route.points,
      legL: person.userData.legL as THREE.Object3D,
      legR: person.userData.legR as THREE.Object3D,
    });
  }

  const life: ParkLife = { walkers, canopyPulse, ambienceOn: false };
  activeLife = life;
  group.userData.parkLife = life;
  group.userData.parkHorizon = true;
}

/** Re-bind park life + ambience after a revisit (build only runs once). */
export function resumeOpenAirPark(group: THREE.Group): void {
  const life = group.userData.parkLife as ParkLife | undefined;
  if (!life) return;
  activeLife = life;
  life.ambienceOn = false;
}

/** Advance park walkers and canopy sway. Call once per frame while an open-air park is active. */
export function tickOpenAirPark(dt: number): void {
  const life = activeLife;
  if (!life) return;

  if (!life.ambienceOn) {
    startParkAmbience();
    life.ambienceOn = true;
  }

  const t = performance.now() * 0.001;
  for (let i = 0; i < life.canopyPulse.length; i++) {
    const c = life.canopyPulse[i];
    const s = 1 + Math.sin(t * 0.7 + i * 0.55) * 0.02;
    c.scale.setScalar(s);
  }

  for (const v of life.walkers) {
    v.t += dt * v.speed;
    const segs = v.points.length - 1;
    const total = Math.max(1, segs);
    const wrapped = ((v.t % total) + total) % total;
    const i = Math.floor(wrapped);
    const f = wrapped - i;
    const a = v.points[i];
    const b = v.points[Math.min(i + 1, v.points.length - 1)];
    const x = a[0] + (b[0] - a[0]) * f;
    const z = a[1] + (b[1] - a[1]) * f;
    v.group.position.set(x, 0, z);
    v.group.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const swing = Math.sin(t * 7 + i) * 0.55;
    v.legL.rotation.x = swing;
    v.legR.rotation.x = -swing;
  }
}

/** Stop park ambience when leaving (safe to call anytime). */
export function releaseOpenAirPark(): void {
  stopParkAmbience();
  if (activeLife) activeLife.ambienceOn = false;
  activeLife = null;
}
