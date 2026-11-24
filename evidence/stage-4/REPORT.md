# Stage 4 evidence — Real interiors (LASUTH first)

**Build:** `cursor/stage-4-real-interiors-181d` @ `b577d6d`  
**Tested:** desktop Chromium + SwiftShader, `GAME_URL=…/NigeriaLife/` only. **Not** phone hardware.

## LASUTH teaching hospital

PlaceSpec rebuilt with shared `teachingHospital()` layout:

| Zone | What you see |
| --- | --- |
| Waiting (+z / door) | Blue benches, A&E board |
| Triage | Nurses’ counter + chart |
| Consult (−x) | Doctor desk + patient chair · **Dr Okeke** |
| Pharmacy (+x) | Shelf, counter, red cross |
| Ward | 3 beds with mattress/sheet/pillow, IV stand, monitor, curtains |

- Room **22×20**, floor finish `ceramic_white`
- Stations unchanged: `clinic` / `pharmacy` / `ward` (same prices)
- Matron Okoro hire + ward-round tasks re-aimed at new bed/chart coords
- Same layout applied to **National Hospital Abuja** and **UPTH** (city accents)

## Programmatic checks (Chromium)

- Entered `interior_place_lasuth`
- `finish === ceramic_white`, size `[22,20]`, doctor present, 3 stations
- shiftskill + insides + workplaces **24/24**

## Screenshots

- `lasuth-overview.png` — full floor from the door
- `lasuth-waiting.png` — benches / entrance
- `lasuth-ward.png` — beds + IV/monitors
- `lasuth-consult.png` — doctor desk
- `lasuth-pharmacy.png` — pharmacy counter

## Not verified

- Phone hardware / iOS Safari
- Every other audit interior beyond the three teaching hospitals

## Banks (follow-up)

- `allen-bank-hall.png` — Eko Commercial Bank, Allen: glass teller, queue, ATM bay, Guard Musa
- Shared `branchBank()` also used by Abuja/PH town banks; CBN visitors centre enriched
