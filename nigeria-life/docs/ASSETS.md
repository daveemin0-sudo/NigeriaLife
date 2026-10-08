# Nigeria Life V2 — Asset Registry & Licensing Directory

All 3D models, textures, animations, and audio used in Nigeria Life must be tracked here with their origin, author, and license.

## 1. Directory Structure

```
nigeria-life/
└── public/
    └── models/
        ├── characters/     # Skinned human GLBs (rigged, modular variants)
        ├── vehicles/       # Danfo, Keke, Okada, sedans, SUVs, buses
        ├── aircraft/       # Narrow-body jets, turboprops, helicopters
        ├── props/          # Generators, umbrellas, market stalls, street furniture
        └── buildings/      # Landmarks, bank facades, hospital exterior, modular shops
```

---

## 2. Asset Register & Provenance

| Asset Name | Target Path | Source / Creator | License | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Human Skeletal Rig & Base Mesh** | `public/models/characters/human_base.glb` | Custom Synthesized / Quaternius Rig Standard | CC0 1.0 Universal / MIT | Compatible with standard Mixamo humanoid animations |
| **Danfo Minibus 3D Model** | `public/models/vehicles/danfo_minibus.glb` | NigeriaLife 3D Production Pipeline | Original Project Asset (MIT) | Separated nodes for body, 4 wheels, sliding door, headlights |
| **Keke Tricycle 3D Model** | `public/models/vehicles/keke_napep.glb` | NigeriaLife 3D Production Pipeline | Original Project Asset (MIT) | Canopy, handlebars, 3 wheels, open cabin bench |
| **Okada Motorcycle** | `public/models/vehicles/okada_bike.glb` | NigeriaLife 3D Production Pipeline | Original Project Asset (MIT) | Frame, 2 wheels, turning fork, exhaust |
| **Commercial Jet (Wazobia Air)** | `public/models/aircraft/wazobia_jet737.glb` | NigeriaLife 3D Production Pipeline | Original Project Asset (MIT) | Animated landing gear, flaps, spinning jet turbine fans |
| **Tiger 1.5KVA Generator** | `public/models/props/tiger_generator.glb` | NigeriaLife 3D Production Pipeline | Original Project Asset (MIT) | Red frame, recoil pull handle, fuel tank cap |
| **Market Hawker Tray & Wares** | `public/models/props/hawker_tray.glb` | NigeriaLife 3D Production Pipeline | Original Project Asset (MIT) | Plastic basin with bottled drinks & pure water sachets |
| **Procedural Character 2.0 Fallback**| `src/graphics/HumanMeshBuilder.ts` | Built-in Project Engine | Original Project Asset (MIT) | Zero-latency fallback when GLBs are streaming or offline |

---

## 3. License Guidelines
- **Permitted Licenses**: CC0 1.0, MIT, Apache 2.0, Public Domain, Original in-house generated assets.
- **Strictly Prohibited**: CC-BY-NC (Non-Commercial), All Rights Reserved proprietary rips from other commercial games, copyrighted real brand logos without written authorization.
