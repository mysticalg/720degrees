# 720° — native JavaScript port in progress

A playable browser version built from translations of the original gameplay routines and graphics/audio recovered from the supplied ROM. The browser runs JavaScript, with no emulator or ROM instruction interpreter.

This replaces the obsolete procedural remake formerly at this repository root. That version remains in Git history.

Play online: https://mysticalg.github.io/720degrees/

## F8 slope regions (build 55)

F8 now includes translucent purple incline coverage with outlined start/end boundaries in the city and courses. It reads the recovered low-three-bit slope field1..6, excluding flat terrain, vertical faces and voids. City curbs retain their green layer above the purple slope coverage. The diagnostic geometry is cached separately from support/wall collision geometry; toggling it changes rendering only.

## Jump-course ground projection (build 54)

The airborne shadow now follows the first rideable lower surface rather than staying on the takeoff plane. It uses the recovered ground board/shadow pose, not the airborne board animation (whose tucked frames visibly floated above the ground). It hides over open space when no supported surface is found. Jump-course falling contact waits until the feet reach that lower surface; it no longer ends flight merely because height passes the upper takeoff plane.

Launch impulse and gravity remain the translated routines: the tested rising face supplies312 vertical units versus170 on flat ground with base shoes. A controlled lower-platform fixture continues48 ticks instead of reaching the upper plane at28; a real ramp fixture projects the shadow48 pixels lower. The vertical search is an explicit native artwork/contact adapter with a320-pixel range and2-pixel steps. It does not establish complete equivalence to the original9C5E height controller.

## Diagonal city curbs (build 51)

All eight orientations of the city's recovered shallow curb profiles now use a shared diagonal surface contour. This smooths their tile-step boundaries while retaining the original incline coefficients and allowing skating and jumping across them. Coded shop, map and park-entry cells keep their original trigger semantics. This is an intentional playability improvement over square terrain cells.

F8 shows these rideable curb regions in translucent green, with complete outlines and corner/end-cap markers. The green geometry is the same region used to choose curb physics; amber still marks solid walls, red support edges, and cyan sprite masks.

## Halfpipe update (build 50)

The curved walls now progress through the recovered inclination poses instead of using a shallow pose all the way to the coping. Jump near the lip with B; use a shoulder button or the right stick to spin. Build speed with A first: low speed gives a shorter aerial. Successful aerials land at the same coping and turn back down that wall.

The native implementation uses the original slope coefficients, shoe boost/caps, ramp animation controller, sprite frames and scoring. A missing doubled orientation-table offset in the coping coefficient translation is corrected for the opposite wall. The decoded map still needs an explicit browser geometry adapter: it scans each lane for floor/coping, projects the curve into the original artwork, and holds the return heading until clear of the curved wall. These geometry and contact transitions are improvements to the port, rather than a claim of complete instruction-for-instruction original halfpipe behavior.

## Run

From this directory, run `python -m http.server 8722`, then open http://localhost:8722. No build step is required.

## Controls

- Move/steer: arrow keys or WASD; analog gamepad supported.
- Kick: X or Shift; gamepad A.
- Jump: Space or Z; gamepad B.
- Spin: C; gamepad shoulders or right stick.
- Upgrades: skate over the original shop mat to buy automatically. Each item can be purchased once per city visit; returning from a park refreshes availability. Equipment persists up to level3.
- Park interaction: E or Enter; park entry pads also activate by skating onto them.
- Developer collision overlay: F8 toggles transparent terrain/fence areas and original sprite masks; collisions remain active.
- Map: Tab or skate over a map marker; appears for at most three seconds. Fresh skating input dismisses it.
- Pause: P or Escape. Fullscreen: F.
- Point/Rotate steering: options button at the top; stick clicks do not change mode.
- Music mute and volume: controls at the top.

## Current state

The game includes recovered city and park scenery, original skater/board/shadow graphics, kick/jump/bail and landing-point sequences, springboard cracks, park access, music controls, and translated portions of fixed-point movement and scoring.

Fixed city actor positions, animation entries and rates now initialize through the translated original routines and extracted tables. Original route selection, population requests, sprite allocation, activation and retirement routines are present, with tests. The 18 original initial routed actors now advance as pending records on the live city clock. Camera-driven activation, visible cars/scooters/cyclists, route turns, retirement and traffic replacement requests now run in the live city loop using these routines. Browser camera conversion and the separate fixed-actor renderer remain adapters; vehicle-mask contacts now trigger recovered response2/7 impact/bail rules. Cyclist attachment, full pedestrian population spawning, airborne pedestrian rewards and traffic SFX remain unfinished. Low-height pedestrian contact and timed motion recovery are wired into the actor loop.

Terrain contact, halfpipe coping, some scoring/event rules, enemies, powerups and full population behaviour remain incomplete or provisional. This is not yet a fully faithful port.

## Graphics and audio

The included game media was recovered from the supplied 720° ROM. No replacement sprites or synthesized sound effects are used. The original recorded start cue plays before the city track, and the original bee warning plays when triggered. Pause, mute and music volume apply to the mixed start cue too. Local MP3s contain recordings of original sound output; unrecovered kick/jump/crash cues remain silent. Traffic sound selection and the complete original sound sequencer are not yet integrated. The ROM ZIP itself is not included.

## Code and checks

`src/original-*.js` contains commented native translations. The renderer, input adapters and game loop are separate. Some translated modules remain research code until their callers and state are connected.

Run the portable checks with `npm test` (Node.js required; no package installation needed). These cover object reservations, route choice and pending-route timing. They do not establish complete gameplay fidelity. Broader development checks also compare recovered ROM tables and captured original actor state, and exercise the game in a browser.

Extraction tools are in `tools/`; they require the user's ROM and, for some older media extraction paths, additional development capture data and Python dependencies. Generated runtime assets are already included.

Springboard cracks and vehicles now use recovered scanline masks after the original rectangle test, including two/three-strip vehicle masks and original carry-rounded shifts. Car/scooter response2/7 uses original impact speed, side selection and bail setup; transparent areas stay clear. Speaker87 explicitly selects original no-action response0, so its former native bail trigger was removed. Normal-stance player footprint selection is currently used; pose-specific footprints, cyclist attachment, the airborne pedestrian reward branch and full population controllers remain unfinished.

Course corrections remove the artificial halfpipe boundary and grass blocker, preserve speed over its flag13 floor strip, and use a consistent airborne plane so downhill jumps cannot gain height indefinitely. Full coping and terrain-contact controllers remain unfinished.

Presentation interpolates skater, camera, traffic and bee positions between the fixed60Hz simulation ticks. Original sprite frames stay discrete and physics/contact/scoring state is never interpolated. Park changes, resets, pause and large recovery teleports snap immediately. Halfpipe coping/handplant gameplay integration remains unfinished.

Terrain contacts intentionally improve playability beyond the original: diagonal contours replace square tile corners, and swept contacts preserve movement along walls/fences. One-tile fence joins close post gaps, and contour simplification stays within four pixels of the recovered grid. This applies across city and park layouts; jump/downhill voids remain drop-offs. Native physics/scoring and original sprite masks remain separate from this improved terrain layer.

Upgrade purchasing now uses recovered price/availability routines and tables. The requested once-per-item-per-city-visit policy is an explicit adapter over the original stock mask. Successful park returns refresh that visit mask. Shop/map contact tiles remain ordinary rideable ground. Helmets use the original paired descriptor at body entry+061E; pad/shoe/board colours use original palette-RAM tables and indexed ROM pixels. No replacement equipment graphics are used. Shop scenery price variants remain initial-class artwork; actual purchase prices follow the recovered progression table, with completed browser events supplying its stage counter.

## Original pedestrian contact/recovery (build 52)

Low-height response6 now uses A60C impact-side/direction and player bail, followed by bank1E000:4ECC-4F40 motion save/stop, D498 hit animation selection and BF18 route reservation release. CB26-CB4A and4F42-4F96 restore the six saved motion fields at180 ticks. The original single global snapshot and sprite6/companion5 special branch are retained. Countdown is intentionally not saved. Original hit frames render through the existing ROM sprite directory.

A controlled kind50 pedestrian integration fixture verifies original scanline-mask contact, transparent clearance, player impact, stopped actor animation and restoration of nonzero motion at tick180. This fixture does not prove natural population spawning: full dynamic NPC activation, the A64C airborne reward branch and hit sound decoding still need translation/integration.

## Halfpipe descent correction (build 53)

The same-wall return now finishes the entire curved descent before steering resumes. Previously steering unlocked at30% wall height; holding the uphill stick reversed the skater before reaching the floor. Rotate-mode dial state is also restored in the unprojected control plane rather than using the isometric screen angle. All curved-wall inclination bands retain their original terrain poses while kicking, so the shallow descending poses are no longer hidden by road kick frames. This steering guard remains an explicit native geometry adaptation.

Browser regressions cover both walls in point and rotate mode, with the uphill stick held throughout and A held after landing: each completes720, lands and reaches the floor without bailing or reversing on the wall. Twelve original descent pose selections were checked against the recovered directory and visually inspected. This does not establish full halfpipe contact/animation fidelity.
