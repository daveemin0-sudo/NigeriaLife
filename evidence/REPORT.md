# All-phones evidence report

Branch under review: `cursor/all-phones` @ `115fca8`  
Base comparison: untouched `bf55dab`  
Evidence branch: `cursor/all-phones-evidence`  
Date: 2026-11-23 (Africa/Lagos)

**Do not claim “works on all phones.”** No physical Samsung A16 or iPhone was used on this run.

---

## Fix addressed in `115fca8`

Review of `e67f17a` rejected meshopt output that expanded skins from **2 → 101 (male) / 95 (female)**.

Rebuild process:

1. Run `gltf-transform` meshopt (high) for compression.
2. Merge skins that share the same joint-name signature back to **exactly 2** skins.
3. Write with `EXT_meshopt_compression` still required.

### Character GLB structure (verified)

| File | Size | Skins | Joints | Meshes | Primitives | Nodes | Anims | `Seated` meshes | Triangles | meshopt |
|------|------|-------|--------|--------|------------|-------|-------|-----------------|-----------|---------|
| `human_male.glb` | 2 443 324 B (~2.4 MB) | **2** | **65, 73** | 102 | 116 | 236 | 19 | 28 | **145 963** | yes |
| `human_female.glb` | 2 556 652 B (~2.5 MB) | **2** | **65, 73** | 102 | 116 | 236 | 19 | 28 | **153 633** | yes |

Originals at `bf55dab` were ~6.4 MB / ~6.9 MB with the same structural counts (uncompressed).

Runtime under `/NigeriaLife/`: both character GLBs return `200` + `model/gltf-binary`; player shows **116** skinned meshes. No character model request failed.

Vehicle / aircraft paths under `/NigeriaLife/models/...` still hit **missing files** (repo never shipped those GLBs); Vite preview serves SPA HTML `200`. Procedural fallbacks apply. Character models are the assets that must load.

---

## Why `life.ts` changed — then removed

An earlier commit added one `GRAPHICS_NOTES.veryLow` string for Phone › Settings subtitle text.

That change is **not required for quality settings**. Very Low is defined and applied in `GraphicsQuality.ts` / `DeviceProfile.ts`. The Settings row already shows `graphics.label` (“Very Low”); the notes map is cosmetic only.

**Removed** in `115fca8` (file matches `bf55dab` for this concern). Settings may show `Very Low: undefined` for the note suffix until a future UI-only edit is approved.

---

## Device profile → starting quality

| Signal | Starting level | Shadows on first load |
|--------|----------------|------------------------|
| weak (`?device=weak`, low mem, Save-Data, weak GPU, missing APIs lean weak) | Very Low | off |
| mid | Low | on (512 map, interval) |
| strong + touch | Medium (`balanced`) | on |
| strong desktop / webdriver without coarse pointer | High | on |
| Manual Phone › Life › Settings | always wins | live level change; shadow flag change waits for next load |
| `?quality=` / `?device=` | test overrides | `?quality=` also primes session shadows |

---

## Draw calls / triangles / memory (360×800, Chromium + SwiftShader)

Frame times on this CI GPU are **not** phone FPS. Heap is JS heap.

### Broad Street

| Level | Calls | Triangles | Drawing buffer | Shadows | Heap MB | Frame ms (SW) |
|-------|------:|----------:|----------------|---------|--------:|--------------:|
| Very Low | 125 | 99 140 | 198×440 @ 1× | off | 476 | 263 |
| Low | 155 | 180 067 | 251×560 @ 1× | on | 493 | 1003 |
| Medium | 498 | 413 734 | 324×720 @ 1.25× | on | 500 | 746 |

Very Low stays under the **250 calls / 110 000 tris** Broad Street target.

### Interior (buka) / ride (sedan)

| Level | Scene | Calls | Triangles | Heap MB |
|-------|-------|------:|----------:|--------:|
| Very Low | interior | 160 | 29 407 | 562 |
| Very Low | ride | 150 | 13 369 | 504 |
| Low | interior | 185 | 74 781 | 503 |
| Low | ride | 175 | 58 743 | 377 |
| Medium | interior | 258 | 207 502 | 515 |
| Medium | ride | 238 | 175 426 | 462 |

Screenshots: `evidence/screenshots/quality-{veryLow,low,balanced}-{broadstreet,interior,ride}.png`.

---

## Download sizes (`--base=/NigeriaLife/` production build)

Measured with Puppeteer (webdriver). **Service worker is not registered under webdriver** (`Updates.ts`), so repeat-visit cache-first behaviour is weaker than a real phone.

| Visit | Bytes accounted | Notes |
|-------|----------------:|-------|
| First (cache disabled) | ~10.4 MB | JS ~4.2 MB + male/female GLB ~4.9 MB + CSS/fonts |
| Repeat reload | ~10.3 MB accounted; many `304` | HTTP revalidation; SW v2 cache-first for `/models/` applies for real (non-webdriver) clients |

Galleries (~28 MB) no longer ship (`docs/galleries/`).

---

## Browser / screen-size matrix (`allphones` — 42/42)

Portrait + landscape: 320×568, 360×640, 360×800, 390×844, 412×915, 430×932, 768×1024.  
Profiles: `?device=weak|mid|strong` with CPU throttle.  
Context loss: `WEBGL_lose_context` — Restoring…, money/place kept.  
Playwright WebKit/Firefox: **skipped** (`SKIP_PLAYWRIGHT=1`).

---

## Full suite list vs `bf55dab` (one suite at a time)

Build: `npx vite build --base=/NigeriaLife/` → preview port 4192.  
Baseline: `bf55dab` with `--base=/` → port 4191 (so its models load).

Branch (`115fca8`): **358/388** checks across the list  
(`allphones` 42/42, `graphics` 8/8, `touch` 10/10, `rides`/`ridepickup`/`npcwardrobe`/`firstfive`/`access`/`laptopperf`/`phone` green; shared flakes on phonefit tap sizes, some perfbudget/city/saves).

Baseline (`bf55dab`): overlapping suites without `allphones`.

**Regressions (PASS on `bf55dab`, FAIL on branch): 0**  
**Improvements: 3** (incl. perfbudget instrumentation overhead; two tab-sync money checks).

`npx tsc --noEmit`: clean.

---

## Not tested on a real device

- Physical Samsung A16 (or any Android phone)
- Any iPhone / real Safari
- Real Firefox or WebKit (Playwright browsers not installed this run)
- Real Save-Data / cellular throttling / SW-controlled repeat visits on a phone

Chromium mobile emulation + SwiftShader only.
