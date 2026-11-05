import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity-ide/brain/9ec81de7-a439-4903-85c6-9c6db07e4f98';
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.game && window.game.hud && window.game.hud.phoneModal, { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Open phone garage app
    await page.evaluate(() => {
      window.game.hud.phoneModal.openApp('garage');
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Click 'Dealer' chip button on the phone screen
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('#smartphone-wrapper button.nl-chip'));
      const dealerChip = chips.find((c) => c.textContent && c.textContent.trim() === 'Dealer');
      if (dealerChip) dealerChip.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    await page.screenshot({ path: `${ARTIFACT_DIR}/p03_phone_garage_dealer_catalogue.png` });
    console.log('Captured p03_phone_garage_dealer_catalogue.png');
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

main();
