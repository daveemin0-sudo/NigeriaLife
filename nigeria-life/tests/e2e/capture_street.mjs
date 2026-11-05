import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity-ide/brain/9ec81de7-a439-4903-85c6-9c6db07e4f98';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function capture() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--use-angle=d3d11',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--window-size=1600,900',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });

    console.log('Navigating to http://localhost:5173/ ...');
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 60000 });

    // Wait for game to initialize
    await page.waitForFunction(() => window.game && window.game.player && window.game.cameraManager, { timeout: 30000 });
    console.log('Game initialized!');

    // Let simulation run for 3.5 seconds
    await new Promise((r) => setTimeout(r, 3500));

    // 1. Street Overview
    await page.screenshot({ path: `${ARTIFACT_DIR}/street_01_overview.png` });
    console.log('Captured street_01_overview.png');

    // Disable camera auto-follow update so we can frame close-up shots precisely
    await page.evaluate(() => {
      window.game.cameraManager.update = () => {};
    });

    // 2. Close-up of Player (@Bayo) in authentic Agbada + Fila Gobi + Sculpted 3D Face + Accessories
    await page.evaluate(() => {
      const game = window.game;
      const player = game.player;
      player.mesh.rotation.y = 0; // Face forward (+Z direction)
      
      const cam = game.cameraManager.camera;
      // Eye level is y = 1.66m
      cam.position.set(player.position.x, player.position.y + 1.66, player.position.z + 0.95);
      cam.lookAt(player.position.x, player.position.y + 1.64, player.position.z);
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/street_02_player_face_closeup.png` });
    console.log('Captured street_02_player_face_closeup.png');

    // 3. Medium / Full-body of Player from 3/4 front angle
    await page.evaluate(() => {
      const game = window.game;
      const player = game.player;
      player.mesh.rotation.y = 0.25; // 3/4 aesthetic turn
      
      const cam = game.cameraManager.camera;
      cam.position.set(player.position.x - 0.45, player.position.y + 1.35, player.position.z + 2.4);
      cam.lookAt(player.position.x, player.position.y + 1.15, player.position.z);
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/street_03_player_fullbody.png` });
    console.log('Captured street_03_player_fullbody.png');

    // 4. Close-up of Sgt. Bello (Traffic Warden in official LASTMA uniform & peaked police cap)
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // Sgt Bello is at (0, 0, 1.5) facing +Z, head at y = 1.66
      cam.position.set(0, 1.66, 2.3);
      cam.lookAt(0, 1.64, 1.5);
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/street_04_warden_closeup.png` });
    console.log('Captured street_04_warden_closeup.png');

    // 5. Sidewalk street NPCs (Tunde Wealth Advisor outside bank in Senator suit)
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // Tunde is at (12, 0, -11) rotated -PI/2 (facing -X)
      // Position camera in front of Tunde
      cam.position.set(10.8, 1.65, -11.0);
      cam.lookAt(12.0, 1.63, -11.0);
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/street_05_sidewalk_npcs.png` });
    console.log('Captured street_05_sidewalk_npcs.png');

    // 6. Drinks Hawker Chidi patrolling with pure water tray on head
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      const hawkerPos = game.world.npcs.hawkerSpot || { x: -8.5, y: 0, z: -15 };
      cam.position.set(hawkerPos.x, 1.66, hawkerPos.z + 1.4);
      cam.lookAt(hawkerPos.x, 1.64, hawkerPos.z);
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/street_06_hawker_chidi.png` });
    console.log('Captured street_06_hawker_chidi.png');

    // 7. Ordinary Sidewalk Walking Citizens (e.g. Alhaji Musa in Agbada / Femi / Blessing)
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // East sidewalk around z = 24 has Alhaji Musa in Agbada and walking citizens
      cam.position.set(7.2, 1.65, 26.0);
      cam.lookAt(9.0, 1.55, 26.0);
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/street_07_sidewalk_citizens.png` });
    console.log('Captured street_07_sidewalk_citizens.png');

  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

capture();
