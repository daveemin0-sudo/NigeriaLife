import { launch, open, wait, closeDialogs, enterInterior, leaveByDoor } from './lib.mjs';

async function sampleFrames(page, durationMs = 2500, action) {
  // Run action if provided (e.g. key press or movement)
  const startTime = Date.now();
  if (action) await action.start();

  const metrics = await page.evaluate(async (ms) => {
    return new Promise((resolve) => {
      const frameDeltas = [];
      let lastTime = performance.now();
      const start = lastTime;

      function onFrame(now) {
        const delta = now - lastTime;
        lastTime = now;
        frameDeltas.push(delta);

        if (now - start < ms) {
          requestAnimationFrame(onFrame);
        } else {
          // Gather Three.js and world state
          const g = window.game;
          const info = g?.renderer?.info;
          const mem = window.performance?.memory;
          
          let activeCars = 0;
          if (g?.world?.trafficSpawner?.batches) {
            for (const b of g.world.trafficSpawner.batches) {
              activeCars += b.drawn || 0;
            }
          }
          let activePedestrians = 0;
          if (g?.world?.cityPopulation?.variants) {
            for (const v of g.world.cityPopulation.variants) {
              activePedestrians += v.drawn || 0;
            }
          }

          resolve({
            frameDeltas,
            drawCalls: info?.render?.calls ?? 0,
            triangles: info?.render?.triangles ?? 0,
            geometries: info?.memory?.geometries ?? 0,
            textures: info?.memory?.textures ?? 0,
            heapUsedMb: mem ? +(mem.usedJSHeapSize / (1024 * 1024)).toFixed(2) : null,
            heapTotalMb: mem ? +(mem.totalJSHeapSize / (1024 * 1024)).toFixed(2) : null,
            activeCars,
            activePedestrians,
            ambientNpcCount: g?.world?.npcs?.pedestrians?.length ?? 0,
            playerPos: g?.player?.position ? { x: +g.player.position.x.toFixed(2), y: +g.player.position.y.toFixed(2), z: +g.player.position.z.toFixed(2) } : null,
          });
        }
      }
      requestAnimationFrame(onFrame);
    });
  }, durationMs);

  if (action) await action.stop();

  // Compute FPS and frame-time distribution
  const deltas = metrics.frameDeltas.slice(1); // skip initial hitch
  if (deltas.length === 0) return { ...metrics, avgFps: 0, worstFps: 0, avgMs: 0, maxMs: 0, longFrames: 0 };

  const totalTime = deltas.reduce((a, b) => a + b, 0);
  const avgMs = +(totalTime / deltas.length).toFixed(2);
  const avgFps = +(1000 / avgMs).toFixed(1);
  const maxMs = +(Math.max(...deltas)).toFixed(2);
  const worstFps = +(1000 / maxMs).toFixed(1);
  const longFrames33 = deltas.filter(d => d > 33.3).length; // frames dropping below 30 FPS
  const longFrames50 = deltas.filter(d => d > 50.0).length; // frames dropping below 20 FPS

  return {
    sampleCount: deltas.length,
    avgFps,
    worstFps,
    avgMs,
    maxMs,
    longFrames33,
    longFrames50,
    drawCalls: metrics.drawCalls,
    triangles: metrics.triangles,
    geometries: metrics.geometries,
    textures: metrics.textures,
    heapUsedMb: metrics.heapUsedMb,
    activeCars: metrics.activeCars,
    activePedestrians: metrics.activePedestrians,
    ambientNpcCount: metrics.ambientNpcCount,
    playerPos: metrics.playerPos,
  };
}

async function measureMovement(page) {
  // Test 1: Walk displacement in 1.0 second
  await page.evaluate(() => {
    window.game.player.stopMoving();
    window.game.player.mesh.position.set(0, 0, 0);
  });
  await wait(200);

  const startPosWalk = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  await page.keyboard.down('KeyW');
  await wait(1000);
  await page.keyboard.up('KeyW');
  const endPosWalk = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  const walkDist = Math.hypot(endPosWalk.x - startPosWalk.x, endPosWalk.z - startPosWalk.z);

  // Test 2: Sprint displacement in 1.0 second
  await page.evaluate(() => {
    window.game.player.stopMoving();
    window.game.player.mesh.position.set(0, 0, 0);
  });
  await wait(200);

  const startPosSprint = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await wait(1000);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  const endPosSprint = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  const sprintDist = Math.hypot(endPosSprint.x - startPosSprint.x, endPosSprint.z - startPosSprint.z);

  // Get configured speeds and physics parameters
  const playerConfig = await page.evaluate(() => {
    const p = window.game.player;
    return {
      configuredWalkSpeed: p.walkSpeed,
      configuredSprintSpeed: p.sprintSpeed,
      currentSpeed: p.speed,
      hasCollisionSolids: !!p.solids,
      hasPedestrianAvoidance: !!p.getOtherPedestrians,
    };
  });

  return {
    configuredWalkSpeed: playerConfig.configuredWalkSpeed,
    configuredSprintSpeed: playerConfig.configuredSprintSpeed,
    measuredWalkDisplacement1s: +walkDist.toFixed(2),
    measuredSprintDisplacement1s: +sprintDist.toFixed(2),
    walkEfficiency: +(walkDist / playerConfig.configuredWalkSpeed).toFixed(2),
    sprintEfficiency: +(sprintDist / playerConfig.configuredSprintSpeed).toFixed(2),
  };
}

async function main() {
  console.log('--- STARTING NIGERIA LIFE PERFORMANCE & MOVEMENT BENCHMARK ---');
  const browser = await launch();
  const ctx = await browser.createBrowserContext();
  const { page } = await open(ctx, { settle: 3500 });
  await closeDialogs(page);

  // Scenario 1: Standing still in open area (Broad Street)
  console.log('Testing Scenario 1: Standing still in open area...');
  await page.evaluate(() => {
    window.game.player.stopMoving();
    window.game.player.mesh.position.set(0, 0, 5);
  });
  await wait(500);
  const s1 = await sampleFrames(page, 2500);

  // Movement Benchmark
  console.log('Testing Player Movement Displacement (1s walk & sprint)...');
  const movementStats = await measureMovement(page);

  // Scenario 2: Walking and running in open area
  console.log('Testing Scenario 2: Walking & running in open area...');
  const s2 = await sampleFrames(page, 2500, {
    start: async () => {
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyW');
    },
    stop: async () => {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('ShiftLeft');
    }
  });

  // Scenario 3: Moving through a busy street with crowd & traffic
  console.log('Testing Scenario 3: Moving through busy street...');
  await page.evaluate(() => {
    window.game.player.mesh.position.set(10, 0, 0); // Sidewalk with NPCs & street stalls
  });
  await wait(500);
  const s3 = await sampleFrames(page, 2500, {
    start: async () => {
      await page.keyboard.down('KeyW');
    },
    stop: async () => {
      await page.keyboard.up('KeyW');
    }
  });

  // Scenario 4: Entering and leaving interior
  console.log('Testing Scenario 4: Entering and leaving interior (Mama Put Buka)...');
  await enterInterior(page, 'buka');
  const s4_inside = await sampleFrames(page, 2000);
  await leaveByDoor(page);
  await wait(1000);
  const s4_after_exit = await sampleFrames(page, 2000);

  // Scenario 5: Short continuous gameplay session (camera rotation, walking, UI toggle)
  console.log('Testing Scenario 5: Continuous gameplay session (5 seconds)...');
  const s5 = await sampleFrames(page, 5000, {
    start: async () => {
      await page.keyboard.down('KeyD');
      await page.mouse.wheel({ deltaY: 150 });
    },
    stop: async () => {
      await page.keyboard.up('KeyD');
    }
  });

  await browser.close();

  const report = {
    timestamp: new Date().toISOString(),
    movement: movementStats,
    scenarios: {
      standingStill: s1,
      walkingRunning: s2,
      busyStreet: s3,
      interiorInside: s4_inside,
      afterInteriorExit: s4_after_exit,
      continuousSession: s5,
    }
  };

  console.log('\n=== BENCHMARK RESULTS ===');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
