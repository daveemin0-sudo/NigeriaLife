# Destination check

Audit of every destination in Lagos, Abuja and Port Harcourt: name, district, map, street, entrance and interior must agree. Generated for branch `cursor/phone-cards-ride-drop`.

## Fixes in this pass

| Issue | Fix |
| --- | --- |
| `dest_lagos_refinery` was Apapa (`dangote_refinery_depot`) while the Dangote venue is Lekki Free Zone | Retargeted to roadside `dangote-refinery` (z≈3500); name/district/interior match Visitors Centre |
| Booking Dangote dropped among Apapa port containers | `setDownSpot` no longer prefers a stale city-map pin when street+entrance were remapped together; Roadside also syncs `mapPosition` |
| Apapa fuel depot shared Dangote aliases | New `dest_lagos_apapa_fuel_depot` — clearly separate place |
| `dest_lagos_mama_bisi_salon` remapped to viewing-centre | Removed from `DESTINATIONS_HERE`; keeps its own Surulere pin |
| UPTH map pin was ~196 m from the built hospital | Map/street/entrance aligned to Port Harcourt district stand (120, −65) / door (120, −54) |
| Abuja / PH street coords drifted from map pins (>20 m) | Street + entrance set to the map pin (same approach as the Abuja drop-off fix) |
| Lagos phone/map places used city-map coords while roadside doors sit on the expressway | Source coords synced to roadside standX/z; Roadside still remaps on boot |

## Rules

- **Map ↔ street** drift ≤ 20 m in source data.
- **Entrance ↔ street** drift ≤ 15 m (door can sit a few metres ahead of the stand).
- Lagos `DESTINATIONS_HERE` places are remapped at boot to the expressway door (`Roadside.ts`).
- Ride drop-offs use `Game.setDownSpot`: prefer map only when the entrance also sits by the pin.

## Summary: 123 destinations, 123 OK, 0 mismatches

## Lagos

| id | name | district | map (x,z) | street (x,z) | entrance (x,z) | interior | map↔street | status |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `dest_lagos_refinery` | Dangote Petroleum Refinery | Lekki Free Zone, Lekki-Epe Expressway | 14, 3500 | 14, 3500 | 14, 3500 | interior_place_dangote-refinery | 0 m | OK |
| `dest_lagos_apapa_fuel_depot` | Apapa Marine Fuel Depot | Wharf Road, Apapa Marine Corridor | -10.5, 58 | -10.5, 58 | -10.5, 58 | — | 0 m | OK |
| `dest_lagos_chapel` | Redemption Cathedral | Lagos-Ibadan Expressway corridor (island approach) | -14, 620 | -14, 620 | -14, 620 | interior_place_redemption-cathedral | 0 m | OK |
| `dest_lagos_radio` | Naija Radio House (Ikeja) | Lateef Jakande Road, Agidingbi, Ikeja | 14, 3800 | 14, 3800 | 14, 3800 | — | 0 m | OK |
| `dest_lagos_afrika_shrine` | New Afrika Shrine (Ikeja) | Neruda Road, Agidingbi, Ikeja | -14, 2750 | -14, 2750 | -14, 2750 | — | 0 m | OK |
| `dest_lagos_ifitness` | i-Fitness Health & Athletic Club (Ikoyi) | Bourdillon Road, Ikoyi | 14, 720 | 14, 720 | 14, 720 | — | 0 m | OK |
| `dest_lagos_balogun_market` | Balogun Textile & Fashion Market | Balogun Street, Lagos Island | -14, 300 | -14, 300 | -14, 300 | — | 0 m | OK |
| `dest_lagos_freedom_park` | Freedom Park Arts & Heritage Centre | Old Prison Ground, Broad Street, Lagos Island | 14, 340 | 14, 340 | 14, 340 | — | 0 m | OK |
| `dest_lagos_central_mosque` | Lagos Central Mosque (Lagos Island) | Nnamdi Azikiwe Street, Lagos Island | 14, 820 | 14, 820 | 14, 820 | — | 0 m | OK |
| `dest_lagos_polling_unit` | Polling Unit 001 (Lagos Island Civic Centre) | Campbell Street, Lagos Island | -14, 760 | -14, 760 | -14, 760 | — | 0 m | OK |
| `dest_lagos_nis_passport` | Federal Passport Office, Alagbon | Alagbon Close, Ikoyi | 14, 880 | 14, 880 | 14, 880 | roadside-nis-passport | 0 m | OK |
| `dest_lagos_consular_visa` | Visa & Consular Desk | Lagos Island consular corridor | 14, 980 | 14, 980 | 14, 980 | roadside-consular-visa | 0 m | OK |
| `dest_lagos_bureau_fx` | Victoria Island Bureau de Change | Victoria Island FX corridor | 14, 590 | 14, 590 | 14, 590 | roadside-bureau-fx | 0 m | OK |
| `dest_lagos_port_health` | Port Health · Yellow Card Centre | Airport Road, Mafoluku | -14, 6160 | -14, 6160 | -14, 6160 | roadside-port-health | 0 m | OK |
| `dest_lagos_elegushi_beach` | Elegushi Royal Beach (Lekki) | Ikate Elegushi, Lekki Peninsula | -14, 1235 | -14, 1235 | -14, 1235 | — | 0 m | OK |
| `dest_lagos_lekki_conservation` | Lekki Conservation Centre & Canopy Walk | Lekki-Epe Expressway, Chevron Corridor, Lekki | 14, 3050 | 14, 3050 | 14, 3050 | — | 0 m | OK |
| `dest_lagos_palms_lekki` | The Palms Shopping Mall (Lekki) | Babatunde Jose Road, Lekki Phase 1 | -14, 3150 | -14, 3150 | -14, 3150 | — | 0 m | OK |
| `dest_lagos_amala_shitta` | Amala Shitta & Abula Bukateria (Surulere) | Shitta Roundabout, Surulere | -14, 425 | -14, 425 | -14, 425 | — | 0 m | OK |
| `dest_lagos_mama_bisi_salon` |  | Adeniran Ogunsanya Street, Surulere | -10.5, -18 | -10.5, -18 | -10.5, -18 | — | 0 m | OK |
| `dest_lagos_viewing_centre` | Oga Sunday Premier League Viewing Centre | Lagos Island expressway stretch (viewing centre) | -14, 485 | -14, 485 | -14, 485 | interior_place_viewing-centre | 0 m | OK |
| `dest_lagos_ivory_rooftop` | Ivory Rooftop Sky Lounge & Cocktail Bar | Adeola Odeku Street, Victoria Island | 14, 540 | 14, 540 | 14, 540 | — | 0 m | OK |
| `dest_lagos_marina_towers` | Marina Towers Commercial Plaza | Ahmadu Bello Way, Victoria Island | 14, 250 | 14, 250 | 14, 250 | — | 0 m | OK |
| `dest_lagos_the_library` | The Library Speakeasy & Private Dining | Adetokunbo Ademola Street, Victoria Island | 14, 640 | 14, 640 | 14, 640 | — | 0 m | OK |

## Abuja

| id | name | district | map (x,z) | street (x,z) | entrance (x,z) | interior | map↔street | status |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `dest_abuja_eagle_square` | Eagle Square National Parade Ground | Shehu Shagari Way, Central Business District | -10, 20 | -11.5, 20 | -11.5, 20 | — | 1.5 m | OK |
| `dest_abuja_wtc` | World Trade Centre Abuja (WTC) | Constitution Avenue, Central Business District | -28, 15 | -11.5, 15 | -11.5, 15 | — | 16.5 m | OK |
| `dest_abuja_icc` | International Conference Centre (ICC) | Herbert Macaulay Way, Central Business District | -22, 8 | -11.5, 8 | -11.5, 8 | — | 10.5 m | OK |
| `dest_abuja_cbn` | Central Bank of Nigeria Headquarters (CBN) | Tafawa Balewa Way, Central Business District | -18, -5 | -11.5, -5 | -11.5, -5 | — | 6.5 m | OK |
| `dest_abuja_nnpc_towers` | NNPC Towers (National Petroleum Headquarters) | Herbert Macaulay Way, Central Business District | -32, -15 | -32, -15 | -32, -15 | — | 0 m | OK |
| `dest_abuja_national_library` | National Library of Nigeria (Abuja) | Plot 274, Sanusi Dantata House, CBD | -15, -25 | -11.5, -25 | -11.5, -25 | — | 3.5 m | OK |
| `dest_abuja_arts_village` | Abuja Arts & Crafts Village | Central Business District (Behind Silverbird) | -8, 42 | -11.5, 42 | -11.5, 42 | — | 3.5 m | OK |
| `dest_abuja_finance_ministry` | Federal Ministry of Finance Headquarters | Ahmadu Bello Way, Central Business District | -25, 50 | -11.5, 50 | -11.5, 50 | — | 13.5 m | OK |
| `dest_abuja_defence_hq` | Defence Headquarters (Ship House) | Olusegun Obasanjo Way, Central Business District | -15, 65 | -11.5, 65 | -11.5, 65 | — | 3.5 m | OK |
| `dest_abuja_sec` | Securities and Exchange Commission (SEC HQ) | Tower 421, Constitution Avenue, CBD | -22, 75 | -11.5, 75 | -11.5, 75 | — | 10.5 m | OK |
| `dest_abuja_radio_house` | Radio House Abuja (FRCN Complex) | Area 10 / Garki Corner, Herbert Macaulay Way | -12, 85 | -11.5, 85 | -11.5, 85 | — | 0.5 m | OK |
| `dest_abuja_federal_high_court` | Federal High Court Headquarters (Abuja) | Shehu Shagari Way, Central Business District | -16, 95 | -11.5, 95 | -11.5, 95 | — | 4.5 m | OK |
| `dest_abuja_boi` | Bank of Industry Tower (BOI) | Plot 256, Zone AO, Off Herbert Macaulay Way | -20, 105 | -11.5, 105 | -11.5, 105 | — | 8.5 m | OK |
| `dest_abuja_aso_villa` | State House (Presidential Villa, Aso Rock) | Aso Rock Presidential Compound, Asokoro | 75, 40 | 75, 40 | 75, 40 | — | 0 m | OK |
| `dest_abuja_national_assembly` | National Assembly Complex (Senate & Reps) | Three Arms Zone, Asokoro | 70, 30 | 70, 30 | 70, 30 | — | 0 m | OK |
| `dest_abuja_supreme_court` | Supreme Court of Nigeria | Three Arms Zone, Asokoro | 65, 20 | 65, 20 | 65, 20 | — | 0 m | OK |
| `dest_abuja_ecowas` | ECOWAS Commission Secretariat | 101 Yakubu Gowon Crescent, Asokoro | 60, 10 | 60, 10 | 60, 10 | — | 0 m | OK |
| `dest_abuja_asokoro_hospital` | Asokoro District General Hospital | Nelson Mandela Street, Asokoro | 55, 0 | 55, 0 | 55, 0 | — | 0 m | OK |
| `dest_abuja_sunrise_waterpark` | Sunrise Waterpark & Hillside Resort (Asokoro) | Sunrise Hills, Kugbo / Asokoro Heights | 70, -10 | 70, -10 | 70, -10 | — | 0 m | OK |
| `dest_abuja_ibb_golf` | IBB International Golf and Country Club | 41 Aso Drive, Maitama / Asokoro Greenbelt | 50, -20 | 50, -20 | 50, -20 | — | 0 m | OK |
| `dest_abuja_mogadishu` | Mogadishu Cantonment (Abacha Barracks) | Keffi Road, Asokoro Extension | 65, -30 | 65, -30 | 65, -30 | — | 0 m | OK |
| `dest_abuja_noun_hq` | National Open University of Nigeria (HQ) | Plot 91, Cadastral Zone, Jabi / Asokoro Axis | 45, -40 | 45, -40 | 45, -40 | — | 0 m | OK |
| `dest_abuja_transcorp_hilton` | Transcorp Hilton Hotel (Maitama) | 1 Aguiyi Ironsi Street, Maitama | 15, 55 | 11.5, 55 | 11.5, 55 | — | 3.5 m | OK |
| `dest_abuja_millennium_park` | Millennium Park (Maitama) | Maitama Green Corridor, Near Unity Fountain | 22, 65 | 11.5, 65 | 11.5, 65 | — | 10.5 m | OK |
| `dest_abuja_unity_fountain` | Unity Fountain & Civic Square | Shehu Shagari Way & Ironsi Corner, Maitama | 12, 75 | 11.5, 75 | 11.5, 75 | — | 0.5 m | OK |
| `dest_abuja_maitama_hospital` | Maitama District Hospital | Aguiyi Ironsi Street, Maitama | 28, 85 | 11.5, 85 | 11.5, 85 | — | 16.5 m | OK |
| `dest_abuja_maitama_farmers_market` |  | IBB Way, Maitama | 32, 95 | 32, 95 | 32, 95 | — | 0 m | OK |
| `dest_abuja_the_dome` | The Dome Entertainment & Leisure Hub | Plot 423, Adekunle Fajuyi Way, Central / Maitama Border | 18, 105 | 11.5, 105 | 11.5, 105 | — | 6.5 m | OK |
| `dest_abuja_dunes_centre` | Dunes Centre Luxury Lifestyle Mall | 44 Aguiyi Ironsi Way, Maitama | 26, 115 | 11.5, 115 | 11.5, 115 | — | 14.5 m | OK |
| `dest_abuja_amazon_lounge` | Amazon Street Executive Lounge & Garden | Amazon Street, Maitama | 34, 125 | 34, 125 | 34, 125 | — | 0 m | OK |
| `dest_abuja_maitama_park` | Maitama Amusement & Recreation Park | Off IBB Way, Maitama | 38, -50 | 38, -50 | 38, -50 | — | 0 m | OK |
| `dest_abuja_ministers_hill` |  | maitama | 42, -60 | 42, -60 | 42, -60 | — | 0 m | OK |
| `dest_abuja_banex_plaza` | Banex Plaza Commercial & Tech Hub | Aminu Kano Crescent, Wuse 2 | -45, 10 | -45, 10 | -45, 10 | — | 0 m | OK |
| `dest_abuja_hustle_bustle` | Hustle & Bustle Club & Restaurant | Aminu Kano Crescent, Wuse 2 | -48, 20 | -48, 20 | -48, 20 | — | 0 m | OK |
| `dest_abuja_moscow_underground` | Moscow Underground VIP Club | 35 Adetokunbo Ademola Crescent, Wuse 2 | -52, 25 | -52, 25 | -52, 25 | — | 0 m | OK |
| `dest_abuja_345_nightlife` | 345 Nightlife & Ultra Lounge | Adetokunbo Ademola Crescent, Wuse 2 | -55, 30 | -55, 30 | -55, 30 | — | 0 m | OK |
| `dest_abuja_trukadero` | Trukadero By Bowling Entertainment Centre | 131B Ademola Adetokunbo Crescent, Wuse 2 | -42, 35 | -42, 35 | -42, 35 | — | 0 m | OK |
| `dest_abuja_wuse_market` | Wuse Main Market (Zone 5 / Wuse Axis) | Kashim Ibrahim Way, Wuse Zone 5 | -40, 45 | -40, 45 | -40, 45 | — | 0 m | OK |
| `dest_abuja_cubana` | Cubana Lounge & Suites (Wuse 2) | Plot 130, Adetokunbo Ademola Crescent, Wuse 2 | -46, 50 | -46, 50 | -46, 50 | — | 0 m | OK |
| `dest_abuja_play_imperial` | Play Imperial Lounge & Nightclub | Adetokunbo Ademola Crescent, Wuse 2 | -50, 55 | -50, 55 | -50, 55 | — | 0 m | OK |
| `dest_abuja_city_park` | City Park Recreation Garden (Wuse 2) | Ahmadu Bello Way, Wuse 2 | -38, 60 | -38, 60 | -38, 60 | — | 0 m | OK |
| `dest_abuja_emab_plaza` | Emab Plaza Technology & Commercial Centre | Aminu Kano Crescent, Wuse 2 | -44, 70 | -44, 70 | -44, 70 | — | 0 m | OK |
| `dest_abuja_jabi_lake_mall` | Jabi Lake Mall & Boardwalk | Bala Sokoto Way, Jabi Waterfront | -60, 5 | -60, 5 | -60, 5 | — | 0 m | OK |
| `dest_abuja_jabi_waterfront` | Jabi Lake Park & Waterfront Promenade | Alex Ekwueme Way, Jabi | -65, 15 | -65, 15 | -65, 15 | — | 0 m | OK |
| `dest_abuja_jabi_motor_park` | Jabi Central Motor Park & Bus Terminal | Obafemi Awolowo Way, Jabi | -55, -5 | -55, -5 | -55, -5 | — | 0 m | OK |
| `dest_abuja_efcc_hq` | Economic and Financial Crimes Commission (EFCC HQ) | Plot 301/302, Institution and Research District, Jabi | -58, -15 | -58, -15 | -58, -15 | — | 0 m | OK |
| `dest_abuja_jabi_boat_club` | Jabi Boat Club (JBC Waterside Lounge) | N10 Alex Ekwueme Way, Jabi Lake | -62, 25 | -62, 25 | -62, 25 | — | 0 m | OK |
| `dest_abuja_nisa_premier` | Nisa Premier Hospital & Specialist Centre | 15/21 Alex Ekwueme Way, Jabi | -52, -20 | -52, -20 | -52, -20 | — | 0 m | OK |
| `dest_abuja_garki_market` | Garki International Model Market | Lafia Road, Garki 2 | 5, 75 | 11.5, 70 | 11.5, 70 | — | 8.2 m | OK |
| `dest_abuja_area_1_complex` | Area 1 Shopping Centre (Garki 1) | Moshood Abiola Way, Area 1, Garki | 0, 85 | 11.5, 80 | 11.5, 80 | — | 12.5 m | OK |
| `dest_abuja_area_10_post` | NIPOST General Post Office (Area 10) | Area 10, Garki | -5, 95 | 11.5, 90 | 11.5, 90 | — | 17.2 m | OK |
| `dest_abuja_garki_hospital` | Garki General Hospital | Tafawa Balewa Way, Area 8, Garki | -8, 105 | -8, 105 | -8, 105 | — | 0 m | OK |
| `dest_abuja_hawthorn_suites` | Hawthorn Suites by Wyndham (Garki) | 1 Uke Street, Off Ahmadu Bello Way, Garki 2 | 2, 115 | 11.5, 110 | 11.5, 110 | — | 10.7 m | OK |
| `dest_abuja_old_parade_ground` | Old Parade Ground Sports Complex (Area 10) | Festival Road, Area 10, Garki | -12, 120 | -12, 120 | -12, 120 | — | 0 m | OK |
| `dest_abuja_gwarinpa_1st_ave` | 1st Avenue Commercial Boulevard (Gwarinpa) | 1st Avenue, Gwarinpa Estate | -80, -60 | -80, -60 | -80, -60 | — | 0 m | OK |
| `dest_abuja_gwarinpa_3rd_ave` | 3rd Avenue Food & Nightlife Strip (Gwarinpa) | 3rd Avenue, Gwarinpa Estate | -85, -50 | -85, -50 | -85, -50 | — | 0 m | OK |
| `dest_abuja_gwarinpa_hospital` | Gwarinpa General Hospital | 3rd Avenue, Gwarinpa Estate | -90, -40 | -90, -40 | -90, -40 | — | 0 m | OK |
| `dest_abuja_charlie_boy` | Charlie Boy Bus Stop & Transit Hub | Expressway Interchange, Gwarinpa | -75, -70 | -75, -70 | -75, -70 | — | 0 m | OK |
| `dest_abuja_national_stadium` | Moshood Abiola National Stadium (Abuja) | Airport Road Corridor, Kukwaba | -40, -90 | -40, -90 | -40, -90 | — | 0 m | OK |
| `dest_abuja_magic_land` | Magic Land Theme Park (Near City Gate) | Plot 444, Constitution Avenue, Kukwaba | -35, -100 | -35, -100 | -35, -100 | — | 0 m | OK |
| `dest_abuja_city_gate` | Abuja City Gate Monumental Arch | Airport Expressway Entrance, Kukwaba | -30, -110 | -30, -110 | -30, -110 | — | 0 m | OK |
| `dest_abuja_package_b` | Package B Sports Complex & Training Pitches | Stadium Ring Road, Kukwaba | -45, -115 | -45, -115 | -45, -115 | — | 0 m | OK |
| `dest_abuja_zuma_rock` | Zuma Rock Natural Monolith (Gateway to Abuja) | Abuja-Kaduna Expressway, Madalla | 95, -120 | 95, -120 | 95, -120 | — | 0 m | OK |
| `dest_abuja_madalla_market` | Madalla International Cattle & Grain Market | Madalla Junction, Niger / Abuja Boundary | 85, -110 | 85, -110 | 85, -110 | — | 0 m | OK |
| `dest_abuja_giri_junction` | Giri Highway Interchange Transit Hub | Airport Road & Lokoja Highway Interchange, Giri | 75, -100 | 75, -100 | 75, -100 | — | 0 m | OK |
| `dest_abuja_uniabuja` | University of Abuja Main Campus (Gwagwalada) | Airport Expressway Corridor, Gwagwalada | 65, -90 | 65, -90 | 65, -90 | — | 0 m | OK |
| `dest_abuja_chemian_plaza` | Chemian Commercial Plaza (Gwarinpa) | 3rd Avenue Corner, Gwarinpa | -70, -30 | -70, -30 | -70, -30 | — | 0 m | OK |
| `dest_abuja_katampe_hill` | Katampe Hill (Geographic Centre of Nigeria) | Katampe Extension Ridge, Abuja | 20, 128 | 11.5, 122 | 11.5, 122 | — | 10.4 m | OK |
| `dest_abuja_jahi_district` | Jahi Modern Commercial & Tech Strip | Jahi District Central Boulevard, Abuja | -50, 40 | -50, 40 | -50, 40 | — | 0 m | OK |
| `dest_abuja_mabushi_hub` | Mabushi Federal Works Complex | Mabushi Corridor, Federal Capital Territory | -30, 40 | -30, 40 | -30, 40 | — | 0 m | OK |
| `dest_abuja_kubwa_market` | Kubwa Model Community Market | Kubwa Expressway Corridor, Bwari Area Council | -75, 50 | -75, 50 | -75, 50 | — | 0 m | OK |
| `dest_abuja_dugba_market` | Dugba Traditional Pottery & Art Market | Ahmadu Bello South, Garki | 15, 125 | 11.5, 125 | 11.5, 125 | — | 3.5 m | OK |
| `dest_abuja_passport` | Federal Passport Office, Abuja | Garki · Independence Avenue | -140, 445 | -140, 445 | -140, 445 | roadside-abuja-passport | 0 m | OK |

## Port Harcourt

| id | name | district | map (x,z) | street (x,z) | entrance (x,z) | interior | map↔street | status |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `dest_ph_onne_port` | Onne Sea Port & Oil & Gas Free Zone | Onne Industrial Corridor, Port Harcourt | 45, 75 | 45, 75 | 45, 75 | — | 0 m | OK |
| `dest_ph_kidney_island` | Kidney Island Marine Logistics Terminal | Dockyard Road / Creek Axis, Port Harcourt | 35, 85 | 35, 85 | 35, 85 | — | 0 m | OK |
| `dest_ph_bonny_jetty` | Bonny Island Marine Passenger Jetty | Bille / Bonny Waterside Terminal, Port Harcourt | 25, 95 | 10.75, 90 | 10.75, 90 | — | 15.1 m | OK |
| `dest_ph_hotel_presidential` | Hotel Presidential (Old GRA) | Aba Road & Presidential Junction, Old GRA | -15, 10 | -10.75, 10 | -10.75, 10 | — | 4.3 m | OK |
| `dest_ph_liberation_stadium` | Adokiye Amiesimaka Liberation Stadium | Elelenwo Link Road, Port Harcourt | -35, 25 | -35, 25 | -35, 25 | — | 0 m | OK |
| `dest_ph_pleasure_park` | Port Harcourt Pleasure Park (Aba Road) | Aba Road (Between Bori Camp & Air Force Base) | 12, -10 | 10.75, -10 | 10.75, -10 | — | 1.3 m | OK |
| `dest_ph_upth` | University of Port Harcourt Teaching Hospital (UPTH) | East-West Road, Choba, Port Harcourt | 120, -65 | 120, -65 | 120, -54 | roadside-upth | 0 m | OK |
| `dest_ph_rsu` | Rivers State University (RSU Nkpolu-Oroworukwo) | Nkpolu-Oroworukwo, Port Harcourt | -25, -30 | -10.75, -30 | -10.75, -30 | — | 14.3 m | OK |
| `dest_ph_mile_one_market` | Mile One International Market (Diobu) | Ikwerre Road, Diobu, Port Harcourt | -18, -45 | -10.75, -45 | -10.75, -45 | — | 7.3 m | OK |
| `dest_ph_creek_road_market` | Creek Road Marine Market (Town) | Creek Road, Port Harcourt Town | 8, -70 | 10.75, -70 | 10.75, -70 | — | 2.8 m | OK |
| `dest_ph_trans_amadi` | Trans-Amadi Industrial & Petrochemical Layout | Trans-Amadi Industrial Layout, Port Harcourt | 30, -35 | 10.75, -35 | 10.75, -35 | — | 19.3 m | OK |
| `dest_ph_oil_mill_market` | Oil Mill Market (Rumuokwurusi) | Aba Road & Eleme Flyover Junction, Rumuokwurusi | 22, 48 | 10.75, 48 | 10.75, 48 | — | 11.3 m | OK |
| `dest_ph_genesis_cinema` | Genesis Deluxe Cinema & Entertainment (GRA 2) | Tombia Street, GRA Phase 2 | -12, -18 | -10.75, -18 | -10.75, -18 | — | 1.3 m | OK |
| `dest_ph_spar_mall` | SPAR Hypermarket & Mall (Azikiwe Road) | Azikiwe Road, Old GRA / Town Border | -5, -85 | -10.75, -85 | -10.75, -85 | — | 5.8 m | OK |
| `dest_ph_isaac_boro_park` | Isaac Boro Garden Peace Park | Opposite Mile One Flyover, Aba Road Entrance | 5, -95 | 10.75, -95 | 10.75, -95 | — | 5.8 m | OK |
| `dest_ph_club_1928` | Port Harcourt Club 1928 (Colonial Heritage) | Forces Avenue, Old GRA | -8, -60 | -10.75, -60 | -10.75, -60 | — | 2.8 m | OK |
| `dest_ph_govt_house` | Rivers State Government House (Brick House) | Harley Street / Azikiwe Road, Old GRA | -15, -105 | -10.75, -105 | -10.75, -105 | — | 4.3 m | OK |
| `dest_ph_garrison` | Garrison Roundabout Commercial Junction | Aba Road & Port Harcourt / Elelenwo Junction | 10, 15 | 10.75, 15 | 10.75, 15 | — | 0.8 m | OK |
| `dest_ph_rumuokoro` | Rumuokoro Flyover Bus Terminal & Junction | East-West Road & Ikwerre Road Interchange | -45, -65 | -45, -65 | -45, -65 | — | 0 m | OK |
| `dest_ph_peter_odili` | Peter Odili Road Waterfront Commercial Strip | Peter Odili Road, Trans-Amadi Extension | 25, 30 | 10.75, 30 | 10.75, 30 | — | 14.3 m | OK |
| `dest_ph_ada_george` | Ada George Commercial Boulevard | Ada George Road, Rumueme Axis | -30, -10 | -10.75, -10 | -10.75, -10 | — | 19.3 m | OK |
| `dest_ph_slaughter_market` | Slaughter Market (Trans-Amadi Abattoir) | Slaughter Road, Trans-Amadi | 32, -15 | 32, -15 | 32, -15 | — | 0 m | OK |
| `dest_ph_borokiri` | Borokiri Coastal Wharf & Community | Borokiri Island End, Port Harcourt Town | 18, -115 | 10.75, -115 | 10.75, -115 | — | 7.3 m | OK |
| `dest_ph_abonnema_wharf` | Abonnema Wharf Marine Terminal | Abonnema Wharf Road, Port Harcourt Town | -12, -120 | -10.75, -115 | -10.75, -115 | — | 5.2 m | OK |
| `dest_ph_aggrey_road` | Aggrey Road Commercial & Heritage High Street | Aggrey Road, Port Harcourt Town | 2, -110 | 10.75, -110 | 10.75, -110 | — | 8.8 m | OK |
| `dest_ph_bundu_waterside` | Bundu Waterside Artisan Fish Jetty | Bundu Waterfront, Port Harcourt Town | 12, -125 | 10.75, -120 | 10.75, -120 | — | 5.2 m | OK |
| `dest_ph_passport` | Federal Passport Office, Port Harcourt | Old GRA · near Police Command | 240, 29 | 240, 29 | 240, 29 | roadside-ph-passport | 0 m | OK |
