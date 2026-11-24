/**
 * Shared open-air beach atmosphere: horizon sea, animated waves, shoreline foam,
 * and a marked shallow swim zone the player cannot leave the map through.
 * Geometry and materials are shared; no per-frame allocations.
 */
import * as THREE from 'three';

const SEA_W = 220;
const SEA_L = 160;
const WAVE_MAT = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x0a6e9c) },
    uShallow: { value: new THREE.Color(0x38bdf8) },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying float vWave;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 p = position;
      float w = sin(p.x * 0.045 + uTime * 1.1) * 0.18
              + sin(p.y * 0.07 - uTime * 0.85) * 0.12;
      p.z += w;
      vWave = w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    varying float vWave;
    varying vec2 vUv;
    void main() {
      float foam = smoothstep(0.08, 0.16, vWave);
      float shore = smoothstep(0.0, 0.22, vUv.y);
      vec3 col = mix(uDeep, uShallow, shore * 0.65 + foam * 0.35);
      float alpha = mix(0.92, 0.55, shore);
      gl_FragColor = vec4(col, alpha);
    }
  `,
});

const SEA_GEO = new THREE.PlaneGeometry(SEA_W, SEA_L, 48, 32);
const FOAM_GEO = new THREE.PlaneGeometry(90, 3.2, 1, 1);
const FOAM_MAT = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  transparent: true,
  opacity: 0.55,
  roughness: 1,
  metalness: 0,
  depthWrite: false,
});
const BUOY_GEO = new THREE.SphereGeometry(0.35, 10, 8);
const BUOY_MAT = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45, metalness: 0.1 });
const LINE_GEO = new THREE.BoxGeometry(0.08, 0.08, 1);
const LINE_MAT = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });

export type SwimZone = {
  /** Local room coords: shallow water the player may enter */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Water surface Y in room space */
  surfaceY: number;
};

/** Attach sea, foam and swim markers to an open-air beach group. Returns the swim zone. */
export function attachOpenAirBeach(group: THREE.Group, length: number): SwimZone {
  const sea = new THREE.Mesh(SEA_GEO, WAVE_MAT);
  sea.name = 'open_air_sea';
  sea.rotation.x = -Math.PI / 2;
  // Sea sits past the back of the plot (negative z), stretching to the horizon
  sea.position.set(0, -0.05, -length / 2 - SEA_L * 0.35);
  sea.renderOrder = 1;
  group.add(sea);

  const foam = new THREE.Mesh(FOAM_GEO, FOAM_MAT);
  foam.name = 'open_air_foam';
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.04, -length / 2 + 1.2);
  foam.renderOrder = 2;
  group.add(foam);

  // Marked swim area: between shore and a buoy line — cannot cross into deep sea
  const swim: SwimZone = {
    minX: -14,
    maxX: 14,
    minZ: -length / 2 - 6,
    maxZ: -length / 2 + 2.5,
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

  group.userData.swimZone = swim;
  group.userData.beachSea = sea;
  return swim;
}

const LAKE_MAT = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x0c4a6e) },
    uShallow: { value: new THREE.Color(0x38bdf8) },
  },
  vertexShader: WAVE_MAT.vertexShader,
  fragmentShader: WAVE_MAT.fragmentShader,
});

/**
 * Freshwater horizon for lakes (Jabi etc.): darker water, soft shore wash, boat/swim line.
 * Shares geometry with the beach sea; own material so beach colour stays independent.
 */
export function attachOpenAirLake(group: THREE.Group, length: number): SwimZone {
  const sea = new THREE.Mesh(SEA_GEO, LAKE_MAT);
  sea.name = 'open_air_lake';
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.05, -length / 2 - SEA_L * 0.35);
  sea.renderOrder = 1;
  group.add(sea);

  const foam = new THREE.Mesh(FOAM_GEO, FOAM_MAT);
  foam.name = 'open_air_lake_wash';
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.03, -length / 2 + 1.0);
  foam.renderOrder = 2;
  group.add(foam);

  const swim: SwimZone = {
    minX: -12,
    maxX: 12,
    minZ: -length / 2 - 5,
    maxZ: -length / 2 + 2.2,
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

/** Advance wave time. Call once per frame while any open-air beach or lake is active. */
export function tickOpenAirBeach(dt: number): void {
  WAVE_MAT.uniforms.uTime.value += dt;
  LAKE_MAT.uniforms.uTime.value += dt;
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
  z = Math.max(-plotHalfL + pad, Math.min(plotHalfL - pad, z));

  const inSwim = x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
  if (z < zone.minZ) {
    // Past the buoy line — push back into shallow water
    z = zone.minZ + 0.15;
  }
  let immersion = 0;
  if (inSwim || z < zone.maxZ && z >= zone.minZ && x >= zone.minX && x <= zone.maxX) {
    const t = (zone.maxZ - z) / Math.max(0.01, zone.maxZ - zone.minZ);
    immersion = Math.max(0, Math.min(1, t));
  }
  return { x, z, immersion };
}
