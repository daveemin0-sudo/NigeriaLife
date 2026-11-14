# NigeriaLife quality roadmap (revision 2, 14 Nov 2026, awaiting approval)

This roadmap is built from `docs/QUALITY_AUDIT.md` (`eea1933`). It is planning only: no game code has been changed for it. All work will go on `claude/next-steps`; nothing will be merged, deployed or published without your approval.

## Changes in revision 2

| # | Your point | What changed |
|---|---|---|
| 1 | Stage 1 keys | Backups are now encrypted to a key pair whose private half never lives on the server, kept offline by you with a sealed second copy. Losing Render's secrets loses no backup. Added: automated daily integrity checks and a monthly decrypt-and-open drill; restores only into a separate place, behind your approval; every restore written to an append-only log. |
| 2 | Stage 2 temporary passwords | Replaced. An administrator never sets or sees a password. Recovery runs in order: an email reset link, a recovery code given at sign-up, approval from a device already signed in, then (last resort) a claim checked by the system on private account facts, with a 72-hour hold and notices to the account, approved by an admin. Every step is single-use, rate-limited and logged. |
| 3 | Stage 3 characters and landmarks | Every street character's interaction is inventoried. The audit's "Enter / Inspect" fault has a deeper cause: four written interactions are orphaned by an id change, including the danfo conductor's "Board Danfo (₦300)". Stage 3 now restores them rather than inventing new ones. Places that are not buildings (hills, parks, lakes, monuments, restricted compounds, commercial strips, wharves) get safe arrival points and fitting interactions instead of doors. |
| 4 | Stage 4 memory | The JS heap is separated from the phone's real memory. The plan says what the A16 can measure on its own, with a USB cable, and not at all. Every target is provisional until Stage 0's baseline. |
| 5 | Stage 6 room counts | The room-variety tests use the real number of doors of each kind in each city, from the audit's probe. |
| 6 | Stages 7 and 9 Living City | The Living City plan had seven stages. Stages 1 to 3 were built (3 as 3a to 3d); 4 to 7 were never started, and two parts of stages 1 and 2 were left out. Each is now named and placed. |
| 7 | Stage 10b priority | Reassessed with the code. Hiring does not check certificates on the server; the browser does. That part moves into Track A (new Stage 2b), before the work system raises pay by grade. Moving stock, furniture and the bag to the server stays later, after a trace of what can reach money. |

Also changed:
- **G2 corrected:** career shifts already need 59 minutes on the server's clock (`server/earn.ts:76-81`, `minSeconds: 3540`); only the cash-in-hand "life" and street gigs pay after 4 to 10 seconds.
- **Dependencies and acceptance criteria reviewed** after these changes (see "Dependencies").

**Rules carried through every stage:**
- **Nothing is removed or made simpler to make a finding go away.**
- **Every stage ends with:**
  - its own new tests
  - the regression set: `livingcity`, `citylife`, `bigcities`, `sidestreets`, `danfo`, `streets`, `touch`, `convoys`, `vehicles`, `bodies`, `cities`, `ways`, `kerbs`, `input`, `phonefit`, `accountsave`, `onboarding`, `firstfive`, plus the stage's named suites
  - a written report of what was measured
  - a stop for your review
- **Laptop and phone results are always reported separately.** Anything marked **A16** needs you on the Samsung A16, with a build I serve on your Wi-Fi.
- **Complexity:**

  | Size | Work | Sessions |
  |---|---|---|
  | S | under a day | about 1 |
  | M | a few days | 2 to 3 |
  | L | a week | 4 to 6 |
  | XL | more | split into sub-stages |

---

## Order at a glance

**Track A: critical fixes (safety and correctness, first)**

| Stage | What | Size | Needs from you |
|---|---|---|---|
| 0 | A16 baseline: measure before changing anything | S (me) + about 45 min (you) | The A16 on Wi-Fi; optionally a USB cable and Developer options for memory figures |
| 1 | Save history, encrypted off-disk backups, auditable restore | M | A bucket; to hold the offline recovery key |
| 2 | Account recovery: email, recovery codes, reset, safe last-resort claim, second sign-in | M | An email provider and address |
| 2b | Server-checked certificates, and the unverified-earnings channel audited | S | – |
| 3 | Broken interactions, every character, Ride and map accuracy, arrival by kind of place | M | – |
| 4 | Mobile performance and memory | L | A16 sessions |

**Track B: feature development (after Track A, or alongside it where nothing overlaps)**

| Stage | What | Size |
|---|---|---|
| 5 | The work system | L |
| 6 | Interior diversity | XL (6a, 6b, 6c) |
| 7 | People who notice you, and story people with a day (Living City stages 5 and 6) | L |
| 8 | UI consistency, touch and text, landscape | M |
| 9 | Places with people in them, and atmosphere by hour (Living City stages 4 and 7) | M |
| 10 | Phone-number accounts (10a); stock, furniture and bag on the server (10b) | M each |

### Dependencies (reviewed)

| Stage | Depends on | Why |
|---|---|---|
| 1 | – | First: it protects every later change to accounts and saves |
| 2 | 1 | Account changes touch sessions and saves; history and backups must exist first |
| 2b | 1 | It changes what the server accepts at hiring. An existing player's certificates are carried over from their current save once, with a log, so nobody loses a job they hold. Stage 1's history makes that safe to undo |
| 3 | – | Independent of 1, 2 and 2b (no server change), so it can run while you set up the bucket and mail provider. Its A16 check waits for Stage 0's build |
| 4 | 0 and 3 | Targets come from Stage 0; screens and doors are settled in 3, so they are measured once |
| 5 | 2b and 3 | 2b, because Stage 5 raises pay by grade (the exploit would be worth more); 3, because it uses the card and action framework fixed there |
| 6 | 3 and 4 | Doors and arrival rules from 3; the per-room memory and draw-call budget from 4 |
| 7 | 3 and 6 | 3's character inventory and restored interactions are its base; 6's rooms are where some routines lead |
| 8 | 5, 6 and 7 | Restyle once, after the features land; Stage 3 fixes only the urgent taps |
| 9 | 6 and 7 | Customers inside rooms need 6's rooms; the atmosphere uses 7's people |
| 10a | 2 | The SMS provider decision |
| 10b | 1, 2 and 2b | A save-format change, protected by history and backups |

---

## Stage 0. A16 baseline (no game changes)

**Why:**
- P1: nothing in the audit was measured on a phone.
- G3: the first five minutes have not been tried on one.
- It gives the numbers every later stage is judged against.

**What changes:**
- A **performance readout**, shown only when switched on in Settings › Graphics (or `?perf=1`). Nothing else in the game changes.
- Files: a new `src/ui/PerfReadout.ts`, plus a toggle in the Settings section of `src/phone/apps/life.ts`.
- It reports only what the page can really know:

  | Measure | Source |
  |---|---|
  | Frame rate and the 95th-percentile frame time | requestAnimationFrame timing |
  | Draw calls, triangles, live geometries and textures | three.js `renderer.info` |
  | JS heap: used and limit | Chrome's `performance.memory`. It covers the JavaScript heap only, and Chrome rounds it, so it is a trend, not the phone's memory |
  | Time to playable | The game's own timer |
  | Tab reloaded since last visit | `document.wasDiscarded` and a session marker: the sign that Android killed the tab for memory |

- A "copy report" button.

**Your session on the A16** (about 45 minutes; I serve the build on your Wi-Fi):
1. Cold load to playable, three times.
2. Lagos: 2 minutes on foot on Broad Street, then 2 minutes driving to the expressway.
3. Fly to Abuja, then take a coach to Port Harcourt. The same in each; note any tab reload.
4. Go into 5 rooms (Mama Put, the supermarket, an Abuja bank, an Abuja hotel, a Port Harcourt market). Note any pause on entering.
5. The first five minutes as a new player, from a fresh browser profile (G3).
6. A ride: is the card covered (U1)? The map: tap a pin and check the place card. Talk to the danfo conductor, Tunde and Sgt. Bello.
7. Copy the readout after each part.

**Optional, for real memory figures:** with the phone on a USB cable, Developer options › USB debugging, and Android's `adb` on the laptop, I read the Chrome renderer's memory as Android counts it (`adb shell dumpsys meminfo`, the process's proportional set size) at the same moments. Chrome's remote DevTools (`chrome://inspect`) gives the same page's heap and a performance trace.

**What the A16 can and cannot tell us:**

| Measure | On its own | With USB and adb | Not available |
|---|---|---|---|
| Frame times, draw calls, triangles | yes | yes | |
| JS heap (rounded) | yes | yes, exact in DevTools | |
| Total memory of Chrome's process (what Android kills for) | no | yes (`dumpsys meminfo`) | |
| GPU memory | no | partly (`dumpsys gfxinfo` and driver figures, if the phone exposes them) | from the page |
| Thermal slowdown | seen as frame times rising over minutes | yes (`dumpsys thermalservice`) | |
| Battery drain | no | roughly (`dumpsys batterystats`) | |
| Tab killed for memory | yes (the reload marker) | yes, plus the system log | |

**Acceptance:**
- A table of A16 figures beside the laptop's, per city, written into this document.
- Each row says how it was measured: page, DevTools or adb.

**Risk:** almost none (an optional overlay). Close other apps before the session.

**Gate:** Stage 4's targets are set from these numbers. Until then they are provisional.

---

## Stage 1. Save history, encrypted off-disk backups, auditable restore (A3)

**Why:** a bad save or a lost disk can wipe players' lives. This is Critical for launch.

**What changes:**

### 1. History by time, not by count
Files: `server/saves.ts`, `server/store.ts`.

A save gets thinned versions kept by age:
- every save for the last 10 minutes
- then one per 10 minutes for 2 hours
- one per hour for 2 days
- one per day for 30 days

The stored format does not change. Thinning runs in a background pass, never on the request path.

### 2. Encryption that survives losing the server's secrets
Files: `server/backup.ts`.

- Backups are encrypted with **public-key encryption** (the `age` format, X25519). The server holds only the public "recipient" keys. **No key on the server can decrypt a backup**, so a lost or leaked Render secret neither loses nor exposes backups.
- Each backup is encrypted to **two recipients**:
  - **The owner's recovery key:** the private half is generated on your own machine, never uploaded. It is kept in two places: your password manager, and a sealed paper or USB copy kept somewhere else.
  - **A verification key**, held only in a separate secret store (for example GitHub Actions secrets, not Render), used by the automated check below.

  Either key can decrypt. Losing one leaves the other.
- **Key rotation:** a new pair yearly, or at once if a key may be exposed. Old private keys are kept offline to read old backups.
- A one-page **key runbook** (`docs/BACKUP_KEYS.md`) says where each key is, how to rotate, and how to restore if any one of Render, GitHub or your password manager is lost.

### 3. The backups
- A consistent SQLite snapshot (the online backup API), compressed, encrypted as above, uploaded daily and on demand to an S3-compatible bucket.
- Kept: 14 daily, 8 weekly, 6 monthly.
- The server's bucket credential can **write new objects only**: it cannot list, read or delete.
- The bucket keeps object versions and an **object lock** for 30 days, so a compromised server cannot erase backups.

### 4. Verification
- **Automated, daily (integrity):**
  - Each upload's manifest records the backup id, time, size, the SHA-256 of the plain database and of the encrypted file, and the counts (accounts, ledger sum, saves).
  - A scheduled job (GitHub Actions, using the verification key) downloads the newest backup, checks the encrypted file's hash, decrypts it in memory, opens the database read-only, recomputes the counts and compares them with the manifest. It then discards everything.
  - On a failure, an alert goes to you by email and appears on the admin page.
- **Monthly, by you (restore drill):** with your own recovery key, decrypt a backup on your machine and run the restore script to a scratch folder. It reports what it found. This proves the offline key works.

### 5. Restores
- **Whole database:**
  - Only by a script run by the operator, with a private key on their own machine.
  - It restores **into a new folder or a new service, never over the live database**. The live server is switched only after you approve, by a deliberate step (`restore promote`) that names the backup id.
  - The previous live database is kept untouched for 30 days.
- **One account, from history:**
  - From the admin page (`server/admin.html`): pick a version from the history list (time and a summary: cash, bank, homes, cars, play time). The current state is kept as a version first. Two confirmations, and a typed reason.
  - The player sees a notice in the game: "Your account was restored to <time> by support".
- **Auditable:**
  - Every restore, promote and key rotation is written to an **append-only restore log**: who, when, which backup or version id and its hash, why, the target, before and after counts, and the result.
  - The log lives in an `admin_audit` table (insert-only for the server) and is mirrored to the bucket as write-only objects.
  - The admin page shows it.

**Acceptance (measurable):**
- **`savehistory` suite:**
  - Two hours of simulated once-a-minute saves leave exactly the versions the rules promise.
  - A 90-minute-old version restores, and the account loads it whole.
  - Thinning never deletes the newest save.
  - An account restore writes one audit row and one in-game notice.
- **`backup` check** (against a local S3 stand-in, MinIO):
  - A backup encrypted to both test recipients decrypts with each one alone.
  - The server's credential cannot list, read or delete.
  - A tampered file fails its hash.
  - The manifest's counts equal the source's.
  - A restore into a fresh folder opens with equal counts.
  - `restore promote` without approval is refused.
- **Regression:** `accountsave` 23/23 and the money suite (`money`) still pass.
- **Runbook check:** you follow `docs/BACKUP_KEYS.md` once on your own machine (generate keys, decrypt a test backup). It counts as done only when that works.

**Risks:**
- Disk growth from history: bounded by thinning, measured.
- The offline key could be lost by you: the sealed second copy and the verification key cover it.
- Restoring over live by mistake: impossible by design (a new folder, a named promote).
- Object lock costs storage for 30 days: small at this size.

**Needs from you:** the bucket (R2, B2 or S3). Generating and keeping the recovery key, with my written steps. A place for the verification key (GitHub secrets).

**Size:** M.

---

## Stage 2. Account recovery and registration (A1, A2, A4)

**Why:** a forgotten password loses everything today (A2, Critical). Email is half-built, and its links never leave the server (A1).

### 1. A real mailer
Files: `server/accounts.ts` `Mailer`, `server/game-server.ts:64`.
- A provider adapter behind the existing interface. The console mailer is kept for development.
- Sends limited per address and per email, as now.
- A sending domain with SPF, DKIM and DMARC.

### 2. Email at sign-up, optional but encouraged
Files: `src/ui/SignInScreen.ts`.
- "Add an email to get your account back if you forget your password", verified by a link (`/auth/email` and `/auth/finish` exist).
- Existing accounts can add one from the phone's profile.

### 3. Recovery codes
- At sign-up, and for existing accounts on their next sign-in, the game shows **10 one-time recovery codes** once, with "copy" and "I've saved them".
- The server keeps only their hashes.
- A code plus the username sets a new password. Each code works once. Attempts are limited per account and per address, and the account is locked from codes for 24 hours after 5 failures.

### 4. Password reset by email
- `/auth/reset` sends a single-use link to the verified email, valid 30 minutes and bound to the account.
- `/auth/reset/finish` sets the new password, ends every other session, and emails "your password was changed".

### 5. Approval from a signed-in device
If the player is still signed in on another phone or PC, that session can approve a reset (a prompt in the game), with no email or code needed.

### 6. Last resort: a recovery claim, checked by the system
For an account with no email, no codes and no other session, the player starts a claim from the sign-in screen.
- **The system, not an admin, checks the claimant.** It asks for private facts only the account's records hold, chosen at random from:
  - the city they last played in
  - the names of two homes they own or rent
  - their bank balance within 20%
  - a car they own
  - their job
  - the name of a person they hired
  - the month they joined

  At least 4 of 6 must be right. Questions are never re-asked in the same form, and wrong answers are never revealed.
- **A 72-hour hold.** During it the account shows a banner on any device that signs in ("Someone is trying to recover your account. Cancel?"), and emails the address if one exists. Any sign-in by the owner can cancel it.
- **An admin approves after the hold**, with the system's check result in front of them. The admin cannot see the answers, sees no password, and cannot shorten the hold. High-value accounts (for example the top 100 on the Rich List, or over ₦50M) need a second admin.
- **On approval** the system shows the claimant, in the claim's own session, a single-use link to set a password (valid 30 minutes). Every other session ends. Adding an email and recovery codes is required at once.
- **Limits:** 1 open claim per account; 3 claims per address per week; after 3 failed claims, claims are off for that account for 7 days.
- **Logged:** every claim, check, hold, cancel, approval, denial and use goes to the same `admin_audit` log as Stage 1, with the admin's id.
- **No administrator ever types, chooses, sees or sends a password**, temporary or otherwise.

### 7. Sign in with email or username
The same field takes either.

### 8. Second sign-in while another browser is connected (A4)
Files: `src/backend/OnlineAccount.ts` `bindRegistry`, the city socket.
On sign-in, close the city connection and reconnect as the account.

**Acceptance:**
- **`accountrecovery` suite**, with a test mailer that keeps messages:
  - Email verify; reset by link. The old password fails, other sessions end, and the change notice is sent.
  - An expired or used link is refused; 6 requests in an hour are refused.
  - A recovery code resets once, the same code fails twice, and 5 failures lock codes for 24 hours.
  - A signed-in device's approval resets.
  - **Claims:**
    - wrong facts are denied without saying which
    - right facts start the 72-hour hold
    - the owner's sign-in cancels it
    - approval before 72 hours is refused
    - approval issues a link only in the claim session
    - an admin's view never contains an answer or a password
    - a high-value account needs two admins
    - each step writes an audit row
- **Second-browser sign-in** finishes within 5 s and loads the account's life.
- **Regression:** `accountsave`, `onboarding`, `firstfive`, `online`.

**Risks:**
- Deliverability to Gmail, Yahoo and ng-domain inboxes: test each.
- Social engineering: removed from admins by design (the system checks; admins only approve after a hold).
- Codes shown once may be lost: they can be regenerated from a signed-in session (which voids the old ones).

**Needs from you:** the email provider and the sending domain or address.

**Size:** M.

---

## Stage 2b. Server-checked certificates; the unverified-earnings channel audited (A5 in part)

**Why** (code):
- Whether a player has the certificate a job needs is checked only in the browser (`src/jobs/Employment.ts:163-174`, `Qualifications`). The server's hiring check looks only at police records (`server/economy.ts:277-288`, `hireRefusal`; `server/game-server.ts:90`).
- So an edited browser save can take a certificate-gated, better-paid job. The server then pays that wage through the real ledger, by the hour (career shifts need 59 minutes at the workplace: `server/earn.ts:76-81`).
- It does not make money from nothing: the hour at work and the daily limit still apply. But it skews earnings and the Rich List for everyone else.
- Stage 5 will raise pay by grade, so this goes first.

**What changes:**
1. Certificate levels are recorded by the server when a course level is completed (the Courses app's level-ups go through a server route, like a shift).
2. `hire` refuses a job whose certificate the server has no record of.
3. **Migration:** each existing account's current certificate levels are taken from its last save once, logged, and capped to what that account's course time and payments make possible. Nobody loses a job they hold.
4. **The unverified-earnings channel** (`UNVERIFIED_EARNING_LIMIT`, ₦30,000 per 10 minutes, `server/economy.ts:50-54`): every caller is traced and listed. Any that a player can drive in a loop moves to a server-checked route, or gets its own daily cap.

**Acceptance:**
- **`certificates` server checks:**
  - hire without the server's record is refused
  - a completed level is recorded and then hires
  - the migration takes existing levels within the cap and writes a log
  - an edited save cannot raise a level
- **The unverified-channel trace** is written down, with each caller and its cap.
- **Regression:** `bizdays`, `companies`, `firstfive`, `money`, `accountsave`.

**Risk:** a player mid-course at migration. Their in-progress level is kept and finished through the new route.

**Size:** S.

---

## Stage 3. Broken interactions, every character, Ride and map accuracy, arrival by kind of place (N1–N6, I2, I3, I5 in part, U1, L1, U2's worst)

### 3.1 Every character, accounted for (I3, revised)

The audit found "Enter / Inspect" on six people opening the business sheet. The cause, from the code:
- `src/ui/HUD.ts` has specific labels and actions for `npc-conductor`, `npc-banker`, `npc-mechanic` and `npc-warden` (`HUD.ts:1853-1903` and `3576-4288`).
- The characters in the street are now `conductor-danfo`, `banker-tunde`, `lead-mechanic` and `traffic-warden` (`src/world/NPCs.ts`).
- Those written interactions never run. The card falls back to "Enter / Inspect" (`HUD.ts:1943`), whose press opens the business sheet for anything unknown (`HUD.ts:604`). The `npc-warden` action is also written twice.

**Lagos street characters, today:**

| Character (id) | What the code meant | What happens now | Stage 3 |
|---|---|---|---|
| Chidi, drinks and Gala (`npc-hawker`) | Sells drinks and Gala | Works (sells; Greet, Wave) | Keep; check in the suite |
| Danfo Conductor (`conductor-danfo`) | "🚌 Board Danfo Shuttle (₦300)": pays the fare and rides | Business sheet | Restore the boarding. Also offer the existing danfo ride from the terminus, and ask the route |
| Segun, odds guru (`bet-customer`) | Nothing of his own | Business sheet | Talk about today's odds; open the Naija Odds app (exists) |
| Mama Nkechi, textiles (`aunty-ankara`) | Sells fabric | Works | Keep |
| Tunde, wealth advisor (`banker-tunde`) | "📈 Invest in 90-Day Federal Treasury Bills (₦50,000)" | Business sheet | Restore the T-bills; also "Talk about investing" |
| Mallam Bisi, suya (`suya-master`) | Sells suya (also the first-steps guide) | Works | Keep |
| Emeka, phone technician (`phone-tech`) | Nothing of his own | Business sheet | Repair the phone and talk gadgets, through the Gadgets app (exists) |
| Master Tayo, mechanic (`lead-mechanic`) | "🛠️ Work Mechanic Apprentice Shift (+₦4,000)", paid by the server's `hud:workshop` gig | Business sheet | Restore the apprentice shift (Stage 5 deepens it) |
| Sgt. Bello, LASTMA warden (`traffic-warden`) | "👮 Ask for traffic and safety directions" (+10 cred, a salute) | Business sheet | Restore it; remove the duplicate |
| Chief Alabi (`community-elder`) | A conversation with memory | Works | Keep |
| Alaye, terminus chairman (`npc-agbero`) | Settle loading dues (₦200), greet | Works | Keep |
| The 12 older pedestrians (Amara, Kelechi, Blessing, Tobi, Ngozi, Babajide, Femi, Zainab, Funke, Chinedu, Halima, Alhaji Musa; `NPCs.ts`) | Greet and wave | To be listed by the suite | Keep; checked by the suite. Folding them into the crowd is Living City's stage 1 part, now in Stage 7 |
| Room staff in every room, all cities (nurses, cashiers, desk sergeants, clerks...) | Their room's actions | Not audited one by one | Listed and checked by the suite |
| Other players (`remote_player_*`) | Their card: chat, hire, CV | Works | Keep |

**Rule:** a person's card shows only person actions (Greet, Wave, buy, ask, the service they give). The "Enter / Inspect" fallback and the business sheet are never shown on a person.

### 3.2 Arrival by kind of place (N1, N2, N3, revised)

The 80 destinations with no door are not all buildings. Each is classified and given what fits it:

| Kind | Examples | Arrival point | Interactions |
|---|---|---|---|
| **Building with a public entrance** | WTC, ICC, NNPC Towers, the hospitals, SPAR, Hotel Presidential, Genesis Cinema, Banex Plaza, the Dome, the clubs and lounges, the National Library | On the pavement at its door, facing it, standable, not on a road | A door and a card now. The room it already has, or one in Stage 6b; until then the card's real services, never an empty "Enter" |
| **Natural landmark or open space** | Katampe Hill, Ministers' Hill lookout, Millennium Park, City Park, Jabi Lake Park, Isaac Boro Garden, Zuma Rock, Aso Rock's foot, the City Gate arch, Bundu waterside | At a **viewpoint**: on foot ground or a path, at least 4 m from any traffic lane, facing the view, in the open (not inside the rock's or monument's solid). No door | Admire, take a photo, sit, walk the path, picnic or buy from a vendor where the place has one; the park's hours |
| **Gated venue** (theme park, waterpark, golf club, stadium, sports complex) | Magic Land, Sunrise Waterpark, IBB Golf Club, the National Stadium, Liberation Stadium, Package B, Old Parade Ground | At its gate or ticket booth | Buy a ticket or a day pass (or "closed today"); the venue's activity; a room or grounds later |
| **Restricted compound** | State House (the Presidential Villa), Defence HQ (Ship House), Mogadishu Cantonment, the Supreme Court, EFCC HQ, the Federal High Court | At the gate or the visitors' desk outside | Guards: "No entry without an appointment"; where public business exists (EFCC reports, the court's public gallery), that service at the desk; never walked into |
| **Commercial strip, junction or interchange** | Gwarinpa's 1st and 3rd Avenues, Jahi strip, Garrison roundabout, Rumuokoro flyover terminal, Peter Odili Road, Ada George, Aggrey Road, Giri interchange, Charlie Boy bus stop | On a pavement at the strip's busiest point, or the bus bay | The strip's nearby places listed on arrival; stalls (Stage 3d's system); boarding where it is a terminal |
| **Port, wharf or jetty** | Onne, Kidney Island, Borokiri, Abonnema Wharf, Bonny jetty | At the gate or the quay's foot | Work and trade where the server runs it; a boat where one sails |
| **Duplicate of a place that exists** | "Jabi Lake Mall & Boardwalk" (the Jabi Lake Mall room exists) | The existing door | Merged into the existing place, not given a second door |

Plus:
- **N2:** every arrival point is moved to the nearest standable spot with the wayfinder (`Wayfinder.canStand`), on the side the place faces. That covers UNILAG, Everyday Supermarket, Lagos Government House, Zuma Rock and the PH Bole spot (`src/game/Game.ts` `arriveAt`, `doorOf`).
- **N5:** a probe drives to every destination and records where the arrows end; any that end out of reach are fixed the same way.
- **N4:** check in play what tap-to-walk does at Balogun Market and the Palms. If it walks into walls, a walking grid is built for the area the player is in (`src/world/plan/Wayfinder.ts`).

### 3.3 Buttons, cards and screens
- **I2:** the salon and Sabo Textiles cards get their real actions (a hairdo or braids; fabric bought and sewn), acted out at the door until Stage 6b gives them rooms. "Enter" is shown only where there is a room.
- **U1:** the "⌄" menu is hidden during a ride, or the card starts below it. Skip ride and Turn back grow to 44 px (`src/transit/TransitHUD.ts`).
- **N6:** map pin labels kept inside the screen, shown nearest-first or at closer zoom, overlapping pins nudged apart, the filter row scrolls with a fade (`src/ui/WorldMapUI.ts`).
- **L1:** Lagos's 3.6 m plot-front rule applied in Abuja's and Port Harcourt's `roadsideStalls` (`src/cities/CityLife.ts`).

**Acceptance:**
- **New `reachable` suite**, in all three cities:
  - **Classification:** 100% of destinations have a kind from the table above.
  - **Buildings:** door within 3 m of the arrival; the card's first action does something within 2 s.
  - **Landmarks and open spaces:**
    - the arrival is standable, outside every obstruction, and at least 4 m from any traffic lane
    - at least 2 area interactions
    - no "Enter" button
  - **Gated venues:** a gate card with a ticket or "closed" state.
  - **Restricted compounds:** a gate or desk card; the player never set inside the compound.
  - **Strips and junctions:** arrival on a pavement; nearby places listed.
  - **Ports:** arrival at a gate or quay.
  - **Duplicates:** 0 left.
  - **Every arrival:** standable, outside every obstruction.
- **New `characters` suite:**
  - It lists every interactive person in all three cities' streets and in every room built at the time.
  - For each, the card's first action does something within 2 s, and is not the business sheet.
  - No person shows "Enter / Inspect".
  - The four restored actions work: the danfo fare is paid and the ride runs; T-bills bought (₦50,000 paid, holding recorded); the apprentice shift paid by the server; the warden gives cred.
  - The list of actions before and after Stage 3 is compared; nothing that worked is lost.
- **`phonefit`** opens the ride in motion, the map's place card, the map at three zooms and a person's card. It checks no overlap (including the "⌄"), no label past the edge, and taps of at least 44 px there.
- **`livingcity`:** no stall within 3.6 m of any plot front, in all three cities.
- **Regression set** passes.
- **A16** (15 minutes): the ride card, the place card, the six restored characters, two landmark arrivals.

**Risks:**
- New door and gate objects add interactive items: tap lookups are timed, and cards must not pile up where places sit close.
- Arrivals must never land on a road: the wayfinder's pavement is preferred, then open ground.
- Restoring old handlers must not double-charge: the danfo fare and the T-bills go through the server's money routes, checked by the suite.

**Size:** M (a little larger than revision 1, for the character and landmark work).

---

## Stage 4. Mobile performance and memory (P1–P5, I7)

**Two measures of memory, kept apart:**
- **JS heap** (`performance.memory`, Chrome only, rounded): the JavaScript objects the game holds. The audit's 279 to 380 MB is this, on the laptop. It is a trend measure; on its own it does not say whether Android will kill the tab.
- **Process memory on the phone** (Android's PSS of Chrome's renderer process, from `adb shell dumpsys meminfo`): what Android actually weighs. It includes the heap, the GPU's buffers and textures in the driver, decoded images, and Chrome's own overhead. Only the A16 with USB debugging gives it (Stage 0). Without the cable, the sign is whether the tab is reloaded (discarded).

**What changes, ordered by risk, smallest first:**
1. **Find the heavy things.** Triangles and draw calls per mesh group in each city (laptop). P3: what makes Port Harcourt's 422,000 triangles.
2. **Distance-based detail** for the heaviest meshes; Lagos's static street pieces merged by block (P4).
3. **A "low-end phone" graphics tier**, chosen when the phone reports little memory (`navigator.deviceMemory` at most 4) or a slow first frame:
   - shadows cheaper or off
   - shorter draw distance
   - pixel ratio capped

   What is in the world does not change.
4. **Leaving a city frees what is drawn there (P2)** (`src/cities/CityManager.ts`): meshes and textures released and rebuilt on return. Never game state.
5. **Traffic at levels of detail (P5).**
6. **Room first-entry pause (I7):** measured on the A16; if over the provisional limit, rooms are built during the door's fade or ahead of time.

**Acceptance.** All targets are **provisional until Stage 0's A16 baseline**; they are replaced by baseline-based figures before this stage starts, for example "a 25% cut from the A16 baseline".

| Check | Laptop target (provisional) | A16 target (provisional) |
|---|---|---|
| JS heap after the three-city tour | at most Lagos-only + 20% | rises by at most 20% over the tour (from the readout) |
| Process memory (PSS) after the tour | – | at most 80% of the baseline Lagos-only, and no tab discard (only if USB is available; otherwise no discard over two tours) |
| Port Harcourt triangles on arrival | at most 250,000 | – |
| Lagos draw calls on Broad Street | at most 380 | – |
| Traffic step in Lagos | at most 0.8 ms | – |
| Time to playable | – | at most 15 s (12 Nov reading: about 20 s) |
| Broad Street on foot | – | at least 30 fps, 95th percentile at most 50 ms |
| Driving | – | at least 25 fps |
| Abuja and Port Harcourt | – | at least 30 fps |
| Room first entry | – | pause at most 300 ms |

Plus:
- **`perfbudget` suite** (laptop) counts work: draw calls, triangles, the heap after the tour, the crowd and traffic step times. It fails on a 10% rise from this stage's own measured baseline.
- **Regression set**, plus `crosscity`, `driving`, `drivetouch`, and the `livingcity` resume-after-city-change check.
- **A16:** Stage 0's session repeated; the figures compared, method by method.

**Risks:**
- Freeing a city is the riskiest change in this roadmap. Only drawn things are freed; the suites run after every step; a switch keeps a city resident.
- A lower tier must not look broken: screenshots of each city on each tier, reviewed side by side.

**Size:** L.

---

## Stage 5. The work system (G1, G2 corrected, G6 in part)

**Corrected starting point:**
- **Career shifts:** already need about an hour on the server's clock at the workplace (`server/earn.ts:76-81`). What is thin is what the player does in that hour: 4 quick rounds (`src/jobs/HandWork.ts:44`), then waiting.
- **Cash-in-hand gigs:** the street and "life" gigs pay after 4 to 10 seconds (`earn.ts:65-75`, for example ₦25,000 for an 8-second code sprint).

**What changes:**
1. **The hour is filled.** A workplace's own tasks, at least 3 kinds per job type, in a loop through the shift, acted out at their spots. The tasks for each workplace type are written into one table: supermarket, buka, office, bank, site, hospital, refinery, garage.
2. **Gigs priced for their length.** Each gig's minimum time is raised to what its task shows, and its pay set against the hourly career rate for similar work. The daily earnings limit stays.
3. **Performance** from the task mini-games (`ShiftSkill`) moves pay ±20% and counts toward promotion (the server's grade).
4. **Leaving early pays the part done**, as `spanSeconds` already allows; two shifts at once are refused.
5. **Not in this stage:** working while offline (5b, after this is tried).

**Acceptance:**
- **`workshift` suite:**
  - In 5 workplace types, a shift's hour has at least 3 task kinds, with at least one task every 2 minutes.
  - Leaving early pays the share.
  - Two at once are refused.
  - Promotion follows the marks.
- **`earn` server checks:** no gig pays under its minimum; a gig's pay per minute is at most 1.5× its career equivalent; the daily limit holds.
- **Economy check:** a simulated week of play at the old and new rates; total earnings change within the agreed band.
- **Regression:** `bizdays`, `companies`, `actions`, `money`, `firstfive` (the first pay at the site stays quick: its short course is kept as the "first day"), `certificates` (Stage 2b).
- **A16:** one shift played through.

**Risks:**
- The economy's pace: a week-long simulation and the daily limit.
- The first five minutes must keep a quick first pay.

**Size:** L.

---

## Stage 6. Interior diversity (I1, I4, I5, I6)

**The real counts of town doors**, from the audit's probe, ground floor:

| Kind | Abuja doors | Port Harcourt doors | Rooms today |
|---|---|---|---|
| Office | 65 | 46 | 1 per city |
| Shop | 63 | 96 | 1 per city |
| Market | 2 | 53 | 1 per city |
| Bank | 6 | 7 | 1 per city |
| Hotel | 5 | 4 | 1 per city (plus suites) |

**6a. Rooms built from parts, different per building (I1).** Size L.
- A room is generated from its door's id (the same every visit), for these five kinds:
  - floor plan (P plans per kind: 4 for offices, shops and markets; 3 for banks and hotels)
  - fittings placement
  - finishes from the city's palette
  - the building's own name on its signs
  - staff names and looks
  - stock
- Built from shared parts within Stage 4's room budget.
- Files: `src/interiors/places/PlaceSpecs.ts` (`townRooms`), a new `src/interiors/places/RoomKit.ts`, `src/cities/CityExtras.ts`.

**6b. Bespoke rooms (I4, I5, N1's buildings).** Size L.
- Uniport campus (a lecture hall and a library, where Courses levels are studied).
- Broad Street's salon, Victory Phones, the pharmacy and Sabo Textiles.
- The public buildings from Stage 3.2's first row, in priority order: WTC, ICC, Hotel Presidential, SPAR, Genesis Cinema, Banex, the Dome, the National Library, then the rest.
- Gated venues get their grounds. Restricted compounds stay at the gate.

**6c. Room-by-room review (I6).** A contact sheet of every room against Lagos Life's; fixes where a room is bare, wrongly scaled, or signed inside.

**Acceptance**, using the real counts. For each kind in each city with n doors and P plans:
- **Every door enters its room** (all n, not a sample), with at least 5 things to do.
- **Plans:** distinct plan ids used = min(n, P). So:

  | City | Kind | Doors | Distinct plans |
  |---|---|---|---|
  | Abuja | Office, shop | 65, 63 | 4 each |
  | Abuja | Bank | 6 | 3 |
  | Abuja | Hotel | 5 | 3 |
  | Abuja | Market | 2 | 2 (each its own) |
  | Port Harcourt | Shop, market, office | 96, 53, 46 | 4 each |
  | Port Harcourt | Bank | 7 | 3 |
  | Port Harcourt | Hotel | 4 | 3 |

- **Signatures** (plan, footprint, fittings seed and finish): distinct signatures ≥ min(n, 12). Every door of a kind with n ≤ 12 is distinct from every other.
- **Neighbours:** for kinds with n ≥ 3, no two doors within 30 m of each other on the same street share a plan.
- **Names:** each room's signs show its own building's name (n of n).
- **Budget:** draw calls per room within Stage 4's room budget; first-entry pause within its limit (A16).
- **Regression:** `reachable` now enters every building door; plus `bigcities`, `interiors`, `places`, `shop`, `buka`, `hotel`, `eating`.
- **A16:** 10 rooms visited.

**Risks:**
- Memory: rooms built on entry, freed on leaving, budget per room.
- Saved state tied to a room (a hotel stay, a bought item) keeps the same ids.

**Size:** XL.

---

## Stage 7. People who notice you, and story people with a day (Living City stages 5 and 6; G4, G5, G3's open items)

**Where Living City stands** (`docs/LIVING_CITY.md` section 3):

| Plan stage | Status | Detail |
|---|---|---|
| 1. Levels of detail | Built | Folding the 12 older `NPCs.ts` pedestrians into the crowd was left out: they still run as a second, separate set |
| 2. Crossing and traffic | Built | A horn at someone crossing getting a reaction was left out |
| 3. Residents and day plans | Built (3a to 3d) | |
| 4. Places with people in them | Not started | |
| 5. People who notice you | Not started | |
| 6. Story people with a day | Not started | |
| 7. Atmosphere by hour | Not started | |

My report "Living City stages 1 to 3d complete" meant those plan stages. Stages 4 to 7 remain.

**This stage is plan stages 5 and 6, plus stage 1's left-out part:**
- **People who notice you (plan stage 5):** passers-by glance, greet a familiar face, step back from a speeding car, grumble at a horn. A tap on any near person gives a short exchange in their temperament; regulars remember being greeted (`Social`, `Ties`, `Actor.say`; a near person becomes a real actor only while spoken to).
- **Story people with a day (plan stage 6):**
  - Lagos's 11 story people get hours and routines: Chief Alabi on his bench by day and gone at night, Mallam Bisi grilling from late afternoon, Alaye at the park in the rush. Their Stage 3 actions are kept.
  - 6 to 8 regulars each for Abuja and Port Harcourt (G4), on the crowd's routines.
- **Conversations that branch** (G5): 3 to 5 exchanges, changing with closeness, the hour and what the player has done.
- **Chief Alabi reacts to life events** (G3).
- **The 12 older pedestrians folded into the crowd** (plan stage 1's left-out part). Their greet and wave are kept, and they become crowd residents. That removes the second pedestrian system without losing anyone.

**Acceptance:**
- **`regulars` suite:**
  - Each city has at least 6 regulars.
  - Each is where their routine says at 4 hours of the day.
  - A conversation changes after closeness rises.
  - A regular remembers the player after a reload.
  - A near person answers a tap in their temperament.
  - A passer-by reacts to a horn or a speeding car within 1 s.
- **`characters` (Stage 3):** still 100%; the 12 older pedestrians keep their greet and wave as crowd residents, and `NPCs.ts` no longer runs a pedestrian loop of its own.
- **`livingcity`:** the crowd stays under 1 ms per city (laptop).
- **A16:** a conversation read and answered.

**Size:** L.

---

## Stage 8. UI consistency, touch and text, landscape (U2–U7, G7)

**What changes:**
- **One design-token stylesheet loaded last** (U6).
- **Taps at least 44 px** (U2).
- **Text at least 12 px** in play, following the Settings text size (U3).
- **Landscape: your decision** (U4).
- **The taxi's inside-view arms** (U5).
- **Photo mode's bar** (U7).
- **G7:** cards as shortcuts, the action acted out where it happens (finished here after 6 and 7).

**Acceptance:**
- `phonefit` raised to 44 px taps and 12 px text, at 316, 360, 390, 412 and 430 px (and landscape if kept).
- A contact sheet reviewed.
- **A16:** a full sweep, with the phone's own large-text setting on.

**Size:** M.

---

## Stage 9. Places with people in them, and atmosphere by hour (Living City stages 4 and 7; L2–L5)

**What changes:**
- **Places with people in them (plan stage 4):**
  - Customers inside shops and bukas when the street says they went in.
  - Queues at a busy counter; empty at closing.
  - Built on Stage 6's rooms and the crowd's `in` state.
- **Atmosphere by hour (plan stage 7):** morning sweepers and school uniforms, the afternoon heat lull, evening generators and music, late-night quiet with a few night workers (`LagosStreetLifeSystem`, `AtmosphereManager`, `StreetAmbience`).
- **The horn reaction for people crossing** (plan stage 2's left-out part).
- **L2:** more stall custom from the city's own people's habits (breakfast akara, an evening suya), no people added.
- **L3:** crossings follow from Stage 6's places across the avenues.
- **L5:** watched.

**Acceptance (`livingcity` grows):**
- The customers counted inside a place equal those seen going in, and it is empty after closing.
- A crosser hooted at reacts within 1 s and still crosses safely.
- At lunch (laptop, real clock), a stall gets a customer at least every 3 minutes.
- Atmosphere events occur at their hours.
- Safety checks unchanged.

**Size:** M.

---

## Stage 10. Phone-number accounts (10a); stock, furniture and bag on the server (10b)

**10a. Phone sign-in by SMS one-time code (A1, second half).** Size M.
- Needs an SMS provider and a per-message budget.
- Nigerian numbers are normalised (+234, and the 0 dropped).
- Codes are rate-limited and last 5 minutes.
- Linked to an existing account, or used to make one.

**10b. Stock, furniture and bag items on the server (A5, the rest).** Size M.

Risk today (code):
- These items are taken on the browser's word, so they can be invented.
- **No server route was found that pays for them:** the inter-city goods trade holds its own cargo on the server and prices it itself (`server/trade.ts`), and business takings are computed by the server from its own catalogue (`server/earn.ts`, `quoteTakings`).
- So the damage is to fairness and display (a home full of invented furniture, a shop's invented shelves), not to the money supply.
- Stage 2b's trace of the unverified-earnings channel confirms or corrects that before this stage.

That is why 10b stays after the feature stages, unless 2b's trace finds a money path. In that case, the item behind the path moves into 2b.

**Acceptance:** `accountsave` grows; an edited browser save cannot add stock, furniture or bag items that the server will keep; existing players' items are carried over once, logged.

---

## What needs the real Samsung A16

| Stage | What only the phone can tell | About |
|---|---|---|
| 0 | Every baseline figure (page, and with USB: process memory, thermal); the first five minutes | 45 min (+15 for USB) |
| 3 | The ride card, the place card, the six restored characters, landmark arrivals | 15 min |
| 4 | Frames, memory (heap and PSS, tab discard), load time, room entry pauses, driving | 45 min |
| 5 | A shift's feel and taps | 20 min |
| 6 | Room entry pauses; rooms on the small screen | 20 min |
| 7 | Reading and answering a conversation | 10 min |
| 8 | Every surface, with large text on | 30 min |

---

## Decisions I need from you

| Before stage | Decision |
|---|---|
| 0 | Whether to use a USB cable and adb for real memory figures (optional) |
| 1 | The bucket (R2, B2 or S3); generating and keeping the recovery key with my steps; GitHub secrets for the verification key |
| 2 | The email provider and the sending domain or address; who the admins are, and the high-value threshold for two-admin approval |
| 8 | Landscape: support it, or lock to portrait |
| 10a | An SMS provider and budget, or postpone |
| Any deploy | Which stages go live, and when. The live site stays at `8690f5b` until you say |

---

## Traceability: every finding to a stage

| ID | Stage | ID | Stage | ID | Stage | ID | Stage |
|---|---|---|---|---|---|---|---|
| N1 | 3.2 (arrival by kind), 6b (rooms) | U1 | 3.3 | A1 | 2, 10a | I1 | 6a |
| N2 | 3.2 | U2 | 3.3 (worst), 8 | A2 | 2 | I2 | 3.3, 6b |
| N3 | 3.2 | U3 | 8 | A3 | 1 | I3 | 3.1 |
| N4 | 3.2 (check, then fix) | U4 | 8 | A4 | 2 | I4 | 6b |
| N5 | 3.2 | U5 | 8 | A5 | 2b (certificates, the earnings channel), 10b (the rest) | I5 | 3.3, 6b |
| N6 | 3.3 | U6 | 8 | | | I6 | 6c |
| N7 | done (`d59cfe7`) | U7 | 8 | | | I7 | 4 |
| N8 | done (8 Nov) | | | | | | |

| ID | Stage | ID | Stage | ID | Stage |
|---|---|---|---|---|---|
| G1 | 5 | L1 | 3.3 | P1 | 0, 4 |
| G2 | 5 (gigs only; careers already an hour) | L2 | 9 | P2 | 4 |
| G3 | 0 (A16), 7 | L3 | 9 | P3 | 4 |
| G4 | 7 | L4 | 9 (plan stages 4 and 7, horn), 7 (plan stages 5 and 6) | P4 | 4 |
| G5 | 7 | L5 | 9 (watch) | P5 | 4 |
| G6 | 5 | | | | |
| G7 | 6, 7, 8 | | | | |

---

**I will not start any stage until you approve.** The suggested start once you do:
- **Stage 0** (the readout and the A16 session).
- **Stage 1**, then 2b, alongside **Stage 3.** 3 touches no server code; 1 and 2b do.
