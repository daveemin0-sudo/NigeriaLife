import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity-ide/brain/9ec81de7-a439-4903-85c6-9c6db07e4f98';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function main() {
  console.log('Launching browser for vehicle, wardrobe & property verification...');
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
    await page.waitForFunction(() => window.game && window.game.player && window.game.cameraManager && window.game.world.vehicles, { timeout: 30000 });
    console.log('Game initialized!');
    await new Promise((r) => setTimeout(r, 3500));

    // Disable camera auto-follow update for custom staging
    await page.evaluate(() => {
      window.game.cameraManager.update = () => {};
    });

    // 1. Capture Danfo Bus with corrected flat roof and longitudinal ribs
    console.log('Staging Danfo Bus...');
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // Danfo is at (-8.5, 0, 10), facing 0 (+Z)
      cam.position.set(-11.5, 2.6, 14.5);
      cam.lookAt(-8.5, 1.3, 10);
    });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${ARTIFACT_DIR}/v01_danfo_roof_corrected.png` });
    console.log('Captured v01_danfo_roof_corrected.png');

    // 2. Capture Keke NAPEP with rectangular canopy and drooping valances
    console.log('Staging Keke NAPEP...');
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // Keke is at (9.2, 0, 4), facing Math.PI/2 (+X)
      cam.position.set(6.8, 1.8, 6.5);
      cam.lookAt(9.2, 0.9, 4);
    });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${ARTIFACT_DIR}/v02_keke_canopy_corrected.png` });
    console.log('Captured v02_keke_canopy_corrected.png');

    // 3. Staging Shot: Toyota Corolla Tokunbo
    console.log('Staging Toyota Corolla Tokunbo...');
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // Sedan is at (12.5, 0, -6.5), facing Math.PI/2
      cam.position.set(9.6, 1.7, -4.0);
      cam.lookAt(12.5, 0.8, -6.5);
    });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${ARTIFACT_DIR}/v03_sedan_corolla.png` });
    console.log('Captured v03_sedan_corolla.png');

    // 4. Staging Shot: Mercedes-AMG G63 G-Wagon
    console.log('Staging Mercedes-AMG G63...');
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // G-Wagon is at (8.5, 0, 24.0), facing -Math.PI/2
      cam.position.set(11.8, 2.4, 27.2);
      cam.lookAt(8.5, 1.3, 24.0);
    });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${ARTIFACT_DIR}/v04_gwagon_amg.png` });
    console.log('Captured v04_gwagon_amg.png');

    // 5. Staging Shot: Porsche 911 GT3 Supercar
    console.log('Staging Porsche 911 GT3 Supercar...');
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // Sports car is at (-8.5, 0, -22.0), facing Math.PI
      cam.position.set(-11.4, 1.6, -19.0);
      cam.lookAt(-8.5, 0.7, -22.0);
    });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${ARTIFACT_DIR}/v05_sports_car_gt3.png` });
    console.log('Captured v05_sports_car_gt3.png');

    // 6. Staging Shot: LASAMBUS Emergency Rescue Van
    console.log('Staging LASAMBUS Emergency Rescue Van...');
    await page.evaluate(() => {
      const game = window.game;
      const cam = game.cameraManager.camera;
      // Ambulance is at (12.0, 0, 14.0), facing 0
      cam.position.set(9.0, 2.5, 17.5);
      cam.lookAt(12.0, 1.5, 14.0);
    });
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({ path: `${ARTIFACT_DIR}/v06_lasambus_ambulance.png` });
    console.log('Captured v06_lasambus_ambulance.png');

    // 7. Open Wardrobe Studio Modal and capture UI
    console.log('Opening Wardrobe Studio Modal...');
    await page.evaluate(() => {
      window.game.hud.creatorModal.open('wardrobe');
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: `${ARTIFACT_DIR}/w01_wardrobe_studio_tops.png` });
    console.log('Captured w01_wardrobe_studio_tops.png');

    // Switch to Footwear tab in Boutique
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const shoesBtn = btns.find((b) => b.textContent && b.textContent.includes('Shoes'));
      if (shoesBtn) shoesBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/w02_wardrobe_studio_footwear.png` });
    console.log('Captured w02_wardrobe_studio_footwear.png');

    // Switch to Bling / Accessories tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const blingBtn = btns.find((b) => b.textContent && b.textContent.includes('Bling'));
      if (blingBtn) blingBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${ARTIFACT_DIR}/w03_wardrobe_studio_accessories.png` });
    console.log('Captured w03_wardrobe_studio_accessories.png');

    // Close Wardrobe modal
    await page.evaluate(() => {
      window.game.hud.creatorModal.close();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 8. Open Phone Land & Real Estate App to verify 17 Properties and Weekly Rent Schedules
    console.log('Opening Phone Property & Land App...');
    await page.evaluate(() => {
      const phone = window.game.hud.phoneModal;
      phone.openApp('land');
    });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: `${ARTIFACT_DIR}/p01_phone_properties_rent.png` });
    console.log('Captured p01_phone_properties_rent.png');

    // 9. Open Phone Garage App to verify 10 Vehicle Models in Dealership Showroom
    console.log('Opening Phone Garage App...');
    await page.evaluate(() => {
      const phone = window.game.hud.phoneModal;
      phone.openApp('garage');
    });
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: `${ARTIFACT_DIR}/p02_phone_garage_showroom.png` });
    console.log('Captured p02_phone_garage_showroom.png');

    console.log('All verification screenshots successfully captured!');
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await browser.close();
  }
}

main();
