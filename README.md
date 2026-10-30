# 720° — native JavaScript port in progress

A playable browser version built from translations of the original gameplay routines and graphics/audio recovered from the supplied ROM. The browser runs JavaScript, with no emulator or ROM instruction interpreter.

This replaces the obsolete procedural remake formerly at this repository root. That version remains in Git history.

Play online: https://mysticalg.github.io/720degrees/

## Run

From this directory, run `python -m http.server 8722`, then open http://localhost:8722. No build step is required.

## Controls

- Move/steer: arrow keys or WASD; analog gamepad supported.
- Kick: X or Shift; gamepad A.
- Jump: Space or Z; gamepad B.
- Spin: C; gamepad shoulders or right stick.
- Park interaction: E or Enter; park entry pads also activate by skating onto them.
- Pause: P or Escape. Fullscreen: F.
- Point/Rotate steering: options button at the top; stick clicks do not change mode.
- Music mute and volume: controls at the top.

## Current state

The game includes recovered city and park scenery, original skater/board/shadow graphics, kick/jump/bail and landing-point sequences, springboard cracks, park access, music controls, and translated portions of fixed-point movement and scoring.

Fixed city actor positions, animation entries and rates now initialize through the translated original routines and extracted tables. Original route selection, population requests, sprite allocation, activation and retirement routines are present, with tests, but moving traffic and its visibility scheduler are **not yet connected to live gameplay**.

Terrain contact, halfpipe coping, some scoring/event rules, enemies, powerups and full population behaviour remain incomplete or provisional. This is not yet a fully faithful port.

## Graphics and audio

The included game media was recovered from the supplied 720° ROM. No replacement sprites or synthesized sound effects are used. The original recorded start cue plays before the city track, and the original bee warning plays when triggered. Pause, mute and music volume apply to the mixed start cue too. Local MP3s contain recordings of original sound output; unrecovered kick/jump/crash cues remain silent. Traffic sound selection and the complete original sound sequencer are not yet integrated. The ROM ZIP itself is not included.

## Code and checks

`src/original-*.js` contains commented native translations. The renderer, input adapters and game loop are separate. Some translated modules remain research code until their callers and state are connected.

Run the portable checks with `npm test` (Node.js required; no package installation needed). These cover object reservations, route choice and pending-route timing. They do not establish complete gameplay fidelity. Broader development checks also compare recovered ROM tables and captured original actor state, and exercise the game in a browser.

Extraction tools are in `tools/`; they require the user's ROM and, for some older media extraction paths, additional development capture data and Python dependencies. Generated runtime assets are already included.
