// E2E test for Compound fencing, sliding security gate, driveway, flowers, and car brand badges.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/b9c44c55-f7bc-420a-8af0-4637d105c126';

const snap = async (page, name) => {
  await page.evaluate(() => {
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await page.setViewport({ width: 1200, height: 800 });
  await closeDialogs(page);

  // Setup: give money and place a luxury house on Banana Island (lag-banana-e1)
  const setupRes = await page.evaluate(async () => {
    const g = window.game;
    const b = g.hud.backend;
    b.data.bank.balance = 5_000_000_000;
    b.saveData();

    // Buy plot and start building a duplex residence on Banana Island
    const plotId = 'lag-banana-e1';
    const buy = await g.land.buyFromState(plotId);
    const build = await g.land.startBuilding(plotId, 'duplex', 137, -32, 1);

    // Fast-forward building hours to 100% finished
    await g.registry.transact((state) => {
      const bld = state.buildings[plotId];
      if (bld) {
        bld.startedAt = Date.now() - 360000000;
      }
      return { ok: true };
    });

    g.plotWorld.refresh();
    return {
      buy,
      build,
      status: g.land.status(plotId),
      hasHome: g.land.hasHome(),
      compoundsCount: g.plotWorld.compounds.size,
    };
  });

  check(
    'compound: building a house generates a compound with compound drawing recorded',
    setupRes.status === 'developed' && setupRes.compoundsCount >= 1,
    setupRes,
  );

  // 1. Inspect Compound 3D structure and flowerbeds
  const compoundDetails = await page.evaluate(() => {
    const g = window.game;
    const comp = g.plotWorld.compounds.get('lag-banana-e1');
    if (!comp) return null;
    const children = comp.drawing.group.children.map((c) => c.name);
    return {
      name: comp.plot.name,
      hasLeaf: !!comp.drawing.leaf,
      leafName: comp.drawing.leaf.name,
      hasCentre: !!comp.drawing.centre,
      hasPost: !!comp.drawing.post,
      fixedCount: comp.drawing.fixed.length,
      parkingBaysCount: comp.drawing.parkingBays?.length ?? 0,
      children,
      isOpen: comp.open,
      progress: comp.progress,
    };
  });

  check(
    'compound: compound includes sliding iron gate, pillars, driveway, perimeter walls, and gatehouse post',
    compoundDetails !== null &&
      compoundDetails.hasLeaf &&
      compoundDetails.hasCentre &&
      compoundDetails.hasPost &&
      compoundDetails.fixedCount >= 3 &&
      compoundDetails.parkingBaysCount >= 3 &&
      compoundDetails.isOpen === false &&
      compoundDetails.progress === 0,
    compoundDetails,
  );

  // 2. Position camera and take screenshot of the compound, gate, and flowers
  await page.evaluate(() => {
    const g = window.game;
    const comp = g.plotWorld.compounds.get('lag-banana-e1');
    if (!comp) return;
    g.player.stopMoving();
    // Stand in front of the gate looking at the compound and flowerbeds
    g.player.mesh.position.set(comp.drawing.outside.x, 0, comp.drawing.outside.z);
    g.cameraManager.camera.position.set(comp.drawing.outside.x - 10, 4.5, comp.drawing.outside.z - 6);
    g.cameraManager.camera.lookAt(comp.drawing.centre.x, 1.5, comp.drawing.centre.z);
  });
  await wait(400);
  await snap(page, 'compound-1-gate-closed');

  // 3. Test sliding gate opening mechanism & collision obstruction removal
  const openResult = await page.evaluate(() => {
    const g = window.game;
    const opened = g.plotWorld.toggleGate('lag-banana-e1');
    const comp = g.plotWorld.compounds.get('lag-banana-e1');
    return {
      opened,
      targetProgress: comp?.targetProgress,
      isOpen: comp?.open,
    };
  });

  check('compound: toggleGate sets gate to open and targets progress 1.0', openResult.opened && openResult.targetProgress === 1, openResult);

  // Fast forward tick to complete slide
  await page.evaluate(() => {
    const g = window.game;
    // Step 2 seconds of delta to fully open the sliding gate
    g.plotWorld.tick(2.0);
  });
  await wait(300);
  await snap(page, 'compound-2-gate-opened');

  const afterOpenObstructions = await page.evaluate(() => {
    const g = window.game;
    const comp = g.plotWorld.compounds.get('lag-banana-e1');
    const obs = g.plotWorld.obstructions('lagos');
    const hasLeafSolid = obs.some((o) => o.owner.includes('Gate of'));
    return {
      progress: comp?.progress,
      hasLeafSolid,
    };
  });

  check(
    'compound: when gate is fully open, leaf has slid and leafSolid obstruction is removed so cars can drive through',
    afterOpenObstructions.progress === 1 && afterOpenObstructions.hasLeafSolid === false,
    afterOpenObstructions,
  );

  // 4. Test gate toggle closing
  const closeResult = await page.evaluate(() => {
    const g = window.game;
    const opened = g.plotWorld.toggleGate('lag-banana-e1');
    const comp = g.plotWorld.compounds.get('lag-banana-e1');
    g.plotWorld.tick(2.0);
    const obs = g.plotWorld.obstructions('lagos');
    const hasLeafSolid = obs.some((o) => o.owner.includes('Gate of'));
    return {
      opened,
      progress: comp?.progress,
      hasLeafSolid,
    };
  });

  check(
    'compound: toggling gate again slides it shut and restores solid obstruction boundary',
    closeResult.opened === false && closeResult.progress === 0 && closeResult.hasLeafSolid === true,
    closeResult,
  );

  // 5. Verify authentic car brand visual identity (Rolls-Royce Spirit of Ecstasy & Pantheon Grille, Mercedes Star)
  const carBrandDetails = await page.evaluate(() => {
    const CAR_SPECS = window.game.modules?.CAR_SPECS;
    return {
      cullinanBrand: CAR_SPECS?.cullinan?.brand,
      mercedesBrand: CAR_SPECS?.gwagon?.brand,
      bmwBrand: CAR_SPECS?.bmw_7?.brand,
      lamboBrand: CAR_SPECS?.aventador?.brand,
    };
  });

  check(
    'compound: luxury car models have authentic brand designations',
    carBrandDetails.cullinanBrand === 'rolls_royce' &&
      carBrandDetails.mercedesBrand === 'mercedes' &&
      carBrandDetails.bmwBrand === 'bmw' &&
      carBrandDetails.lamboBrand === 'lamborghini',
    carBrandDetails,
  );
}

