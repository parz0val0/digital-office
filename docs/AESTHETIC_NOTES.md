# Aesthetic notes — what we studied and what we borrowed

All links below were opened/verified (HTTP 200) on 2026-11-14.

## References
| Repo / page | What it shows | Technique we took |
|---|---|---|
| [pmndrs/drei](https://github.com/pmndrs/drei) — `Environment` + `Lightformer`, `ContactShadows`, `AccumulativeShadows`/`RandomizedLight`, `SoftShadows`, `BakeShadows` | The "staging" toolbox for R3F. | Procedural **Environment with Lightformers** (no HDR download → works offline / from GitHub Pages) for soft fill + glass reflections; a baked-look **soft contact shadow** under the building; shadow map is tuned (large map, tight frustum, `shadow-radius`, small bias) and the key light is warm while the hemisphere fill is cool — the warm/cool split is what makes pastel scenes look "lit" instead of flat. |
| [pmndrs/react-postprocessing](https://github.com/pmndrs/react-postprocessing) (+ [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)) | `EffectComposer` with `N8AO`, `Bloom`, `ToneMapping`, `Vignette`, `SMAA`. | Same stack: **N8AO → Bloom (high threshold, only emissive screens/lamps/windows) → ToneMapping (Khronos Neutral) → vignette → SMAA**. Tone mapping is done in the composer (renderer tone mapping off) so bloom works on linear HDR. |
| [N8python/n8ao](https://github.com/N8python/n8ao) | Temporally stable SSAO with artist controls; README: use it on any scene that looks "flat or fake". | AO is the single biggest "premium" upgrade for low-poly rooms: darkens furniture/wall contacts and the gaps under floor slabs. Half-res + medium quality keeps it cheap. |
| [typhoidcoma/te_GTLF_Loader](https://github.com/typhoidcoma/te_GTLF_Loader) | N8AO + ACES Filmic + 3-point lighting + procedural environment + subtle gradient backdrop. | Key / fill / rim light set-up, gradient backdrop instead of a flat colour, matte PBR (roughness .8–.95, metalness 0). |
| [kutluhangil/CityVerse](https://github.com/kutluhangil/CityVerse) | Isometric low-poly city with bloom + AO, procedural buildings, lit windows. | Building language: **window bands, roof parapets, rooftop units**, per-lot variation; windows are the emissive element that blooms. |
| [leonlarsson/isometrics](https://github.com/leonlarsson/isometrics) | Isometric map toolkit with "Standard / Nice / Ultra" graphics levels (AO, glow, soft shadows). | **Quality tiers**: we ship High (AO + bloom + big shadow map) and a Low fallback (plain render) chosen automatically from measured frame time or `?quality=low|high`. |
| [Valentin Gassend — Cozy place](https://valentingassend.com/en/project/cozy-place/) (R3F + drei + postprocessing bloom/vignette/grain + n8ao) | A cozy diorama that feels hand-made. | Restrained palette (warm neutrals + 1 accent), soft vignette, glow only on lamps/screens. |
| [brunosimon/folio-2019](https://github.com/brunosimon/folio-2019) | Bruno Simon's toy-world portfolio. | Ground "plaza" with a clear base colour, soft baked shadows, props (trees, lamps, benches) that make the scale readable. |
| [Realco-Seeking-Dubai/aurum-digital-twin](https://github.com/Realco-Seeking-Dubai/aurum-digital-twin) | Building digital twin with floor selection and explode view. | Pick a floor → the floors above separate; we kept that, but the default is a *closed, believable tower* (curtain wall, roof) instead of floating trays. |
| Monument Valley–style palettes (general practice, no single repo) | Low-saturation pastels, 1–2 accents, cool shadows / warm light. | Palette below. |

## Concrete rules applied
1. **Palette**: warm neutral concrete `#f1e9dc` / `#dfd3c2`, glass `#bcd5e2`, plaza stone `#e7dfd2`, muted grass `#b5cba0`. Each floor keeps *one* accent (red / green / orange) used only on its sign, window glow and label. Sky: cool blue-grey at the top → warm cream at the horizon.
2. **Light**: warm key (`#fff0da`) from upper right-front, cool hemisphere fill (`#dfeaf5` / `#e8d9c4`), faint rim light from behind-left, procedural Lightformer environment at low intensity for glass.
3. **Tone mapping**: Khronos *Neutral* in the composer. AgX and ACES both looked grey/hazy with this pastel palette (A/B-able with `?tm=agx|aces`); Neutral keeps pastels and warm whites intact while still rolling off highlights.
4. **AO + bloom**: N8AO on, bloom threshold ≈ 0.9 so only emissive things glow (laptop screens, desk lamps, lit windows, rooftop beacon).
5. **Materials**: matte (roughness 0.8–0.95), tiny colour variation per floor, no pure white / pure black.
6. **Building read**: tight stack, glass curtain wall with mullions and spandrel bands on the two visible facades, slab edge lips, roof deck with parapet + rooftop units + sign, ground-floor canopy/entrance, plaza + trees. Camera in the building view is a lower elevation (≈27°) than inside a floor (35°) so you can see through the glass at the bots; it eases between the two when you enter/leave a floor.
7. **Quality fallback**: `?quality=low` disables the composer and uses a smaller shadow map; auto-detected if the average frame rate stays below ~22 fps.

## Lessons from our own iterations
- **Dollhouse cutaway beats a closed facade.** A fully opaque roof/ceiling hid every bot (interiors were only visible at grazing angles). Each floor slab is now a frame (parapet + rim) around a faint glass skylight, with a solid equipment strip only on the top deck, so the camera looks *into* every floor while the exterior still reads as a building.
- Lower the building-view camera elevation (24° vs 35° inside floors) and keep N8AO weak there (`?aob=`) — AO under ceilings made bots muddy.
- Debug params: `?quality=low|high`, `?tm=neutral|agx|aces`, `?aob=0.5`, `?fast=1` (headless testing only).
