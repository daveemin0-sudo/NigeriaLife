# Save system: audit and roadmap (11 Nov 2026)

Read from the code on `claude/next-steps`. Where something was only read and not run, it says so.

## 1. What exists today

A signed-up player's life is already kept on the server. `src/backend/CloudSyncService.ts` gathers every game key in the browser's storage into one document and sends it to `/me/save` two seconds after any change and every minute; `server/saves.ts` stores it per account with a version number, keeps the last five versions, and can roll one back from the admin page. On sign-in on another device the newer server copy replaces the device and the page reloads. The database is copied once a day (`server/backup.ts`). The `accountsave` suite covers this (15 checks, passing).

So nothing a signed-up player owns is "browser only" any more. What differs is **who decides** each thing.

| Who decides | What | Where |
|---|---|---|
| The server alone | Cash and bank (ledger); land titles and registered vehicles (registry); car dealing, staff, races, bets, marriage, chieftaincy, billboards, ideas, police record, trade | `server/economy.ts`, `registry.ts`, `motors.ts`, and the rest of `server/` |
| The browser, checked by the server on arrival | Jets and yachts, businesses, bought houses: a new one is dropped unless the ledger shows a payment for it; cash and bank inside the save are overwritten from the ledger | `server/saves.ts` (`prove`, `overlayMoney`) |
| The browser, taken on its word | Certificates and course levels, employment and its history, skills and career counts, the bag, the fridge, furniture and where it stands, home look and doors, rented homes, quests, needs, companies and their staff, supermarket stock, studio, ties and contacts, club, flight and coach state, race bests, omo-onile state, settings | the keys listed in section 4 |
| Nobody (lost with the browser) | Everything, for a **guest** who has not signed up | the pill says "Guest: sign up to keep your progress" |

Earnings made in the browser are reported to `/money/report`; the server pays business takings only up to what the owned businesses could have taken, and holds any other earning past a ten-minute limit for checking.

## 2. Risks found

1. **A stale second device can overwrite newer progress.** *(Fixed by step 1, 12 Nov 2026. Reproduced first: on the old server all four two-device checks in `accountsave` fail, the stale copy winning each time.)* `saves.write` keeps the server's copy only when the incoming save's clock is *older* than the stored one **and** its base version differs. A device left open stamps every save with the current time, so after playing on a PC, a phone tab that wakes up sends its old life with a new time and wins. The five kept versions are used up in five minutes of once-a-minute saves, so the good copy can be gone before anyone notices.
2. **The client's clock is trusted** in that same rule (`doc.at`).
3. **Things taken on the browser's word** can be edited: a certificate level opens better-paid jobs; stock, furniture and bag items can be invented. Money cannot be invented this way (the ledger decides), so the damage is to fairness, not to the economy's totals. Wages from a job the edited certificate opened still pass through the earnings limit.
4. **Backups sit on the same disk** unless `NL_BACKUP_DIR` points elsewhere. On Render that is one disk: a lost disk loses the data and its copies. Whether the live server has `NL_BACKUP_DIR` set was not checked (it needs the Render dashboard).
5. **Five versions is about five minutes** of history while playing. A bad save noticed the next day cannot be rolled back except from the daily copy.
6. **Guests** lose everything on a cleared browser. The first-steps guide does not yet ask them to sign up after the first pay.
7. **Size:** a save over 1.5 MB is refused whole ("That save is too large"); a single key over 400,000 characters is silently left out by the client. Current sizes were not measured.

## 3. Roadmap, in order of safety

Each step is separate, can be shipped alone, and has its own test. None changes the format of what is stored.

**Step 1. Stop the stale overwrite. DONE (12 Nov 2026), on `claude/next-steps`, not live.**

What was built:
- Server (`server/saves.ts`): a save is kept only when its `base` is the stored version, or it comes from the device that wrote the stored version (a lost reply). Otherwise the newer copy is sent back (`kept: 'server'`), whatever the device's clock says. A save that names no base (an old client, a tool) keeps the old clock rule. New nullable column `device` on `player_saves`, added only if missing. A copy put back by the admin gets a new, higher version and no device, so every device is behind it.
- Client (`src/backend/CloudSyncService.ts`): a random device id kept in the browser (`nl_account_save_device`, never in the save), sent with each save. A device that is behind loads the newer copy once and says so ("This device was behind..."). Behind again within 90 seconds, the other device is being played: this one stops saving and shows "Playing on another device", with **Play here instead** (which loads the latest and takes the life over: its next save carries `take: true` and is kept; the other device is then the one behind).
- This also ends a loop found while testing (it was there before, measured on the old code): a device opened while another was being played loaded the life again every time the other saved.
- Tests (`accountsave`, 23 checks): four server checks (stale device refused even with its clock ahead; caught up it saves; a lost reply still saves but another device naming the same number does not; a put-back copy wins) and four in the game (loads once and says why; steps aside; takes over; the life comes through whole).
- Roll-back: the old server ignores the `device` column and `take`; it can be redeployed as it was.

Found while testing, not fixed (separate): in the test, signing in on a second browser while the first is still open and connected to the city never finishes (it stays on the local guest). The same happens on the old code, so it is not caused by this step. To be looked at with the city connection (`OnlineAccount.bindRegistry`, the socket).

The plan as written before the work:
- Rule: a save is accepted only when its `base` equals the stored version, or when it comes from the same device that wrote the stored version (so a lost reply does not throw away a minute of play). Otherwise the server's copy is returned (`kept: 'server'`), as it already is for an old clock.
- Needs: a random device id kept in the browser (not part of the save), sent with each save; one new nullable column `device` on `player_saves` (added with `ALTER TABLE ... ADD COLUMN`, which leaves existing rows valid).
- Test (in `accountsave`): device A and B signed in to one account; A plays and saves; B, never reloaded, saves: the server keeps A's life and B reloads into it. Then A saves twice with the first reply dropped: the second is accepted.
- Roll-back: the column is ignored by the old code, so the old server can be redeployed.

**Step 2. Keep history by time, not by count.**
- Keep the last 5 versions plus one per hour for a day and one per day for a week. Server only; test with a fake clock.

**Step 3. Backups off the disk.**
- Set `NL_BACKUP_DIR` to a second place, or upload the daily copy to object storage. Needs the user's decision on where (it is an account and a cost).
- Test: restore yesterday's copy into a fresh server and sign in.

**Step 4. Ask guests to sign up at the right moment.**
- After the first pay and again after the first home: one line, one button. Client only; test in `onboarding`.

**Step 5. Move the things that open money to the server, one at a time.**
- Order: certificates (they gate salaries), then employment, then business stock. For each: the server keeps its own table, the action goes through a server route that takes the fee from the ledger, and the save's copy is overwritten from the table on arrival (as money is today). The client keeps working offline for a solo player.
- Test per item: edit the browser's value, save, reload: the server's value is back.
- This is the only step with real risk; each item is its own change with its own suite, never together.

**Not recommended:** rewriting the save as many small server tables in one go. The single document with server-side checks works, is covered by tests, and can be tightened piece by piece.

## 4. Keys in the save

Account and money view: `nigeria_life_account_data_v1` (money overwritten by the server). Homes and things: `nigeria_life_placed_furniture_v1`, `nigeria_life_furniture_storage_v1`, `nigeria_life_home_look_v1`, `nigeria_life_home_doors_v1`, `nigeria_life_home_handed_over_v1`, `nl_home_main_v1`, `nl_home_now_v1`, `nl_home_power_v1`. Work and learning: `nl_classes_v1`, `nigeria_life_employment_v1`, `nigeria_life_employment_past_v1`, `nigeria_life_companies_v1`, `nigeria_life_supermarket_v1`, `nigeria_life_studio_v1`, `nl_cargo_v1`. Vehicles and travel: `nigeria_life_fleet_v1` (checked), `nigeria_life_flight_v1`, `nigeria_life_coach_v1`, `nigeria_life_escort_v1`, `nl_race_best_v1`. People and story: `nigeria_life_character_v2`, `nigeria_life_ties_v1`, `nigeria_life_club_v1`, `nigeria_life_story_quests_v2`, `nl_first_steps_v1`, `nl_activity_v1`, `nl_games_record_v1`, `nl_ideas_v1`, `nl_police_v1`, `nl_omo_onile_v1`, `nigeria_life_broad_st_v1`. Settings: `nl_text`, `nl_sound_level`, `nl_music_autoplay`, `nl_notices`, `nl_theme_v1`, `nl_inside_view_v1`, `nl_drive_view_v1`, `nl_clean_view_v1`, `nl_place_folded_v1`.

Never in the save: the sign-in session, the account id, the network id, the world registry copy, the server address, and the save's own version marks.
