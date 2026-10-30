/** Application wiring and the fixed 60 Hz simulation loop. */
(() => {
  const S = window.Skate720,
    canvas = document.querySelector("#game");
  const input = new S.Input(canvas),
    audio = new S.AudioSystem(),
    renderer = new S.Renderer(canvas),
    game = new S.Game(input, audio);
  game.boardFootprint = (player) =>
    renderer.boardFootprint(
      player,
      player.halfpipePoseProfile ??
        (game.event?.level || game.city.level).contactSample(player.x, player.y)
          .profile,
    );
  const menu = document.querySelector("#menu"),
    pause = document.querySelector("#pause"),
    result = document.querySelector("#result");
  const button = document.querySelector("#continue");
  function syncScreen() {
    menu.hidden = game.mode !== "title";
    pause.hidden = !game.paused;
    result.hidden = !["result", "gameover", "victory"].includes(game.mode);
    if (game.mode === "result") {
      const r = game.result;
      document.querySelector("#result-title").textContent =
        r.medal === "PARTICIPATION" ? "KEEP PRACTISING" : `${r.medal} MEDAL!`;
      document.querySelector("#result-copy").textContent =
        `${r.kind.toUpperCase()} PARK · CLASS ${game.event.round}\n${S.format(r.points)} points · $${r.cash} prize\n+${S.format(r.bonus)} medal bonus`;
      button.textContent = "BACK TO SKATE CITY";
    } else if (game.mode === "gameover" || game.mode === "victory") {
      document.querySelector("#result-title").textContent =
        game.mode === "victory" ? "YOU OWN SKATE CITY!" : "SKATE OR DIE.";
      document.querySelector("#result-copy").textContent =
        `${game.mode === "victory" ? "All sixteen events completed." : "The bees caught up with you."}\nFINAL SCORE ${S.format(game.score)}\nBEST ${S.format(game.highScore)}`;
      button.textContent = "SKATE AGAIN";
    }
  }
  game.changed = syncScreen;
  function start(practice) {
    previousFrame = null;
    accumulator = 0;
    game.start(practice);
    input.clear();
    canvas.focus();
    syncScreen();
  }
  // Session medals are kept by Game.finishEvent; this board reads them
  // directly so retries and title restarts never create invented awards.
  const medalsPanel = document.querySelector("#medals-panel");
  let medalsWasPaused = false,
    medalsFocus = null;
  function closeMedals() {
    medalsPanel.hidden = true;
    game.paused = medalsWasPaused;
    input.clear();
    previousFrame = null;
    accumulator = 0;
    if (!game.paused && ["city", "event"].includes(game.mode))
      audio.playMusic();
    syncScreen();
    (medalsFocus || canvas).focus();
  }
  document.querySelector("#medals-open").onclick = () => {
    if (!medalsPanel.hidden) return;
    medalsWasPaused = game.paused;
    medalsFocus = document.activeElement;
    game.paused = true;
    input.clear();
    audio.pauseMusic();
    const body = document.querySelector("#medals-grid tbody");
    body.replaceChildren();
    for (let round = 1; round <= 4; round++) {
      const row = document.createElement("tr"),
        label = document.createElement("th");
      label.textContent = String(round);
      row.append(label);
      for (const park of ["ramp", "downhill", "jump", "slalom"]) {
        const cell = document.createElement("td"),
          award = game.medals.find((m) => m.park === park && m.round === round);
        cell.textContent = award?.medal || "—";
        cell.dataset.medal = award?.medal || "none";
        cell.title = award
          ? `${S.format(award.points)} event points`
          : "Not completed this session";
        row.append(cell);
      }
      body.append(row);
    }
    document.querySelector("#medals-total").textContent =
      `${game.medals.filter((m) => m.medal !== "PARTICIPATION").length} MEDALS · ${game.medals.length}/16 EVENTS COMPLETED`;
    medalsPanel.hidden = false;
    document.querySelector("#medals-close").focus();
  };
  document.querySelector("#medals-close").onclick = closeMedals;
  document.addEventListener(
    "keydown",
    (event) => {
      if (medalsPanel.hidden) return;
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeMedals();
      }
      if (event.code === "Tab") {
        event.preventDefault();
        document.querySelector("#medals-close").focus();
      }
    },
    true,
  );
  function togglePause() {
    if (!medalsPanel.hidden) {
      closeMedals();
      return;
    }
    if (!["city", "event"].includes(game.mode)) return;
    previousFrame = null;
    accumulator = 0;
    game.paused = !game.paused;
    input.clear();
    game.paused ? audio.pauseMusic() : audio.playMusic();
    syncScreen();
  }
  function toggleSound() {
    const muted = audio.toggle();
    document.querySelector("#sound").textContent = muted
      ? "SOUND OFF"
      : "SOUND ON";
    document
      .querySelector("#sound")
      .setAttribute("aria-pressed", String(muted));
    if (!muted && !game.paused && ["city", "event"].includes(game.mode))
      audio.playMusic();
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector("#cabinet").requestFullscreen();
    } catch {}
  }
  function syncSteering() {
    const button = document.querySelector("#steering");
    button.textContent = `STICK: ${input.controlMode.toUpperCase()}`;
    button.setAttribute("aria-pressed", String(input.controlMode === "rotate"));
  }
  function toggleSteering() {
    input.toggleMode();
    syncSteering();
    game.tell(`${input.controlMode.toUpperCase()} STEERING`, 2);
  }
  document.querySelector("#steering").onclick = toggleSteering;
  syncSteering();
  document.querySelector("#difficulty").onclick = () => {
    game.experienced = !game.experienced;
    document.querySelector("#difficulty").textContent =
      `SKILL: ${game.experienced ? "EXPERIENCED" : "TRAINING"}`;
  };
  document.querySelector("#start").onclick = () => start(false);
  document.querySelector("#practice").onclick = () => start(true);
  document.querySelector("#resume").onclick = togglePause;
  document.querySelector("#quit").onclick = () => {
    game.mode = "title";
    game.paused = false;
    audio.stop();
    syncScreen();
  };
  document.querySelector("#sound").onclick = toggleSound;
  function syncMusic() {
    const muted = audio.musicMuted;
    const control = document.querySelector("#music-mute");
    control.textContent = muted ? "MUSIC OFF" : "MUSIC ON";
    control.setAttribute("aria-pressed", String(muted));
    document.querySelector("#music-volume").value = String(
      Math.round(audio.musicVolume * 100),
    );
    document.querySelector("#music-level").value =
      `${Math.round(audio.musicVolume * 100)}%`;
  }
  document.querySelector("#music-mute").onclick = () => {
    audio.toggleMusic();
    syncMusic();
  };
  document.querySelector("#music-volume").oninput = (event) => {
    audio.setMusicVolume(Number(event.target.value) / 100);
    syncMusic();
  };
  syncMusic();
  document.querySelector("#fullscreen").onclick = fullscreen;
  button.onclick = () => {
    if (game.mode === "result") game.continueAfterEvent();
    else start(game.practice);
    canvas.focus();
  };
  // Suspend when changing tabs so the player cannot lose to an invisible timer.
  document.addEventListener("visibilitychange", () => {
    if (
      document.hidden &&
      !game.paused &&
      ["city", "event"].includes(game.mode)
    )
      togglePause();
  });
  function handleActions() {
    if (input.consumeCollisionToggle())
      renderer.showCollisions = !renderer.showCollisions;
    if (input.pressed("fullscreen")) fullscreen();
    if (input.pressed("mute")) toggleSound();
    if (!medalsPanel.hidden) {
      if (
        input.pressed("pause") ||
        input.pressed("enter") ||
        input.pressed("jump")
      )
        closeMedals();
      return;
    }
    if (input.pressed("pause")) togglePause();
    if (
      game.mode === "title" &&
      (input.pressed("enter") ||
        input.pressed("pause") ||
        input.pressed("jump"))
    )
      start(false);
    else if (
      ["result", "gameover", "victory"].includes(game.mode) &&
      (input.pressed("enter") ||
        input.pressed("pause") ||
        input.pressed("jump"))
    )
      button.click();
    else if (!game.paused && ["city", "event"].includes(game.mode)) {
      if (input.pressed("map") && game.mode === "city") game.showMap();
      if (input.pressed("jump")) game.jump();
      if (input.pressed("enter")) game.interact();
    }
  }
  let last = performance.now(),
    accumulator = 0,
    manualClock = false,
    previousFrame = null;
  function frame(now) {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!manualClock) {
      input.poll();
      handleActions();
      accumulator += delta;
      while (accumulator >= S.CONFIG.step) {
        previousFrame = S.RenderInterpolation.capture(game);
        game.update(S.CONFIG.step);
        accumulator -= S.CONFIG.step;
      }
    }
    const padLabel = input.padName
      ? `${input.padName} · ${input.controlMode.toUpperCase()} MODE`
      : "CONTROLLER: press a button on your pad to connect.";
    const status = document.querySelector("#pad-status");
    if (status.textContent !== padLabel) status.textContent = padLabel;
    renderer.draw(
      S.RenderInterpolation.view(
        game,
        previousFrame,
        manualClock ? 1 : accumulator / S.CONFIG.step,
      ),
    );
    requestAnimationFrame(frame);
  }
  // Deterministic test hooks operate the same rules as the normal animation loop.
  // Automation enables manualClock explicitly; normal play never stops its clock.
  window.advanceTime = (ms) => {
    manualClock = true;
    previousFrame = null;
    accumulator = 0;
    input.poll();
    handleActions();
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) game.update(S.CONFIG.step);
    renderer.draw(game);
  };
  window.render_game_to_text = () =>
    JSON.stringify({
      ...game.toJSON(),
      debug: { collisionOverlay: !!renderer.showCollisions },
    });
  window.Skate720.app = {
    game,
    input,
    audio,
    renderer,
    resumeClock() {
      ((manualClock = false), (previousFrame = null));
      last = performance.now();
    },
  };
  renderer.loadPromise
    .then(() => renderer.draw(game))
    .catch((error) => {
      document.querySelector(".subtitle").textContent = error.message;
      document.querySelector("#start").disabled = true;
    });
  requestAnimationFrame(frame);
})();
