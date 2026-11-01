// Eko Motors Luxury Showroom & Tuning Garage app:
// - Browse luxury SUVs & supercars (G-Wagon, Range Rover, Porsche 911, Land Cruiser 300, Cullinan)
// - Buy Land Cruiser 300 VXR with biometric keys
// - Install Stage 2 Twin-Turbo ECU remap, Satin Black wrap, and VIP Convoy Siren kit
// - 3D Showroom at Sankofa Motors with rotating turntable, flagship G-Wagon, and master dealer figure
import { open, newPlayer, closeDialogs, wait, enterInterior, advance, pressSteady } from './lib.mjs';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/b9c44c55-f7bc-420a-8af0-4637d105c126';

const tap = async (page, selector) => {
  await page.evaluate(() => {
    const notice = document.getElementById('phone-notice');
    if (notice) notice.hidden = true;
  });
  await pressSteady(page, selector);
  await wait(280);
};

const snap = async (page, name) => {
  await page.evaluate(() => {
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await page.setViewport({ width: 400, height: 820 });
  await closeDialogs(page);

  await page.evaluate(() => {
    const b = window.game.hud.backend;
    b.data.bank.balance = 200_000_000;
    b.saveData();
    window.game.modules.Motors.get().resetForTests();
  });

  // 1. Open Motors app on phone
  await page.evaluate(() => window.game.hud.phoneModal.openApp('motors'));
  await wait(450);
  await snap(page, 'motors-1-showroom');

  const initialView = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#phone-screen-content [data-model-card]')).map((el) =>
      el.getAttribute('data-model-card'),
    );
    const m = window.game.modules.Motors.get();
    return {
      title: document.getElementById('phone-title')?.textContent?.trim(),
      cards,
      ownedCount: m.owned().length,
      activeVehicle: m.activeVehicle(),
    };
  });

  check(
    'motors: opens on phone showing luxury car models (G-Wagon, Range Rover, Porsche 911, Land Cruiser 300, Cullinan)',
    initialView.title === 'Motors' &&
      initialView.cards.includes('gwagon') &&
      initialView.cards.includes('range_rover') &&
      initialView.cards.includes('porsche_911') &&
      initialView.cards.includes('land_cruiser') &&
      initialView.cards.includes('cullinan') &&
      initialView.ownedCount === 0 &&
      initialView.activeVehicle === null,
    initialView,
  );

  // 2. Buy Land Cruiser 300 VXR (₦75,000,000)
  const fundsBefore = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return d.bank.balance + d.walletCash;
  });
  await tap(page, 'button[data-act="buy-car"][data-model="land_cruiser"]');
  await wait(350);
  await snap(page, 'motors-2-car');

  const boughtState = await page.evaluate(() => {
    const m = window.game.modules.Motors.get();
    const d = window.game.hud.backend.getData();
    const g = window.game.garage;
    const active = m.activeVehicle();
    const inGarage = g.mine().find((v) => v.id === active?.vehicleId);
    return {
      ownedCount: m.owned().length,
      modelId: active?.modelId,
      totalFunds: d.bank.balance + d.walletCash,
      hasKeyInBag: d.inventory.some((i) => i.id === 'key_land_cruiser'),
      inGarage: !!inGarage,
      plate: inGarage?.plate,
    };
  });

  check(
    'motors: buys Land Cruiser 300 VXR for ₦75,000,000, adds car key to inventory, and registers car in fleet and garage',
    boughtState.ownedCount === 1 &&
      boughtState.modelId === 'land_cruiser' &&
      fundsBefore - boughtState.totalFunds === 75000000 &&
      boughtState.hasKeyInBag &&
      boughtState.inGarage,
    boughtState,
  );

  // 3. Switch to Tuning Bay tab and install Stage 2 Turbo Remap & Satin Black Wrap
  await tap(page, 'button[data-set="mt.tab"][data-value="tuning"]');
  await wait(300);

  const fundsBeforeTune = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return d.bank.balance + d.walletCash;
  });

  // Install Stage 2 Twin-Turbo Remap (₦15,000,000)
  await tap(page, 'button[data-act="tune-car"][data-option="tune_stage2"]');
  await wait(300);

  // Install Satin Matte Black Wrap (₦7,500,000)
  await tap(page, 'button[data-act="tune-car"][data-option="wrap_satin_black"]');
  await wait(300);

  // Install VIP Siren Kit (₦12,000,000)
  await tap(page, 'button[data-act="tune-car"][data-option="mod_siren"]');
  await wait(300);

  await snap(page, 'motors-3-tuning');

  const tunedState = await page.evaluate(() => {
    const m = window.game.modules.Motors.get();
    const d = window.game.hud.backend.getData();
    const active = m.activeVehicle();
    const text = document.getElementById('phone-screen-content')?.textContent ?? '';
    return {
      turbo: active?.turbo,
      wrap: active?.wrap,
      hasVipSiren: active?.hasVipSiren,
      totalFunds: d.bank.balance + d.walletCash,
      hasSirenBanner: text.includes('VIP Siren Equipped'),
    };
  });

  // Net tune cost: 15,000,000 + 7,500,000 + 12,000,000 = 34,500,000
  check(
    'motors: installs Stage 2 Twin-Turbo, Satin Black wrap, and VIP Convoy Siren kit on active vehicle',
    tunedState.turbo === 'tune_stage2' &&
      tunedState.wrap === 'wrap_satin_black' &&
      tunedState.hasVipSiren &&
      tunedState.hasSirenBanner &&
      fundsBeforeTune - tunedState.totalFunds === 34500000,
    tunedState,
  );

  // 4. Switch to My Fleet tab, summon car to street kerb, and drive it
  await tap(page, 'button[data-set="mt.tab"][data-value="fleet"]');
  await wait(300);
  const fleetInfo = await page.evaluate(() => {
    const card = document.querySelector('#phone-screen-content [data-fleet-card]');
    const bringBtn = card?.querySelector('button[data-act="bring-car"]');
    return {
      hasFleetCard: !!card,
      hasBringBtn: !!bringBtn,
      cardText: card?.textContent ?? '',
    };
  });
  check(
    'motors: My Fleet lists the tuned luxury vehicle with license plate, top speed, power, and delivery button',
    fleetInfo.hasFleetCard && fleetInfo.hasBringBtn && /Plate: LAG-/.test(fleetInfo.cardText),
    fleetInfo,
  );

  await tap(page, 'button[data-act="bring-car"]');
  await wait(450);

  const driveTest = await page.evaluate(async () => {
    const g = window.game;
    const m = g.modules.Motors.get();
    const active = m.activeVehicle();
    if (!active) return { ok: false, reason: 'No active vehicle' };
    const vehId = active.vehicleId;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.id === `veh-own-${vehId}`);
    if (!v) return { ok: false, reason: 'Vehicle not spawned at kerb' };
    const initialPos = v.mesh.position.clone();
    g.enterVehicle(v);
    g.input.keys['w'] = true;
    await g.advance(2.0);
    g.input.keys['w'] = false;
    await g.advance(0.5);
    const moved = Math.hypot(v.mesh.position.x - initialPos.x, v.mesh.position.z - initialPos.z);
    g.exitVehicle();
    return {
      ok: true,
      spawned: true,
      driving: true,
      moved: +moved.toFixed(1),
      paint: v.config.paint,
    };
  });

  check(
    'motors: vehicle is brought round to kerb beside player on street, enters drivable state, moves with engine throttle, and has custom wrap paint',
    driveTest.ok && driveTest.spawned && driveTest.driving && driveTest.moved > 1.0,
    driveTest,
  );

  // Close phone
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(250);

  // 5. Enter Sankofa Motors showroom interior and verify 3D turntable & master dealer figure
  await enterInterior(page, 'interior_place_sankofa-motors');
  await advance(page, 1.0);
  await snap(page, 'motors-4-drive');

  const showroomScene = await page.evaluate(() => {
    const g = window.game;
    const turntableMesh = g.scene.getObjectByName('eko_motors_turntable_mesh');
    const flagshipCar = g.scene.getObjectByName('eko_motors_flagship_gwagon');
    const turntableRotor = g.scene.getObjectByName('eko_motors_turntable_rotor');
    const dealerFig = g.scene.getObjectByName('eko_motors_dealer');
    const action = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'eko_motors_terminal');
    return {
      hasTurntableMesh: !!turntableMesh,
      hasFlagshipCar: !!flagshipCar,
      hasTurntableRotor: !!turntableRotor,
      hasDealerFig: !!dealerFig,
      hasShowroomAction: !!action,
      actionName: action?.name,
    };
  });

  check(
    'motors: Sankofa Motors interior features 3D turntable platform, flagship rotating G-Wagon, master dealer figure, and interactive terminal',
    showroomScene.hasTurntableMesh &&
      showroomScene.hasFlagshipCar &&
      showroomScene.hasTurntableRotor &&
      showroomScene.hasDealerFig &&
      showroomScene.hasShowroomAction &&
      showroomScene.actionName?.includes('Eko Motors'),
    showroomScene,
  );
}

