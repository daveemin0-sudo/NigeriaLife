/**
 * Shared open-air beach atmosphere: horizon skirts past the plot rails, animated sea with
 * foam and sky reflection, wet/dry sand, swim bobbers, horse rides along the shore, and
 * walking vendors. Geometry and materials are shared; no per-frame allocations.
 */
import * as THREE from 'three';
import { SoundEngine } from '../../audio/SoundEngine';

const SEA_W = 420;
const SEA_L = 280;
const SAND_APRON_W = 260;
const SAND_APRON_L = 220;

const WAVE_MAT = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x0a5f8a) },
    uMid: { value: new THREE.Color(0x1a8fbf) },
    uShallow: { value: new THREE.Color(0x5ec8e8) },
    uSky: { value: new THREE.Color(0xb8dff5) },
    uFoam: { value: new THREE.Color(0xf8fafc) },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying float vWave;
    varying float vShore;
    varying vec2 vUv;
    varying vec3 vWorldN;
    void main() {
      vUv = uv;
      vec3 p = position;
      // Multi-octave swell — not a flat sheet
      float w1 = sin(p.x * 0.028 + uTime * 1.15) * 0.42;
      float w2 = sin(p.y * 0.055 - uTime * 0.95) * 0.28;
      float w3 = sin((p.x + p.y) * 0.09 + uTime * 1.7) * 0.12;
      float w4 = sin(p.x * 0.12 - p.y * 0.07 + uTime * 2.4) * 0.06;
      float w = w1 + w2 + w3 + w4;
      p.z += w;
      vWave = w;
      // uv.y ~ 0 at far sea, 1 at near shore (plane local)
      vShore = uv.y;
      // Approximate normal from wave derivatives for cheap sky reflection
      float dx = cos(p.x * 0.028 + uTime * 1.15) * 0.028 * 0.42
               + cos((p.x + p.y) * 0.09 + uTime * 1.7) * 0.09 * 0.12;
      float dy = cos(p.y * 0.055 - uTime * 0.95) * 0.055 * 0.28;
      vWorldN = normalize(vec3(-dx, 1.0, -dy));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uDeep;
    uniform vec3 uMid;
    uniform vec3 uShallow;
    uniform vec3 uSky;
    uniform vec3 uFoam;
    varying float vWave;
    varying float vShore;
    varying vec2 vUv;
    varying vec3 vWorldN;
    void main() {
      float shore = smoothstep(0.0, 0.35, vShore);
      float near = smoothstep(0.55, 1.0, vShore);
      vec3 water = mix(uDeep, uMid, shore);
      water = mix(water, uShallow, near * 0.75);
      // Sky reflection from wave normals
      float fresnel = pow(1.0 - clamp(vWorldN.y, 0.0, 1.0), 2.2);
      water = mix(water, uSky, fresnel * 0.45);
      // Crest foam + shoreline wash
      float crest = smoothstep(0.22, 0.48, vWave);
      float wash = near * smoothstep(0.05, 0.28, abs(vWave) + 0.08 * sin(vUv.x * 40.0));
      float foam = max(crest * 0.55, wash * 0.9);
      vec3 col = mix(water, uFoam, foam);
      float alpha = mix(0.94, 0.62, near);
      gl_FragColor = vec4(col, alpha);
    }
  `,
});

const SEA_GEO = new THREE.PlaneGeometry(SEA_W, SEA_L, 96, 64);
const FOAM_GEO = new THREE.PlaneGeometry(120, 4.5, 1, 1);
const FOAM_MAT = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  transparent: true,
  opacity: 0.5,
  roughness: 1,
  metalness: 0,
  depthWrite: false,
});
const WET_MAT = new THREE.MeshStandardMaterial({
  color: 0xc4a882,
  roughness: 0.55,
  metalness: 0.08,
});
const DRY_SAND_MAT = new THREE.MeshStandardMaterial({
  color: 0xe8d5a3,
  roughness: 0.95,
  metalness: 0.02,
});
const HORIZON_SAND_MAT = new THREE.MeshBasicMaterial({ color: 0xd4bc8a });
const HORIZON_SEA_MAT = new THREE.MeshBasicMaterial({ color: 0x0a6e9c });
const SKY_BAND_MAT = new THREE.MeshBasicMaterial({
  color: 0x87c5e8,
  transparent: true,
  opacity: 0.92,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const BUOY_GEO = new THREE.SphereGeometry(0.35, 10, 8);
const BUOY_MAT = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45, metalness: 0.1 });
const LINE_GEO = new THREE.BoxGeometry(0.08, 0.08, 1);
const LINE_MAT = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });

const BODY_GEO = new THREE.CapsuleGeometry(0.22, 0.55, 4, 8);
const HEAD_GEO = new THREE.SphereGeometry(0.18, 8, 6);
const HORSE_BODY_GEO = new THREE.BoxGeometry(0.5, 0.75, 1.7);
const HORSE_HEAD_GEO = new THREE.BoxGeometry(0.28, 0.55, 0.45);
const HORSE_LEG_GEO = new THREE.BoxGeometry(0.12, 0.9, 0.12);

export type SwimZone = {
  /** Local room coords: shallow water the player may enter */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Water surface Y in room space */
  surfaceY: number;
};

type BeachLife = {
  foam: THREE.Mesh;
  bobbers: Array<{ mesh: THREE.Group; baseY: number; phase: number; amp: number; speed: number }>;
  horses: Array<{
    group: THREE.Group;
    t: number;
    speed: number;
    z: number;
    x0: number;
    x1: number;
    dir: number;
  }>;
  vendors: Array<{
    group: THREE.Group;
    t: number;
    speed: number;
    points: Array<[number, number]>;
    legL: THREE.Object3D;
    legR: THREE.Object3D;
  }>;
  ambienceOn: boolean;
};

let activeLife: BeachLife | null = null;
let ambienceGain: GainNode | null = null;
let ambienceSources: AudioNode[] = [];

function makePerson(outfit: number, skin = 0x8d5524): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.7 }));
  body.position.y = 0.85;
  const head = new THREE.Mesh(HEAD_GEO, new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 }));
  head.position.y = 1.45;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const legL = new THREE.Mesh(HORSE_LEG_GEO, legMat);
  legL.position.set(-0.12, 0.45, 0);
  legL.scale.set(0.9, 0.55, 0.9);
  const legR = legL.clone();
  legR.position.x = 0.12;
  g.add(body, head, legL, legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

function makeHorse(coat: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.7 });
  const body = new THREE.Mesh(HORSE_BODY_GEO, mat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(HORSE_HEAD_GEO, mat);
  head.position.set(0, 1.55, 0.95);
  head.rotation.x = -0.45;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.8 });
  for (const [x, z] of [[-0.16, 0.55], [0.16, 0.55], [-0.16, -0.55], [0.16, -0.55]] as Array<[number, number]>) {
    const leg = new THREE.Mesh(HORSE_LEG_GEO, legMat);
    leg.position.set(x, 0.45, z);
    g.add(leg);
  }
  g.add(body, head);
  // Rider
  const rider = makePerson(0xf8fafc);
  rider.position.set(0, 1.15, -0.1);
  rider.scale.setScalar(0.85);
  g.add(rider);
  return g;
}

function startBeachAmbience(): void {
  const engine = SoundEngine.getInstance();
  const audio = engine.audio();
  const ctx = audio?.ctx ?? null;
  const master = audio?.master ?? null;
  if (!ctx || !master || engine.isMuted) return;
  stopBeachAmbience();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  ambienceGain = gain;

  // Soft band-limited noise as surf
  const seconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.97 + white * 0.03;
    data[i] = last;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 780;
  filter.Q.value = 0.7;
  const surfGain = ctx.createGain();
  surfGain.gain.value = 0.22;
  src.connect(filter);
  filter.connect(surfGain);
  surfGain.connect(gain);
  src.start();

  // Gentle crowd murmur (second darker noise bed)
  const crowdBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const cd = crowdBuf.getChannelData(0);
  last = 0;
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
  crowdFilter.frequency.value = 520;
  crowdFilter.Q.value = 0.8;
  const crowdGain = ctx.createGain();
  crowdGain.gain.value = 0.08;
  crowdSrc.connect(crowdFilter);
  crowdFilter.connect(crowdGain);
  crowdGain.connect(gain);
  crowdSrc.start();

  ambienceSources = [src, crowdSrc, filter, surfGain, crowdFilter, crowdGain];
  gain.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
}

function stopBeachAmbience(): void {
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

/** Attach sea, foam, horizon skirts and beach life. Returns the swim zone. */
export function attachOpenAirBeach(group: THREE.Group, length: number, width = 72): SwimZone {
  const shoreZ = -length / 2;

  // --- Horizon skirts: kill the grey void past the finite plot ---
  const skirts = new THREE.Group();
  skirts.name = 'open_air_horizon_skirts';

  // Wide dry-sand apron under and past the plot
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(SAND_APRON_W, SAND_APRON_L),
    DRY_SAND_MAT,
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, -0.08, shoreZ + 8);
  apron.receiveShadow = true;
  skirts.add(apron);

  // Far land / side sand rings so left/right never drop into void
  const sideSand = new THREE.Mesh(new THREE.CircleGeometry(180, 48), HORIZON_SAND_MAT);
  sideSand.rotation.x = -Math.PI / 2;
  sideSand.position.set(0, -0.12, 10);
  skirts.add(sideSand);

  // Distant sea disc past the animated mesh
  const farSea = new THREE.Mesh(new THREE.CircleGeometry(200, 40), HORIZON_SEA_MAT);
  farSea.rotation.x = -Math.PI / 2;
  farSea.position.set(0, -0.18, shoreZ - SEA_L * 0.55);
  skirts.add(farSea);

  // Soft sky band on the horizon (cylinder ring)
  const skyBand = new THREE.Mesh(new THREE.CylinderGeometry(210, 210, 48, 48, 1, true), SKY_BAND_MAT);
  skyBand.position.set(0, 18, shoreZ - 40);
  skirts.add(skyBand);

  group.add(skirts);

  // Wet sand strip at the waterline (darker, glossier)
  const wet = new THREE.Mesh(new THREE.BoxGeometry(Math.max(width + 40, 110), 0.05, 7), WET_MAT);
  wet.name = 'open_air_wet_sand';
  wet.position.set(0, 0.02, shoreZ + 2.2);
  wet.receiveShadow = true;
  group.add(wet);

  // Animated sea
  const sea = new THREE.Mesh(SEA_GEO, WAVE_MAT);
  sea.name = 'open_air_sea';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.06, shoreZ - SEA_L * 0.38);
  sea.renderOrder = 1;
  group.add(sea);

  const foam = new THREE.Mesh(FOAM_GEO, FOAM_MAT);
  foam.name = 'open_air_foam';
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.05, shoreZ + 1.0);
  foam.renderOrder = 2;
  group.add(foam);

  // Marked swim area: between shore and a buoy line — cannot cross into deep sea
  const swim: SwimZone = {
    minX: -14,
    maxX: 14,
    minZ: shoreZ - 6,
    maxZ: shoreZ + 2.5,
    surfaceY: -0.08,
  };

  const buoys = new THREE.Group();
  buoys.name = 'open_air_swim_line';
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const x = swim.minX + (swim.maxX - swim.minX) * t;
    const z = swim.minZ + 0.4;
    const buoy = new THREE.Mesh(BUOY_GEO, BUOY_MAT);
    buoy.position.set(x, 0.25, z);
    buoys.add(buoy);
    if (i < 7) {
      const nx = swim.minX + (swim.maxX - swim.minX) * ((i + 1) / 7);
      const line = new THREE.Mesh(LINE_GEO, LINE_MAT);
      line.position.set((x + nx) / 2, 0.12, z);
      line.scale.z = Math.hypot(nx - x, 0);
      line.rotation.y = Math.atan2(0, nx - x);
      buoys.add(line);
    }
  }
  group.add(buoys);

  // Swim bobbers in the safe zone
  const bobbers: BeachLife['bobbers'] = [];
  const swimOutfits = [0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a, 0xdb2777, 0xf97316];
  for (let i = 0; i < 6; i++) {
    const person = makePerson(swimOutfits[i % swimOutfits.length]);
    // Chest-deep: sink the body into the water
    person.scale.setScalar(0.9);
    const x = swim.minX + 2 + (i % 3) * 4.5 + (i > 2 ? 1.2 : 0);
    const z = swim.minZ + 1.5 + (i % 2) * 2.2;
    person.position.set(x, -0.35, z);
    person.rotation.y = Math.PI + (i % 2 ? 0.3 : -0.25);
    group.add(person);
    bobbers.push({ mesh: person, baseY: -0.35, phase: i * 1.1, amp: 0.12 + (i % 3) * 0.03, speed: 1.4 + (i % 4) * 0.2 });
  }

  // Horses with riders trotting along the shore
  const horses: BeachLife['horses'] = [];
  const coats = [0x78350f, 0xf5f5f4, 0x44403c];
  for (let i = 0; i < 3; i++) {
    const horse = makeHorse(coats[i % coats.length]);
    const z = shoreZ + 6 + i * 2.2;
    horse.position.set(-26 + i * 4, 0, z);
    group.add(horse);
    horses.push({
      group: horse,
      t: i * 0.33,
      speed: 0.04 + i * 0.008,
      z,
      x0: -28,
      x1: 26,
      dir: i % 2 === 0 ? 1 : -1,
    });
  }

  // Vendors walking the sand between stalls
  const vendors: BeachLife['vendors'] = [];
  const vendorRoutes: Array<{ outfit: number; points: Array<[number, number]> }> = [
    { outfit: 0xf97316, points: [[12, 10], [10, 6], [8, 12], [12, 10]] },
    { outfit: 0x16a34a, points: [[-14, 12], [-10, 8], [-16, 6], [-14, 12]] },
    { outfit: 0xb45309, points: [[6, 14], [2, 12], [8, 10], [6, 14]] },
    { outfit: 0x0ea5e9, points: [[-6, -4], [0, -6], [4, -4], [-6, -4]] },
  ];
  for (const route of vendorRoutes) {
    const person = makePerson(route.outfit);
    person.position.set(route.points[0][0], 0, route.points[0][1]);
    group.add(person);
    vendors.push({
      group: person,
      t: Math.random(),
      speed: 0.12 + Math.random() * 0.06,
      points: route.points,
      legL: person.userData.legL as THREE.Object3D,
      legR: person.userData.legR as THREE.Object3D,
    });
  }

  const life: BeachLife = { foam, bobbers, horses, vendors, ambienceOn: false };
  activeLife = life;
  group.userData.swimZone = swim;
  group.userData.beachSea = sea;
  group.userData.beachLife = life;
  return swim;
}

/** Re-bind beach life + ambience after a revisit (build only runs once). */
export function resumeOpenAirBeach(group: THREE.Group): void {
  const life = group.userData.beachLife as BeachLife | undefined;
  if (!life) return;
  activeLife = life;
  life.ambienceOn = false;
}

const LAKE_MAT = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x0c4a6e) },
    uMid: { value: new THREE.Color(0x0e7490) },
    uShallow: { value: new THREE.Color(0x38bdf8) },
    uSky: { value: new THREE.Color(0xa5d8ef) },
    uFoam: { value: new THREE.Color(0xf8fafc) },
  },
  vertexShader: WAVE_MAT.vertexShader,
  fragmentShader: WAVE_MAT.fragmentShader,
});

/**
 * Freshwater horizon for lakes (Jabi etc.): darker water, soft shore wash, boat/swim line.
 * Shares geometry with the beach sea; own material so beach colour stays independent.
 */
export function attachOpenAirLake(group: THREE.Group, length: number): SwimZone {
  const shoreZ = -length / 2;

  const skirts = new THREE.Group();
  skirts.name = 'open_air_lake_skirts';
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(160, 40), new THREE.MeshBasicMaterial({ color: 0x7a9e6a }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(0, -0.12, 0);
  skirts.add(lawn);
  const farWater = new THREE.Mesh(new THREE.CircleGeometry(180, 36), new THREE.MeshBasicMaterial({ color: 0x0c4a6e }));
  farWater.rotation.x = -Math.PI / 2;
  farWater.position.set(0, -0.16, shoreZ - SEA_L * 0.5);
  skirts.add(farWater);
  group.add(skirts);

  const sea = new THREE.Mesh(SEA_GEO, LAKE_MAT);
  sea.name = 'open_air_lake';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.05, shoreZ - SEA_L * 0.35);
  sea.renderOrder = 1;
  group.add(sea);

  const foam = new THREE.Mesh(FOAM_GEO, FOAM_MAT);
  foam.name = 'open_air_lake_wash';
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.03, shoreZ + 1.0);
  foam.renderOrder = 2;
  group.add(foam);

  const swim: SwimZone = {
    minX: -12,
    maxX: 12,
    minZ: shoreZ - 5,
    maxZ: shoreZ + 2.2,
    surfaceY: -0.08,
  };

  const buoys = new THREE.Group();
  buoys.name = 'open_air_boat_line';
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = swim.minX + (swim.maxX - swim.minX) * t;
    const z = swim.minZ + 0.4;
    const buoy = new THREE.Mesh(BUOY_GEO, BUOY_MAT);
    buoy.position.set(x, 0.22, z);
    buoys.add(buoy);
    if (i < 6) {
      const nx = swim.minX + (swim.maxX - swim.minX) * ((i + 1) / 6);
      const line = new THREE.Mesh(LINE_GEO, LINE_MAT);
      line.position.set((x + nx) / 2, 0.1, z);
      line.scale.z = Math.hypot(nx - x, 0);
      buoys.add(line);
    }
  }
  group.add(buoys);

  group.userData.swimZone = swim;
  group.userData.beachSea = sea;
  group.userData.lakeMat = LAKE_MAT;
  return swim;
}

/** Advance wave time and beach life. Call once per frame while any open-air beach or lake is active. */
export function tickOpenAirBeach(dt: number): void {
  WAVE_MAT.uniforms.uTime.value += dt;
  LAKE_MAT.uniforms.uTime.value += dt;
  const life = activeLife;
  if (!life) return;

  if (!life.ambienceOn) {
    startBeachAmbience();
    life.ambienceOn = true;
  }

  const t = WAVE_MAT.uniforms.uTime.value;
  // Breathing foam opacity at the shoreline
  FOAM_MAT.opacity = 0.38 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.3));
  life.foam.position.z += Math.sin(t * 0.9) * 0.002;

  for (const b of life.bobbers) {
    b.mesh.position.y = b.baseY + Math.sin(t * b.speed + b.phase) * b.amp;
    b.mesh.rotation.y += Math.sin(t * 0.4 + b.phase) * 0.002;
  }

  for (const h of life.horses) {
    h.t += dt * h.speed * h.dir;
    if (h.t > 1) { h.t = 1; h.dir = -1; }
    if (h.t < 0) { h.t = 0; h.dir = 1; }
    const x = h.x0 + (h.x1 - h.x0) * h.t;
    h.group.position.set(x, 0.02 * Math.sin(t * 8 + h.z), h.z);
    h.group.rotation.y = h.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  for (const v of life.vendors) {
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

/** Stop beach ambience when leaving (safe to call anytime). */
export function releaseOpenAirBeach(): void {
  stopBeachAmbience();
  if (activeLife) activeLife.ambienceOn = false;
  activeLife = null;
}

/**
 * Keep the player in the plot / shallow swim zone. Returns immersion depth 0..1.
 * Mutates player local xz (room space) when they would leave the safe water.
 */
export function constrainBeachSwim(
  localX: number,
  localZ: number,
  zone: SwimZone,
  plotHalfW: number,
  plotHalfL: number,
): { x: number; z: number; immersion: number } {
  let x = localX;
  let z = localZ;
  // Soft plot clamp (rails are invisible but nav may miss)
  const pad = 0.8;
  x = Math.max(-plotHalfW + pad, Math.min(plotHalfW - pad, x));
  // Allow a little into the marked swim shallows past the back rail
  const minZ = Math.min(-plotHalfL + pad, zone.minZ + 0.2);
  z = Math.max(minZ, Math.min(plotHalfL - pad, z));

  const inSwim = x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
  if (z < zone.minZ) {
    // Past the buoy line — push back into shallow water
    z = zone.minZ + 0.15;
  }
  let immersion = 0;
  if (inSwim || (z < zone.maxZ && z >= zone.minZ && x >= zone.minX && x <= zone.maxX)) {
    const depthT = (zone.maxZ - z) / Math.max(0.01, zone.maxZ - zone.minZ);
    immersion = Math.max(0, Math.min(1, depthT));
  }
  return { x, z, immersion };
}
