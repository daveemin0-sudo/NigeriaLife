# Nigeria Life — World Audit

Base commit: `bf55dab`. Branch: `cursor/world-audit`. Build served at `http://127.0.0.1:4177/` (vite preview). Viewport: **390×844** touch.

Method: every destination was booked through the map (keke/taxi/bike/walk) where a pin existed; the ride cinematic was skipped after start so set-down still ran. Enterable PlaceSpecs without a destination used the roadside door card. A place is **not** marked fine unless arrival, on-site and overview images were captured and checked. Teleport fallbacks are recorded as defects (no ride path).

## Totals

| Metric | Count |
|---|---:|
| Places in scope | 244 |
| Visited with photos | 209 |
| Could not visit / no photos | 35 |
| Marked fine (photos + no defects) | 14 |
| Defect instances | 337 |
| P0 | 198 |
| P1 | 9 |
| P2 | 130 |
| P3 | 0 |

### By category

| Category | Count |
|---|---:|
| wrong location | 158 |
| UI overlap | 89 |
| broken activity | 74 |
| walk-through object | 8 |
| open place shown as a building | 8 |

### Arrival path used

| Path | Count |
|---|---:|
| teleport-street-fallback | 137 |
| unvisited | 35 |
| map-keke | 34 |
| door-card | 25 |
| teleport-enter-fallback | 10 |
| direct-enter | 3 |

## Worst 30 places

| Rank | Place | City | Score | Top defects |
|---:|---|---|---:|---|
| 1 | Moscow Underground VIP Club | abuja | 96 | P0 wrong location; P2 UI overlap; P0 walk-through object |
| 2 | Aso Rock & Three Arms Monolith | abuja | 88 | P0 wrong location; P0 walk-through object; P2 broken activity |
| 3 | Mogadishu Cantonment (Abacha Barracks) | abuja | 88 | P0 wrong location; P2 UI overlap; P0 walk-through object |
| 4 | Banex Plaza Commercial & Tech Hub | abuja | 88 | P0 wrong location; P0 walk-through object; P2 broken activity |
| 5 | 345 Nightlife & Ultra Lounge | abuja | 80 | P0 wrong location; P0 walk-through object |
| 6 | Victoria Residence Estate | lagos | 76 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 7 | Oga Sunday Premier League Viewing Centre | lagos | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 8 | Federal Ministry of Finance Headquarters | abuja | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 9 | ECOWAS Commission Secretariat | abuja | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 10 | Asokoro District General Hospital | abuja | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 11 | Hustle & Bustle Club & Restaurant | abuja | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 12 | Trukadero By Bowling Entertainment Centre | abuja | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 13 | Jahi Modern Commercial & Tech Strip | abuja | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 14 | Mabushi Federal Works Complex | abuja | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 15 | Adokiye Amiesimaka Liberation Stadium | port_harcourt | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 16 | Trans-Amadi Industrial & Petrochemical Layout | port_harcourt | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 17 | Rumuokoro Flyover Bus Terminal & Junction | port_harcourt | 56 | P0 wrong location; P2 UI overlap; P2 broken activity |
| 18 | Jibowu Motor Park | lagos | 48 | P0 wrong location; P2 broken activity |
| 19 | Co-Creation Hub (CcHub Yaba) | lagos | 48 | P0 wrong location; P2 broken activity |
| 20 | Balogun Market | lagos | 48 | P0 wrong location; P2 UI overlap |
| 21 | Victoria Island Bureau de Change | lagos | 48 | P0 wrong location; P2 UI overlap |
| 22 | Port Health · Yellow Card Centre | lagos | 48 | P0 wrong location; P2 UI overlap |
| 23 | Ivory Rooftop Sky Lounge | lagos | 48 | P0 wrong location; P2 UI overlap |
| 24 | Marina Towers | lagos | 48 | P0 wrong location; P2 UI overlap |
| 25 | Eko Marina | lagos | 48 | P0 wrong location; P2 UI overlap |
| 26 | Eko Grand Hotel | lagos | 48 | P0 wrong location; P2 UI overlap |
| 27 | Murtala Muhammed International Airport | lagos | 48 | P0 wrong location; P2 broken activity |
| 28 | Allen Hair & Barbing Salon | lagos | 48 | P0 wrong location; P2 UI overlap |
| 29 | FCT Police Command | abuja | 48 | P0 wrong location; P2 UI overlap |
| 30 | World Trade Centre Abuja (WTC) | abuja | 48 | P0 wrong location; P2 broken activity |

## Could not visit

| Place | City | Reason |
|---|---|---|
| Abuja Bank | unknown | no roadside door in any city |
| Abuja Bureau | unknown | no roadside door in any city |
| Abuja Chambers | unknown | no roadside door in any city |
| Abuja Creek Hotel | unknown | no roadside door in any city |
| Abuja Market | unknown | no roadside door in any city |
| Abuja Microfinance | unknown | no roadside door in any city |
| Abuja Mini Mart | unknown | no roadside door in any city |
| Abuja Offices | unknown | no roadside door in any city |
| Abuja Palace Hotel | unknown | no roadside door in any city |
| Abuja Provision Store | unknown | no roadside door in any city |
| Abuja Secretariat | unknown | no roadside door in any city |
| Abuja Suites | unknown | no roadside door in any city |
| Abuja Supermarket | unknown | no roadside door in any city |
| Abuja hotel room | unknown | no roadside door in any city |
| Abuja hotel room | unknown | no roadside door in any city |
| Abuja hotel room | unknown | no roadside door in any city |
| Eko Grand Hotel · 2nd floor | unknown | no roadside door in any city |
| Eko Grand Hotel · your room | unknown | no roadside door in any city |
| Lagos Executive Barbershop | unknown | no roadside door in any city |
| Port Harcourt Bank | unknown | no roadside door in any city |
| Port Harcourt Bureau | unknown | no roadside door in any city |
| Port Harcourt Chambers | unknown | no roadside door in any city |
| Port Harcourt Creek Hotel | unknown | no roadside door in any city |
| Port Harcourt Market | unknown | no roadside door in any city |
| Port Harcourt Microfinance | unknown | no roadside door in any city |
| Port Harcourt Mini Mart | unknown | no roadside door in any city |
| Port Harcourt Offices | unknown | no roadside door in any city |
| Port Harcourt Palace Hotel | unknown | no roadside door in any city |
| Port Harcourt Provision Store | unknown | no roadside door in any city |
| Port Harcourt Secretariat | unknown | no roadside door in any city |
| Port Harcourt Suites | unknown | no roadside door in any city |
| Port Harcourt Supermarket | unknown | no roadside door in any city |
| Port Harcourt hotel room | unknown | no roadside door in any city |
| Port Harcourt hotel room | unknown | no roadside door in any city |
| Port Harcourt hotel room | unknown | no roadside door in any city |

## Full place table

| Place | City | Booked district | Set-down | Actual district | Match | Expected | Shown as | Path | Defects (P0–P3) |
|---|---|---|---|---|---|---|---|---|---|
| 1st Avenue Commercial Boulevard (Gwarinpa) | abuja | 1st Avenue, Gwarinpa Estate | -80,-60 | Garki Area 1 / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| 345 Nightlife & Ultra Lounge | abuja | Adetokunbo Ademola Crescent, Wuse 2 | -55,30 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P0:walk-through object |
| 3rd Avenue Food & Nightlife Strip (Gwarinpa) | abuja | 3rd Avenue, Gwarinpa Estate | -85,-50 | Garki Area 1 / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Abuja Arts & Crafts Village | abuja | Central Business District (Behind Silverbird) | -11.5,42 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Abuja City Gate Monumental Arch | abuja | Airport Expressway Entrance, Kukwaba | -30,-110 | Aso Rock / Three Arms Zone · the lookout / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Abuja National Mosque | abuja | Independence Avenue, Central Business District | -16,-25 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | _none observed_ |
| Amazon Street Executive Lounge & Garden | abuja | Amazon Street, Maitama | 11.5,120 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Area 1 Shopping Centre (Garki 1) | abuja | Moshood Abiola Way, Area 1, Garki | 11.5,80 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Aso Rock & Three Arms Monolith | abuja | Three Arms Zone, Asokoro | 0,-90 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | map-keke | P0:wrong location<br>P0:walk-through object<br>P2:broken activity |
| Asokoro District General Hospital | abuja | Nelson Mandela Street, Asokoro | 55,0 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Banex Plaza Commercial & Tech Hub | abuja | Aminu Kano Crescent, Wuse 2 | -45,10 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P0:walk-through object<br>P2:broken activity |
| Bank of Industry Tower (BOI) | abuja | Plot 256, Zone AO, Off Herbert Macaulay Way | -11.5,105 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Central Bank of Nigeria | abuja | Central Business District · the apex bank | -3000,4857.4 | Central Business District · the apex bank / Central Bank of Nigeria / Interior • Central Business District · the apex bank | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Central Bank of Nigeria Headquarters (CBN) | abuja | Tafawa Balewa Way, Central Business District | -11.5,-5 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Charlie Boy Bus Stop & Transit Hub | abuja | Expressway Interchange, Gwarinpa | -75,-70 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Chemian Commercial Plaza (Gwarinpa) | abuja | 3rd Avenue Corner, Gwarinpa | -70,-30 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| City Park Recreation Garden (Wuse 2) | abuja | Ahmadu Bello Way, Wuse 2 | -11.5,60 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Cubana Lounge & Suites (Wuse 2) | abuja | Plot 130, Adetokunbo Ademola Crescent, Wuse 2 | -11.5,45 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Defence Headquarters (Ship House) | abuja | Olusegun Obasanjo Way, Central Business District | -11.5,65 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Dugba Traditional Pottery & Art Market | abuja | Ahmadu Bello South, Garki | 11.5,125 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Dunes Centre Luxury Lifestyle Mall | abuja | 44 Aguiyi Ironsi Way, Maitama | 11.5,115 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| ECOWAS Commission Secretariat | abuja | 101 Yakubu Gowon Crescent, Asokoro | 60,10 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Eagle Square National Parade Ground | abuja | Shehu Shagari Way, Central Business District | 42,247 | Eagle Square / Central Business District · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | map-keke | P0:wrong location |
| Economic and Financial Crimes Commission (EFCC HQ) | abuja | Plot 301/302, Institution and Research District, Jabi | -58,-15 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Emab Plaza Technology & Commercial Centre | abuja | Aminu Kano Crescent, Wuse 2 | -11.5,70 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| FCT Police Command | abuja | Garki, Abuja | -3000,5206.4 | Garki · police / FCT Police Command / Interior • Garki · police / Garki · police · 3 things to do · 1 person here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location<br>P2:UI overlap |
| Farmers' Market (Maitama) | abuja | IBB Way, Maitama | 11.5,95 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Federal Green Cab Rank | abuja | Shehu Shagari Way, Central Business District | 14,12 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | P2:broken activity |
| Federal High Court Headquarters (Abuja) | abuja | Shehu Shagari Way, Central Business District | -11.5,95 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Federal Ministry of Finance Headquarters | abuja | Ahmadu Bello Way, Central Business District | -11.5,50 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Federal Passport Office, Abuja | abuja | Garki · Independence Avenue | -3000,5276.4 | Garki · immigration / Federal Passport Office, Abuja / Interior • Garki · immigration / Garki · immigration · 2 things to do · 1 person here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location<br>P2:UI overlap |
| Federal Secretariat Complex | abuja | Shehu Shagari Way, Central Business District | -14,32 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | _none observed_ |
| Garki General Hospital | abuja | Tafawa Balewa Way, Area 8, Garki | 11.5,100 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Garki International Model Market | abuja | Lafia Road, Garki 2 | 11.5,70 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Giri Highway Interchange Transit Hub | abuja | Airport Road & Lokoja Highway Interchange, Giri | 75,-100 | Aso Rock / Three Arms Zone · the lookout / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Gwarinpa General Hospital | abuja | 3rd Avenue, Gwarinpa Estate | -90,-40 | Garki Area 1 / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Hawthorn Suites by Wyndham (Garki) | abuja | 1 Uke Street, Off Ahmadu Bello Way, Garki 2 | 11.5,110 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Hustle & Bustle Club & Restaurant | abuja | Aminu Kano Crescent, Wuse 2 | -48,20 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| IBB International Golf and Country Club | abuja | 41 Aso Drive, Maitama / Asokoro Greenbelt | 11.5,-20 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| International Conference Centre (ICC) | abuja | Herbert Macaulay Way, Central Business District | -11.5,8 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Jabi Boat Club (JBC Waterside Lounge) | abuja | N10 Alex Ekwueme Way, Jabi Lake | -62,25 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Jabi Central Motor Park & Bus Terminal | abuja | Obafemi Awolowo Way, Jabi | -55,-5 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Jabi Lake Mall | abuja | Jabi · mall | -3000,5068.4 | Jabi · mall / Jabi Lake Mall / Interior • Jabi · mall | yes | OPEN_AIR | BUILDING_SHELL | door-card | P1:open place shown as a building<br>P2:UI overlap |
| Jabi Lake Mall & Boardwalk | abuja | Bala Sokoto Way, Jabi Waterfront | -475,416 | Jabi Lake Mall / Jabi · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | map-keke | P0:wrong location |
| Jabi Lake Park & Waterfront Promenade | abuja | Alex Ekwueme Way, Jabi | -65,15 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Jahi Modern Commercial & Tech Strip | abuja | Jahi District Central Boulevard, Abuja | -50,40 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Katampe Hill (Geographic Centre of Nigeria) | abuja | Katampe Extension Ridge, Abuja | 11.5,122 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Kubwa Model Community Market | abuja | Kubwa Expressway Corridor, Bwari Area Council | -75,50 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Mabushi Federal Works Complex | abuja | Mabushi Corridor, Federal Capital Territory | -30,40 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Madalla International Cattle & Grain Market | abuja | Madalla Junction, Niger / Abuja Boundary | 85,-110 | Aso Rock / Three Arms Zone · the lookout / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Magic Land Theme Park (Near City Gate) | abuja | Plot 444, Constitution Avenue, Kukwaba | -35,-100 | Aso Rock / Three Arms Zone · the lookout / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Maitama Amusement & Recreation Park | abuja | Off IBB Way, Maitama | 11.5,-50 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Maitama District Hospital | abuja | Aguiyi Ironsi Street, Maitama | 11.5,85 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Millennium Park (Maitama) | abuja | Maitama Green Corridor, Near Unity Fountain | 196,446 | Millennium Park / Millennium Park · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | map-keke | P0:wrong location |
| Millennium Tower | abuja | Central Business District · observation deck | -3000,4927.4 | Central Business District · observation deck / Millennium Tower / Interior • Central Business District · observation deck | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Ministers' Hill Panoramic Lookout | abuja | Ministers' Hill Road, Katampe / Maitama Ridge | 11.5,-60 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Mogadishu Cantonment (Abacha Barracks) | abuja | Keffi Road, Asokoro Extension | 65,-30 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P0:walk-through object |
| Moscow Underground VIP Club | abuja | 35 Adetokunbo Ademola Crescent, Wuse 2 | -52,25 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P0:walk-through object<br>P2:broken activity |
| Moshood Abiola National Stadium (Abuja) | abuja | Airport Road Corridor, Kukwaba | -40,-90 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| NIPOST General Post Office (Area 10) | abuja | Area 10, Garki | 11.5,90 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| NNPC Towers (National Petroleum Headquarters) | abuja | Herbert Macaulay Way, Central Business District | -11.5,-15 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| National Assembly | abuja | Three Arms Zone · the legislature | -3000,4718.4 | Three Arms Zone · the legislature / National Assembly / Interior • Three Arms Zone · the legislature | yes | BUILDING | BUILDING | door-card | P2:UI overlap<br>P2:walk-through object |
| National Assembly Complex (Senate & Reps) | abuja | Three Arms Zone, Asokoro | 70,30 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| National Christian Centre (Ecumenical) | abuja | Central Business District, Abuja | 16,-25 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | _none observed_ |
| National Hospital Abuja | abuja | Garki · hospital | -3000,5137.4 | Garki · hospital / National Hospital Abuja / Interior • Garki · hospital | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| National Library of Nigeria (Abuja) | abuja | Plot 274, Sanusi Dantata House, CBD | -11.5,-25 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| National Open University of Nigeria (HQ) | abuja | Plot 91, Cadastral Zone, Jabi / Asokoro Axis | 11.5,-40 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Nisa Premier Hospital & Specialist Centre | abuja | 15/21 Alex Ekwueme Way, Jabi | -52,-20 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Nnamdi Azikiwe International Airport (ABV) | abuja | Airport Road, Abuja | 260,250 | Abuja airport / Nnamdi Azikiwe Airport (ABV) / Interior • Abuja airport / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | BUILDING | map-keke | _none observed_ |
| Old Parade Ground Sports Complex (Area 10) | abuja | Festival Road, Area 10, Garki | 11.5,118 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Package B Sports Complex & Training Pitches | abuja | Stadium Ring Road, Kukwaba | -45,-115 | Aso Rock / Three Arms Zone · the lookout / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Play Imperial Lounge & Nightclub | abuja | Adetokunbo Ademola Crescent, Wuse 2 | -11.5,55 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Radio House Abuja (FRCN Complex) | abuja | Area 10 / Garki Corner, Herbert Macaulay Way | -11.5,85 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Savanna Bank | abuja | Shehu Shagari Way, Central Business District | 15.75,-8.6 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | P2:broken activity |
| Securities and Exchange Commission (SEC HQ) | abuja | Tower 421, Constitution Avenue, CBD | -11.5,75 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| State House (Presidential Villa, Aso Rock) | abuja | Aso Rock Presidential Compound, Asokoro | 75,40 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Sunrise Waterpark & Hillside Resort (Asokoro) | abuja | Sunrise Hills, Kugbo / Asokoro Heights | 70,-10 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Supreme Court of Nigeria | abuja | Three Arms Zone, Asokoro | 65,20 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| The Dome Entertainment & Leisure Hub | abuja | Plot 423, Adekunle Fajuyi Way, Central / Maitama Border | 11.5,105 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Transcorp Hilton Abuja | abuja | Maitama · hotel | -3000,4788.4 | Maitama · hotel / Transcorp Hilton Abuja / Interior • Maitama · hotel | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Transcorp Hilton Hotel (Maitama) | abuja | 1 Aguiyi Ironsi Street, Maitama | 11.5,55 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Trukadero By Bowling Entertainment Centre | abuja | 131B Ademola Adetokunbo Crescent, Wuse 2 | -42,35 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Unity Fountain & Civic Square | abuja | Shehu Shagari Way & Ironsi Corner, Maitama | 11.5,75 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| University of Abuja Main Campus (Gwagwalada) | abuja | Airport Expressway Corridor, Gwagwalada | 65,-90 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Utako Motor Park | abuja | Central Business District, Abuja | 19.2,28.6 | Central Area / Abuja FCT / Abuja airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | map-keke | P2:broken activity |
| World Trade Centre Abuja (WTC) | abuja | Constitution Avenue, Central Business District | -11.5,15 | Shehu Shagari Way / Central Area · Abuja / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Wuse Main Market (Zone 5 / Wuse Axis) | abuja | Kashim Ibrahim Way, Wuse Zone 5 | -175,186 | Wuse Market / Wuse · Abuja / Abuja airport · 8 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | map-keke | P0:wrong location |
| Wuse Market | abuja | Wuse · market | -3000,4998.4 | Wuse · market / Wuse Market / Interior • Wuse · market | yes | OPEN_AIR | BUILDING_SHELL | door-card | P1:open place shown as a building<br>P2:UI overlap |
| Zuma Rock Natural Monolith (Gateway to Abuja) | abuja | Abuja-Kaduna Expressway, Madalla | 95,-120 | Aso Rock / Three Arms Zone · the lookout / Abuja airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Allen Hair & Barbing Salon | lagos | Salon & barber | 55,4613 | Allen Avenue / Ikeja / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Allen Lounge | lagos | Lounge & club | 14,4560 | Ikorodu Road, Ikeja / Allen · Computer Village / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Amala Shitta | lagos | Shitta Roundabout, Surulere | -14,425 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Amala Shitta | lagos | Surulere · buka | -3000,1075.4 | Surulere · buka / Amala Shitta / Interior • Surulere · buka | yes | BUILDING | BUILDING | direct-enter | P2:UI overlap |
| Apapa Port | lagos | Wharf Road, Apapa | -43.4,48 | Port & Apapa Industrial / Maritime & Heavy Shipping Hub / Ikeja Aviation Corridor · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | map-keke | P2:UI overlap<br>P2:broken activity |
| Awolowo Way Fashion House | lagos | Tailor & fashion | -60,5657 | Obafemi Awolowo Way / Ikeja / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Awolowo Way Pharmacy | lagos | Pharmacy | -95,5643 | Obafemi Awolowo Way / Ikeja / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Balogun Market | lagos | Balogun Street, Lagos Island | -14,300 | Third Mainland Expressway / Island approach / Lagos Central Command Zone · 2 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Balogun Market | lagos | Lagos Island · market | -3000,1011.4 | Lagos Island · market / Balogun Market / Interior • Lagos Island · market | yes | OPEN_AIR | BUILDING_SHELL | direct-enter | P1:open place shown as a building<br>P2:UI overlap |
| Chop Express | lagos | Fast food | -14,5700 | Ikorodu Road, Ikeja / Ladipo · GRA / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Co-Creation Hub (CcHub Yaba) | lagos | Herbert Macaulay Way, Yaba | -12.5,-23.8 | Mainland Central / Dense Residential & Commercial Core / Lagos Central Command Zone · 2 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | map-keke | P0:wrong location<br>P2:broken activity |
| Computer Village | lagos | Gadget market | 14,4320 | Ikorodu Road, Ikeja / Allen · Computer Village / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Computer Village (Otigba Technology Market) | lagos | Otigba Street, Ikeja | 12,-95 | Ikeja / State Capital & Tech Center / Lagos Central Command Zone · 2 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | map-keke | P2:broken activity |
| Dangote Petroleum Refinery | lagos | Wharf Road, Apapa Marine Corridor | 14,3500 | Third Mainland Expressway / Mainland · Oworonshoki / Lagos Central Command Zone · 2 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Dangote Refinery Visitors Centre | lagos | Lekki Free Zone | -3000,1567.4 | Lekki Free Zone / Dangote Refinery Visitors Centre / Interior • Lekki Free Zone | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| EFCC Zonal Office | lagos | Government office | 14,3680 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Eko Commercial Bank & Wealth Hub | lagos | Broad Street, Lagos Island | 260,149 | Broad Street Commercial Core / Eko Commercial Bank & Wealth Hub / Interior • Broad Street Commercial Core / Broad Street Commercial Core · 3 things to do · 3 people here | yes | BUILDING | BUILDING | map-keke | _none observed_ |
| Eko Commercial Bank, Allen | lagos | Bank | 135,4613 | Allen Avenue / Ikeja / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Eko Executive Airfield | lagos | Private airfield | 14,2830 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Eko Grand Hotel | lagos | Hotel | 14,3330 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Eko Marina | lagos | Marina | 14,1240 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Elegushi Beach | lagos | Ikate Elegushi, Lekki Peninsula | -14,1235 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Elegushi Beach | lagos | Lekki · beach | -3000,3459.4 | Lekki · beach / Elegushi Beach / Interior • Lekki · beach | yes | OPEN_AIR | BUILDING_SHELL | door-card | P1:open place shown as a building<br>P2:UI overlap<br>P2:walk-through object |
| Everyday Supermarket | lagos | Lagos Island | 10.88,-45 | Yaba / Tech Silicon Valley & University District / Broad Street, Lagos Island · 2 things to do · 5 people here | yes | OPEN_AIR | OPEN_AIR | map-keke | _none observed_ |
| Faith Arena | lagos | Church | -14,6060 | Ikorodu Road, Ikeja / Ladipo · GRA / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Federal Passport Office, Alagbon | lagos | Alagbon Close, Ikoyi | -3000,2476.4 | Ikoyi · immigration / Federal Passport Office, Alagbon / Interior • Ikoyi · immigration / Ikoyi · immigration · 3 things to do · 2 people here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location |
| Freedom Park | lagos | Old Prison Ground, Broad Street, Lagos Island | 14,340 | Third Mainland Expressway / Island approach / Lagos Central Command Zone · 2 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Freedom Park | lagos | Lagos Island · arts | -3000,1217.4 | Lagos Island · arts / Freedom Park / Interior • Lagos Island · arts | yes | OPEN_AIR | BUILDING_SHELL | door-card | P1:open place shown as a building<br>P2:UI overlap |
| Ikeja City Mall | lagos | Mall | -14,4440 | Ikorodu Road, Ikeja / Allen · Computer Village / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Ikeja Computer School | lagos | Training centre | -145,5657 | Obafemi Awolowo Way / Ikeja / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Ikeja GRA | lagos | Estate | 14,5480 | Ikorodu Road, Ikeja / Ladipo · GRA / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Ikeja Golf Club | lagos | Golf club | -14,3860 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Ivory Rooftop | lagos | Victoria Island · lounge | -3000,1287.4 | Victoria Island · lounge / Ivory Rooftop / Interior • Victoria Island · lounge | yes | BUILDING | BUILDING | door-card | P2:UI overlap<br>P2:walk-through object |
| Ivory Rooftop Sky Lounge | lagos | Adeola Odeku Street, Victoria Island | 14,540 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Jibowu Motor Park | lagos | Ikorodu Road Corridor, Mainland | 86.1,-73.8 | Banana Island / Gated Waterfront Estate / Lagos Central Command Zone · 2 things to do · 3 people here | NO | OPEN_AIR | OPEN_AIR | map-keke | P0:wrong location<br>P2:broken activity |
| LASUTH | lagos | Hospital | 14,5000 | Ikorodu Road, Ikeja / Oshodi / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Ladipo Auto Market | lagos | Auto parts & mechanics | -14,5350 | Ikorodu Road, Ikeja / Ladipo · GRA / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Lagos Area Command Police Headquarters | lagos | Lagos Island | 260,349 | Lagos Central Command Zone / Lagos State Area Command Headquarters / Interior • Lagos Central Command Zone / Lagos Central Command Zone · 2 things to do · 3 people here | yes | BUILDING | BUILDING | map-keke | _none observed_ |
| Lagos Central Mosque | lagos | Nnamdi Azikiwe Street, Lagos Island | 14,820 | Third Mainland Expressway / Island approach / Lagos Central Command Zone · 2 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Lagos Central Mosque | lagos | Lagos Island · mosque | -3000,1987.4 | Lagos Island · mosque / Lagos Central Mosque / Interior • Lagos Island · mosque | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Lagos State Government House | lagos | Government | 14,3990 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Lagos State Police Command | lagos | Police | -14,3520 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Lekki Conservation Centre | lagos | Lekki-Epe Expressway, Chevron Corridor, Lekki | 14,3050 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Lekki Conservation Centre | lagos | Lekki · nature park | -3000,1499.4 | Lekki · nature park / Lekki Conservation Centre / Interior • Lekki · nature park | yes | OPEN_AIR | BUILDING_SHELL | door-card | P1:open place shown as a building<br>P2:UI overlap |
| Mai Suya Spot | lagos | Suya | 85,4627 | Allen Avenue / Ikeja / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Mama Put Buka & Chop Life Bar | lagos | Lagos Island | -10.43,-8.1 | Yaba / Tech Silicon Valley & University District / Broad Street Commercial Core · 3 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | map-keke | P0:wrong location |
| Marina Towers | lagos | Ahmadu Bello Way, Victoria Island | 14,250 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Marina Towers | lagos | Marina · offices | -3000,1147.4 | Marina · offices / Marina Towers / Interior • Marina · offices | yes | OPEN_AIR | BUILDING_SHELL | door-card | P1:open place shown as a building<br>P2:UI overlap |
| Murtala Muhammed International Airport | lagos | International airport | -14,6262 | Ikorodu Road, Ikeja / Airport Road / Airport Road · Mafoluku · 2 things to do · 1 person here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Murtala Muhammed International Airport (LOS) | lagos | Ikeja Aviation Corridor | 260,250 | Ikeja Aviation Corridor / Murtala Muhammed Airport (LOS) / Interior • Ikeja Aviation Corridor / Ikeja Aviation Corridor · 8 things to do · 3 people here | yes | BUILDING | BUILDING | map-keke | _none observed_ |
| Naija Fresh Supermarket | lagos | Supermarket | -14,5500 | Ikorodu Road, Ikeja / Ladipo · GRA / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Naija Radio House | lagos | Lateef Jakande Road, Agidingbi, Ikeja | 14,3800 | Third Mainland Expressway / Mainland · Oworonshoki / Lagos Central Command Zone · 2 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Naija Radio House | lagos | Ikeja · NaijaFM 99.1 | -3000,1637.4 | Ikeja · NaijaFM 99.1 / Naija Radio House / Interior • Ikeja · NaijaFM 99.1 | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| NaijaPetro Mart, Ikeja | lagos | Filling station · mart | -3000,4503.4 | Filling station · mart / NaijaPetro Mart, Ikeja / Interior • Filling station · mart | yes | BUILDING | BUILDING | direct-enter | P2:UI overlap |
| NaijaPetro, Bridge End | lagos | Filling station | 14,2650 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| NaijaPetro, Island | lagos | Filling station | -14,900 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| NaijaPetro, Mainland | lagos | Filling station | -14,3330 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| National Stadium, Surulere | lagos | Stadium Road, Surulere | -44.1,5 | Surulere / Sports, Media & Urban Culture / Ikeja Aviation Corridor · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | map-keke | P2:UI overlap<br>P2:broken activity |
| New Afrika Shrine | lagos | Neruda Road, Agidingbi, Ikeja | -14,2750 | Third Mainland Expressway / Mainland · Oworonshoki / Lagos Central Command Zone · 2 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| New Afrika Shrine | lagos | Ikeja · Afrobeat | -3000,1848.4 | Ikeja · Afrobeat / New Afrika Shrine / Interior • Ikeja · Afrobeat | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Nike Art Gallery & Cultural Studio | lagos | Lekki Phase 1 | 75.6,-8 | Lekki Phase 1 / High-End Residential Estates & Coastline / Lagos Central Command Zone · 2 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | P2:broken activity |
| Oga Sunday Premier League Viewing Centre | lagos | Bode Thomas Street, Surulere | -10.5,-28 | Mainland Central / Dense Residential & Commercial Core / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Oga Sunday Viewing Centre | lagos | Adeniran Ogunsanya Street, Surulere | -14,485 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Oga Sunday Viewing Centre | lagos | Mushin · football | -3000,1706.4 | Mushin · football / Oga Sunday Viewing Centre / Interior • Mushin · football | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Oshodi Transport Interchange | lagos | Bus terminal | -14,4900 | Ikorodu Road, Ikeja / Oshodi / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Polling Unit 001 | lagos | Campbell Street, Lagos Island | -14,760 | Third Mainland Expressway / Island approach / Lagos Central Command Zone · 2 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Polling Unit 001 & NIN Centre | lagos | Lagos Island Civic Centre | -3000,1775.4 | Lagos Island Civic Centre / Polling Unit 001 & NIN Centre / Interior • Lagos Island Civic Centre | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Port Health · Yellow Card Centre | lagos | Airport Road, Mafoluku | -3000,2616.4 | Airport Road · Mafoluku / Port Health · Yellow Card Centre / Interior • Airport Road · Mafoluku / Airport Road · Mafoluku · 2 things to do · 1 person here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location<br>P2:UI overlap |
| Quilox Nightclub | lagos | Victoria Island | 14.8,103 | Victoria Island / Luxury Business, Diplomacy & Nightlife / Ikeja Aviation Corridor · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | _none observed_ |
| Redemption Cathedral | lagos | Mobolaji Bank Anthony Way, Ikeja | -14,620 | Third Mainland Expressway / Island approach / Lagos Central Command Zone · 2 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| Redemption Cathedral | lagos | Island · church | -3000,1919.4 | Island · church / Redemption Cathedral / Interior • Island · church | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Sankofa Motors | lagos | Car showroom | 14,450 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| St. Nicholas Lagos General Hospital | lagos | Lagos Island | 260,49 | Lagos Island Medical District / St. Nicholas Lagos General Hospital / Interior • Lagos Island Medical District / Lagos Island Medical District · 4 things to do · 3 people here | yes | BUILDING | BUILDING | map-keke | _none observed_ |
| The Library | lagos | Adetokunbo Ademola Street, Victoria Island | 14,640 | Third Mainland Expressway / Island approach / Airport Road · Mafoluku · 2 things to do · 1 person here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| The Library | lagos | Ikoyi · fine dining | -3000,1357.4 | Ikoyi · fine dining / The Library / Interior • Ikoyi · fine dining | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| The Palms Mall | lagos | Babatunde Jose Road, Lekki Phase 1 | -14,3150 | Third Mainland Expressway / Mainland · Oworonshoki / Airport Road · Mafoluku · 2 things to do · 1 person here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| The Palms Mall | lagos | Lekki · mall | -3000,2128.4 | Lekki · mall / The Palms Mall / Interior • Lekki · mall | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| University of Lagos (UNILAG) | lagos | Akoka, Yaba | 260,149 | Akoka Campus, Yaba / University of Lagos (UNILAG) / Interior • Akoka Campus, Yaba / Akoka Campus, Yaba · 4 things to do · 3 people here | yes | BUILDING | BUILDING | map-keke | _none observed_ |
| Victoria Island Bureau de Change | lagos | Victoria Island FX corridor | -3000,2686.4 | Victoria Island · FX desk / Victoria Island Bureau de Change / Interior • Victoria Island · FX desk / Victoria Island · FX desk · 3 things to do · 1 person here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location<br>P2:UI overlap |
| Victoria Residence Estate | lagos | Victoria Island | -9.5,30.4 | Lagos Island / Broad Street / Lagos Central Command Zone · 2 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | teleport-enter-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity<br>P1:broken activity |
| Visa & Consular Desk | lagos | Lagos Island consular corridor | -3000,2546.4 | Lagos Island · consular / Visa & Consular Desk / Interior • Lagos Island · consular / Lagos Island · consular · 2 things to do · 1 person here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location |
| i-Fitness | lagos | Bourdillon Road, Ikoyi | 14,720 | Third Mainland Expressway / Island approach / Lagos Central Command Zone · 2 things to do · 3 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location |
| i-Fitness | lagos | Ikoyi · gym | -3000,1427.4 | Ikoyi · gym / i-Fitness / Interior • Ikoyi · gym | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Abonnema Wharf Marine Terminal | port_harcourt | Abonnema Wharf Road, Port Harcourt Town | -10.75,-115 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Ada George Commercial Boulevard | port_harcourt | Ada George Road, Rumueme Axis | -10.75,-10 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Adokiye Amiesimaka Liberation Stadium | port_harcourt | Elelenwo Link Road, Port Harcourt | -10.75,25 | Aba Road / Aba Road · Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| Aggrey Road Commercial & Heritage High Street | port_harcourt | Aggrey Road, Port Harcourt Town | 10.75,-110 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Bonny Island Marine Passenger Jetty | port_harcourt | Bille / Bonny Waterside Terminal, Port Harcourt | 10.75,90 | Aba Road / Aba Road · Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Borokiri Coastal Wharf & Community | port_harcourt | Borokiri Island End, Port Harcourt Town | 10.75,-115 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Bundu Waterside Artisan Fish Jetty | port_harcourt | Bundu Waterfront, Port Harcourt Town | 10.75,-120 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Creek Road Marine Market (Town) | port_harcourt | Creek Road, Port Harcourt Town | 10.75,-70 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Delta Bank | port_harcourt | Aba Road, D-Line | 15.75,-22.4 | Aba Road / Port Harcourt / Port Harcourt airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | P2:broken activity |
| Famous Port Harcourt Bole & Fish Spot | port_harcourt | D-Line, Port Harcourt | -14.33,7.36 | Aba Road / Aba Road · Port Harcourt / Port Harcourt airport · 8 things to do · 3 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | _none observed_ |
| Federal Passport Office, Port Harcourt | port_harcourt | Old GRA · near Police Command | -3000,5696.4 | Old GRA · immigration / Federal Passport Office, Port Harcourt / Interior • Old GRA · immigration / Old GRA · immigration · 2 things to do · 1 person here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location |
| Garrison Roundabout Commercial Junction | port_harcourt | Aba Road & Port Harcourt / Elelenwo Junction | 10.75,15 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Genesis Deluxe Cinema & Entertainment (GRA 2) | port_harcourt | Tombia Street, GRA Phase 2 | -10.75,-18 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Hotel Presidential (Old GRA) | port_harcourt | Aba Road & Presidential Junction, Old GRA | -10.75,10 | Aba Road / Aba Road · Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Isaac Boro Garden Peace Park | port_harcourt | Opposite Mile One Flyover, Aba Road Entrance | 10.75,-95 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Kidney Island Marine Logistics Terminal | port_harcourt | Dockyard Road / Creek Axis, Port Harcourt | 10.75,78 | Aba Road / Aba Road · Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Mile 1 Market | port_harcourt | Diobu · market | -3000,5348.4 | Diobu · market / Mile 1 Market / Interior • Diobu · market | yes | OPEN_AIR | BUILDING_SHELL | door-card | P1:open place shown as a building<br>P2:UI overlap |
| Mile One International Market (Diobu) | port_harcourt | Ikwerre Road, Diobu, Port Harcourt | -10.75,-45 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Oil Mill Market (Rumuokwurusi) | port_harcourt | Aba Road & Eleme Flyover Junction, Rumuokwurusi | 10.75,48 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Onne Sea Port & Oil & Gas Free Zone | port_harcourt | Onne Industrial Corridor, Port Harcourt | 10.75,65 | Aba Road / Aba Road · Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Peter Odili Road Waterfront Commercial Strip | port_harcourt | Peter Odili Road, Trans-Amadi Extension | 10.75,30 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Port Harcourt Club 1928 (Colonial Heritage) | port_harcourt | Forces Avenue, Old GRA | -10.75,-60 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | NO | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Port Harcourt International Airport (PHC Omagwa) | port_harcourt | Omagwa Aviation Corridor, Port Harcourt | 260,250 | Port Harcourt airport / Port Harcourt Airport (PHC) / Interior • Port Harcourt airport / Port Harcourt airport · 8 things to do · 3 people here | yes | BUILDING | BUILDING | map-keke | _none observed_ |
| Port Harcourt Mall | port_harcourt | Old GRA · mall | -3000,5418.4 | Old GRA · mall / Port Harcourt Mall / Interior • Old GRA · mall | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Port Harcourt Petroleum Refinery & Tank Farms | port_harcourt | Trans-Amadi Industrial Layout | 30,-35 | Aba Road / Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | NO | BUILDING | OUTDOOR_SITE | map-keke | P0:wrong location<br>P2:broken activity |
| Port Harcourt Pleasure Park (Aba Road) | port_harcourt | Aba Road (Between Bori Camp & Air Force Base) | -410,194 | Pleasure Park / Rumuokoro · Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | NO | OPEN_AIR | OPEN_AIR | map-keke | P0:wrong location |
| Rivers State Government House | port_harcourt | Rumuola · the Brick House | -3000,5487.4 | Rumuola · the Brick House / Rivers State Government House / Interior • Rumuola · the Brick House | yes | BUILDING | BUILDING | door-card | P2:UI overlap |
| Rivers State Government House (Brick House) | port_harcourt | Harley Street / Azikiwe Road, Old GRA | -370,-190 | Rivers State Government House / Rumuokoro · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | NO | BUILDING | OUTDOOR_SITE | map-keke | P0:wrong location |
| Rivers State Police Command | port_harcourt | Port Harcourt | -3000,5626.4 | Port Harcourt · police / Rivers State Police Command / Interior • Port Harcourt · police / Port Harcourt · police · 3 things to do · 1 person here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location<br>P2:UI overlap |
| Rivers State University (RSU Nkpolu-Oroworukwo) | port_harcourt | Nkpolu-Oroworukwo, Port Harcourt | -10.75,-30 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap |
| Rumuokoro Flyover Bus Terminal & Junction | port_harcourt | East-West Road & Ikwerre Road Interchange | -10.75,-65 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| SPAR Hypermarket & Mall (Azikiwe Road) | port_harcourt | Azikiwe Road, Old GRA / Town Border | -10.75,-85 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location |
| Slaughter Market (Trans-Amadi Abattoir) | port_harcourt | Slaughter Road, Trans-Amadi | 10.75,-15 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | OPEN_AIR | OPEN_AIR | teleport-street-fallback | P0:wrong location<br>P2:broken activity |
| Trans-Amadi Industrial & Petrochemical Layout | port_harcourt | Trans-Amadi Industrial Layout, Port Harcourt | 10.75,-35 | Aba Road / Aba Road · Port Harcourt / Choba · UPTH · 4 things to do · 2 people here | yes | BUILDING | OUTDOOR_SITE | teleport-street-fallback | P0:wrong location<br>P2:UI overlap<br>P2:broken activity |
| University of Port Harcourt (UNIPORT) | port_harcourt | Choba Boulevard, Port Harcourt | -35,-40 | Aba Road / Port Harcourt / Broad Street, Lagos Island · 2 things to do · 5 people here | yes | BUILDING | OUTDOOR_SITE | map-keke | _none observed_ |
| University of Port Harcourt Teaching Hospital (UPTH) | port_harcourt | East-West Road, Choba, Port Harcourt | -3000,5557.4 | Choba · UPTH / University of Port Harcourt Teaching Hospital / Interior • Choba · UPTH / Choba · UPTH · 4 things to do · 2 people here | yes | BUILDING | BUILDING | teleport-enter-fallback | P0:wrong location<br>P2:UI overlap |
| Waterlines Motor Park | port_harcourt | Aba Road, D-Line | 18.7,31.6 | Aba Road / Port Harcourt / Port Harcourt airport · 8 things to do · 3 people here | yes | OPEN_AIR | OPEN_AIR | map-keke | P2:broken activity |
| Abuja Bank | unknown | Abuja · bank | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Bureau | unknown | Abuja · bank | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Chambers | unknown | Abuja · offices | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Creek Hotel | unknown | Abuja · hotel | — | — | — | OPEN_AIR | — | unvisited | P0:broken activity |
| Abuja Market | unknown | Abuja · market | — | — | — | OPEN_AIR | — | unvisited | P0:broken activity |
| Abuja Microfinance | unknown | Abuja · bank | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Mini Mart | unknown | Abuja · supermarket | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Offices | unknown | Abuja · offices | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Palace Hotel | unknown | Abuja · hotel | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Provision Store | unknown | Abuja · supermarket | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Secretariat | unknown | Abuja · offices | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Suites | unknown | Abuja · hotel | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja Supermarket | unknown | Abuja · supermarket | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja hotel room | unknown | Abuja · your room | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja hotel room | unknown | Abuja · your room | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Abuja hotel room | unknown | Abuja · your room | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Eko Grand Hotel · 2nd floor | unknown | Mainland · hotel | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Eko Grand Hotel · your room | unknown | Mainland · hotel | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Lagos Executive Barbershop | unknown | Lagos Island · Broad Street | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Bank | unknown | Port Harcourt · bank | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Bureau | unknown | Port Harcourt · bank | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Chambers | unknown | Port Harcourt · offices | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Creek Hotel | unknown | Port Harcourt · hotel | — | — | — | OPEN_AIR | — | unvisited | P0:broken activity |
| Port Harcourt Market | unknown | Port Harcourt · market | — | — | — | OPEN_AIR | — | unvisited | P0:broken activity |
| Port Harcourt Microfinance | unknown | Port Harcourt · bank | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Mini Mart | unknown | Port Harcourt · supermarket | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Offices | unknown | Port Harcourt · offices | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Palace Hotel | unknown | Port Harcourt · hotel | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Provision Store | unknown | Port Harcourt · supermarket | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Secretariat | unknown | Port Harcourt · offices | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Suites | unknown | Port Harcourt · hotel | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt Supermarket | unknown | Port Harcourt · supermarket | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt hotel room | unknown | Port Harcourt · your room | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt hotel room | unknown | Port Harcourt · your room | — | — | — | BUILDING | — | unvisited | P0:broken activity |
| Port Harcourt hotel room | unknown | Port Harcourt · your room | — | — | — | BUILDING | — | unvisited | P0:broken activity |

## Contact sheets

Compressed labelled sheets live in `docs/audit/sheets/`. Each figure is captioned with the place name; columns are arrival / on-site / overview.

Sheet bytes total: **3.06 MB** (limit 25 MB).

## Severity legend

| Level | Meaning |
|---|---|
| P0 | Blocks trust: wrong place, no ride path / map pin, spawn in solid, could not visit |
| P1 | Player is clearly let down: outdoor venue as a box, empty/void scene, wrong seat/bed, enterable but no interior |
| P2 | Noticeable: UI overlap, walk-through props, staff out of room, blocked activity |
| P3 | Polish: mild clipping/floating |

Audit finished at 23 Nov 2026, 19:08 Africa/Lagos. Results JSON: `docs/audit/worldaudit-results.json`.
