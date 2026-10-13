# NigeriaLife: Visual Quality & Asset Standards

**Date**: October 2026  
**Status**: Active Engineering Standard  
**Target Engine**: Three.js WebGL (Stylized Realism)

---

## 1. Core Visual Target: Stylized Realism

NigeriaLife rejects both primitive block geometry ("plastic toy robots") and uncanny hyper-realism that kills browser frame rates. Our standard is **Stylized Realism**:
- **Believable Proportions**: Anatomically plausible human skeletons and vehicular dimensions based on real Nigerian references.
- **Physical Plausibility**: PBR materials that respond correctly to sun, sky dome, and artificial light.
- **Cultural Authenticity**: Recognizable Nigerian silhouettes, textiles (Ankara, Adire, Aso-oke, Agbada), hairstyles (Gele, Fila, Braids, Fades), and vehicles (Lagos Danfo with twin stripes, Keke Napep, Okada, Prado SUVs).
- **Smooth Articulated Motion**: Blended kinematic animations without foot sliding or rigid-stick swinging.

---

## 2. Character Anatomy & Modeling Standards

### 2.1 Anatomical Proportions
1. **Total Height**: Grounded on an **8-head anatomical canon** (~1.75m – 1.82m in world units):
   - Head & Neck: 0.28m – 0.30m
   - Torso (Chest to Pelvis): 0.58m – 0.62m
   - Legs (Hip to Sole): 0.84m – 0.90m
2. **Gender Silhouettes**:
   - **Masculine**: Broad trapezius/deltoid shoulder line (width ~0.56m), tapered athletic ribcage, narrow hips, straight leg alignment.
   - **Feminine**: Gracefully sloped shoulders (width ~0.44m), defined bust contour, tapered narrow waist (0.28m), curvaceous pelvic hip flare (width ~0.46m), gentle leg taper.

### 2.2 Articulated Limbs & Joint Architecture
Characters must never use single unbroken cylinders for limbs:
- **Arms**:
  - Upper Arm (Bicep/Tricep) with shoulder deltoid cap.
  - Articulated **Elbow Joint** (sphere or rounded bevel pivot).
  - Tapered Forearm narrowing toward the wrist.
  - Wrist joint connector.
- **Hands**:
  - Sculpted palm with natural arch and thenar eminence.
  - Distinct opposable thumb angled at ~45°.
  - Four individually modeled fingers (Index, Middle, Ring, Pinky) with natural finger curve at rest.
  - **Zero Tolerance**: Undifferentiated sphere hands are completely prohibited.
- **Legs**:
  - Upper Thigh with quadricep contour.
  - Articulated **Knee Joint** with patella prominence.
  - Lower Leg (Gastrocnemius calf bulge tapering down to the Achilles shin).
  - Defined Ankle malleolus.
- **Feet & Footwear**:
  - Sculpted shoe/boot geometry with distinct sole thickness, toe cap, heel lift, and top collar.
  - Feminine footwear: sleek pumps or strap sandals with heel elevation.

### 2.3 Facial Anatomy & Hair
- **Facial Features**:
  - Sculpted almond-shaped eyes with sclera (eye white), dark irises/pupils, and subtle eyelid definition.
  - Natural arched eyebrows positioned above the orbital rim.
  - Anatomically proportioned African nose with bridge, apex, and distinct nostrils.
  - Full, natural upper and lower lips with defined cupid's bow and commissures.
  - Anatomically placed ears spanning from eye brow level to lower nose level.
- **Hairstyles & Headwear**:
  - **Fade / Buzzcut**: Close-cropped skull cap with crisp hairline edge and temple taper.
  - **Afro**: Rounded textured volume with subtle organic surface silhouette.
  - **Box Braids**: Clean geometric scalp parts with hanging multi-strand braided cylinders falling over shoulders and back.
  - **Gele (Headwrap)**: Layered fan structure with folded fabric tiers and metallic sheen.
  - **Fila**: Traditional embroidered Yoruba velvet/cotton cap with folded crest.
  - **Hardhat**: High-impact polycarbonate construction helmet with peak, suspension harness, and safety ridge.
  - **Service Caps**: Formal peaked caps with visor and gold insignia for Police and Airline Captains.

---

## 3. PBR Materials & Cultural Textile Palette

### 3.1 Skin Melanin Spectrum
Skin materials use `MeshStandardMaterial` with warm undertones:
- Deep Ebony: `#26140B`, roughness 0.68, metalness 0.04
- Rich Mahogany: `#4A2C1D`, roughness 0.65, metalness 0.04
- Warm Chestnut: `#5C3722`, roughness 0.62, metalness 0.05
- Golden Caramel: `#7C4B2E`, roughness 0.60, metalness 0.05
- Honey Bronze: `#965C38`, roughness 0.58, metalness 0.06

### 3.2 Textiles & Outfits
- **Agbada**: Flowing wide outer robe with geometric gold embroidery medallion on chest, matte cotton/brocade finish (`roughness: 0.75`).
- **Ankara Cotton**: High-contrast saturated African wax prints with matte textile roughness (`0.80`).
- **Senator Suit**: Tailored solid tunic with mandarin collar, chest pocket flap, and matching slim trousers (`roughness: 0.65`).
- **Safety Vest**: High-visibility fluorescent safety orange (`#F97316`) or lime green (`#84CC16`) with silver retro-reflective micro-bead stripes (`#ECFCCB`, high specular).
- **Clinical Uniforms**: Crisp white lab coat (`roughness: 0.50`) and medical scrub fabrics.

---

## 4. Vehicle Modeling Standards

Every vehicle in NigeriaLife must be recognizable as a real vehicle rather than a painted cuboid:

| Vehicle Type | Reference Vehicle | Essential Geometry Requirements |
| :--- | :--- | :--- |
| **Danfo Minibus** | Volkswagen Transporter T3 / LT | Sculpted van body with curved roof crown, A/B/C/D window pillars, recessed side windows, signature dual black waist stripes on bright Lagos yellow, black wraparound front bumper, front grille with horizontal louvers, twin circular/square headlights with glass lenses, rear brake lights, roof rain gutters, dual side mirrors with glass faces, and rear registration plate. |
| **Keke Napep** | Bajaj RE / TVS King | Three-wheeled vehicle: front single fork with chrome shock absorber, front mudguard, curved painted metal nose apron with single central headlight, black handlebar with handgrips and side mirrors, open-sided passenger cabin with rear bench seat and padded cushions, canvas weather canopy with rolled curtain ties, dual rear wheels under flared mudguards, and rear engine exhaust pipe. |
| **Executive SUV** | Toyota Land Cruiser Prado / V8 | Muscular hood with dual power bulges, chrome multi-slat front radiator grille, modern LED projector headlight clusters with daytime running lights, flared wheel arches with black protective trims, integrated tubular side-step running boards, roof luggage rails, tinted privacy glass, dual chrome exhaust tips, and rear tailgate spare wheel cover. |
| **Okada Motorcycle** | Boxer 150 / CG125 | Steel cradle frame, teardrop fuel tank with contrasting decals, air-cooled single-cylinder engine block with detailed cooling fins, chrome header pipe with cylindrical exhaust muffler, vinyl saddle seat, rear luggage/delivery carrier rack with cargo box, spoked wheels with rubber tires, instrument speedometer pod, and round chrome headlight. |
| **Commercial Sedan** | Toyota Corolla / Camry | Sloped aerodynamic hood, distinct raked windshield and rear backlight, sculptured door panels with shoulder crease line, body-colored bumpers with integrated fog lights, front honeycomb grille, and wraparound taillight assemblies. |

### 4.1 Wheel & Rim Standards
- **Zero Tolerance**: Plain black solid cylinders for wheels are prohibited.
- **Assembly Composition**:
  - Outer rubber tire with curved sidewall and circumferential tread ridges (`roughness: 0.85`, dark charcoal `#18181B`).
  - Recessed silver alloy rim (`metalness: 0.85`, `roughness: 0.25`).
  - 5-spoke or multi-spoke wheel face with central hubcap and lug nuts.
  - Visible metallic brake disc rotor and caliper behind the spokes.

---

## 5. Animation Quality Gates

1. **Locomotion Kinematics**:
   - Walking speed: stride frequency directly matches ground travel velocity (zero foot sliding).
   - Leg cycle: knee bends back on the swing phase and straightens on heel strike.
   - Arm swing: reciprocal arm swing counterbalances leg movement; elbow flexes gently (20°–30°) during forward swing.
   - Torso bounce: vertical oscillation (~0.03m–0.05m) timed to steps with subtle pelvic tilt.
2. **Action Blending**:
   - Poses must transition through smooth interpolation (`easeJoints` with exponential decay or spherical easing) to eliminate sudden robotic snapping.
   - Handheld items (smartphones, food baskets, toolkits, drinks) must seat firmly into the palm and move with the forearm rig.
3. **Grounding & Alignment**:
   - Foot soles must remain exactly at ground plane elevation (`y = 0.00` on streets, or stepped floor heights).
   - Seated poses must drop the pelvic center of mass onto seat cushion planes (`y = 0.50m`) with knees bent at 90°.

---

## 6. Performance & Rendering Budgets

To guarantee smooth 60 FPS gameplay on typical consumer laptops (e.g. Intel UHD / Iris Xe):
- **Character Geometry**: 600 – 1,400 triangles per articulated character rig.
- **Vehicle Geometry**: 1,200 – 2,800 triangles per vehicle model.
- **Materials**: Reusable shared materials across the city (`MeshStandardMaterial` with instance colors where applicable).
- **Draw Call Target**: Under 50 draw calls per district through procedural geometry batching and instanced crowds.
- **Shadows**: Dedicated directional sun shadow frustum covering a 60m radius around the camera; contact shadow decals under feet and tires for distant entities.
