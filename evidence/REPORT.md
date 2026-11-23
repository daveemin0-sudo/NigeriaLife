# Evidence: phone UI + ride drop-offs (`cursor/phone-cards-ride-drop`)

**Do not merge.** Proof only for review of `7c9113d`.

| | |
| --- | --- |
| Fix branch | `cursor/phone-cards-ride-drop` |
| Fix tip | `7c9113df0575da0080f33ae3d8ae025ca4778d86` |
| Parent | `89223b9` (UI + destinations) → `7c9113d` (HUD polish) |
| Baseline | untouched `bf55dab2c590d521b4e32a33083c5433b932acc4` |
| Evidence branch | `cursor/phone-cards-ride-drop-evidence` |
| `npx tsc --noEmit` | clean (exit 0) on fix |
| Game code on this evidence commit | unchanged from `7c9113d` (docs/screenshots only) |

## Verdict

- Street HUD: need bars (health / energy / food / star) are fully visible; location + chevron sit on the row below.
- Ride card: compact strip under the top safe-area with vehicle, destination, time left, Skip / Turn back.
- Driving HUD: minimap, car name, fuel, View, Refuel, music, chevron do not stack on each other in the captured sizes.
- Dangote: `setDownSpot` and expressway e2e put the player at Lekki Free Zone (`z≈3500`); interact prompt reads Dangote.
- Apapa Marine Fuel Depot: separate place at Apapa Port (`z≈58`); screenshots show Gate 1 containers, not Lekki.

## Suite results (one suite at a time)

Fix served from Vite on `http://127.0.0.1:5173/` (checkout `7c9113d`).  
Baseline served from worktree `/tmp/bf55dab-baseline` on `http://127.0.0.1:5174/` (`bf55dab`).  
Chrome: `/usr/local/bin/google-chrome`. Logs: artifacts `fix2/` and `baseline2/`.

| Suite | Fix `7c9113d` | Baseline `bf55dab` | Notes |
| --- | ---: | ---: | --- |
| phonefit | 18/35 | 23/35 | Residual overlaps still fail phonefit (see below); not a destination regression |
| phone | **39/39** | 38/39 | Fix cleaner |
| rides | **18/18** | 17/18 | Fix cleaner |
| ridepickup | 11/11 | 11/11 | |
| places | 22/25 | 22/25 | Same pre-existing filter/fare fails |
| getabout | 9/9 | 9/9 | |
| crosscity | 47/49 | 47/49 | Same Abuja→PH flight fails |
| expressway | **12/13** | 9/11 | **Amala + every-destination arrival + Dangote/Apapa PASS on fix**; Amala FAIL on baseline (drop 420 m away) |
| camera | 11/12 | 11/12 | Same eye-view FOV fail |
| touch | 10/10 | 10/10 | |
| drivetouch | **11/11** | 10/11 | Fix cleaner |

### Expressway destination proof (fix)

```
PASS  … Amala Shitta … {"booked":true,"away":0,"shown":true}
PASS  … every phone destination arrives at its street door … {"bad":[],"dangoteOk":true,"refName":"Dangote Petroleum Refinery","refZ":3500,"apapaName":"Apapa Marine Fuel Depot"}
PASS  … Dangote books to Lekki Free Zone; Apapa Marine Fuel Depot stays a separate place …
```

## Destinations changed

Full audit table: `nigeria-life/docs/DESTINATION_CHECK.md` (123 destinations, 0 mismatches).

| Destination | Change |
| --- | --- |
| `dest_lagos_refinery` | Renamed / retargeted to **Dangote Petroleum Refinery**, Lekki Free Zone, map/street/entrance `(14, 3500)`, interior `interior_place_dangote-refinery` |
| `dest_lagos_apapa_fuel_depot` | **New** — Apapa Marine Fuel Depot at Wharf / Apapa `(−10.5, 58)`; keeps Apapa aliases |
| `dest_lagos_mama_bisi_salon` | Removed from `DESTINATIONS_HERE` (no longer remapped to viewing-centre) |
| `dest_lagos_viewing_centre` | Mapped to roadside `viewing-centre` at `(−14, 485)` |
| `dest_lagos_chapel` | Name → Redemption Cathedral; coords → roadside `(−14, 620)` |
| Lagos `DESTINATIONS_HERE` places | Source map/street/entrance synced to expressway roadside stands |
| `dest_ph_upth` | Map aligned to hospital stand `(120, −65)` / door `(120, −54)` |
| Abuja + Port Harcourt benchmarks | Street + entrance aligned to each place’s map pin (≤20 m drift) |
| `Game.setDownSpot` | Prefer remapped street when entrance moved with it (stop stale map winning) |
| `Roadside.ts` | Also writes `mapPosition` when remapping |

## Screenshots

All under `evidence/screenshots/` (and mirrored in the agent artifacts folder).

Sizes: `320x568`, `360x800`, `390x844`, `430x932`, landscape `844x390`.

| Scene | Files |
| --- | --- |
| Street HUD (need bars visible) | `*-street.png` |
| Ride card | `*-ride.png` |
| Driving HUD | `*-driving.png` |
| Inside a place | `*-inside.png` |
| Phone | `*-phone.png` |
| Map | `*-map.png` |
| Arrival Dangote Lekki | `360x800-arrive-dangote-lekki.png`, `390x844-arrive-dangote-lekki.png`, `430x932-arrive-dangote-lekki.png` |
| Arrival Apapa depot | `360x800-arrive-apapa-depot.png`, `390x844-arrive-apapa-depot.png`, `430x932-arrive-apapa-depot.png` |

Arrival shots teleport via `setDownSpot` (same helper rides use). Dangote: district Lekki Free Zone, spot `(14, 3500)`, interact prompt “Interact with Dangote…”. Apapa: Gate 1 container terminal visible at `(−10.5, 58)`.

## Overlaps still present (phonefit / visual)

Not fixed in this pass (no further game-code changes for evidence):

1. **phonefit — home / sleep:** `#hud-today-chip` overlaps `.hud-top-left-badges`; minimized `#street-chat-box` overlaps `.hud-top-right-group`.
2. **phonefit — driving:** `.nl-minimap-north` “N” can clip 1–3 px past the right edge on narrow widths.
3. **phonefit — weather:** `#hud-weather-btn` stays under the 36×36 tap minimum.
4. **phonefit — phone apps:** in-phone nav / floating close can sit below the viewport bottom (pre-existing phone chrome).
5. **Ride card:** destination label truncates with ellipsis on narrow widths (expected for long names like Dangote Petroleum Refinery).
6. **Toasts:** can stack above the ride camera bar; not covering Skip / Turn back in the captures.

## Not claimed

- No merge / deploy.
- No real-device capture (headless Chromium only).
- No change to economy, `server/`, clothing, vehicle models, RideDriver / RidePassenger / CarCabin, shaders, or workflows.
