# Nigeria Life V2 — Art Bible & Visual Direction

## 1. Core Visual Style: Stylized Realism
Nigeria Life V2 adheres strictly to **Stylized Realism**. 
- **Proportions**: Anatomically grounded human proportions (8-head proportions, natural shoulders, distinct gender silhouettes) and accurate vehicular dimensions.
- **Surface Finish**: Modern physically-based rendering (PBR) with distinct roughness, ambient occlusion, metallic clearcoats, micro-surface imperfections, and weathering (Lagos rust, rain streaks, harmattan dust).
- **Lighting & Atmosphere**: Warm, cinematic equatorial illumination. High contrast sunlight, vibrant saturated Naija accents (Danfo yellow, green-white-green flags, Ankara patterns), soft blue-sky ambient fill, and golden-hour radiance.

---

## 2. City Color Palettes & Visual Tone

### Lagos (The Bustling Megacity)
- **Primary Atmosphere**: Warm golden haze, humid coastal sky, heat shimmer on black asphalt.
- **Signature Colors**:
  - `Danfo Yellow`: `#FFCC00` with twin `#1A1A1A` charcoal stripes
  - `Keke Gold / Emerald`: `#FFB300` / `#008751`
  - `Kerbstone Warning`: `#FF3333` alternating with `#FFFFFF`
  - `Weathered Concrete`: `#8C867E` with damp dark stains `#4A453F`
  - `Atlantic Teal Lagoon`: `#006680` with silver water reflections
- **Street Dressing**: Overhanging bundles of overhead power cables, yellow umbrellas, plastic stall tarpaulins, stacked sachet water crates, smoking suya braziers, humming Tiger generators with blue exhaust wisps.

### Abuja (The Planned Federal Capital)
- **Primary Atmosphere**: Dry Sahel sun, majestic Harmattan dust veil, wide expansive horizons.
- **Signature Colors**:
  - `Aso Rock Monolith`: Terracotta reddish-tan granite `#B36B4C`
  - `Federal Monuments`: Off-white polished marble `#F4F5F0`
  - `Lush Ministry Lawns`: Deep savanna green `#2E6F40`
  - `Broad Expressways`: Crisp dark asphalt `#24272B` with sharp white lane markers
  - `Green Cabs`: Vibrant federal cab green `#00A859`
- **Street Dressing**: Manicured palm verges, modern solar streetlights, grand gates with federal crests, ministerial SUVs, high-rise glass curtain walls.

### Port Harcourt (The Garden Oil City)
- **Primary Atmosphere**: Low humid rain clouds, sudden tropical downpours, glistening wet asphalt puddles reflecting neon signs.
- **Signature Colors**:
  - `Rainforest Flora`: Dense emerald green `#1C542D`
  - `Industrial Marine Steel`: Slate blue-gray `#4A607A`
  - `Wet Asphalt Reflection`: Glossy dark charcoal `#121518` with mirror specular highlights
  - `Laterite Earth`: Rich reddish-orange iron soil `#A04020`

---

## 3. Material & Shader Rules
1. **Vehicles**:
   - `MeshPhysicalMaterial`: `roughness: 0.25`, `metalness: 0.65`, `clearcoat: 0.8`, `clearcoatRoughness: 0.15`.
   - Weathered edges, road splash dirt gradient along the lower 20% of the chassis.
   - Glass: Semi-transparent tinted panels (`roughness: 0.05`, `transmission: 0.7`, `ior: 1.5`).
2. **Characters**:
   - PBR skin with warm undertones across the rich African melanin spectrum (`#1C1008` to `#8A5232`).
   - Clothing: Low-roughness specular highlights for satin Aso-ebi; matte woven roughness (`0.85`) for Ankara cotton prints and Agbada brocades.
3. **Environment & Roads**:
   - High-contrast road markings.
   - Puddle decals with planar/screen-space roughness dampening (`roughness: 0.02`) creating real-time sky reflection.
   - Zinc Roofs: Corrugated profile with rusty patches (`metalness: 0.8`, `roughness: 0.55`).

---

## 4. Fictional Naija Branding Dictionary (Zero Legal Risk)
To ensure absolute legal safety and authentic world-building, all real-world corporate brands are replaced with lore-rich fictional Nigerian brands:

| Category | Real World Brand | Nigeria Life Fictional Brand | Visual Identity & Slogan |
| :--- | :--- | :--- | :--- |
| **Airline 1** | Air Peace | **Wazobia Air** | Blue, red & gold dove livery • *"Uniting the Skies"* |
| **Airline 2** | Arik Air | **EagleWings Express** | Maroon and white soaring eagle • *"Pride of Nigeria"* |
| **Commercial Bank 1** | GTBank | **Eko Commercial Bank** | High-contrast orange square • *"Smart Banking, Sharp People"* |
| **Commercial Bank 2** | Zenith Bank | **Apex Trust Bank** | Deep red and silver crest • *"Strength in Trust"* |
| **Telecom 1** | MTN | **NaijaCom 5G** | Bright yellow & blue ring • *"Everywhere You Hustle"* |
| **Telecom 2** | Airtel | **ZainLink Mobile** | Vibrant scarlet red • *"The Network with Soul"* |
| **Food Delivery** | Chowdeck | **QuickChop Delivery** | Emerald green delivery bikes with hot thermal boxes |
| **Sports Betting** | Bet9ja | **NaijaBet Mega** | Green and gold jackpot slips • *"Your Weekend Winning Ticket"* |
| **Fast Food** | Mama Cass / Mr Biggs | **Chop Life Buka & Eatery** | Warm terracotta & yellow • *"Authentic Smoky Firewood Pots"* |
| **Fuel Station** | Oando / Total | **NaijaPetro Energy** | Deep blue and bright yellow fuel pumps |
