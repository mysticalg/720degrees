## Build83: course scoring, slalom pairs and skids

- Slalom now includes D0C2's original type25 companion for every26..35 placement, the original palette2 atlas, recovered6110 pass masks, swept board crossings and original blue success frames. There are8/16/19/22/30/34 gates across the six maps. Proximity-only scoring and Y-row automatic misses are removed. The native300-point gate award remains provisional; the original race counter increment is retained for future tally integration.
- Downhill/jump landings use the recovered7ADA numeric scoring tables for duration, rotation, repeats, gaps and target modifier. Native landing/input adapters still supply the inputs; the surrounding original controllers and repeat replenishment timer are not fully translated. Jump points remain deferred until the park tally, with the original F064 burst/points animation visible at touchdown. The target scenery's own animation is still pending.
- Fresh quarter turns at speed have native lateral traction using original E458 body/board poses. The0.38-second grip adapter is an intentional enhancement, separate from ROM constants. Jump/terrain transitions cancel the pose; fakie and halfpipe returns retain their existing handling.
- The original SKATE OR DIE word graphic/controller is still being investigated; no replacement artwork was introduced.

# 720° — native JavaScript port in progress

## Original ramp/jump medal and cash routines (build82)

Bank16000 CPU6B84–6BB6 now unpacks the original three score thresholds and scales ramp/jump values with the recovered six/five shifts. CPU6E38–6E90 compares the signed16-bit deferred event score, searches ranks3→1 inclusively and stores the original rank<<6 medal byte. CPU67D8–680C uses fixed FE8C's25/35/50 cash factors multiplied by the original setup index, rather than browser fixed50/100/200/300 payouts. Rank0 keeps the existing PARTICIPATION UI label but awards no cash. Halfpipe/jump results now use these translations in the live finish path; original deferred points tally exactly once.

The browser's current difficulty still supplies a positive requested class to translated90BA, so this does not establish the full original class/progression controller. Slalom/downhill use a different remaining-race-counter metric; those medal/cash adapters remain provisional until their full counter/contact flow is integrated. Native geometry and requested gameplay/sound enhancements are retained.

The deferred score accumulator now wraps to its original word width; signed nonpositive overflow stops the tally instead of looping forever. The extractor validates the ROM dispatch/shift opcodes and retains11 source threshold rows. Portable tests cover22 class/park sets, rank boundaries, signed words and cash. Browser checks cover24 real finish calls, exactly-once score/cash and safe overflow exit. No replacement graphics, new audio or emulator were added.

## Facebook in-app browser texture cache (build81)

On the connected phone's Facebook browser, build80 still showed roughly4 FPS with intermittent stalls despite Chrome running smoothly. Its exposed WebView debugging connection identified rendering stalls when large images backed main-canvas draws. The renderer now stages original map art into256px opaque world tiles and original sprite pixels into16px transparent tiles, then draws only those small cached textures. LRU eviction caps these caches at32 world tiles (8MB) and1024 sprite tiles (1MB). No game rules or source graphics were changed; intermediate canvas alpha rounding can differ by at most two8-bit channel values in the tested views.

In Facebook's actual on-device test, moving city gameplay reached97–120 FPS after warm-up; sampled ramp/downhill/jump/slalom views read90/115/120/118 FPS. These are measured scenes, not guaranteed rates for every workload. Eighteen old/new rendering comparisons and explicit cache-eviction/memory checks passed.

## On-device mobile performance and thumbstick (build80)

USB-debugging measurements on the connected Samsung phone reproduced roughly3 FPS in the live build79. Rendering, rather than audio/game logic, dominated frame time. The renderer now skips an invisible world-sized pavement-pattern fill once opaque scenery is loaded, and loads one offline-composited opaque city background instead of drawing the large transparent decorations each frame. It also avoids setting main-canvas blur state at all; the existing cached soft shadow remains. The unused runtime decoration image is no longer decoded separately.

On that phone, the test build settled at60 FPS while moving through the city and in sampled halfpipe/downhill/jump/slalom views. This describes the tested scenes, not a guarantee for every device or workload. Eighteen city/course views are pixel-identical to build79. Original map art and decorations are composited reproducibly by tools/compose_city_background.py; simulation/collision rules are unchanged.

Mobile arrows are replaced by a circular analog thumbstick sharing the physical-gamepad input path, deadzone, point/rotate modes and airborne steering. Kick and Jump are the only mobile action buttons. Spin/Enter touch buttons are removed; keyboard/gamepad bindings remain. Tests on the actual connected phone cover proportional diagonal input, simultaneous steering+Kick, release/cancel, rotate mode and continued60 FPS.

## Mobile follow-up and FPS readout (build79)

The softened original board-shadow tiles are blurred once into a bounded20px tile cache, avoiding live main-canvas blur passes on each frame. The original silhouette and transparency are retained; the18-view comparison differs only by at most two channel shade values from alpha/blur rounding. Main-canvas filtered draw calls fell2→0 in the city proxy benchmark; desktop CPU timings were roughly unchanged, and A53 performance remains unmeasured.

Audio loops avoid redundant volume/rate writes and duplicate pending play requests while retaining fades and speed pitch. An FPS readout below the game updates once per second for on-device diagnosis. Ordinary-jump wheel audio, halfpipe wheel audio, persisted volume/mute and landing fades pass browser checks. Physics are unchanged.

## Mobile rendering cost (build78)

After a Samsung A53 low-FPS report, viewport culling skips off-screen sprite work and clips map/decoration source rectangles to the512x384 view rather than submitting6144x3072 city images. Simulation, actor scheduling, original graphics and collisions are unchanged. Conservative descriptor bounds and per-tile margins retain wide vehicles, wrapped descriptors and soft shadows.

Eighteen city/course/airborne views are pixel-identical to the prior renderer. In a headless Chromium city benchmark with6x CPU throttling, drawImage calls fell178→50 per frame and median draw submission time4.5→2.0ms (95th percentile7.0→3.3ms). This is a desktop proxy measurement, not a measured A53 FPS result; mobile GPU/filter/memory costs may still differ.

## Free wheels on every jump (build77)

Ordinary stationary and slow jumps now receive a quiet free-wheel loop as well as rolling jumps and halfpipe airs. A small minimum wheel-speed reference and audible gain floor remove the horizontal-speed gate; faster takeoffs still change pitch/intensity, and landing fades the loop. Saved skate volume/mute remain authoritative. Real gameplay checks cover stationary,100-unit and900-unit city jumps through landing, alongside the existing settings/halfpipe-audio regression.

## Saved skate audio settings and halfpipe wheel spin (build76)

Skate sound volume and mute now persist in browser storage and restore both audio state and controls on reload. The keys are separate from music and master sound; restricted storage falls back to working defaults.

Free wheel-spin recordings now use retained halfpipe/course takeoff speed when the aerial controller temporarily holds screen XY still. This keeps them audible during vertical halfpipe airs, with the existing gentle decay and landing fade.

Browser checks passed for HTTP and file URLs: change volume/mute, reload and verify model/UI, unmute and reload again, then verify zero-XY halfpipe wheel spin plays and stops on landing.

## Automatic skate sounds on the live game (build75)

All21 skate recordings are bundled in assets/skate-sfx and load automatically after starting the game, including on GitHub Pages and after a reload. No folder selection is needed. The skate volume/mute controls remain independent of music; CUSTOM SKATE PACK is an optional override. Relative URLs also preserve local-file playback. Source names and media IDs remain in assets/skate-sfx/sources.json.

## Progressive downhill kicks (build74)

Each fresh grounded kick on downhill adds a small48-unit push, even when slope momentum is already above the original flat kick target. Holding A adds no repeated native pushes; the original held-input envelope still runs. Native push headroom is2400 plus128 per board upgrade, with the existing5% fakie adjustment; naturally faster momentum is never clamped down by this assist. Airborne presses and other parks retain their existing behavior. These are native playability settings in config.js, separate from the original coefficient tables.

A real gamepad-input regression compares64 frames at the same downhill entry: coasting1464, holding A1512, eight A taps1848. Every tap increases speed, with no bail or airborne state. All25 portable suites and the downhill takeoff regression pass.

## Timed springboard jump bonus (build73)

A fresh jump timed within roughly100ms of crack contact adds one normal shoe-jump impulse to the original pad-dependent spring impulse. Contact during jump anticipation or the first rising frames is admitted; a press just after spring contact receives the same bonus. Holding/repeating jump cannot stack the bonus, and late presses leave the spring flight unchanged. Normal automatic springboards retain their original pad impulses and minimum-speed threshold. This timing bonus is a native gameplay enhancement.

Also corrected a misplaced downhill-only adapter from build72 that could throw on city springboard activation; downhill ledge drops now receive the intended projection. Browser checks cover20 timing/gear cases, all16 original crack locations, four original pad impulses/animation clocks, greater boosted apex and landing, and the downhill takeoff regression.

## Downhill takeoff continuity and X grind (build72)

Downhill jumps and ledge drops keep the original grounded surface projection at takeoff. Previously the adapter removed the slope's vertical contribution from screen Y while retaining X, abruptly turning the projected travel vector sideways. The source coefficient tables and jump-course flight routine are unchanged; this is a native downhill continuity adjustment.

Controller X now requests a coping grind; keyboard G supplies the same action. A remains kick and B jump. LB/RB and the right stick retain spin; keyboard C still spins and keyboard X still kicks. At the coping, a requested grind selects the nearest tangent and the recovered grind animation even at high entry speeds. The existing full-coping traversal and automatic descent remain active. Jump takes priority when B is also held.

Browser checks cover six downhill forward/fakie takeoffs at three speeds with unchanged flight direction and clean landings, six explicit X-grind entries on both walls through automatic descent, six natural angled grinds, twelve existing city/course forward/fakie landings and six jump-course lower-shadow flights. All25 portable suites pass.

## Halfpipe containment and touchdown alignment (build71)

The halfpipe barrier mesh now applies during airborne and bail movement, closing the outer roof-edge escape without treating support gaps as airborne walls. Ground, air and F8 use the same continuous diagonal boundary.

Coping landings replace the aerial velocity immediately with the return heading's original surface-coefficient motion, using the same projection as grounded riding. This removes the sideways touchdown tick before the next ground update corrected it. Grind return paths begin at their existing curve origin without carrying a lateral aerial step.

Checks cover 96 outer-roof crossings at ground/40/250px heights, straight720 return vectors on both walls at three speeds, six natural analog grinds with automatic descent, matched wall traversal and the existing fence-sliding regression.

## Continuous diagonal fences (build70)

Matching diagonal fence faces now join through marching-square saddles in both the barrier and support meshes. Repeated fence-post hexagons become a continuous diagonal strip, shared by swept collision and F8. Ordinary isolated obstacles, differently oriented faces and actual missing-panel gaps retain separate geometry. Original artwork is unchanged.

Validation includes both isometric directions and an explicit missing panel, 505 swept contacts on the actual city fence mesh, the existing halfpipe fence-sliding regression, and all 25 portable suites.

## Optional skate sound pack and fakie tuning (build69)

The local `local-skate-sfx` folder contains 21 MP3 clips converted from the user's installed THPS HD skateboard Wwise bank: four rolling materials, two grind materials, three pushes, three ollies, three landings, three board impacts a revert/skid and two dedicated free wheel-spin recordings. `sources.json` retains each original media ID and source name. Steam files are read only. These recordings are separate from the recovered 720 audio. Build75 bundles them in assets/skate-sfx for automatic playback.

Local and GitHub Pages play load the bundled sounds automatically. **CUSTOM SKATE PACK** optionally overrides them with selected files for the current page session. **SKATE SFX** and **SKATE LEVEL** control these recordings independently of music. Master SOUND and pause stop the effects. Rolling follows speed with a gentle pitch increase, fades between surfaces and gives way to quieter free wheel-spin recordings in the air; original map artwork supplies a native material approximation, with concrete fallback when a local browser prevents canvas pixel reads. Ramp coping uses the metal grind loop; concrete grind is available in the pack for future curb-grind integration. No online recordings are included.

Point and rotate steering are reversed while fakie. Holding the facing direction preserves backward coasting; an exit kick keeps the body facing the same direction and starts forward propulsion. Requested native tuning adds a bounded 3% horizontal boost to fakie jumps and 5% speed-limit headroom, without changing jump height or the original coefficient tables.

Validation: all 24 portable suites pass; browser checks cover twelve forward/fakie landings, mirrored controls and exit kicks, bounded jump assists, and all 21 audio clips decoding and playing through both HTTP and file URLs. Master mute, pause, independent music and folder import are checked.

## Slalom flags, session medals and fakie correction (build66)

Original placed slalom actors26..35 now render across all six layouts (8/16/19/22/30/34 placements), with original directories and animation clocks. Native checkpoints use these actual placements instead of ten uniformly guessed positions; the full original gate-pair response/scoring controller remains unfinished. MEDALS at the top opens a paused session board for the four rounds and four parks. Award selection still uses the existing provisional medal rules; this is a native text board, not a recovered original medal-screen layout.

Fakie ground movement now uses the retained travel direction rather than the reversed sprite-facing angle. This fixes the previous one-frame-after-landing reversal, including kick acceleration and steering. Rotate mode also starts its dial from travel at touchdown. Tests now assert actual postlanding velocity, beyond the pose-only checks that missed the bug.

## Vehicle towing (build65)

Skate into a moving car's rear strip while facing its travel direction to grab automatically. The skater uses the original high-speed crouching body table; the board stays in its flat-road stance. Kick or jump releases with inherited car momentum, with a short same-car contact grace period. Front, side, opposite-facing and airborne approaches do not latch. Turns follow the routed vehicle; stopping, retirement or blocked rear support releases safely.

Rear-strip mask geometry, the latch controller and a three-clock towing speed assist are native gameplay improvements. A grabbed car keeps the assist for its current visible trip so release does not instantly slow the car into the skater. The original actor motion and route routines still run on each clock. This is not a claim that the entire original attachment controller has been translated. No new or replacement assets, sounds or emulator were added.


Recent native contact corrections:

- Both halfpipe walls use the same original inclination progression and physical travel scale. The foreground wall's 48 px map span is normalized to the opposite 176 px span. At 900/1400/1920 entry speed, matching climbs take 32/18/13 ticks and descents 19/14/12 ticks on either side.
- The southern curve uses one shared projection for wheels, shadow, camera and F8 geometry, including its full 424..640 coping length and the visible lower corner at (704,772). This artwork adapter is native geometry; it is not a completed translation of the original terrain-height controller.
- Ordinary and late lip flights use the original 9FE8 XY conversion. Jump shadows acquire a lower surface, then follow its original terrain-height reference instead of repeatedly snapping to an edge. Downhill landing surfaces can recede under the board; supported long drops remain in flight until actual contact. Full 9C5E layer composition is still pending.
- Park entrances are larger isometric columns that catch airborne crossings. Return positions are checked for clear pavement and a swept connection to the entrance.
- Rider response 8 now applies the original FD10 cash table and retires contacted NPCs. Elevated pedestrian response 6 applies A64C's reward/recovery branch without bailing the player. Original height limits still allow high jumps to clear NPCs.
- A 180-degree landing keeps momentum and selects backward-facing original poses. Point/rotate input held through touchdown does not immediately reverse the rolling direction.
- Original effects now include credit insertion, command5F equipment purchases, command61 rider takedowns and command7B crack springboards. Purchase/takedown/springboard captures use the original6502 queue and unmodified sound driver offline. Music controls remain separate from effects; master mute/stop applies to all. Provenance is recorded in assets/sound-sources.json. Resident state-dependent kick/landing/crash effects remain unrecovered; unrelated service-test tones are not used. The playable game contains no emulator.


A playable browser version built from translations of the original gameplay routines and graphics/audio recovered from the supplied ROM. The browser runs JavaScript, with no emulator or ROM instruction interpreter.

This replaces the obsolete procedural remake formerly at this repository root. That version remains in Git history.

Play online: https://mysticalg.github.io/720degrees/

## Coping tricks (build 59)

- Approach the coping at an angle without jumping to select the recovered grind sequence. Approach speed and heading still choose the original animation band. The skater can traverse the full cap in either direction, then releases and descends automatically from the end reached.
- A slow straight-on entry without jumping selects the rock/stall sequence. Leave spin neutral to return fakie; use the spin control for a half turn, then release it, to return facing downhill (rock 'n' roll).
- B still selects an aerial. Existing handplants and720s remain available through their original speed/angle selection.

The native caller now preserves the actual entry heading instead of forcing2/10, and carries original91A6/9FB4 tangential motion into the recovered4F->40->50->44->43 grind path. Action50 retains its original40-tick hold setup and1.5x velocity update. Existing original airtime scoring awards points once on landing; no new trick-score table or replacement graphics/sounds was added.

Full-length hold renewal, endpoint admission from original white-cap artwork (north712..928, south424..640), contact-height anchoring, separate fakie facing and a bounded curved return to decoded floor are intentional native playability adapters. The turn-input gate allows a half turn before interruption. These changes do not prove the original game named or controlled the tricks identically, or that its full height/contact controller is complete. Also repaired corrupted HUD separator/degree/infinity labels and stored them as Unicode escapes.

## Raised ramps with multiple faces (build 58)

Raised city ramps now decode their secondary face profiles using original94BA-94D4 mode2 semantics. The pictured blue ramp has primary material48, while flag0x84 supplies front incline4, flag0x92 supplies opposite incline18, and flag0xF8 supplies the flat120 crest. These profiles now drive native coefficients, speed changes, slope-jump admission and original poses, rather than treating both faces as flat material48. Inclined poses take priority over road kick frames. F8 includes the secondary slopes and internal incline divisions, which are diagnostic lines, not extra walls.

Layer admission is still a native adapter: it selects known city platform materials32/48 with rideable alternate flags128..191 or crest248, while preserving overhead scenery. The original full9514-9798 layer-transition/height controller remains incomplete. Tests verify131072 primary/mode2 combinations and the real blue ramp in both directions: opposite vertical signs, uphill deceleration/downhill acceleration, rising launch261 and the original inclined sprite entry.

## Painted course markers (build 57)

Direction/start, finish, target and lip flags9/10/15/16 now retain native ground movement and jump admission in slalom, downhill and jump courses. Some painted arrows mix ordinary and flag9 tiles; entering a flagged piece previously selected the fallback movement branch and reset speed to zero. Their recovered profiles/flags remain intact for course logic. Verified48 marker cases across the decoded layouts, plus coasting and jumping on the curved arrow at1636,956 in jump-1.

## Southern halfpipe coping (build 56)

The south wall now projects its terrain height onto the original artwork's white coping line, y=x/2+382 in ramp-1.png. Previously the native adapter drew that wall, its skater and aerial origins on the lower wooden face. Ground poses, aerials, handplants, camera tracking, landing effects and F8 slope/contact display now share the projected height. The original motion, scoring and animation controllers remain in use. This is an explicit artwork-space geometry adapter, not a claim that the full original height controller is complete.

Short foreground-rail interruptions are bridged only where bounded by recovered south-curve/floor samples. Real coping faces and unrelated/wide fences remain solid; fence-gap closing cannot grow into a recovered riding surface. Coping launch ignores interior rail interruptions, and the landing point settles on the rideable side of the contour. Tests cover18 southern edge/angled cycles and12 jump/no-jump cycles at two speeds/three lanes, including the original46->40->47->48->43->45 handplant sequence. The north wall retains its existing projection.

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

Low-height response 6 now uses A60C impact-side/direction and player bail, followed by bank1E000:4ECC-4F40 motion save/stop, D498 hit animation selection and BF18 route reservation release. CB26-CB4A and4F42-4F96 restore the six saved motion fields at180 ticks. The original single global snapshot and sprite6/companion5 special branch are retained. Countdown is intentionally not saved. Original hit frames render through the existing ROM sprite directory.

A controlled kind50 pedestrian integration fixture verifies original scanline-mask contact, transparent clearance, player impact, stopped actor animation and restoration of nonzero motion at tick180. This fixture does not prove natural population spawning: full dynamic NPC activation, the A64C airborne reward branch and hit sound decoding still need translation/integration.

## Halfpipe descent correction (build 53)

The same-wall return now finishes the entire curved descent before steering resumes. Previously steering unlocked at30% wall height; holding the uphill stick reversed the skater before reaching the floor. Rotate-mode dial state is also restored in the unprojected control plane rather than using the isometric screen angle. All curved-wall inclination bands retain their original terrain poses while kicking, so the shallow descending poses are no longer hidden by road kick frames. This steering guard remains an explicit native geometry adaptation.

Browser regressions cover both walls in point and rotate mode, with the uphill stick held throughout and A held after landing: each completes720, lands and reaches the floor without bailing or reversing on the wall. Twelve original descent pose selections were checked against the recovered directory and visually inspected. This does not establish full halfpipe contact/animation fidelity.
