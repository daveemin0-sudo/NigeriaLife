# A16 test session (quality roadmap, Stage 0)

This session measures the game on the Samsung A16 before anything is changed, so later stages are judged against real phone figures. It runs `claude/next-steps` and that branch's own game server on the laptop, over your home Wi-Fi.

**It does not touch the live game, the live server or any player's data:**
- The game server is started from this branch on a **new, empty test database** in the laptop's temporary folder. It is printed on start, and is never `server/data`.
- The game for the phone is built with that local server's address and is opened with it in the link. The test check confirmed every request from the page went to the laptop, and none to `onrender.com` or `github.io`.
- The launcher refuses to start if it finds itself on a hosted server, or if the server address would be a hosted one.
- Sign-in links are printed on the laptop and never emailed.

## 1. Start the session (laptop)

1. Connect the laptop and the A16 to **the same Wi-Fi**.
2. In a terminal, in the `nigeria-life` folder:
   ```
   npm run a16:session
   ```
   It builds the game (about a minute), starts both servers, and prints a box with **the address to open on the phone**, for example:
   ```
   http://192.168.18.3:5180/?perf=1&server=http%3A%2F%2F192.168.18.3%3A8799
   ```
   - If the address shown is not your laptop's Wi-Fi address, run `npm run a16:session -- --ip <your address>`.
   - If Windows asks whether Node.js may use the network, choose **Allow** (private networks).
3. Leave the terminal open during the session. **Ctrl+C** stops it. The test database folder is printed; delete it when you are done.

## 2. On the A16

Before starting:
- Close other apps.
- Have the battery above 50%, the phone not charging, and screen brightness as you normally play.
- Note the phone's Android version, and whether Chrome's or Android's large-text setting is on.

1. Open the address in **Chrome**. The performance readout (a small dark panel at the left: fps, calls, heap) is already on because of `?perf=1`.
   - It can be turned on or off at any time in **Phone › Settings › Graphics › Performance readout**.
   - It averages the **last 10 seconds**. After loading, arriving somewhere or entering a room, **wait about 30 seconds before pressing Mark**, so the start-up pause is not counted.
2. **Loading, three times.** For each: close the tab completely, open the address again, and wait until you can walk. The start-up times are recorded by themselves (the report lists them).
3. **Lagos on foot.** Walk Broad Street for 2 minutes. Press **Mark** after 30 seconds, then again at the end.
4. **Lagos driving.** Get into a car (one at the kerb, or your own) and drive down to the expressway for 2 minutes. Press **Mark** while driving, twice.
5. **Abuja.** Fly to Abuja (the airport, or the phone's flights). On arrival walk for a minute, then press **Mark**.
   - Note if the page **reloads by itself** at any point. The report also notes it as "reloaded" or "BROUGHT BACK AFTER CHROME DISCARDED IT".
6. **Port Harcourt.** Take the coach from Abuja's motor park to Port Harcourt. Walk a minute, then press **Mark**.
7. **Five rooms.** Go into each and note any pause on entering, roughly in seconds:
   - Mama Put
   - the Everyday Supermarket (Lagos)
   - a bank in Abuja (on a weekday by the game's clock; banks are shut at weekends)
   - a hotel in Abuja
   - a market in Port Harcourt

   Press **Mark** inside each after 30 seconds.
8. **The first five minutes.** In Chrome, open a new **Incognito** tab, then the same address (a brand-new player). Play the first five minutes as a newcomer, including signing up when the game asks. The account is made on the laptop's test server only. Note anything confusing, slow or covered.
9. **Things to look at** (screenshots welcome):
   - Take a ride (phone › Ride): is the ride card at the top covered by the round "⌄" button?
   - Open the map and tap a place's pin: does the place card fit the screen?
   - Talk to the danfo conductor, Tunde and Sgt. Bello on Broad Street: what does their main button say and do?
10. **Send the report.** Tap **Report** on the panel. Then either:
    - **Save as file:** it goes to Downloads, and you send the file; or
    - **Select all**, then long-press, Copy, and paste it into a message.

    (Chrome does not allow copying by itself on a plain `http` page like this one, hence the two ways.)

## 3. Optional: real memory figures with a USB cable

The panel's "heap" is only the JavaScript heap, as Chrome rounds it. Android's own figure for the tab, which is what decides whether Chrome is killed, needs a cable.

1. On the A16: Settings › About phone › Software information › tap **Build number** 7 times (developer options on). Then Settings › Developer options › **USB debugging** on.
2. Connect the phone to the laptop by USB, and allow the laptop when asked.
3. On the laptop, with Android's platform tools (`adb`) installed:
   ```
   adb devices
   adb shell dumpsys meminfo com.android.chrome
   ```
   Run the second command at the same moments you press Mark (on foot in Lagos, driving, in Abuja, in Port Harcourt). The line that matters is **TOTAL PSS** of Chrome's renderer (sandboxed) process: the one using the most memory.
4. Optional extras:
   - **Thermal state:** `adb shell dumpsys thermalservice` at the start and after 20 minutes.
   - **Exact heap and a performance trace:** in Chrome on the laptop, `chrome://inspect`, then the phone's tab, then **inspect** (the Performance and Memory panels).

## 4. What the A16 can and cannot measure

| Measure | From the page (panel) | With USB and adb | Not available |
|---|---|---|---|
| Frame times (fps, 95th percentile, worst) | yes | yes | |
| Draw calls, triangles, geometries, textures, shader programs | yes (three.js's counts) | yes | |
| JS heap | yes, rounded by Chrome | yes, exact in remote DevTools | |
| Total memory of Chrome's process (what Android kills for) | no | yes (`dumpsys meminfo`, PSS) | |
| GPU memory | no | partly (`dumpsys gfxinfo`; driver figures only if the phone exposes them) | from the page |
| Thermal slowdown | seen as frame times rising over minutes | yes (`dumpsys thermalservice`) | |
| Battery use | no | roughly (`dumpsys batterystats`) | |
| Tab killed for memory and reloaded | yes (the report's "This page" line) | yes, plus the system log | |
| Time to playable | yes (the game's own load timer) | yes | |

## 5. Baseline results

Each row says where it was measured.

**Laptop reference.** From the audit of 14 Nov: headless Chrome, 412×915, Intel HD 620, the laptop heavily loaded. This is for comparison only; it is **not phone data**.

| Where | fps | p95 ms | Draw calls | Triangles | JS heap MB |
|---|---|---|---|---|---|
| Lagos, on foot | 33.2 | 47.2 | 502 | 169,162 | 279 |
| Abuja, on foot | 54.6 | 28.3 | 158 | 181,878 | 353 |
| Port Harcourt, on foot | 49.5 | 35.0 | 185 | 421,801 | 347 |

Time to playable on the laptop: 14.8 s.

**Samsung A16 baseline:** not yet measured. To be filled in from your report.

| Where | fps | p95 ms | Draw calls | Triangles | JS heap MB (page) | PSS MB (adb) | Reloaded? |
|---|---|---|---|---|---|---|---|
| Load 1 / 2 / 3 (s to playable) | | | | | | | |
| Lagos, on foot | | | | | | | |
| Lagos, driving | | | | | | | |
| Abuja, on foot | | | | | | | |
| Port Harcourt, on foot | | | | | | | |
| Mama Put | | | | | | | |
| Everyday Supermarket | | | | | | | |
| Abuja bank | | | | | | | |
| Abuja hotel | | | | | | | |
| Port Harcourt market | | | | | | | |

Room entry pauses (seconds, by eye):

The first five minutes (notes):

The ride card, the map place card, the three Broad Street characters (notes):

Stage 4's performance targets stay provisional until this table is filled in.
