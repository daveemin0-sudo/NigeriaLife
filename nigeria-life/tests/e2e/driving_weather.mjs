import { open, newPlayer, closeDialogs, advance, wait, playUntil } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // =========================================================================
  // 1. VEHICLE SPAWN & DRIVING ENTRY
  // =========================================================================
  const enterCarResult = await page.evaluate(async () => {
    const g = window.game;
    // Find or spawn a drivable sedan on Broad Street lane (e.g. x = -4.9, z = 0, facing South rotY = 0)
    let veh = g.world.vehicles.drivableVehicles[0];
    if (!veh) {
      // Spawn drivable sedan
      const config = g.world.vehicles.VEHICLE_CONFIGS.sedan || {
        id: 'sedan-corolla',
        name: 'Toyota Corolla Sedan',
        type: 'sedan',
        maxSpeed: 28,
        reverseSpeed: 8,
        acceleration: 14,
        braking: 24,
        turnSpeed: 2.8,
        friction: 0.94,
        mass: 1300,
        width: 1.8,
        length: 4.4,
        height: 1.5,
      };
      veh = new g.world.vehicles.DrivableVehicle(config, new (g.modules.THREE.Vector3)(-4.9, 0, 0), 0);
      g.world.vehicles.drivableVehicles.push(veh);
      g.world.vehicles.group.add(veh.mesh);
    } else {
      veh.mesh.position.set(-4.9, 0, 0);
      veh.mesh.rotation.y = 0;
      veh.currentSpeed = 0;
      veh.steerInput = 0;
    }

    g.player.stopMoving();
    g.player.mesh.position.set(-4.9, 0, 0);
    g.enterVehicle(veh);
    return {
      isDriving: g.player.isDriving,
      vehPos: { x: veh.mesh.position.x, z: veh.mesh.position.z },
      vehRot: veh.mesh.rotation.y,
    };
  });

  check(
    'player enters drivable vehicle on Broad Street lane',
    enterCarResult.isDriving && Math.abs(enterCarResult.vehPos.x - -4.9) < 0.1,
    enterCarResult
  );

  // =========================================================================
  // 2. STRAIGHT LINE ACCELERATION WITHOUT STEERING (NO ZIGZAG)
  // =========================================================================
  const straightAccelResult = await page.evaluate(async () => {
    const g = window.game;
    const veh = g.player.currentVehicle;
    veh.mesh.position.set(-4.9, 0, 0);
    veh.mesh.rotation.y = 0;
    veh.currentSpeed = 0;
    veh.steerInput = 0;

    // Simulate pressing ArrowUp (gas) for 2 seconds without steering
    const samples = [];
    for (let i = 0; i < 20; i++) {
      g.input.keys['arrowup'] = true;
      g.input.keys['arrowleft'] = false;
      g.input.keys['arrowright'] = false;
      await g.advance(0.1);
      samples.push({
        x: veh.mesh.position.x,
        z: veh.mesh.position.z,
        rotY: veh.mesh.rotation.y,
        speed: veh.currentSpeed,
      });
    }
    g.input.keys['arrowup'] = false;

    // Check lateral drift: x should remain centered around -4.9 without oscillating
    const xPositions = samples.map((s) => s.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const lateralDrift = Math.abs(maxX - minX);
    const finalSpeed = veh.currentSpeed;
    const traveledZ = veh.mesh.position.z;

    return { lateralDrift, finalSpeed, traveledZ, samplesCount: samples.length };
  });

  check(
    'accelerating on straight road travels forward without lateral zigzag or wobble (lateral drift < 0.05m)',
    straightAccelResult.lateralDrift < 0.05 && straightAccelResult.finalSpeed > 15 && straightAccelResult.traveledZ > 15,
    straightAccelResult
  );

  // =========================================================================
  // 3. PROGRESSIVE STEERING TAP & DAMPED RETURN TO NEUTRAL
  // =========================================================================
  const tapSteerResult = await page.evaluate(async () => {
    const g = window.game;
    const veh = g.player.currentVehicle;
    veh.mesh.position.set(-4.9, 0, 0);
    veh.mesh.rotation.y = 0;
    veh.currentSpeed = 12; // Moderate driving speed
    veh.steerInput = 0;

    // 120ms tap on ArrowLeft
    g.input.keys['arrowleft'] = true;
    await g.advance(0.12);
    const tapInput = veh.steerInput;

    // Release steering keys and step forward 0.35s
    g.input.keys['arrowleft'] = false;
    await g.advance(0.35);
    const releasedInput = veh.steerInput;

    return { tapInput, releasedInput };
  });

  check(
    'small steering tap builds progressive moderate input (~0.2-0.55) and release smoothly returns input to neutral (~0.0)',
    tapSteerResult.tapInput > 0.15 && tapSteerResult.tapInput < 0.60 && Math.abs(tapSteerResult.releasedInput) < 0.02,
    tapSteerResult
  );

  // =========================================================================
  // 4. SPEED-DEPENDENT STEERING SENSITIVITY
  // =========================================================================
  const speedSensitivityResult = await page.evaluate(async () => {
    const g = window.game;
    const veh = g.player.currentVehicle;

    // Measure yaw change rate with full steer input at low parking speed (2 m/s)
    veh.mesh.rotation.y = 0;
    veh.currentSpeed = 2.0;
    veh.steerInput = 1.0;
    const startRotLow = veh.mesh.rotation.y;
    await g.advance(0.2);
    const yawDeltaLow = Math.abs(veh.mesh.rotation.y - startRotLow);

    // Measure yaw change rate with full steer input at highway speed (24 m/s)
    veh.mesh.rotation.y = 0;
    veh.currentSpeed = 24.0;
    veh.steerInput = 1.0;
    const startRotHigh = veh.mesh.rotation.y;
    await g.advance(0.2);
    const yawDeltaHigh = Math.abs(veh.mesh.rotation.y - startRotHigh);

    veh.steerInput = 0;
    return { yawDeltaLow, yawDeltaHigh, ratio: yawDeltaHigh / yawDeltaLow };
  });

  check(
    'steering sensitivity scales with vehicle speed: high speed yaw rate is attenuated to ~30-50% for stability',
    speedSensitivityResult.ratio < 0.55 && speedSensitivityResult.ratio > 0.20 && speedSensitivityResult.yawDeltaLow > 0.03,
    speedSensitivityResult
  );

  // =========================================================================
  // 5. AUTOMATIC LANE CENTERING & PASSIVE HEADING ALIGNMENT
  // =========================================================================
  const laneCenteringResult = await page.evaluate(async () => {
    const g = window.game;
    const veh = g.player.currentVehicle;
    // Place car in West southbound lane (center is -4.9), but offset to x = -4.2 (drifted toward center) with slight heading error (0.08 rad)
    veh.mesh.position.set(-4.2, 0, 10);
    veh.mesh.rotation.y = 0.08;
    veh.currentSpeed = 10.0;
    veh.steerInput = 0;

    // Drive forward 1.5 seconds without player steering input
    for (let i = 0; i < 15; i++) {
      g.input.keys['arrowup'] = true;
      g.input.keys['arrowleft'] = false;
      g.input.keys['arrowright'] = false;
      await g.advance(0.1);
    }
    g.input.keys['arrowup'] = false;

    const finalX = veh.mesh.position.x;
    const finalRotY = veh.mesh.rotation.y;
    const offsetCorrection = Math.abs(finalX - -4.9);
    const headingCorrection = Math.abs(finalRotY);

    return {
      initialX: -4.2,
      finalX,
      offsetCorrection,
      headingCorrection,
      isCenteringActive: veh.isCenteringActive,
    };
  });

  check(
    'automatic lane centering corrects small lateral offset and aligns vehicle heading with road lane',
    laneCenteringResult.finalX < -4.4 && laneCenteringResult.headingCorrection < 0.05,
    laneCenteringResult
  );

  // =========================================================================
  // 6. BRAKING AND REVERSE MANEUVERING
  // =========================================================================
  const brakeReverseResult = await page.evaluate(async () => {
    const g = window.game;
    const veh = g.player.currentVehicle;
    veh.mesh.position.set(-4.9, 0, 50);
    veh.mesh.rotation.y = 0;
    veh.currentSpeed = 14.0;

    // Press ArrowDown (brake) while moving forward
    g.input.keys['arrowdown'] = true;
    g.input.keys['arrowup'] = false;
    await g.advance(0.8);
    const speedAfterBrake = veh.currentSpeed;

    // Continue holding ArrowDown to engage reverse gear
    await g.advance(1.2);
    const speedInReverse = veh.currentSpeed;
    g.input.keys['arrowdown'] = false;

    return { speedAfterBrake, speedInReverse };
  });

  check(
    'braking predictably decelerates vehicle forward motion, then transitions smoothly into reverse',
    brakeReverseResult.speedAfterBrake < 3.0 && brakeReverseResult.speedInReverse < -1.5,
    brakeReverseResult
  );

  // =========================================================================
  // 7. INPUT LOSS OF FOCUS (WINDOW BLUR SAFETY)
  // =========================================================================
  const windowBlurResult = await page.evaluate(async () => {
    const g = window.game;
    g.input.keys['arrowleft'] = true;
    g.input.keys['arrowup'] = true;

    // Trigger blur event
    window.dispatchEvent(new Event('blur'));

    return {
      leftKey: g.input.keys['arrowleft'],
      upKey: g.input.keys['arrowup'],
    };
  });

  check(
    'browser window blur event resets all pressed keys to prevent stuck acceleration or steering inputs',
    windowBlurResult.leftKey === false && windowBlurResult.upKey === false,
    windowBlurResult
  );

  // =========================================================================
  // 8. CHASE CAMERA HEADING SMOOTHING
  // =========================================================================
  const chaseCameraResult = await page.evaluate(async () => {
    const g = window.game;
    const cam = g.cameraManager;
    const veh = g.player.currentVehicle;
    veh.mesh.position.set(-4.9, 0, 0);
    veh.mesh.rotation.y = 0;
    veh.currentSpeed = 15;

    // Advance camera update
    await g.advance(0.1);
    const initialCamPos = cam.camera.position.clone();

    // Turn vehicle sharply 0.5 rad (~28 deg)
    veh.mesh.rotation.y = 0.5;
    await g.advance(0.05); // One frame
    const fastCamYaw = cam.cameraVehYaw;

    // Camera heading should lag behind vehicle heading smoothly, not jump instantly
    return {
      vehYaw: 0.5,
      cameraVehYaw: fastCamYaw,
      isLaggingSmoothly: fastCamYaw < 0.40 && fastCamYaw > 0.05,
    };
  });

  check(
    'driving chase camera heading filter smoothly tracks vehicle heading without jarring instantaneous snapping',
    chaseCameraResult.isLaggingSmoothly,
    chaseCameraResult
  );

  // =========================================================================
  // 9. AUTHORITATIVE WORLD CLOCK (SIMULATED VS REAL TIME)
  // =========================================================================
  const clockModelResult = await page.evaluate(async () => {
    const g = window.game;
    const sky = g.world.skyEnvironment;

    // 1. Simulated Time Mode
    sky.clockMode = 'SIMULATED_TIME';
    sky.setHour(14.0);
    const startSimHour = sky.currentHour;
    sky.timeScale = 0.1;
    await g.advance(1.0);
    const afterSimHour = sky.currentHour;
    const simAdvanced = afterSimHour > startSimHour;

    // 2. Real Time Mode (Africa/Lagos WAT)
    sky.clockMode = 'REAL_TIME';
    await g.advance(0.1);
    const realHour = sky.currentHour;
    const now = new Date();
    const expectedHour = (now.getUTCHours() + 1 + now.getUTCMinutes() / 60) % 24;
    const realMatchesWAT = Math.abs(realHour - expectedHour) < 0.15;

    // Restore to simulated time for standard test gameplay
    sky.clockMode = 'SIMULATED_TIME';
    sky.setHour(13.3);
    sky.timeScale = 0.04;

    return { simAdvanced, realMatchesWAT, realHour, expectedHour };
  });

  check(
    'world clock supports SIMULATED_TIME with stable advancement and REAL_TIME accurately tracking Africa/Lagos (UTC+1 WAT)',
    clockModelResult.simAdvanced && clockModelResult.realMatchesWAT,
    clockModelResult
  );

  // =========================================================================
  // 10. CELESTIAL SUN ARC & CONTINUOUS LIGHTING INTERPOLATION
  // =========================================================================
  const celestialLightingResult = await page.evaluate(async () => {
    const g = window.game;
    const sky = g.world.skyEnvironment;

    // Test Midday (13.0)
    sky.setHour(13.0);
    await g.advance(0.1);
    const middaySunPos = sky.sunLight.position.clone();
    const middaySunIntensity = sky.sunLight.intensity;
    const middayPeriod = sky.currentPeriod;

    // Test Golden Hour (18.0)
    sky.setHour(18.0);
    await g.advance(0.1);
    const goldenSunPos = sky.sunLight.position.clone();
    const goldenPeriod = sky.currentPeriod;

    // Test Night (23.0)
    sky.setHour(23.0);
    await g.advance(0.1);
    const nightSunIntensity = sky.sunLight.intensity;
    const nightPeriod = sky.currentPeriod;

    // Reset to daytime
    sky.setHour(13.3);

    return {
      middayY: middaySunPos.y,
      goldenY: goldenSunPos.y,
      middaySunIntensity,
      nightSunIntensity,
      middayPeriod,
      goldenPeriod,
      nightPeriod,
    };
  });

  check(
    'celestial sun arc smoothly positions sun at high elevation at midday and low elevation at sunset with continuous intensity interpolation',
    celestialLightingResult.middayY > 40 &&
      celestialLightingResult.goldenY < celestialLightingResult.middayY &&
      celestialLightingResult.nightSunIntensity < celestialLightingResult.middaySunIntensity * 0.3 &&
      celestialLightingResult.middayPeriod === 'midday' &&
      celestialLightingResult.goldenPeriod === 'golden_hour' &&
      celestialLightingResult.nightPeriod === 'night',
    celestialLightingResult
  );

  // =========================================================================
  // 11. DYNAMIC WEATHER SYSTEM CYCLING & RAIN INTERPOLATION
  // =========================================================================
  const weatherSystemResult = await page.evaluate(async () => {
    const g = window.game;
    const weather = g.world.weather;

    // Set clear/sunny
    weather.setWeather('sunny');
    await g.advance(0.5);
    const clearRainIntensity = weather.curRainIntensity ?? 0;
    const clearLabel = weather.getWeatherLabel();

    // Set rainy
    weather.setWeather('rainy');
    await g.advance(1.5); // Allow smooth lerp
    const rainyIntensity = weather.curRainIntensity ?? 0;
    const rainyRoadWetness = weather.curRoadWetness ?? 0;
    const rainyVisible = weather.rainParticles?.visible ?? false;

    // Set thunderstorm
    weather.setWeather('thunderstorm');
    await g.advance(1.5);
    const stormIntensity = weather.curRainIntensity ?? 0;

    // Set harmattan
    weather.setWeather('harmattan');
    await g.advance(1.5);
    const harmattanDust = weather.curHarmattanDust ?? 0;
    const harmattanRain = weather.curRainIntensity ?? 0;

    // Reset back to sunny
    weather.setWeather('sunny');
    await g.advance(1.0);

    return {
      clearRainIntensity,
      clearLabel,
      rainyIntensity,
      rainyRoadWetness,
      rainyVisible,
      stormIntensity,
      harmattanDust,
      harmattanRain,
    };
  });

  check(
    'weather system smoothly transitions rain intensity, road wetness shimmer, and harmattan dust without abrupt snaps',
    weatherSystemResult.clearRainIntensity < 0.05 &&
      weatherSystemResult.rainyIntensity > 0.4 &&
      weatherSystemResult.rainyRoadWetness > 0.5 &&
      weatherSystemResult.rainyVisible === true &&
      weatherSystemResult.stormIntensity > 0.8 &&
      weatherSystemResult.harmattanDust > 0.6 &&
      weatherSystemResult.harmattanRain < 0.1,
    weatherSystemResult
  );

  // =========================================================================
  // 12. WORLD STATE SAVE AND RESTORE FOR TIME AND WEATHER
  // =========================================================================
  const saveRestoreResult = await page.evaluate(async () => {
    const g = window.game;
    const sky = g.world.skyEnvironment;
    const weather = g.world.weather;

    // Set specific test conditions
    sky.setHour(17.4);
    weather.setWeather('rainy');

    // Trigger game save
    g.saveWorldState();
    const saved = g.hud.backend.getData().worldState;

    // Alter current world state
    sky.setHour(8.0);
    weather.setWeather('sunny');

    // Restore from save
    g.restoreWorldState();

    return {
      savedHour: saved?.hour,
      savedWeather: saved?.weather,
      restoredHour: sky.currentHour,
      restoredWeather: weather.currentWeather,
    };
  });

  check(
    'saved world state retains authoritative world hour and dynamic weather condition upon game restore',
    Math.abs(saveRestoreResult.restoredHour - 17.4) < 0.1 && saveRestoreResult.restoredWeather === 'rainy',
    saveRestoreResult
  );

  check('no critical console or runtime errors during driving and weather tests', log.errors.length === 0, log.errors);
}
