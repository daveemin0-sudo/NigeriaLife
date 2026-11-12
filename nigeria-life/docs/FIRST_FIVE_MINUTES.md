# NigeriaLife: the first five minutes

Status: plan for approval (2026-11-12). Nothing below is built yet except where it says "exists".

## 1. Audit: what a new player gets today

| Area | What exists | Problem for a first visit |
|---|---|---|
| Start | Splash, title card ("Begin"), then for a guest on the server the sign-up screen, then the look editor opens by itself | Three screens before the first step. Sign-up is asked before the player knows why |
| Spawn | `Game.arriveAtTheGate`: west pavement of Broad Street, Lagos Island, a few steps north of the Victoria Residence Estate gate (about -9.5, 45). Toast "Your gate is ahead" | The player owns no home there, so "your gate" is not true |
| Money | Server account: ₦25,000 cash, ₦150,000 bank (`server/accounts.ts`) | Fine |
| Guide | `src/ui/FirstSteps.ts`: a slim line with 5 steps (name and look, walk, open the phone, take a shift in the Jobs app, collect pay). Ticked by real actions, can be skipped | Mostly phone menus. No people, no place, no home. The first job is found in an app, not in the street |
| Guide persistence | Key `nl_first_steps_v1` in localStorage. It is carried by the account save (CloudSyncService sends every key that is not on the deny list) | A signed-in player on a new device can see the guide flash before the account's copy arrives. No server-side "done" flag |
| People nearby | Story people with actors (greet, wave, shake hands, chat work through `Social.ts`): Chief Alabi the elder (12.5, 20), Mallam Bisi suya (29 m), Chidi the hawker, Alaye at the danfo terminus, Mama Put, the conductor, Sgt. Bello (LASTMA) | They speak only when tapped. Nobody says the next thing worth doing |
| Dialogue | `HUD.showDialogueModal` with reply options and rewards; `Ties` remembers who the player knows | Exists, unused for a first meeting |
| Work nearby | Eko Mega Plaza building site, Supervisor Amaka, 33 m from the spawn. Hire, then carry 6 blocks from pallet to wall (`HandWork`, acted out). Server checks and pays ₦5,000 (Labourer). Port (Foreman Sunday) at 63 m | Ideal first job, but the guide sends the player to the Jobs app instead |
| Homes | Property listings, cheapest the Mushin self-contain; Victoria Residence Estate gate has "Property office" | Not shown to a new player at all |
| Rewards | Server-paid shift, Today's hustle (3 a day), the life ladder, quests (Mainland Hustle etc.) | Fine; the first pay already counts toward Today's hustle and the quest |
| Way-finding | Tap-to-walk from a place card (`PlaceCard.goTo`), minimap, a short-lived property beacon in `World.ts` | No marker that stays on the next person until reached |

## 2. Proposed five minutes (all in the street, no tutorial screens)

| Time | Beat | What the player does | Built from |
|---|---|---|---|
| 0:00 | Arrive | "Begin" on the title and they are on Broad Street in the morning. One line: "Broad Street, Lagos Island. You just arrived with ₦25,000 in your pocket." No sign-up, no editor | Title, arriveAtTheGate (wording fixed) |
| 0:10 | Move | Hint in the slim line: drag the stick (phone) or W A S D (PC). The stick pulses on a phone. Ticks after a few metres | FirstSteps step 2 |
| 0:30 | Someone calls | Chief Alabi, on the pavement ahead, calls "My child! Come, greet your elder." A small marker floats over him, and the line says "Greet Chief Alabi". Tapping him walks the player up and they greet (the animation exists) | Social greet, new marker, new call-out bubble |
| 0:50 | Meaningful talk | Two replies: a respectful "Good morning, sir" (he warms to you; Ties and street credit) or a casual "How far, Chief" (he laughs and teases). Either way he says Amaka at the Eko Plaza site is taking hands today, and that the estate office at the gate lets rooms. Remembered: next time he greets you by name | showDialogueModal options, Ties |
| 1:30 | Find the work | The marker moves to Supervisor Amaka; minimap pin; "Walk there" chip does the walking for a tired thumb | PlaceCard goTo, marker |
| 1:50 | Work | Amaka takes them on; they carry six blocks to the wall, seen in full. The wall really grows | HandWork (exists) |
| 3:20 | Paid | Server pays ₦5,000. Money pill counts up; Amaka: "Come back tomorrow, there is more." This also ticks Today's hustle | Server shift pay (exists) |
| 3:40 | Spend it | If hungry: Mallam Bisi's suya is marked; buy and eat it with the pay | Vendor and visible eating (exist) |
| 4:15 | A home | The marker goes to the estate office at the gate. Its listing opens on what they can afford, cheapest first, with "Show me" on the map. Renting is their choice | Property listing, beacon |
| 4:45 | Keep it | "Keep your life and your ₦5,000 on any phone: choose a name". The sign-up screen opens now, with the name and look; "Later" is allowed | SignInScreen, look editor (moved, not new) |

Free play throughout: any beat can be ignored. The line waits, the marker stays, nothing blocks movement. ✕ skips the rest for good. Doing things out of order still ticks them (a player who finds Amaka first skips the elder's tip).

## 3. Persistence

- Progress keeps using `nl_first_steps_v1`, so it rides in the account save to any device (exists).
- New: a server flag on the account (`onboarded`, set when the guide is finished or skipped, returned by `/me`). A signed-in player on a new device never sees the guide, even before the save arrives. The guide waits for `/me` (or 4 s with no server) before it shows.
- Lives already under way (paid before, or with a home) never get it (exists: `isFreshLife`).
- Reload mid-way: it resumes on the same beat (exists for steps; the beat list keeps that rule).

## 4. Missing systems this needs (small, new)

1. A guide marker: one floating chevron over the next person or door, plus a minimap pin. One mesh, no per-frame cost when hidden.
2. A call-out: a story person speaks first, once, when the player comes within about 12 m (a bubble over the head).
3. A first-meeting conversation for Chief Alabi, with two replies.
4. A server `onboarded` flag on the account.
5. A property listing that opens on "what I can afford".

No new job, currency or reward is invented: the pay is the server's existing site wage.

## 5. Tests planned

New `firstfive` e2e suite: a brand-new life walks the whole five minutes by real actions on desktop keys and on a touch screen; reload at each beat resumes in place; skip is kept; a life under way never sees it; a second browser signed into the same account does not see it (server flag); with the server down the guide still runs and saves locally; the pay is the server's ₦5,000. Then the usual regression suites (ways, plan, streets, touch, drivetouch, phonefit, accountsave, vehicles and the rest) and a frame-count check on the low-end budget.
