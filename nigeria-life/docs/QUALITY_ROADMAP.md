# NigeriaLife quality roadmap (revision 3, 14 Nov 2026, awaiting approval)

This roadmap is built from `docs/QUALITY_AUDIT.md` (`eea1933`). It is planning only: no game code has been changed for it. All work will go on `claude/next-steps`; nothing will be merged, deployed or published without your approval.

## Changes in revision 3

| # | Your question | Decision |
|---|---|---|
| 1 | Backup verification | One architecture with three separately held keys and four bucket permissions; no part of it both writes and reads backups. **The live server writes only.** **A separate checker reads only.** It runs in a private repository of yours that I and Cursor never get access to, and holds its own decryption key in its own secret store. It decrypts in a throwaway runner and reports only pass or fail with counts. **You alone hold the full recovery key, offline.** **Nothing anywhere can delete or change a backup before its lock runs out.** Losing or leaking any one key cannot lose backups; only the checker's key could expose them, and that key can be rotated without touching the others. |
| 2 | Last-resort recovery | **Removed.** Questions built from account records can be guessed (small answer spaces), seen by other players (the Rich List, player cards, CVs), known by friends and family, and worked through by repeated tries. Recovery is now only by something the owner **has**: an email inbox, a saved recovery code, a device they signed in on (with a key kept in that browser), or later an optional passkey. An account with none of these cannot be recovered. The game says so at sign-up and asks the player to secure the account as it grows in value. Admins never recover accounts. |
| 3 | Dependencies 0, 1, 2b, 3 | Confirmed in that order, with four corrections found in the code. **First:** Stage 0's phone session runs against a local copy of the branch's server, never the live server. **Second:** course levels have no server route at all today, so 2b adds one rather than only a check at hiring. **Third:** Tunde's Treasury Bills never pay out at maturity, so their restoration needs a server route and moves into 2b; Stage 3 shows them only after 2b. **Fourth:** the doors Stage 3 adds would become Living City destinations, so restricted compounds, landmarks and gated venues are kept out of residents' workplaces and errands. Neither deploy trigger includes `claude/next-steps` (Render deploys `stabilise-core`; Pages deploys `stabilise-core` and `main`), so the branch cannot reach the live game. |

## Changes in revision 2

| # | Your point | What changed |
|---|---|---|
| 1 | Stage 1 keys | Backups are now encrypted to a key pair whose private half never lives on the server, kept offline by you with a sealed second copy. Losing Render's secrets loses no backup. Added: automated daily integrity checks and a monthly decrypt-and-open drill; restores only into a separate place, behind your approval; every restore written to an append-only log. |
| 2 | Stage 2 temporary passwords | Replaced (the question-based last resort described here was itself removed in revision 3). An administrator never sets or sees a password. Recovery runs in order: an email reset link, a recovery code given at sign-up, approval from a device already signed in, then (last resort) a claim checked by the system on private account facts, with a 72-hour hold and notices to the account, approved by an admin. Every step is single-use, rate-limited and logged. |
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
| 2 | Account recovery by possession only (email, recovery codes, trusted devices), second sign-in | M | An email provider and address |
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
| 2b | 1 | It adds server routes (course levels, Treasury Bills) and changes what the server accepts at hiring. An existing player's certificates are carried over from their current save once, with a log, so nobody loses a job they hold. Stage 1's history makes that safe to undo |
| 3 | 0 (A16 check); 2b for Tunde's T-bill only | Otherwise independent of 1, 2 and 2b: no server change. It can be built while you set up the bucket and mail provider. Tunde's T-bill purchase waits for 2b's route; the rest of his card does not. Its A16 check uses Stage 0's local-server set-up |
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

**Status (14 Nov):** built on `claude/next-steps`: the readout (`src/ui/PerfReadout.ts`) and the session launcher (`npm run a16:session`, `tests/a16/session.mjs`). Instructions and the baseline table are in `docs/A16_TEST_SESSION.md`. The A16 figures are still to be measured on the phone.

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

**Your session on the A16** (about 45 minutes): I serve the branch's build **and a local copy of the branch's own game server** on the laptop, over your Wi-Fi, with a throwaway database. A branch build is never pointed at the live server: the branch expects server routes the live server does not have, and its data must not mix with real players'. Sign-up and the first pay in the first five minutes then work against the local server.
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

### 2. Who can do what: three keys, four bucket permissions

Nothing that writes backups can read them, and nothing that reads them can change or delete them.

**Keys** (public-key encryption, the `age` format, X25519). Each backup is encrypted to two recipients; either private key alone can decrypt it.

| Key | Private half held by | Public half held by | Used for |
|---|---|---|---|
| **Owner recovery key** | You only: generated on your own computer, kept in your password manager, plus a sealed paper or USB copy elsewhere. Never uploaded anywhere | The live server (to encrypt) | Real restores, and your monthly drill |
| **Checker key** | The checker only: a secret in its own private repository's protected environment (see below) | The live server (to encrypt) | The daily automated check |
| (none on the server) | – | – | **The live server holds no private key at all.** It cannot decrypt any backup, its own included |

**Bucket permissions** (one bucket, separate credentials):

| Credential | Held by | Can | Cannot |
|---|---|---|---|
| **Writer** | The live server (Render secret) | Put new objects under `backups/` and `manifests/` | Read, list, overwrite or delete anything |
| **Checker reader** | The checker | Read and list `backups/` and `manifests/`; put under `checks/` | Write or delete backups or manifests |
| **Owner reader** | You, offline (with the recovery key) | Read and list everything | Delete (not needed: expiry is by rule) |
| **Bucket admin** | Your cloud account, with two-factor sign-in | Set the lock, the lifecycle rule and the credentials above | Used only to set up and rotate; never stored in any service |

**The lock:**
- The bucket keeps object versions and a **write-once retention of 35 days** (object lock or bucket lock: the provider must support it; R2, B2 and S3 do).
- **Expiry is by a lifecycle rule** (14 daily, 8 weekly, 6 monthly), so **no credential holds delete rights**.

### 3. The backups
- A consistent SQLite snapshot (the online backup API), compressed and encrypted on the server to both public keys, uploaded daily and on demand with the writer credential.
- A manifest goes beside it. It records:
  - the backup id and time
  - the SHA-256 of the plain database and of the encrypted file
  - the counts (accounts, ledger sum, saves)
- The plain snapshot is written to the server's disk only as a temporary file and deleted after encryption.

### 4. Verification: the checker, a separate service with its own access
- **Where:** a scheduled GitHub Actions job in a **separate private repository you own** (for example `nigerialife-backup-check`). It is not the game's repository, and no one else, including me and Cursor, is a collaborator. It has nothing to do with the live server: different provider, different credentials.
- **Protecting the checker's key:**
  - **Where it lives:** the key and the checker reader credential are environment secrets in that repository. The environment allows only the default branch, and branch protection requires your review for any change to the workflow, so a workflow edit cannot quietly print the secret.
  - **Supply chain:** third-party actions are pinned to exact commits, and the job uses only the age and SQLite tools it needs.
  - **Your account:** two-factor sign-in on your GitHub account is required.
- **Where decryption happens:** in a GitHub-hosted runner, a fresh virtual machine destroyed after the job. The job:
  1. downloads the newest backup and its manifest with the checker reader
  2. checks the encrypted file's hash against the manifest
  3. decrypts to the runner's temporary disk
  4. opens the database read-only and recomputes the counts
  5. compares them with the manifest
  6. writes **only** pass or fail, the backup id, the hashes and the counts (no player data) to `checks/` and to the job log
  7. deletes the decrypted file

  Nothing decrypted leaves the runner.
- **Alerts:** a failed or missing check emails you (GitHub's workflow-failure notice, and the job's own message). The admin page shows the latest result: the job posts it to a narrow admin endpoint whose token can only record a check result.
- **Why this does not weaken the model:**

  | If this is compromised | The attacker can | The attacker cannot |
  |---|---|---|
  | The live server | Add junk backups (the checker flags a manifest that does not match) | Read, change or delete any existing backup |
  | The checker | Read and decrypt backups (a confidentiality loss) | Change or delete any. The checker key is rotated by issuing a new pair: new backups use it, old backups stay readable with your owner key, and the old checker key is revoked |
  | You lose your owner key | – | Lose backups: the checker key still decrypts, and a new owner key is issued |
  | Render's secrets are lost | – | Lose backups: they hold no private key |

  Only your owner key and the checker key can decrypt, and they are held by different parties in different places.
- **Monthly, by you:** the restore drill on your own machine with your owner key and the owner reader. It proves the key you would really use in a disaster works.

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
- **Permissions check** (against a local S3 stand-in, MinIO, with the same policies):
  - The writer cannot get, list, overwrite or delete.
  - The checker reader cannot put under `backups/` or delete.
  - Nothing deletes an object before its retention ends.
  - The live server's environment contains no age private key (a scan of its config).
- **Checker dry run** in a test private repository with test keys: pass on a good backup; fail and alert on a tampered file, on a missing day, and on a manifest whose counts differ.
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

**Needs from you:**
- The bucket (R2, B2 or S3), with object or bucket lock turned on.
- The private checker repository under your account.
- Generating and keeping the owner key, with my written steps.
- Two-factor sign-in on the cloud and GitHub accounts.

**Overlooked dependency, now noted:** thinning history must never remove a save version that a device's stale-overwrite guard (save step 1, `9a82545`) still names as its base. `accountsave` and `savehistory` test both together.

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

### 5. Trusted devices (approval and a device key)
- **A device key:** each browser that signs in with a password (or email) gets a random **device recovery key** stored in that browser's own storage (IndexedDB). The server keeps only its hash, the device's label and when it was last used. It expires after 180 days unused.
- **Signed in elsewhere:** if the player is still signed in on another phone or PC, that session can approve a password reset from a prompt in the game.
- **Signed out, but on a device used before:** from that same browser the player can reset with the device key, after a **24-hour hold**. During the hold, the account's email (if any) and every other signed-in session get "A password reset was asked for from <device>. Cancel?". Any of them can cancel it.
- Device keys are listed in the profile, where the player can remove any.

### 6. Accounts with none of these: no recovery, said plainly and early
**Why there is no question-based recovery.** Questions drawn from the account's own records fail on four counts:
- **Guessing:** the answer spaces are small. There are three cities, about 33 careers, a short car catalogue, the few months since the game launched, and bands of balances. Four right out of six is reachable by guessing, and more so across many accounts.
- **Public information:** a multiplayer game shows much of it to others. The Rich List shows wealth; player cards show jobs and CVs; hiring shows names; homes are visible in the street.
- **Social engineering:** friends, siblings and people sharing a phone know these facts. A hold and an admin's approval do not help when the claimant really does know them.
- **Repeated attempts:** limits slow, but do not stop, someone who tries different accounts or comes back each week. Every question asked also confirms something about the account.

A proof of **possession** (an inbox, a saved code, a device that was signed in) cannot be guessed or looked up, so recovery uses only those.

**So:**
- **At sign-up** the screen says clearly: "If you forget your password, only your email, your recovery codes or a phone you signed in on can get this account back."
- **As the account grows in value**, the game asks the player to secure it, with one tap to add an email or show the codes: at the first home, the first car, ₦1M, and every week while nothing is set.
- **The profile shows a security status:** email, codes, devices and (later) passkey, each set or not.
- **An account with no email, no codes and no trusted device cannot be recovered by anyone.** Admins do not recover accounts and never set, see or send a password. Their recovery role is limited to freezing an account that is reported stolen, after which the owner recovers it by one of the means above.

**Passkeys (optional, later):** a passkey on the phone (WebAuthn, supported by Chrome on Android) is the strongest option: it cannot be guessed or phished. It is tied to the site's domain. The game is on `daveemin0-sudo.github.io` today, and moving to a custom domain later would void every passkey made before. So passkeys come after the game has its own domain: a decision for you, listed below.

**Phone numbers (Stage 10a)** add an SMS code as a further factor. In Nigeria, SIM-swap fraud means a phone number alone should not reset a password. With an SMS code, the same 24-hour hold and notices apply.

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
  - **Device key:**
    - a device key resets only after the 24-hour hold
    - another session or the email can cancel it within the hold
    - a device key from another browser or account is refused
    - an expired or removed key is refused
  - **No other route:**
    - an account with no email, codes or devices has no recovery path
    - the admin API has no route that sets or reveals a password (the test lists the admin routes)
    - freezing a reported account stops sign-ins until the owner recovers it by a proper means
  - **Prompts:** at the first home, the first car and ₦1M, the secure-your-account prompt appears for an unsecured account.
  - **Audit:** each reset, hold, cancel and freeze writes an audit row.
- **Second-browser sign-in** finishes within 5 s and loads the account's life.
- **Regression:** `accountsave`, `onboarding`, `firstfive`, `online`.

**Risks:**
- Deliverability to Gmail, Yahoo and ng-domain inboxes: test each.
- Social engineering: removed by design. No one, admin or system, recovers an account on what someone says they know.
- Players who never secure their account can lose it: said at sign-up, prompted as the account grows, shown in the profile.
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

**Found in revision 3:**
- **Course levels have no server route at all today.** `Qualifications.sit` (`src/life/Qualifications.ts`) charges the fee and raises the level in the browser.
- **Tunde's Treasury Bills, once restored, would take ₦50,000 for a document that never pays out.** The bill is a bag item (`src/ui/HUD.ts`, the `npc-banker` action). Documents cannot be resold (`BackendService.resaleValue` returns 0), so there is no money loop, but nothing pays the 18.5% at maturity.

**What changes:**
1. **A server route for sitting a course level.** It:
   - charges the fee in the ledger
   - records the level
   - allows one level per game day per course

   The client's test (the short check) stays as the experience, but the server decides.
2. `hire` refuses a job whose certificate the server has no record of.
3. **Migration:** each existing account's current certificate levels are taken from its last save once, logged, and capped to what that account's course time and payments make possible. Nobody loses a job they hold.
5. **Treasury Bills as a server-held investment.** Buying one is a ledger transfer into a holding the server keeps, and at 90 game days the server pays the principal and interest into the bank. Tunde's card offers it (Stage 3) once this route exists. The bag shows the bill as a receipt, not as money.
4. **The unverified-earnings channel** (`UNVERIFIED_EARNING_LIMIT`, ₦30,000 per 10 minutes, `server/economy.ts:50-54`): every caller is traced and listed. Any that a player can drive in a loop moves to a server-checked route, or gets its own daily cap.

**Acceptance:**
- **`certificates` server checks:**
  - sitting a level through the route charges the fee once and records it
  - a second level the same game day is refused
  - hire without the server's record is refused
  - a completed level is recorded and then hires
  - the migration takes existing levels within the cap and writes a log
  - an edited save cannot raise a level
- **The unverified-channel trace** is written down, with each caller and its cap.
- **`treasury` server checks:**
  - a purchase moves ₦50,000 into a holding
  - at maturity exactly principal + interest is paid once
  - a second payout is refused
  - the holding survives a reload and a restore from history (Stage 1)
- **Regression:** `bizdays`, `companies`, `firstfive`, `money`, `accountsave`.

**Risk:** a player mid-course at migration. Their in-progress level is kept and finished through the new route.

**Size:** S to M (revision 3 adds the course and Treasury Bill routes).

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
| Tunde, wealth advisor (`banker-tunde`) | "📈 Invest in 90-Day Federal Treasury Bills (₦50,000)", which today never pays out | Business sheet | "Talk about investing" in Stage 3; the T-bill purchase once Stage 2b's server-held investment exists (never restored as it was) |
| Mallam Bisi, suya (`suya-master`) | Sells suya (also the first-steps guide) | Works | Keep |
| Emeka, phone technician (`phone-tech`) | Nothing of his own | Business sheet | Repair the phone and talk gadgets, through the Gadgets app (exists) |
| Master Tayo, mechanic (`lead-mechanic`) | "🛠️ Work Mechanic Apprentice Shift (+₦4,000)", paid by the server's `hud:workshop` gig | Business sheet | Restore the apprentice shift (Stage 5 deepens it) |
| Sgt. Bello, LASTMA warden (`traffic-warden`) | "👮 Ask for traffic and safety directions" (+10 cred, a salute) | Business sheet | Restore it; remove the duplicate |
| Chief Alabi (`community-elder`) | A conversation with memory | Works | Keep |
| Alaye, terminus chairman (`npc-agbero`) | Settle loading dues (₦200), greet | Works | Keep |
| The 12 older pedestrians (Amara, Kelechi, Blessing, Tobi, Ngozi, Babajide, Femi, Zainab, Funke, Chinedu, Halima, Alhaji Musa; `NPCs.ts`) | Greet and wave | To be listed by the suite | Keep; checked by the suite. Folding them into the crowd is Living City's stage 1 part, now in Stage 7 |
| Room staff in every room, all cities (nurses, cashiers, desk sergeants, clerks...) | Their room's actions | Not audited one by one | Listed and checked by the suite |
| Other players (`remote_player_*`) | Their card: chat, hire, CV | Works | Keep |

**Overlooked dependency, now noted:** the doors Stage 3 adds become places in each city's list, and Living City gives residents workplaces and errands from that list (`CityPopulation.giveLives`, `Routines.kindOf`). Restricted compounds, natural landmarks and open spaces are marked so they are never a workplace or an errand. Gated venues and the new public buildings take part like any other place of their kind, by their hours. `livingcity` checks that nobody's day leads into a restricted compound.

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
  - The restored actions work: the danfo fare is paid and the ride runs; the apprentice shift is paid by the server; the warden gives cred; Tunde talks about investing, and (with 2b in place) his T-bill moves ₦50,000 into the server's holding.
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
| 1 | The bucket (R2, B2 or S3) with lock turned on; a private repository of yours for the checker; generating and keeping the owner key with my steps; two-factor sign-in on both accounts |
| 2 | The email provider and the sending domain or address; who may freeze a reported account |
| After 2 | A custom domain for the game, if passkeys are wanted (they are tied to the domain) |
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
- **Stage 1**, then **2b**; **Stage 3**'s client work alongside, with Tunde's T-bill purchase switched on once 2b lands.
