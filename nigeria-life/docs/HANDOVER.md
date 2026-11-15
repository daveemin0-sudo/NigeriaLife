# Handover: NigeriaLife (15 Nov 2026)

For the next agent (Cursor) until Thursday, then back to Claude. Read this first, then the documents it points to.

## 1. Where things stand

- **Branch:** `claude/next-steps`. All work stays here.
  - **Never merge, deploy or publish** unless the owner explicitly says so.
  - Render deploys `stabilise-core`; Pages deploys `stabilise-core` and `main`. This branch never deploys.
- **Last commits:**

  | Commit | What |
  |---|---|
  | `8d81389` | `docs/M1_EXECUTION_PLAN.md` (M1 plan, **awaiting the owner's approval**) |
  | `ae6db5a` | `docs/THREE_CITY_FOUNDATION.md` (adopted rules, city status, milestones M1–M6) |
  | `9f92883` | L1 + L2 (Turn back; journeys saved to the account at once). **Accepted by the owner** |
  | `a8ce080` | A16 repair Step 1 (rides survive reloads). Accepted |

- **Next action:** wait for the owner to approve M1 (or package 1 of it). **Do not change game code until they do.**

## 2. Standing rules (adopted by the owner, 15 Nov)

1. The first release contains **Lagos, Abuja and Port Harcourt**. Never propose reducing it to one city.
2. The long-term vision is **all 36 Nigerian states**. Build so states can be added without rewrites.
3. **Visible product progress:** every cycle delivers measurable player-facing progress. Infrastructure, security, stability and performance work is allowed when it directly supports the product.
4. The **nine requirements** in `THREE_CITY_FOUNDATION.md` are the first-release acceptance criteria.

## 3. How the owner works (important)

- The owner is **not technical**. Report in plain words: what changed, what the player sees, test results with exact numbers, and remaining risks.
- **Approve stage by stage.** Do only the approved stage, then stop and report. Ask before anything outside it.
- **Never make the owner diagnose.** Investigate yourself and bring evidence.
- **No long manual phone test sessions.** Verify with automation (below). Ask for the phone only when the laptop truly cannot answer, and say why.
- **Never claim Samsung A16 results** unless they came from the owner's device report. Always keep laptop and phone figures apart.
- **No sprawling roadmaps.** Give one clear route.
- **Don't remove or simplify gameplay** to make a problem disappear.
- Don't touch production data or services. The A16 sessions use a local branch server (`npm run a16:session`).
- The owner's private email must never go to external services.

## 4. Documents to read

| Document | What is in it |
|---|---|
| `docs/THREE_CITY_FOUNDATION.md` | The rules, what works in each city, the nine requirements graded, milestones M1–M6 |
| `docs/M1_EXECUTION_PLAN.md` | **The next milestone**: 8 work packages with evidence, fixes, targets and tests |
| `docs/A16_INVESTIGATION.md` | The A16 findings (performance, layout, cameras, rides, memory in section M), the Step 1 / L1–L4 records |
| `docs/QUALITY_AUDIT.md`, `docs/QUALITY_ROADMAP.md` | Earlier audit (finding IDs such as N1, I1, G4, P3) and the stages (Stage 1 backups, 2 accounts, 2b server checks, 4 performance) |
| `docs/A16_TEST_SESSION.md` | How the phone session runs |
| `docs/LIVING_CITY.md` | NPC routines, stages 1–3d |

## 5. Testing

- **Test against a frozen build, not the dev server:**
  ```
  npx vite build --outDir <somewhere>
  npx vite preview --outDir <somewhere> --port 4197 --strictPort
  GAME_URL=http://localhost:4197/ node tests/e2e/run.mjs <suite ...>
  ```
- **The ride and save suite:** `ridesave` (74 checks).
  - Its parts can be run alone: `RIDESAVE_ONLY=cities,phone,turnback,map,account`.
  - It includes an A16-like run (320×607, touch, CPU slowed 4×) and "Chrome kills the tab" (`Page.crash`).
- **Regression set used so far:** `rides saves accountsave server online coaches flights getabout redline quests crosscity cities away firstfive onboarding phone phonefit perfreadout`.
- **Known unreliable on this busy laptop**, failing on older builds too:
  - `online` (401 on `/ads`, 409 commit timeouts)
  - `phonefit` (the phone app bottom bar sits below the screen at 316–360 px; this is real, and in M1 package 6)
  - occasional navigation timeouts
- Before blaming a change, **run the same suite on the build from before it** (A/B).
- `npx tsc --noEmit -p .` must stay clean.

## 6. Lessons that cost time (don't repeat)

**Tests and the test tools**
- **Puppeteer `setViewport` with `isMobile`/`hasTouch` reloads the page.**
- **Two-device tests:** close other signed-in browsers first. A device still open and saving makes a newly signed-in one step aside ("Playing on another device"). That is correct behaviour.
- **Signing in on a second browser takes 30–100 s on the laptop** (several full loads). Allow 240 s in tests.
- **Phone screens redraw often:** tap with a retry when an element is detached (see `tapOn` in `ridesave.mjs`).
- **Check what is drawn,** not only state; look at screenshots.

**Saving**
- **The 20 s quiet after loading the account's copy** (`CloudSyncService.apply`) is deliberate. Saves made in it are now sent when it ends.
- **The server returns `device` with `GET /me/save`** so a browser knows its own last copy. Without this, the copy sent as the page closes caused an extra reload at start.

**Measuring performance**
- **The readout's "heap" is `usedJSHeapSize`,** which includes uncollected garbage. The live heap after collection is about 81–95 MB on the laptop.
- On the busy laptop, measure **work** (objects, programs, allocations) as well as time.

**Windows and the shell**
- `git worktree remove --force` followed a `node_modules` junction and deleted it once. Use `git archive` for old builds.
- Bash heredocs containing apostrophes break. Write scripts with the editor, then run them.
- Use raw strings in Python replacements.

## 7. What M1 needs first (when approved)

Package 1: the `perfbudget` suite and readout additions:
- **The suite** runs at laptop A16 emulation and at desktop size, in each city. It records:
  - load stages
  - first-time freezes (map, room, ride, flight, drive)
  - main-thread busy time
  - objects tested per frame
  - allocation rate
  - shader programs
  - live heap
- **The readout:**
  - a long-frame log (frames over 500 ms, with what ran)
  - the player's spot in each Mark
  - the last places tapped
  - moved off the player to a top-right strip

The evidence and current numbers are in `M1_EXECUTION_PLAN.md`. Each later package must show before and after numbers from this suite.
