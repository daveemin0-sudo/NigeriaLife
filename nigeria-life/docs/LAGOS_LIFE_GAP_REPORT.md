# What NigeriaLife needs next (10 November 2026)

A brief for Cursor, from the owner's own play of the live build (`a665d0e`) and of Lagos Life.
Every item says what is wrong or missing, what the player should get, and where the code is.

**About the Lagos Life details:** they come from the owner's descriptions and their earlier
screenshots. Claude did not open Lagos Life again for this report, so the owner's word is the
reference. Do not copy Lagos Life's names, art or text; build our own version, Nigerian and real.

**Ground rules (from the owner):**
- Phone first: test at 316 to 412 px with real taps and look at screenshots.
- Every action is acted out in the world.
- Nothing half-done.
- To publish: `git push origin claude/next-steps:stabilise-core` (see `docs/HANDOVER.md`).

---

## Bugs first

### 1. Shift pay stuck: "The server has no record of this shift"
- **What happens:** after a Junior Software Engineer shift, the phone says "Shift done: collect your ₦31,250". Tapping Collect says "The server has no record of this shift", and the money never comes.
- **Cause:** `src/phone/apps/life.ts`, around line 228.
  - `start` runs the shift locally (`backend.startJobShift`), then calls `online.startGig('career:<id>')` asynchronously. A failed server start is only shown as a message; the local shift carries on.
  - `claim` needs `online.rememberedGig(...)`. The record is missing whenever the server start failed (the server was asleep or redeploying, which is common on Render), the shift was started another way (in person at the workplace, `src/jobs`), or the record did not survive a reload.
- **Fix:**
  - Every way of starting a shift goes through one function. It starts the server gig first and only starts the local shift once the server agrees (or offline, locally only).
  - The gig record is kept in localStorage until it is paid.
  - At Collect with no record, ask the server for the player's open gig for that job before failing. If there truly is none, say so plainly and clear the stuck shift; never leave "collect" showing pay that can never come.
- **Check:** start a shift, reload the page, finish it, collect. Start a shift with the server down, then up. Start in person at the refinery. All three are paid exactly once (`money` and `jobs` suites).

### 2. Eating from the fridge walks to the wrong places
- **What happens:** the player taps a food. They walk to an empty corner of the parlour, wait, then go to the middle of the room and sit on nothing.
- **Cause:** `HomeLife.eatFromFridge` (`src/interiors/home/HomeLife.ts`, about line 284) uses `HOME.fridge` and `HOME.sofa`. Those positions are only kept up to date for the pieces a home came with (`followCore`, `CORE_CARDS` in `ResidentialInterior.ts`). In other homes, and for a bought fridge or sofa, they are the default flat's positions.
- **Fix:**
  - Take the food at the fridge that was tapped, at its own front.
  - Eat it on the nearest real seat in the home (a placed piece whose kind has `seat`).
  - With no seat, eat standing at the fridge.
- **Check:** in a second home and a built duplex, with a bought fridge and sofa. Look at screenshots.

### 3. Rooms in Abuja and Port Harcourt are empty of real activities
- **What happens:** "Abuja hotel" has a lounge and a bar but no check-in, room, key or stay.
- **Cause:** every Abuja and Port Harcourt shop, office, hotel, bank and market shares one thin room per kind (`townRooms` in `src/interiors/places/PlaceSpecs.ts`).
- **Fix:**
  - **Hotels:** give them the Lagos hotel's front desk, key card, room and stay (`HOTEL_SPECS`, `HotelStay` in `src/interiors/places/Hotel.ts`).
  - **Banks:** teller and ATM, as Lagos.
  - **Supermarkets:** the Lagos supermarket (shelves, trolley, till).
  - **Markets:** stalls with real buying.
  - **Offices:** real work, linked to Jobs.
  - Give each door its own name ("Wuse Suites", "Garki Supermarket") and put it on the map and in the map's search.

### 4. Two failing checks left from the last round
- **The blackout picture:** with the lights off, a home is under 15% darker. Something may still light the room since the generator moved outside. Test a power cut with an empty generator and look at the room.
- **The live ArrowUp driving check:** the car covers about 8 m in 12 s where the check wants 10 m. Run it alone with the game closed. If it still fails, the car now accelerates more slowly.

---

## Jobs: real pay, real hours

**Pay:** pay what Nigerian jobs really pay (2025–26 levels).
- Today: Dangote Refinery about ₦20k a shift; most jobs ₦10–15k.
- Use a real monthly salary for each job, turned into pay per shift. Examples:
  - Junior software engineer: ₦400k–₦800k a month.
  - Refinery operator: ₦500k–₦1.5M a month.
  - Banker: ₦250k–₦600k.
  - Doctor: ₦600k–₦1.5M.
  - Cleaner or dispatch rider: ₦70k–₦150k.
- Promotions raise pay.
- The server's earn rules (`server/earn.ts`) must agree: the server pays.

**Hours:**
- A shift should be a real stretch of play (the owner's reference: Lagos Life's hour or more), not 4 rounds in a minute or two.
- During the shift the player is at the workplace, in uniform, doing the work.
- The player can't wander off without leaving the shift (pay for the time worked, or none).

**Working while offline:**
- If the player has a job and is offline at their shift time, their character goes to work by itself.
- On return they find the pay, less a cut, with a short "while you were away" note.
- This must be decided by the server, so it can't be faked.

**CV and qualifications:**
- Better jobs ask for a CV, experience and certificates (see Courses below). Some ask for an interview.
- Show what is missing: "Needs: Software Developer level 3 certificate".

## Businesses: register your own and grow it

Buying a business starts at ₦8M, which is out of reach. Add **Register a business**, built from scratch:
1. **Pick the area.** The owner's fees: Ikorodu, Ajah, Wuse (Abuja) ₦6M; Yaba, Lagos Island ₦10M; Lekki ₦18M; Victoria Island, Ikoyi, Banana Island ₦30M. Add Port Harcourt areas the same way.
2. **Pick the type:** food spot, salon, provisions, fashion, pharmacy, events, dispatch, tech startup, filling station, transport (buses), and more.
3. **Name it, and design its logo:** colour, icon, letters.
4. **Pay the area's fee to register.** It starts small: a kiosk or a small shop, a few customers.
5. **Grow it:** hire staff, stock, upgrade the premises, open branches.

Its income comes from real customers in the world, settled by the server like other takings. Its sign, with its name and logo, stands on its building in that area. Keep the current "buy a business" for the rich. Where the code is today: `src/backend` (businesses, takings), the phone's business app, `src/realestate` (land and building).

## New phone apps

Every app follows the phone's design system (`src/ui/kit`, `src/ui/theme`), fits 316 px, and is checked by the `phonefit` suite.

- **Gadgets:** a shop for phones, PlayStation and other consoles, a titanium watch, retro games, sports watches, AirPods, MP3 players. Real models and prices. Bought items go into the bag and can be used: play the console at home, wear the watch.
- **Contacts:** everyone the player has met (people in the world, other players, staff, landlord, employer). Call, message, and see how they know you. `src/phone/apps` has Messages; Contacts sits beside it.
- **Courses (a university, e.g. UNILAG):**
  - Courses: lawyer, doctor, software developer, banker, chef, musician, artist, fashion designer, pilot, real estate pro, journalism, broadcast, entrepreneur, civil engineer, money smart.
  - Each has levels 0 to 5. Each level is study time (attend class, take the test) and a fee.
  - Each level gives a certificate in the CV, and certificates unlock jobs and better pay.
- **Bus company:** for players who buy buses (`src/assets` fleet, Motors).
  - The fleet, routes, drivers and conductors (crew), daily takings, servicing, and bookings.
  - The buses run their routes in the world and earn while the player is away.
- **Police:**
  - Report a crime or a person, check a case, pay a fine, request an escort, ask for a police report.
  - All from the phone, without driving to headquarters.
  - Ties into the existing police and Cases code (`src/life`, `src/phone/apps/cases.ts`).

## Settings and how to play

Make the settings page as clear and good-looking as the rest. It should cover:
- **How to play:** a short guided tour of moving, entering places, the phone, jobs, money, homes and driving.
- **Controls:** phone and PC shown separately.
- **Sound and music volumes.**
- **Graphics quality.**
- **Light and dark theme.**
- **Text size.**
- **Notifications.**
- **Account, privacy, help, and report a problem.**

Where: `src/phone/apps/life.ts` (settings).

## A full check of the game, as a player

On a phone viewport with real taps, in each city (Lagos, Abuja, Port Harcourt):
- enter one place of every kind and press every button inside;
- rent a home and build one, then use the bed, fridge, sofa, TV, bath, generator and cook in both;
- take a job shift end to end and get paid;
- book a ride and drive yourself;
- fly the jet both ways;
- open every phone app.

Write down what you did, what happened and what should happen. Fix it and rerun the suite that covers it.

---

## Real interiors for every place in Abuja and Port Harcourt (added 10 November, from the owner's screenshots)

**What the owner saw:** the "Abuja hotel room" is a white box.
- A box bed with a flat white block on it, a dark cube for a nightstand, bare white walls and floor. No chair, TV, wardrobe, window or bathroom.
- The hotel's big red sign ("ABUJA HOTEL... Bed · Until noon") is painted on the inside wall of the room.
- Asleep, the player lies across the bed with the head hanging off the end, on top of the covers.

The other shared rooms (supermarket, office, bank, market) are thin in the same way.

**What every place needs** (the Lagos standard is the floor; `src/housing/FineFurniture.ts`, `src/interiors/places/Hotel.ts`):
- **Built from the real pieces, not boxes:** `fineBed` (headboard, mattress, pillows, duvet), `fineSofa`, `fineWardrobe`, `fineToilet`, `fineBathtub`, `fineFridge`, `fineLamp`, `fineDining`, `fineFan`, with textured floors and walls (`src/graphics/Surfaces.ts`) and warm lights.
- **Its own room, designed for that place and that city.** Abuja and Port Harcourt each have their own look. Two hotels must not be the same room with a different name.
- **The sign outside on the building, not inside on a wall.** Inside, at most a small reception plaque.
- **Real things to do there,** acted out in the room (see the bug list above for each kind).

**A hotel room in Abuja should have:**
- a king bed with headboard, bedside tables and lamps;
- a wall TV over a console, a desk and chair, an armchair;
- a wardrobe and luggage rack;
- curtains on a window with a view of the city;
- a minibar fridge and an AC unit on the wall;
- carpet or a rug, and art on the walls;
- a key-card slot by the door;
- an en-suite bathroom: toilet, shower, basin and mirror, tiles, towels.

The lobby needs a reception desk with staff, seating, a lift, and the bar or restaurant. Check-in gives a key card. The room is yours until checkout.

**Sleeping:** lie along the bed, head on the pillow, under that bed's own duvet. Use the bed's real foot, side and facing (`HomeLife.sleepAt`, `duvetOver` and `bedDuvetNear` in `src/interactions/Duvet.ts`), as in Lagos homes and hotels.

**Check every place:** go through every place and door kind in Abuja and Port Harcourt (`townRooms`, `ABUJA_SPECS`, `PH_SPECS` in `src/interiors/places/PlaceSpecs.ts`). For each:
- open it;
- take a screenshot from the player's view and from above;
- compare it with its Lagos equivalent;
- fix it until it looks like a real Nigerian place of that kind.

Show the owner the screenshots.

---

## LAUNCH BLOCKER: cities must never leak into each other (added 10 November)

The owner flew from Lagos to Abuja:
- **The map:** they opened the map, picked a **supermarket**, and were set down **in Lagos, behind Apapa port**.
- **Home:** they pressed **Home** in Abuja and were taken **straight into their Lagos house**, with no flight or coach, and came out on its Lagos street.

**Cause:** nothing on these paths checks which city the player is in.
- `RideService.journey` (`src/phone/services/RideService.ts`) takes any destination in any city.
- The map's list and search (`src/ui/WorldMapUI.ts`) never read `cityManager.currentCityId`.
- The Home button (`Game.onNavigateMode('home')`, `canGoHome`, `currentHome`) enters the home whatever city it is in.

**The rule, everywhere:** a place in another city is reached only by travelling there: a flight, a coach, or the player's own jet (the flights terminal, `InterStateModal`). Nothing in one city ever opens a door, sets the player down, or walks or drives them to a place in another city.
1. **Map:** it shows and searches this city's places (the city tabs switch the view). Picking a place in another city offers "Fly or take the coach to <city>", which opens the flights terminal. It never teleports.
2. **Home:** with no home in this city, Home says "Your home is in Lagos (its address). Fly back, or check into a hotel here", with buttons for the flights terminal and the city's hotel. With a home here (rented, bought, built, or a hotel room checked into), Home goes there. The same goes for the phone's home shortcuts and the land app's "Go inside".
3. **Rides, deliveries, staff, jobs:**
   - Rides and "drive yourself" go only to places in this city.
   - Deliveries come to a home in this city, or to the player where they stand.
   - The driver, cook and cleaner work in the home's city.
   - "Go to work" for a workplace in another city offers the flight.
4. **Everything else that moves the player:** fainting or the hospital, the ambulance, police custody and release, a reload or a new session (come back in the city you left), races, convoys, the train, the yacht and the jet, and quest "Track" buttons. Each must keep or choose the right city.

**Check it properly:** add a `crosscity` suite.
- From each of Lagos, Abuja and Port Harcourt:
  - pick a place on the map;
  - search the map;
  - book a phone ride;
  - press Home, both with and without a home in that city;
  - order a delivery;
  - start a job shift;
  - reload the page.
- After each step, assert the city and that the player stands in that city.
- Then fly, coach and jet between all three, and check each lands at the right apron or terminal.
- Use real taps on a phone viewport.

**Before the public launch next week:** a full pass by hand of every button that names or moves to a place, in each city. Write down what happened and fix every case.

---

## LAUNCH REQUIREMENT: everything in a real account

The owner wants everything a player has (money, homes, land, cars, jets and yachts, businesses, furniture, the bag, certificates) kept in their real account, so it is never lost and is the same on any phone or computer they sign in from.

**What is true today:**
- **The "☁ Just now" cloud pill is not real.** `src/backend/CloudSyncService.ts` writes its "backup" and "backup code" only into the same browser's localStorage, with no server call. Clearing the browser or changing phones loses everything.
- **On the server already** (`server/`): accounts (`accounts.ts`: guest, email, password); online players' cash and bank (`economy.ts`, a ledger that can't be paid twice); the land register (`registry.ts`); and the parts in `motors`, `staff`, `races`, `police`, `trade` and so on.
- **Only on the device:** most of `BackendService`'s save (rented and bought homes), furniture and decor (`HouseDecorationSystem`), the bag, the fridge, the Fleet (jets and yachts), businesses (bought and registered), courses and certificates, gadgets, buses, quests, skills, the look, settings, the current city and spot.

**What to build:**
1. **One save per account on the server.** Every player-owned or earned thing not already in a server ledger, as one versioned document (`server/store.ts`, on the Render disk).
   - The client sends changes after each meaningful action, and a full save every minute while playing.
   - The server keeps the last few versions, so a bad save can be rolled back.
2. **The server stays the authority for money and land.** Cash, bank and title deeds come from their ledgers, never from the client's save. Expensive things the client claims (a jet, a business, a house) must match a server payment in the ledger. Don't trust a client save that says "I own a jet".
3. **Sign in anywhere:** on a new phone, signing in loads everything, and the player stands in the city and spot they left.
   - Signing in with an email (a code, or a password) is the real account.
   - A guest's progress moves into the account when they sign up, never lost.
   - A clear note that a guest who never signs up can lose everything.
4. **Offline:** play keeps working. Changes are queued on the device and sent when back online. If two devices clash, the newer version wins for small things; money and land always come from the server.
5. **Replace the fake pill with the true status:** "Saved to your account · 2 min ago", or "Not saved: no connection", or "Guest: sign up to keep your progress". Remove the device-only backup code.
6. **Account page:** sign in or out, change email, download my data, delete my account (needed for launch).
7. **Back up the server's data every day** (Render disk to a second place).

**Check:**
1. Make a new account, earn money, rent and buy homes, furnish them, buy a car and a jet, register a business, and take a course.
2. Clear the browser and sign in again; then sign in on a second browser or phone. Everything must be there and identical, standing where you left.
3. Restart the server: everything is still there.
4. Add a `accountsave` suite that does this.
