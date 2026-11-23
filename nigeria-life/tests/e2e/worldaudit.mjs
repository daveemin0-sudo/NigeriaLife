// World audit: every destination and enterable place in Lagos, Abuja and Port Harcourt.
// Visits via the map ride / arrival path, captures evidence, records defects. Does not fix game code.
//
// Standalone (writes docs/audit artifacts):
//   GAME_URL=http://127.0.0.1:4177/ node tests/e2e/worldaudit.mjs
// Via the suite runner:
//   GAME_URL=... npm run test:e2e worldaudit
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPlayer, closeDialogs, wait, advance, playUntil, makeOpen } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const AUDIT_DIR = path.join(ROOT, 'docs/audit');
const RAW_DIR = path.join(AUDIT_DIR, 'raw');
const SHEETS_DIR = path.join(AUDIT_DIR, 'sheets');
const RESULTS_JSON = path.join(AUDIT_DIR, 'worldaudit-results.json');
const REPORT_MD = path.join(AUDIT_DIR, 'WORLD_AUDIT.md');

const CITIES = ['lagos', 'abuja', 'port_harcourt'];
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const OPEN_AIR_RE = /\b(beach|park|lake|market|stadium|golf|conserv|marina|promenade|square|garden|creek|lagoon|waterfront|wharf|yard|compound grounds|race\s*course|polo|zoo|forest|bush|field|pitch)\b/i;
const BUILDING_SHELL_RE = /\b(hotel|hospital|bank|office|mall|tower|church|mosque|cathedral|temple|clinic|school|university|assembly|court|embassy|terminal|lobby|suite|apartment|duplex|restaurant|club|lounge|shop|store|supermarket|cinema|theatre|museum|gallery|station|refinery|depot|hall|arena|chapel|studio)\b/i;

const slug = (s) => String(s || 'place').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'place';

function classifyExpected(name, category, district) {
  const blob = `${name} ${category || ''} ${district || ''}`;
  if (OPEN_AIR_RE.test(blob)) return 'OPEN_AIR';
  if (/Beach|Park|Market|Stadium|Golf|Lake|Marina|Conservation|Square/i.test(category || '')) return 'OPEN_AIR';
  return 'BUILDING';
}

function ensureDirs() {
  for (const d of [AUDIT_DIR, RAW_DIR, SHEETS_DIR]) fs.mkdirSync(d, { recursive: true });
}

async function moneyUp(page) {
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.performGig?.(5_000_000, 0, 'worldaudit: travel money');
    be.data.walletCash = Math.max(be.data.walletCash || 0, 2_000_000);
    be.data.bank.balance = Math.max(be.data.bank.balance || 0, 5_000_000);
    be.saveData?.();
    window.game.world.skyEnvironment.setHour(12);
  });
}

async function leaveInterior(page) {
  await page.evaluate(async () => {
    const g = window.game;
    const im = g.world.interiorManager;
    if (!im.isPlayerInside()) return;
    await im.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  });
  await playUntil(page, () => (!window.game.world.interiorManager.isPlayerInside() && !window.game.world.interiorManager.busy ? true : null), 20);
  await wait(200);
}

async function switchCity(page, city) {
  await leaveInterior(page);
  await page.evaluate((c) => {
    const g = window.game;
    if (g.world.cityManager.currentCityId === c) return;
    if (typeof g.arriveInCity === 'function') g.arriveInCity(c);
    else {
      g.world.cityManager.switchCity(c, g.player, (objs) => { g.world.interactiveObjects = objs; });
    }
  }, city);
  await wait(800);
  await advance(page, 0.5);
}

/** Open the map on a destination and Go by keke (or walk). Uses the real booking path; skips the ride cinematic after it starts. */
async function travelByMap(page, destId, city) {
  await leaveInterior(page);
  await switchCity(page, city);
  await moneyUp(page);
  await makeOpen(page, destId);

  // Close overlays
  await page.evaluate(() => {
    document.getElementById('dialogue-confirm-btn')?.click();
    document.getElementById('game-dialogue-overlay')?.remove();
    window.game.hud.hideInteractionCard?.();
  });

  const opened = await page.evaluate(async ({ destId, city }) => {
    const g = window.game;
    // Ensure map for this city
    if (g.hud.currentNavMode !== 'map') {
      document.getElementById('nav-btn-map')?.click();
    }
    await new Promise((r) => setTimeout(r, 400));
    g.hud.worldMapUI?.onSwitchCityTab?.(city);
    g.hud.worldMapUI?.updateCityHeader?.(city);
    await new Promise((r) => setTimeout(r, 300));
    const ok = g.hud.worldMapUI?.goToPlace?.(destId, city);
    const card = document.getElementById('map-context-card');
    const name = document.getElementById('map-card-name')?.textContent?.trim() || null;
    const zone = document.getElementById('map-card-zone')?.textContent?.trim() || null;
    const modes = [...document.querySelectorAll('.transport-tile')].map((t) => t.dataset.mode);
    return { ok: !!ok, name, zone, modes, cardShown: card?.style.display !== 'none' };
  }, { destId, city });

  if (!opened.ok && !opened.cardShown) {
    return { ok: false, reason: 'no-map-pin', booked: opened };
  }

  await wait(350);

  // Prefer keke, else taxi, else bike, else walk
  const mode = ['keke', 'taxi', 'bike', 'walk'].find((m) => opened.modes.includes(m)) || opened.modes[0] || 'walk';
  if (mode !== 'walk') {
    await page.evaluate((m) => document.querySelector(`.transport-tile[data-mode="${m}"]`)?.click(), mode);
    await wait(120);
  }

  const bookedName = await page.evaluate(() => document.getElementById('map-card-name')?.textContent?.trim() || null);
  const bookedDistrict = await page.evaluate(() => document.getElementById('map-card-zone')?.textContent?.trim() || null);

  await page.evaluate(() => document.getElementById('btn-card-go')?.click());
  await wait(200);

  // Wait for ride to start (if any), then skip cinematic so arrival still runs
  const rideStarted = await playUntil(page, () => (window.game.roadRideExperience?.isActive ? true : null), 8);
  if (rideStarted) {
    await page.evaluate(() => window.game.roadRideExperience.skipRide());
  }
  // Wait until not in transit / map closed and player visible again
  await playUntil(page, () => {
    const g = window.game;
    if (g.roadRideExperience?.isActive) return null;
    if (g.rides?.ride?.stage === 'on_trip') return null;
    if (g.world.worldMap?.isActive) return null;
    return true;
  }, 25);
  await wait(600);
  // Allow interior enter timeout from HUD arrive()
  await wait(400);
  await advance(page, 0.5);

  return { ok: true, mode, bookedName, bookedDistrict, rideSkipped: !!rideStarted };
}

/** Enter a PLACE_SPEC via its roadside door card (after being set down nearby). */
async function enterViaDoor(page, key) {
  await makeOpen(page, key);
  const found = await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}` || o.id === k || o.id === `interior_place_${k}`);
    if (!card) return null;
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    return card.id;
  }, key);
  if (!found) return { ok: false, reason: 'no-door' };
  await wait(200);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  const name = await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? window.game.world.interiorManager.currentInterior.name : null), 20);
  return { ok: !!name, insideName: name, doorId: found };
}

async function snapshotState(page) {
  return page.evaluate(() => {
    const g = window.game;
    const THREE = g.modules.THREE;
    const pos = g.player.position;
    const district = g.world.getDistrictAtPosition(pos);
    const inside = g.world.interiorManager.isPlayerInside();
    const cur = g.world.interiorManager.currentInterior;
    const loc = {
      hudName: document.getElementById('location-name')?.textContent?.trim()
        || document.querySelector('.location-name, #hud-location, .hud-location')?.textContent?.trim()
        || null,
      hudSub: document.getElementById('location-sub')?.textContent?.trim()
        || document.querySelector('.location-sub, #hud-location-sub')?.textContent?.trim()
        || null,
    };
    // Banner often carries the place name on enter
    const banner = document.querySelector('.interior-banner, #interior-banner')?.textContent?.trim() || null;
    const placeCard = {
      shown: document.getElementById('place-card')?.style.display !== 'none',
      title: document.querySelector('#place-card .place-title, #place-card h2, #place-card .place-name')?.textContent?.trim() || null,
      sub: document.querySelector('#place-card .place-sub, #place-card .place-meta')?.textContent?.trim() || null,
    };
    return {
      city: g.world.cityManager.currentCityId,
      x: +pos.x.toFixed(2),
      z: +pos.z.toFixed(2),
      districtName: district?.name || null,
      districtSub: district?.sub || null,
      inside,
      interiorName: cur?.name || null,
      interiorDistrict: cur?.districtName || null,
      interiorType: cur?.type || null,
      loc,
      banner,
      placeCard,
      meshCount: (() => {
        let n = 0;
        const root = inside ? g.world.interiorManager.group : g.scene;
        root?.traverse((o) => { if (o.isMesh) n++; });
        return n;
      })(),
    };
  });
}

async function checkUiOverlaps(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const samples = [
      [W * 0.5, H * 0.08, 'top-center'],
      [W * 0.92, H * 0.08, 'top-right'],
      [W * 0.08, H * 0.08, 'top-left'],
      [W * 0.5, H * 0.5, 'center'],
      [W * 0.5, H * 0.92, 'bottom-center'],
      [W * 0.12, H * 0.78, 'joystick'],
      [W * 0.88, H * 0.72, 'action'],
      [W * 0.5, H * 0.18, 'banner-band'],
    ];
    const overlaps = [];
    for (const [x, y, label] of samples) {
      const el = document.elementFromPoint(x, y);
      if (!el) continue;
      const id = el.id || '';
      const cls = typeof el.className === 'string' ? el.className : '';
      const tag = el.tagName;
      // Two interactive HUD pieces stacked: toast over leave, menu over ride card, etc.
      const interactive = /button|a/i.test(tag) || el.getAttribute('role') === 'button' || /btn|fab|sheet|card|toast|menu|nav|overlay|modal/i.test(id + cls);
      if (!interactive) continue;
      // Check if a second visible interactive sits under the same point by temporarily peeking
      const prev = el.style.pointerEvents;
      el.style.pointerEvents = 'none';
      const under = document.elementFromPoint(x, y);
      el.style.pointerEvents = prev;
      if (!under || under === el) continue;
      const uid = under.id || '';
      const ucls = typeof under.className === 'string' ? under.className : '';
      const underInteractive = /button|a/i.test(under.tagName) || under.getAttribute('role') === 'button' || /btn|fab|sheet|card|toast|menu|nav|overlay|modal/i.test(uid + ucls);
      if (underInteractive) {
        overlaps.push({
          at: label,
          top: `${tag}#${id}.${cls}`.slice(0, 80),
          under: `${under.tagName}#${uid}.${ucls}`.slice(0, 80),
        });
      }
    }
    return overlaps;
  });
}

async function checkActivitiesAndSolids(page) {
  return page.evaluate(() => {
    const g = window.game;
    const im = g.world.interiorManager;
    const inside = im.isPlayerInside();
    const objects = inside
      ? (im.getActiveInteractiveObjects?.() || [])
      : (g.world.interactiveObjects || []).filter((o) => {
          const d = Math.hypot(o.interactionPoint.x - g.player.position.x, o.interactionPoint.z - g.player.position.z);
          return d < 40;
        });

    const activities = objects.map((o) => {
      const p = o.interactionPoint;
      const dx = p.x - g.player.position.x;
      const dz = p.z - g.player.position.z;
      const dist = Math.hypot(dx, dz);
      // Probe mid-points for solid blocking (street solids only; interiors use footprints via topAt)
      let blocked = false;
      if (!inside) {
        const solids = g.solidsHere?.();
        if (solids) {
          for (let t = 0.15; t < 0.95; t += 0.2) {
            const x = g.player.position.x + dx * t;
            const z = g.player.position.z + dz * t;
            if (solids.at?.(x, z) || solids.wallAt?.(x, z, 0.35)) { blocked = true; break; }
          }
        }
      }
      return { id: o.id, name: o.name || o.label || o.id, dist: +dist.toFixed(2), blocked };
    });

    // Walk-through: sample solid-looking meshes near the player; if topAt/solids say open but a tall mesh is there
    const walkThrough = [];
    if (inside) {
      const place = im.places?.find?.((p) => p.group?.visible) || im.places?.find?.((p) => p.spec && im.currentInterior?.name === p.spec.name);
      const cur = place || null;
      if (cur?.built?.length && cur.topAt) {
        // Sample a grid in the room; tall visual without seat/floor collision intent
        for (let x = -6; x <= 6; x += 2) {
          for (let z = -6; z <= 6; z += 2) {
            const top = cur.topAt(x, z);
            // Counter/shelf/wall-like height but player can stand on the same cell (top reported yet no footprint block in navigation)
            if (top > 0.9 && top < 2.8) {
              // Try to stand there — interiors often allow walk-through of props
              const ox = cur.group.position.x + x;
              const oz = cur.group.position.z + z;
              walkThrough.push({ x: +ox.toFixed(2), z: +oz.toFixed(2), top: +top.toFixed(2), kind: 'interior-prop' });
            }
          }
        }
      }
      // Cap samples
      walkThrough.splice(12);
    } else {
      const solids = g.solidsHere?.();
      if (solids?.all) {
        // Set-down inside a solid body
        if (solids.at?.(g.player.position.x, g.player.position.z)) {
          walkThrough.push({ x: g.player.position.x, z: g.player.position.z, kind: 'spawn-inside-solid' });
        }
      }
    }

    return {
      activityCount: activities.length,
      unreachable: activities.filter((a) => a.blocked || a.dist > 80).map((a) => a.id),
      activities: activities.slice(0, 24),
      walkThrough,
    };
  });
}

async function checkSeatsBeds(page) {
  return page.evaluate(() => {
    const g = window.game;
    const im = g.world.interiorManager;
    if (!im.isPlayerInside()) return { seats: [], beds: [], issues: [] };
    const issues = [];
    const seats = [];
    const beds = [];
    for (const place of im.places || []) {
      if (!place.group?.visible && place.spec?.name !== im.currentInterior?.name) continue;
      if (place.seats) {
        for (const [id, s] of place.seats) {
          const top = place.topAt?.(s.seat[0], s.seat[1]) ?? null;
          const row = { place: place.spec?.key, id, top, yaw: s.yaw };
          seats.push(row);
          if (top != null && (top < 0.25 || top > 0.85)) issues.push({ kind: 'wrong-seat', ...row });
        }
      }
    }
    // Home beds
    const home = im.residence;
    if (home && im.currentInterior?.type === 'residence') {
      const bed = g.modules?.HomeLife ? null : null;
      // Probe known bed-like stations
      const objs = im.getActiveInteractiveObjects?.() || [];
      for (const o of objs) {
        if (!/bed|sleep|duvet/i.test(o.id + (o.name || ''))) continue;
        beds.push({ id: o.id, name: o.name });
      }
    }
    // Hotel / place sleep stations
    const objs = im.getActiveInteractiveObjects?.() || [];
    for (const o of objs) {
      if (/bed|sleep/i.test(o.id + (o.name || ''))) beds.push({ id: o.id, name: o.name || o.id });
    }
    return { seats, beds, issues };
  });
}

async function checkStaffPlacement(page) {
  return page.evaluate(() => {
    const g = window.game;
    const im = g.world.interiorManager;
    if (!im.isPlayerInside()) return { staff: [], issues: [] };
    const cur = im.currentInterior;
    const origin = cur?.interiorOrigin || { x: 0, z: 0 };
    const room = cur?.room || cur?.def?.room || null;
    const halfW = (room?.width || 24) / 2;
    const halfL = (room?.length || 20) / 2;
    const staff = [];
    const issues = [];
    const objs = im.getActiveInteractiveObjects?.() || [];
    for (const o of objs) {
      if (!/npc|staff|interior_npc/i.test(o.id)) continue;
      const lx = o.interactionPoint.x - origin.x;
      const lz = o.interactionPoint.z - origin.z;
      const row = { id: o.id, name: o.name || o.id, lx: +lx.toFixed(2), lz: +lz.toFixed(2) };
      staff.push(row);
      if (Math.abs(lx) > halfW + 1.5 || Math.abs(lz) > halfL + 1.5) {
        issues.push({ kind: 'staff-outside-room', ...row });
      }
    }
    // Also NPCs from place spec people meshes
    return { staff, issues };
  });
}

async function setCamera(page, mode) {
  await page.evaluate((mode) => {
    const g = window.game;
    const cam = g.cameraManager;
    if (mode === 'overview') {
      // High overview
      if (typeof cam.setInteriorEye === 'function' && g.world.interiorManager.isPlayerInside()) {
        cam.setInteriorEye(false);
      }
      if (typeof cam.setMode === 'function') cam.setMode('overview');
      // Pull camera up
      if (cam.camera) {
        const p = g.player.position;
        cam.camera.position.set(p.x + 8, 28, p.z + 8);
        cam.camera.lookAt(p.x, 0, p.z);
        if (cam.eyePitch != null) cam.eyePitch = 1.2;
        if (cam.distance != null) cam.distance = 28;
      }
      if (typeof cam.snapToPlayer === 'function') {
        try { cam.snapToPlayer(g.player, 'street'); } catch {}
      }
      // Force high chase
      if (cam.camera) {
        const p = g.player.position;
        cam.camera.position.set(p.x - 12, 32, p.z - 12);
        cam.camera.lookAt(p.x, 1, p.z);
        cam.camera.updateProjectionMatrix?.();
      }
    } else if (mode === 'inside') {
      if (typeof cam.setInteriorEye === 'function') cam.setInteriorEye(true);
      if (typeof cam.snapToPlayer === 'function') {
        try { cam.snapToPlayer(g.player, g.world.interiorManager.isPlayerInside() ? 'interior' : 'street'); } catch {}
      }
    } else {
      // arrival / eye level
      if (typeof cam.setInteriorEye === 'function') cam.setInteriorEye(true);
      if (typeof cam.snapToPlayer === 'function') {
        try { cam.snapToPlayer(g.player, g.world.interiorManager.isPlayerInside() ? 'interior' : 'street'); } catch {}
      }
    }
  }, mode);
  await advance(page, 0.15);
  await wait(180);
}

async function captureViews(page, base) {
  const shots = {};
  for (const [mode, suffix] of [['arrival', 'arrival'], ['inside', 'onsite'], ['overview', 'overview']]) {
    await setCamera(page, mode === 'onsite' ? 'inside' : mode);
    // Hide map if still up
    await page.evaluate(() => {
      if (window.game.world.worldMap?.isActive) window.game.hud.leaveMap?.();
    });
    await wait(120);
    const file = path.join(RAW_DIR, `${base}-${suffix}.png`);
    await page.screenshot({ path: file, type: 'png' });
    shots[suffix] = file;
  }
  return shots;
}

function districtMatch(bookedDistrict, state) {
  const actual = [state.interiorDistrict, state.districtName, state.districtSub, state.loc.hudSub, state.placeCard.sub]
    .filter(Boolean).join(' | ');
  const booked = bookedDistrict || '';
  if (!booked) return { match: null, actual, reason: 'no-booked-district' };
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const b = norm(booked);
  const a = norm(actual);
  if (!a) return { match: false, actual, reason: 'no-actual-district' };
  // Token overlap
  const bt = new Set(b.split(' ').filter((w) => w.length > 2));
  const at = new Set(a.split(' ').filter((w) => w.length > 2));
  let hit = 0;
  for (const t of bt) if (at.has(t)) hit++;
  const match = hit >= 1 || a.includes(b.slice(0, 12)) || b.includes(a.split(' ')[0]);
  return { match, actual, overlap: hit };
}

function assessPresentation(expectedKind, state, name) {
  // Heuristic: open-air place shown as a boxed room with walls and low mesh variety / interior banner
  const shownAsBuilding = !!(state.inside && state.interiorName);
  const emptyOrBoxy = state.inside && state.meshCount > 0 && state.meshCount < 55;
  const defects = [];
  if (expectedKind === 'OPEN_AIR' && shownAsBuilding) {
    // Markets/beaches that correctly use PlaceInterior shells still count if they feel boxed —
    // flag when interior district/name suggests indoor shell for outdoor venue
    defects.push({
      sev: 'P1',
      cat: 'open place shown as a building',
      detail: `${name} expected OPEN_AIR but entered an interior shell (${state.interiorName})`,
    });
  }
  if (emptyOrBoxy) {
    defects.push({
      sev: 'P1',
      cat: 'empty or boxy interior',
      detail: `Only ${state.meshCount} meshes visible in interior`,
    });
  }
  return { shownAsBuilding, emptyOrBoxy, defects };
}

function collectDefects(row) {
  const defects = [...(row.presentationDefects || [])];
  if (String(row.path || '').startsWith('teleport')) {
    defects.push({
      sev: 'P0',
      cat: 'wrong location',
      detail: 'No usable map pin for ride booking; audit had to teleport to streetPosition / enter directly',
    });
  }
  if (row.path === 'unvisited') {
    defects.push({
      sev: 'P0',
      cat: 'broken activity',
      detail: (row.notes || []).join('; ') || 'could not visit',
    });
  }
  if (row.districtMatch === false) {
    defects.push({
      sev: 'P0',
      cat: 'wrong location',
      detail: `Booked district "${row.bookedDistrict}" vs shown "${row.actualDistrict}"`,
    });
  }
  if (row.uiOverlaps?.length) {
    defects.push({
      sev: 'P2',
      cat: 'UI overlap',
      detail: row.uiOverlaps.map((o) => `${o.at}: ${o.top} over ${o.under}`).join('; '),
    });
  }
  if (row.walkThrough?.some((w) => w.kind === 'spawn-inside-solid')) {
    defects.push({ sev: 'P0', cat: 'walk-through object', detail: 'Set down inside a solid' });
  } else if (row.walkThrough?.length >= 6) {
    defects.push({
      sev: 'P2',
      cat: 'walk-through object',
      detail: `${row.walkThrough.length} solid-looking prop samples look walkable`,
    });
  }
  if (row.unreachable?.length) {
    defects.push({
      sev: 'P2',
      cat: 'broken activity',
      detail: `Unreachable or blocked activity points: ${row.unreachable.slice(0, 6).join(', ')}`,
    });
  }
  if (row.seatIssues?.length) {
    defects.push({
      sev: 'P1',
      cat: 'wrong seat/bed target',
      detail: row.seatIssues.slice(0, 4).map((s) => `${s.id} top=${s.top}`).join('; '),
    });
  }
  if (row.staffIssues?.length) {
    defects.push({
      sev: 'P2',
      cat: 'staff in the wrong place',
      detail: row.staffIssues.slice(0, 4).map((s) => s.id).join(', '),
    });
  }
  if (row.visited && row.inside === false && row.isEnterable && row.path !== 'unvisited') {
    defects.push({
      sev: 'P1',
      cat: 'broken activity',
      detail: 'Marked enterable but arrival did not enter an interior',
    });
  }
  if (row.clipping) {
    defects.push({ sev: 'P3', cat: 'clipping/floating objects', detail: row.clipping });
  }
  return defects;
}

async function catalog(page) {
  return page.evaluate((cities) => {
    const g = window.game;
    const reg = g.modules.DestinationRegistry?.getInstance?.() || null;
    // DestinationRegistry is usually imported into map UI; fall through via worldMapUI
    const all = (reg?.getAll?.() || []).filter((d) => cities.includes(d.city));
    // Fallback: pull from ride service
    const fromRides = [];
    for (const city of cities) {
      // temporarily not switching — destinations() filters by current city; use registry only
    }
    const dests = all.length ? all : [];
    // Try hard to get registry from any global
    let registryAll = dests;
    try {
      const DR = g.hud?.worldMapUI?.constructor && null;
    } catch {}
    // Place specs
    const places = (g.world.interiorManager.places || []).map((p) => ({
      key: p.spec.key,
      name: p.spec.name,
      district: p.spec.district,
      stations: (p.spec.stations || []).length,
    }));
    // Landmarks per city
    const wdm = g.modules.WorldDataManager?.getInstance?.() || g.world.dataManager;
    const landmarks = {};
    for (const city of cities) {
      landmarks[city] = (wdm.landmarksOf?.(city) || []).map((lm) => ({
        id: lm.id,
        name: lm.name || lm.title,
        districtId: lm.districtId,
        type: lm.type,
      }));
    }
    return {
      destinations: registryAll.map((d) => ({
        id: d.id,
        name: d.name,
        city: d.city,
        district: d.district,
        districtName: d.districtName,
        category: d.category,
        isEnterable: !!d.isEnterable,
        interiorId: d.interiorId || '',
        aliases: d.aliases || [],
        street: d.streetPosition ? { x: d.streetPosition.x, z: d.streetPosition.z } : null,
        map: d.mapPosition ? { x: d.mapPosition.x, z: d.mapPosition.z } : null,
      })),
      places,
      landmarks,
    };
  }, CITIES);
}

/** Resolve DestinationRegistry through page when modules map is incomplete. */
async function catalogDestinations(page) {
  // Switch cities and collect ride destinations + map pins
  const byId = new Map();
  for (const city of CITIES) {
    await switchCity(page, city);
    await wait(400);
    const chunk = await page.evaluate((city) => {
      const g = window.game;
      const list = g.rides?.destinations?.() || [];
      // Also map pins
      const wdm = g.world.dataManager;
      const lms = wdm.landmarksOf?.(city) || wdm.getLandmarks?.() || [];
      return {
        dests: list.map((d) => ({
          id: d.id,
          name: d.name,
          city: d.city,
          district: d.district,
          districtName: d.districtName,
          category: d.category,
          isEnterable: !!d.isEnterable,
          interiorId: d.interiorId || '',
          aliases: d.aliases || [],
          street: d.streetPosition ? { x: +d.streetPosition.x.toFixed(2), z: +d.streetPosition.z.toFixed(2) } : null,
          map: d.mapPosition ? { x: +d.mapPosition.x.toFixed(2), z: +d.mapPosition.z.toFixed(2) } : null,
        })),
        landmarks: lms.map((lm) => ({ id: lm.id, name: lm.name || lm.title, districtId: lm.districtId, type: lm.type })),
        places: (g.world.interiorManager.places || []).map((p) => ({
          key: p.spec.key,
          name: p.spec.name,
          district: p.spec.district,
          stations: (p.spec.stations || []).length,
        })),
        roadside: (g.world.interactiveObjects || [])
          .filter((o) => /^roadside-/.test(o.id))
          .map((o) => ({ id: o.id, key: o.id.replace(/^roadside-/, ''), name: o.name || o.id })),
      };
    }, city);
    for (const d of chunk.dests) byId.set(d.id, d);
    // stash city-specific
    chunk._city = city;
    catalogDestinations._last = catalogDestinations._last || { landmarks: {}, roadside: {}, places: [] };
    catalogDestinations._last.landmarks[city] = chunk.landmarks;
    catalogDestinations._last.roadside[city] = chunk.roadside;
    if (chunk.places.length) catalogDestinations._last.places = chunk.places;
  }
  return {
    destinations: [...byId.values()],
    landmarks: catalogDestinations._last.landmarks,
    roadside: catalogDestinations._last.roadside,
    places: catalogDestinations._last.places,
  };
}

async function auditDestination(page, dest, opts = {}) {
  const id = dest.id;
  const base = `${dest.city}-${slug(dest.name)}`;
  const expectedKind = classifyExpected(dest.name, dest.category, dest.districtName);
  const row = {
    id,
    name: dest.name,
    city: dest.city,
    category: dest.category,
    bookedDistrict: dest.districtName,
    districtId: dest.district,
    isEnterable: !!dest.isEnterable,
    expectedKind,
    path: null,
    visited: false,
    captured: false,
    bookedName: null,
    setDown: null,
    actualDistrict: null,
    districtMatch: null,
    inside: null,
    interiorName: null,
    shownAs: null,
    uiOverlaps: [],
    unreachable: [],
    walkThrough: [],
    seatIssues: [],
    staffIssues: [],
    shots: {},
    defects: [],
    notes: [],
  };

  try {
    const travel = await travelByMap(page, id, dest.city);
    if (!travel.ok) {
      // Try alias pin ids
      let alt = null;
      for (const a of dest.aliases || []) {
        alt = await travelByMap(page, a, dest.city);
        if (alt.ok) break;
      }
      if (!alt?.ok) {
        row.path = 'unvisited';
        row.notes.push(travel.reason || 'travel-failed');
        // Fall back: set down at street position and try enter for enterables
        if (dest.street) {
          await switchCity(page, dest.city);
          await page.evaluate((s) => {
            const g = window.game;
            g.player.stopMoving();
            g.player.mesh.position.set(s.x, 0, s.z);
            g.cameraManager.snapToPlayer?.(g.player, 'street');
          }, dest.street);
          await wait(300);
          if (dest.isEnterable && dest.interiorId) {
            await page.evaluate((iid) => window.game.hud.onEnterInterior?.(iid), dest.interiorId);
            await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 15);
            row.path = 'teleport-enter-fallback';
            row.notes.push('map pin missing; teleported to streetPosition then enter');
          } else {
            row.path = 'teleport-street-fallback';
            row.notes.push('map pin missing; teleported to streetPosition only');
          }
        } else {
          row.defects.push({ sev: 'P0', cat: 'wrong location', detail: 'Could not visit: no map pin and no street position' });
          return row;
        }
      } else {
        Object.assign(travel, alt);
        row.path = `map-${alt.mode}`;
      }
    } else {
      row.path = `map-${travel.mode}`;
    }

    row.bookedName = travel.bookedName || dest.name;
    row.bookedDistrict = travel.bookedDistrict || dest.districtName;
    row.visited = true;

    const state = await snapshotState(page);
    row.setDown = { x: state.x, z: state.z, city: state.city };
    const dm = districtMatch(row.bookedDistrict, state);
    row.actualDistrict = dm.actual;
    row.districtMatch = dm.match;
    // Drift from booked street/map spot (interiors sit on a shell origin — compare before trusting a match)
    if (dest.street || dest.map) {
      const expect = dest.street || dest.map;
      const drift = Math.hypot(state.x - expect.x, state.z - expect.z);
      row.setDownDrift = +drift.toFixed(1);
      // If still outside and far from the booked spot, location is wrong
      if (!state.inside && drift > 80) row.districtMatch = false;
      // If inside but the shell origin is nowhere near the booked city street for Lagos island vs Ikeja-scale misses
      if (state.inside && dest.city === state.city && drift > 2500 && !/airport|express|ikeja/i.test(dest.districtName || '')) {
        // large shell offset alone is common; only flag when district tokens also failed
        if (dm.match === false) row.notes.push(`set-down drift ${drift.toFixed(0)}m`);
      }
    }
    row.inside = state.inside;
    row.interiorName = state.interiorName;
    const pres = assessPresentation(expectedKind, state, dest.name);
    row.shownAs = expectedKind === 'OPEN_AIR'
      ? (pres.shownAsBuilding ? 'BUILDING_SHELL' : 'OPEN_AIR')
      : (pres.shownAsBuilding ? 'BUILDING' : 'OUTDOOR_SITE');
    row.presentationDefects = pres.defects;
    row.meshCount = state.meshCount;

    // If enterable but still outside, try enter
    if (dest.isEnterable && !state.inside && dest.interiorId) {
      await page.evaluate((iid) => window.game.hud.onEnterInterior?.(iid), dest.interiorId);
      await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 12);
      const s2 = await snapshotState(page);
      row.inside = s2.inside;
      row.interiorName = s2.interiorName;
      Object.assign(state, s2);
    }

    // For enterable place-spec keys matching aliases, try door
    if (!row.inside && dest.isEnterable) {
      for (const a of [dest.interiorId, ...(dest.aliases || [])]) {
        const key = String(a || '').replace(/^roadside-/, '').replace(/^interior_place_/, '');
        if (!key) continue;
        const ent = await enterViaDoor(page, key);
        if (ent.ok) {
          row.notes.push(`entered via door ${ent.doorId}`);
          const s3 = await snapshotState(page);
          row.inside = s3.inside;
          row.interiorName = s3.interiorName;
          Object.assign(state, s3);
          break;
        }
      }
    }

    row.uiOverlaps = await checkUiOverlaps(page);
    const act = await checkActivitiesAndSolids(page);
    row.unreachable = act.unreachable;
    row.walkThrough = act.walkThrough;
    row.activityCount = act.activityCount;
    const seats = await checkSeatsBeds(page);
    row.seatIssues = seats.issues;
    row.seatCount = seats.seats.length;
    row.bedCount = seats.beds.length;
    const staff = await checkStaffPlacement(page);
    row.staffIssues = staff.issues;

    // Clipping heuristic: player y not near 0 / interior floor
    const y = await page.evaluate(() => +window.game.player.position.y.toFixed(3));
    if (Math.abs(y) > 0.35 && !row.inside) row.clipping = `player y=${y} (floating/sinking)`;
    if (row.inside && Math.abs(y) > 1.5) row.clipping = `player y=${y} indoors`;

    row.shots = await captureViews(page, base);
    row.captured = !!(row.shots.arrival && row.shots.onsite && row.shots.overview);
    row.defects = collectDefects(row);

    await leaveInterior(page);
  } catch (e) {
    row.notes.push(String(e?.message || e).slice(0, 240));
    row.defects.push({ sev: 'P0', cat: 'broken activity', detail: `Audit exception: ${String(e?.message || e).slice(0, 160)}` });
  }
  return row;
}

async function auditPlaceSpec(page, place, cityHint, coveredInteriorKeys) {
  const key = place.key;
  if (coveredInteriorKeys.has(key) || coveredInteriorKeys.has(`roadside-${key}`) || coveredInteriorKeys.has(`interior_place_${key}`)) {
    return null;
  }
  const expectedKind = classifyExpected(place.name, '', place.district);
  const base = `${cityHint || 'place'}-${slug(place.name)}`;
  const row = {
    id: `place:${key}`,
    name: place.name,
    city: cityHint || 'unknown',
    category: 'PlaceSpec',
    bookedDistrict: place.district,
    isEnterable: true,
    expectedKind,
    path: null,
    visited: false,
    captured: false,
    defects: [],
    notes: [],
  };

  try {
    // Prefer city from roadside presence
    let city = cityHint;
    if (!city || city === 'unknown') {
      for (const c of CITIES) {
        await switchCity(page, c);
        const has = await page.evaluate((k) => !!window.game.world.interactiveObjects.find((o) => o.id === `roadside-${k}`), key);
        if (has) { city = c; break; }
      }
    }
    if (!city) {
      row.path = 'unvisited';
      row.notes.push('no roadside door in any city');
      row.defects.push({ sev: 'P1', cat: 'broken activity', detail: 'PlaceSpec has no roadside door' });
      return row;
    }
    row.city = city;
    await switchCity(page, city);
    await moneyUp(page);
    // Set near door and enter — no map destination for orphan specs
    const ent = await enterViaDoor(page, key);
    if (!ent.ok) {
      // Direct interior enter
      await page.evaluate((k) => window.game.hud.onEnterInterior?.(`interior_place_${k}`) || window.game.hud.onEnterInterior?.(k), key);
      await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 15);
    }
    const state = await snapshotState(page);
    if (!state.inside && !ent.ok) {
      row.path = 'unvisited';
      row.notes.push('could not enter PlaceSpec');
      return row;
    }
    row.path = ent.ok ? 'door-card' : 'direct-enter';
    row.visited = true;
    row.bookedName = place.name;
    row.setDown = { x: state.x, z: state.z, city: state.city };
    row.actualDistrict = [state.interiorDistrict, state.districtName, state.districtSub].filter(Boolean).join(' | ');
    row.districtMatch = districtMatch(place.district, state).match;
    row.inside = state.inside;
    row.interiorName = state.interiorName;
    const pres = assessPresentation(expectedKind, state, place.name);
    row.shownAs = expectedKind === 'OPEN_AIR' ? (pres.shownAsBuilding ? 'BUILDING_SHELL' : 'OPEN_AIR') : (pres.shownAsBuilding ? 'BUILDING' : 'OUTDOOR_SITE');
    row.presentationDefects = pres.defects;
    row.meshCount = state.meshCount;
    row.uiOverlaps = await checkUiOverlaps(page);
    const act = await checkActivitiesAndSolids(page);
    row.unreachable = act.unreachable;
    row.walkThrough = act.walkThrough;
    const seats = await checkSeatsBeds(page);
    row.seatIssues = seats.issues;
    const staff = await checkStaffPlacement(page);
    row.staffIssues = staff.issues;
    row.shots = await captureViews(page, base);
    row.captured = !!(row.shots.arrival && row.shots.onsite && row.shots.overview);
    row.defects = collectDefects(row);
    await leaveInterior(page);
  } catch (e) {
    row.notes.push(String(e?.message || e).slice(0, 240));
  }
  return row;
}

async function buildContactSheets(results) {
  // Group by city; each sheet is an HTML grid of labelled thumbs, screenshotted as JPEG
  const browser = await launch();
  const page = await browser.newPage();
  const sheets = [];
  for (const city of CITIES) {
    const rows = results.filter((r) => r.city === city && r.captured);
    const chunkSize = 12;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const figures = chunk.map((r) => {
        const label = `${r.name}`.replace(/[<>&]/g, '');
        const imgs = ['arrival', 'onsite', 'overview'].map((k) => {
          const f = r.shots[k];
          if (!f || !fs.existsSync(f)) return '';
          const b64 = fs.readFileSync(f).toString('base64');
          return `<div class="v"><img src="data:image/png;base64,${b64}"><span>${k}</span></div>`;
        }).join('');
        return `<figure><figcaption>${label}</figcaption><div class="row">${imgs}</div></figure>`;
      }).join('');
      const html = `<!doctype html><html><head><style>
        body{margin:0;background:#1a1a1a;color:#fff;font:12px/1.3 system-ui,sans-serif}
        main{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px}
        figure{margin:0;background:#111;padding:6px;border-radius:4px}
        figcaption{font-weight:700;margin:0 0 6px;font-size:13px}
        .row{display:flex;gap:4px}
        .v{flex:1;min-width:0}
        .v img{width:100%;display:block;background:#333}
        .v span{display:block;text-align:center;opacity:.75;font-size:10px;margin-top:2px}
      </style></head><body><main>${figures}</main></body></html>`;
      const htmlPath = path.join(RAW_DIR, `sheet-${city}-${i}.html`);
      fs.writeFileSync(htmlPath, html);
      await page.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 120000 });
      const box = await page.evaluate(() => ({ w: Math.min(1600, document.body.scrollWidth), h: Math.min(4000, document.body.scrollHeight) }));
      await page.setViewport({ width: Math.max(800, box.w), height: Math.max(600, box.h), deviceScaleFactor: 1 });
      const out = path.join(SHEETS_DIR, `${city}-${String(i / chunkSize + 1).padStart(2, '0')}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 72, fullPage: true });
      sheets.push(out);
    }
  }
  await browser.close();

  // Compress further with ffmpeg if over budget
  let total = sheets.reduce((s, f) => s + fs.statSync(f).size, 0);
  if (total > 24 * 1024 * 1024) {
    for (const f of sheets) {
      const tmp = f + '.tmp.jpg';
      await new Promise((resolve, reject) => {
        import('node:child_process').then(({ spawn }) => {
          const p = spawn('ffmpeg', ['-y', '-i', f, '-q:v', '8', tmp], { stdio: 'ignore' });
          p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg fail'))));
        });
      }).catch(() => {});
      if (fs.existsSync(tmp)) {
        fs.renameSync(tmp, f);
      }
    }
    total = sheets.reduce((s, f) => s + fs.statSync(f).size, 0);
  }
  return { sheets, totalBytes: total };
}

function writeReport(results, meta) {
  const visited = results.filter((r) => r.visited && r.captured);
  const unvisited = results.filter((r) => !r.visited || !r.captured);
  const byCat = {};
  const bySev = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const r of results) {
    for (const d of r.defects || []) {
      byCat[d.cat] = (byCat[d.cat] || 0) + 1;
      bySev[d.sev] = (bySev[d.sev] || 0) + 1;
    }
  }
  const worst = [...results]
    .map((r) => ({
      r,
      score: (r.defects || []).reduce((s, d) => s + ({ P0: 40, P1: 20, P2: 8, P3: 2 }[d.sev] || 0), 0),
    }))
    .filter((x) => x.score > 0 && x.r.captured)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const lines = [];
  lines.push('# Nigeria Life — World Audit');
  lines.push('');
  lines.push(`Base commit: \`${meta.baseCommit}\`. Branch: \`${meta.branch}\`. Build served at \`${meta.gameUrl}\` (vite preview). Viewport: **390×844** touch.`);
  lines.push('');
  lines.push('Method: every destination was booked through the map (keke/taxi/bike/walk) where a pin existed; the ride cinematic was skipped after start so set-down still ran. Enterable PlaceSpecs without a destination used the roadside door card. A place is **not** marked fine unless arrival, on-site and overview images were captured and checked.');
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| Places in scope | ${results.length} |`);
  lines.push(`| Visited with photos | ${visited.length} |`);
  lines.push(`| Could not visit / no photos | ${unvisited.length} |`);
  lines.push(`| Defect instances | ${Object.values(bySev).reduce((a, b) => a + b, 0)} |`);
  for (const sev of ['P0', 'P1', 'P2', 'P3']) lines.push(`| ${sev} | ${bySev[sev] || 0} |`);
  lines.push('');
  lines.push('### By category');
  lines.push('');
  lines.push(`| Category | Count |`);
  lines.push(`|---|---:|`);
  for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${n} |`);
  }
  if (!Object.keys(byCat).length) lines.push(`| _(none recorded)_ | 0 |`);
  lines.push('');
  lines.push('## Worst 30 places');
  lines.push('');
  lines.push('| Rank | Place | City | Score | Top defects |');
  lines.push('|---:|---|---|---:|---|');
  worst.forEach((w, i) => {
    const tops = (w.r.defects || []).slice(0, 3).map((d) => `${d.sev} ${d.cat}`).join('; ');
    lines.push(`| ${i + 1} | ${w.r.name} | ${w.r.city} | ${w.score} | ${tops} |`);
  });
  lines.push('');
  lines.push('## Could not visit');
  lines.push('');
  if (!unvisited.length) {
    lines.push('_None — every place was captured._');
  } else {
    lines.push('| Place | City | Reason |');
    lines.push('|---|---|---|');
    for (const r of unvisited) {
      lines.push(`| ${r.name} | ${r.city} | ${(r.notes || []).join('; ') || r.path || 'no capture'} |`);
    }
  }
  lines.push('');
  lines.push('## Full place table');
  lines.push('');
  lines.push('| Place | City | Booked district | Set-down | Actual district | Match | Expected | Shown as | Path | Defects (P0–P3) |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))) {
    const sd = r.setDown ? `${r.setDown.x},${r.setDown.z}` : '—';
    const defs = (r.defects || []).map((d) => `${d.sev}:${d.cat}`).join('<br>') || (r.captured ? '_none observed_' : '_not assessed_');
    const match = r.districtMatch === null ? '—' : r.districtMatch ? 'yes' : 'NO';
    lines.push(`| ${r.name} | ${r.city} | ${r.bookedDistrict || '—'} | ${sd} | ${(r.actualDistrict || '—').replace(/\|/g, '/')} | ${match} | ${r.expectedKind} | ${r.shownAs || '—'} | ${r.path || '—'} | ${defs} |`);
  }
  lines.push('');
  lines.push('## Contact sheets');
  lines.push('');
  lines.push('Compressed labelled sheets live in `docs/audit/sheets/`. Each figure is captioned with the place name; columns are arrival / on-site / overview.');
  lines.push('');
  lines.push(`Sheet bytes total: **${(meta.sheetBytes / (1024 * 1024)).toFixed(2)} MB** (limit 25 MB).`);
  lines.push('');
  lines.push('## Severity legend');
  lines.push('');
  lines.push('| Level | Meaning |');
  lines.push('|---|---|');
  lines.push('| P0 | Blocks trust: wrong place, spawn in solid, audit could not complete a visit that should work |');
  lines.push('| P1 | Player is clearly let down: outdoor venue as a box, empty room, wrong seat/bed |');
  lines.push('| P2 | Noticeable: UI overlap, walk-through props, staff out of room, blocked activity |');
  lines.push('| P3 | Polish: mild clipping/floating |');
  lines.push('');
  lines.push(`Audit finished at ${meta.finishedAt} (Africa/Lagos). Results JSON: \`docs/audit/worldaudit-results.json\`.`);
  lines.push('');
  fs.writeFileSync(REPORT_MD, lines.join('\n'));
}

async function openPhone(ctx) {
  const page = await ctx.newPage();
  const log = { errors: [] };
  page.on('pageerror', (e) => log.errors.push('PAGEERR ' + e.message.slice(0, 240)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/AudioContext encountered an error from the audio device/.test(m.text())) {
      log.errors.push('CONSOLE ' + m.text().slice(0, 240));
    }
  });
  await page.emulate({
    viewport: { width: VIEWPORT.width, height: VIEWPORT.height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  });
  // Match lib.mjs noon pin + instant pickup so rides are bookable in tests
  await page.evaluateOnNewDocument(() => {
    try {
      if (!sessionStorage.getItem('__noonPinned')) sessionStorage.setItem('__noonPinned', '1');
    } catch { /* */ }
    const t = setInterval(() => {
      const sky = window.game?.world?.skyEnvironment;
      if (!sky) return;
      clearInterval(t);
      const h = sky.lagosHourNow();
      if (h < 9 || h >= 21) sky.setHour(12);
    }, 10);
    window.__nlInstantPickup = true;
  });
  const url = process.env.GAME_URL || 'http://127.0.0.1:4177/';
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game && window.game.hud && window.game.world', { timeout: 180000 });
  await wait(4000);
  return { page, log };
}

export async function run(browser, check) {
  ensureDirs();
  const ctx = await newPlayer(browser);
  const { page, log } = await openPhone(ctx);
  await closeDialogs(page);
  await moneyUp(page);

  const cat = await catalogDestinations(page);
  check('worldaudit: destinations discovered for three cities', cat.destinations.length >= 30, { n: cat.destinations.length });

  const results = [];
  const covered = new Set();

  // Limit via env for smoke runs (AUDIT_LIMIT / AUDIT_PLACE_LIMIT; empty = all)
  const limit = process.env.AUDIT_LIMIT != null && process.env.AUDIT_LIMIT !== ''
    ? Number(process.env.AUDIT_LIMIT)
    : cat.destinations.length;
  const dests = cat.destinations.slice(0, Number.isFinite(limit) ? limit : cat.destinations.length);

  for (let i = 0; i < dests.length; i++) {
    const dest = dests[i];
    console.log(`[worldaudit] ${i + 1}/${dests.length} ${dest.city} ${dest.name}`);
    const row = await auditDestination(page, dest);
    results.push(row);
    covered.add(dest.id);
    for (const a of dest.aliases || []) covered.add(a);
    if (dest.interiorId) covered.add(dest.interiorId.replace(/^roadside-/, '').replace(/^interior_place_/, ''));
    // Persist incrementally
    fs.writeFileSync(RESULTS_JSON, JSON.stringify({ results, catalog: { destinations: cat.destinations.length, places: cat.places.length } }, null, 2));
  }

  // Orphan PlaceSpecs (enterables not covered)
  const orphans = (cat.places || []).filter((p) => !covered.has(p.key));
  const orphanLimit = process.env.AUDIT_PLACE_LIMIT != null && process.env.AUDIT_PLACE_LIMIT !== ''
    ? Number(process.env.AUDIT_PLACE_LIMIT)
    : orphans.length;
  for (let i = 0; i < Math.min(orphans.length, orphanLimit); i++) {
    const place = orphans[i];
    console.log(`[worldaudit] place ${i + 1}/${Math.min(orphans.length, orphanLimit)} ${place.key}`);
    const row = await auditPlaceSpec(page, place, null, covered);
    if (row) {
      results.push(row);
      covered.add(place.key);
      fs.writeFileSync(RESULTS_JSON, JSON.stringify({ results }, null, 2));
    }
  }

  const sheetInfo = await buildContactSheets(results);
  const baseCommit = process.env.AUDIT_BASE || 'bf55dab';
  writeReport(results, {
    baseCommit,
    branch: 'cursor/world-audit',
    gameUrl: process.env.GAME_URL || 'http://127.0.0.1:4177/',
    sheetBytes: sheetInfo.totalBytes,
    finishedAt: new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }) + ' Africa/Lagos',
  });

  const visited = results.filter((r) => r.captured).length;
  const need = Math.max(1, Math.floor(dests.length * 0.5));
  check('worldaudit: captured photos for a majority of destinations', visited >= need, { visited, dests: dests.length, need });
  check('worldaudit: wrote WORLD_AUDIT.md', fs.existsSync(REPORT_MD));
  check('worldaudit: contact sheets under 25MB', sheetInfo.totalBytes < 25 * 1024 * 1024, { mb: +(sheetInfo.totalBytes / (1024 * 1024)).toFixed(2), files: sheetInfo.sheets.length });
  check('worldaudit: no page errors flooding', log.errors.length < 40, log.errors.slice(0, 5));

  await ctx.close();
}

// Standalone entry
{
  const { pathToFileURL } = await import('node:url');
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const browser = await launch();
    const { check, summary } = (await import('./lib.mjs')).reporter();
    try {
      await run(browser, check);
    } catch (e) {
      console.error(e);
      check('worldaudit: completed', false, String(e).slice(0, 400));
    } finally {
      await browser.close();
    }
    process.exit(summary() ? 1 : 0);
  }
}
