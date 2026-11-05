// E2E test for the "Spark" dating app:
//   1. Browsing made-up profiles on Spark (Zainab Bello, Tolu Adebayo, Amaka Okafor, Damilola Coker, Chuka Eze, Kemi Adesanya)
//   2. Liking & matching with a profile, verifying they appear in MessageService.contacts(), chatting via MessageService, and receiving their reply
//   3. Arranging a date at a real restaurant or lounge (The Library in Ikoyi) and verifying the date is standing in 3D inside the venue waiting
//   4. Acting out the date in 3D, paying the date bill once, raising social/fun/hunger & closeness, and recording the completed date
import path from 'node:path';
import { open, wait, newPlayer, closeDialogs, leaveInterior, steadyPoint, advance, playUntil, money } from './lib.mjs';

const PHONE = '#smartphone-wrapper';
const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/b9c44c55-f7bc-420a-8af0-4637d105c126';

const openApp = async (page, id, route = '') => {
  const wasOpen = await page.evaluate(
    ({ id, route }) => {
      const phone = window.game.hud.phoneModal;
      const isOpen = phone.isOpen;
      phone.openApp(id, route);
      return isOpen;
    },
    { id, route },
  );
  await wait(wasOpen ? 180 : 650);
};

const clickPhone = async (page, selector) => {
  const at = await steadyPoint(page, `${PHONE} ${selector}`);
  if (!at) throw new Error(`Nothing on the phone matches ${selector}`);
  await page.mouse.click(at.x, at.y);
  await wait(240);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await page.setViewport({ width: 400, height: 820 });
  await closeDialogs(page);

  // Lower vitals slightly so we can verify the date raises social, fun, and hunger
  await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    d.stats.social = 50;
    d.stats.fun = 50;
    d.stats.hunger = 50;
    window.game.hud.backend.saveData();
  });

  // 1. Open Spark app and check the 6 made-up profiles on Discover
  await openApp(page, 'spark');
  const initialView = await page.evaluate(() => {
    const spark = window.game.modules.Spark.get();
    const profiles = spark.profiles();
    const pills = Array.from(document.querySelectorAll('#smartphone-wrapper [data-act="select-profile"]')).map((el) =>
      el.textContent.trim(),
    );
    const cardText = document.querySelector('#smartphone-wrapper [data-spark-profile]')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
    return {
      title: document.getElementById('phone-title')?.textContent,
      profileCount: profiles.length,
      names: profiles.map((p) => p.name),
      pills,
      cardText,
      contactsBeforeMatch: window.game.messages.contacts().length,
    };
  });

  check(
    'spark: opens with 6 made-up Lagos profiles (Zainab Bello, Tolu Adebayo, Amaka Okafor, Damilola Coker, Chuka Eze, Kemi Adesanya) and 0 contacts before matching',
    initialView.title === 'Spark' &&
      initialView.profileCount === 6 &&
      initialView.names.includes('Zainab Bello') &&
      initialView.names.includes('Tolu Adebayo') &&
      initialView.pills.length === 6 &&
      /Zainab Bello/.test(initialView.cardText) &&
      /The Library/.test(initialView.cardText) &&
      initialView.contactsBeforeMatch === 0,
    initialView,
  );

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'spark-1-profiles.png') });

  // 2. Like & match with Zainab Bello, verify she appears in MessageService.contacts(), and chat with her
  await clickPhone(page, '[data-act="like-profile"][data-profile="zainab"]');
  await wait(250);

  const afterMatch = await page.evaluate(() => {
    const spark = window.game.modules.Spark.get();
    const contacts = window.game.messages.contacts();
    const thread = window.game.messages.thread('spark:zainab');
    return {
      isMatched: spark.isMatched('zainab'),
      contacts: contacts.map((c) => ({ id: c.id, name: c.name, note: c.note })),
      threadCount: thread.length,
      firstMessage: thread[0]?.text ?? null,
    };
  });

  check(
    'spark: liking Zainab Bello creates a match, adds her to MessageService.contacts(), and delivers her opening icebreaker message',
    afterMatch.isMatched &&
      afterMatch.contacts.some((c) => c.id === 'spark:zainab' && c.name === 'Zainab Bello') &&
      afterMatch.threadCount === 1 &&
      /The Library/.test(afterMatch.firstMessage ?? ''),
    afterMatch,
  );

  // Switch to Chat tab in Spark and send a message through MessageService
  await clickPhone(page, '[data-act="open-chat"][data-profile="zainab"]');
  await clickPhone(page, '[data-act="quick-msg"][data-contact="spark:zainab"]');
  // Advance game clock so MessageService's pending reply is delivered
  await advance(page, 2.0);
  await openApp(page, 'spark');

  const afterChat = await page.evaluate(() => {
    const thread = window.game.messages.thread('spark:zainab');
    return {
      count: thread.length,
      messages: thread.map((m) => ({ from: m.from, text: m.text })),
    };
  });

  check(
    'spark: chatting with Zainab Bello sends the player message via MessageService and delivers her custom Spark reply',
    afterChat.count >= 3 &&
      afterChat.messages.some((m) => m.from === 'me') &&
      afterChat.messages.filter((m) => m.from === 'them').length >= 2,
    afterChat,
  );

  await page.evaluate(() => {
    const notice = document.getElementById('phone-notice');
    if (notice) notice.hidden = true;
  });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'spark-2-chat.png') });

  // 3. Schedule a date with Zainab Bello at The Library (the-library)
  await clickPhone(page, '[data-act="schedule-date"][data-profile="zainab"]');
  await wait(250);

  const scheduled = await page.evaluate(() => {
    const spark = window.game.modules.Spark.get();
    const active = spark.activeDate();
    const banner = document.getElementById('spark-active-date')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
    return { active, banner };
  });

  check(
    'spark: scheduling a date sets an active waiting date with Zainab Bello at The Library (₦45,000)',
    scheduled.active !== null &&
      scheduled.active.profileId === 'zainab' &&
      scheduled.active.venueKey === 'the-library' &&
      scheduled.active.bill === 45000 &&
      /Zainab Bello at The Library/.test(scheduled.banner),
    scheduled,
  );

  // Close the phone and enter The Library (roadside-the-library)
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(250);
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-the-library');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  const entered = await playUntil(
    page,
    () =>
      window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning
        ? window.game.world.interiorManager.currentInterior.name
        : null,
    20,
  );
  await advance(page, 0.5);

  // Frame camera to clearly show Zainab Bello standing by the reserved candlelit table
  const venueState = await page.evaluate(() => {
    const g = window.game;
    const setGroup = g.scene.getObjectByName('spark_date_set_the-library');
    const children = setGroup ? setGroup.children.filter((c) => c.visible).map((c) => c.name) : [];
    const card = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'spark_date_the-library');
    if (card) {
      g.player.stopMoving();
      g.player.mesh.position.set(card.interactionPoint.x - 0.9, 0, card.interactionPoint.z + 0.5);
      g.cameraManager.yaw = 0.25;
      g.cameraManager.pitch = 0.36;
      g.cameraManager.distance = 6.2;
      g.hud.showInteractionCard(card);
    }
    const label = document.getElementById('card-action-btn')?.textContent ?? '';
    return {
      hasSet: !!setGroup,
      children,
      hasDateCard: !!card,
      label,
    };
  });
  await wait(350);

  check(
    'spark: entering The Library shows Zainab Bello standing in 3D beside the candlelit reserved table with an interactive date card',
    entered === 'The Library' &&
      venueState.hasSet &&
      venueState.children.includes('worship Zainab Bello') &&
      venueState.hasDateCard &&
      /Meet Zainab Bello for your date · ₦45,000/.test(venueState.label),
    { entered, ...venueState },
  );

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'spark-3-date-venue.png') });

  // 4. Act out the date with Zainab Bello at The Library
  const beforeMoney = await money(page);
  const beforeDate = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return {
      social: d.stats.social,
      fun: d.stats.fun,
      hunger: d.stats.hunger,
    };
  });

  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'spark_date_the-library');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  });

  await playUntil(
    page,
    () => (window.game.player.actor.sequence ? null : true),
    40,
  );
  await advance(page, 0.5);

  const afterMoney = await money(page);
  const afterDate = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    const spark = window.game.modules.Spark.get();
    const match = spark.matches().find((m) => m.profileId === 'zainab');
    const thread = window.game.messages.thread('spark:zainab');
    return {
      social: d.stats.social,
      fun: d.stats.fun,
      hunger: d.stats.hunger,
      activeDate: spark.activeDate(),
      completedCount: spark.completedDates().length,
      closeness: match?.closeness ?? 0,
      datesCount: match?.datesCount ?? 0,
      lastMessage: thread[thread.length - 1]?.text ?? '',
    };
  });

  check(
    'spark: acting out the date at The Library pays ₦45,000 once, raises social/fun/hunger, increases closeness to 60%, and sends a follow-up message',
    beforeMoney.cash + beforeMoney.bank - (afterMoney.cash + afterMoney.bank) === 45000 &&
      afterDate.social > beforeDate.social + 20 &&
      afterDate.fun > beforeDate.fun + 15 &&
      afterDate.hunger > beforeDate.hunger + 25 &&
      afterDate.activeDate === null &&
      afterDate.completedCount === 1 &&
      afterDate.closeness === 60 &&
      afterDate.datesCount === 1 &&
      /The Library was wonderful/.test(afterDate.lastMessage),
    { beforeMoney, afterMoney, beforeDate, afterDate },
  );

  // Open Spark Dates tab to show the completed date and 60% closeness
  await page.evaluate(() => {
    document.querySelectorAll('#game-toast-container > *').forEach((el) => el.remove());
  });
  await openApp(page, 'spark');
  await clickPhone(page, '[data-set="spark-tab"][data-value="dates"]');
  await wait(250);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'spark-4-after-date.png') });

  await leaveInterior(page);
  check('spark: no console or page errors during Spark E2E flow', log.errors.length === 0, log.errors);
  await ctx.close();
}

