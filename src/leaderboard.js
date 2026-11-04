/** Community board: only finished ordinary runs can be submitted by the UI. */
(() => {
  const S = window.Skate720;
  S.attachLeaderboard = function (game) {
    const endpoint =
      "https://720degrees-scores.netlify.app/.netlify/functions/scores";
    const section = document.querySelector("#highscores"),
      status = document.querySelector("#scores-status"),
      form = document.querySelector("#score-submit"),
      submit = form.querySelector("button"),
      initials = document.querySelector("#score-initials"),
      skill = document.querySelector("#score-skill"),
      body = document.querySelector("#scores-body");
    const enter = document.querySelector("#score-enter");
    enter.onclick = () => {
      section.hidden = false;
      section.scrollIntoView({ block: "start", behavior: "smooth" });
      initials.focus({ preventScroll: true });
    };
    const pendingKey = "720-pending-scores";
    let pending = [],
      run = null,
      saving = false,
      captured = false,
      refreshSerial = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(pendingKey) || "[]");
      pending = Array.isArray(saved)
        ? saved.filter(
            (r) =>
              r &&
              /^[0-9a-f-]{36}$/i.test(r.id) &&
              Number.isSafeInteger(r.score) &&
              r.score > 0 &&
              r.practice === false &&
              r.assisted === false,
          )
        : [];
      run = pending[0] || null;
    } catch {}
    const persist = () => {
      try {
        localStorage.setItem(pendingKey, JSON.stringify(pending));
      } catch {}
    };
    const runId = () => {
      if (crypto.randomUUID) return crypto.randomUUID();
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
      ].join("-");
    };
    async function scoreRequest(url, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw Error(data.error || `Score server returned ${response.status}`);
        return data;
      } finally {
        clearTimeout(timeout);
      }
    }
    try {
      initials.value = localStorage.getItem("720-initials") || "";
    } catch {}
    async function refresh() {
      const serial = ++refreshSerial;
      status.textContent = "Loading scores…";
      try {
        const data = await scoreRequest(endpoint + "?skill=" + skill.value);
        if (serial !== refreshSerial) return;
        body.replaceChildren();
        for (const [i, score] of data.scores.entries()) {
          const tr = document.createElement("tr");
          for (const value of [
            i + 1,
            score.initials,
            Number(score.score).toLocaleString(),
          ]) {
            const td = document.createElement("td");
            td.textContent = value;
            tr.append(td);
          }
          body.append(tr);
        }
        status.textContent = data.scores.length
          ? "Community high scores"
          : "No scores yet. Be the first!";
      } catch {
        if (serial !== refreshSerial) return;
        status.textContent =
          "Score server unavailable. Your local best and pending scores are still saved.";
      }
    }
    document.querySelector("#scores-open").onclick = () => {
      section.hidden = !section.hidden;
      if (!section.hidden) {
        skill.value = game.experienced ? "experienced" : "training";
        refresh();
      }
    };
    document.querySelector("#scores-refresh").onclick = refresh;
    skill.onchange = refresh;
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (saving || !run || run.saved) return;
      const name = initials.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{1,3}$/.test(name)) {
        status.textContent = "Enter 1–3 letters or numbers.";
        initials.focus();
        return;
      }
      const attempt = run;
      attempt.initials = name;
      persist();
      saving = true;
      submit.disabled = true;
      status.textContent = "Saving score…";
      try {
        await scoreRequest(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...attempt, initials: name }),
        });
        attempt.saved = true;
        pending = pending.filter((r) => r.id !== attempt.id);
        persist();
        if (attempt !== run) return;
        run = pending[0] || null;
        form.hidden = true;
        enter.hidden = true;
        try {
          localStorage.setItem("720-initials", name);
        } catch {}
        await refresh();
        status.textContent = "Score saved to the server.";
        if (run) game.changed?.();
      } catch (error) {
        status.textContent =
          (error.name === "AbortError"
            ? "Score server timed out."
            : error.message === "Failed to fetch"
              ? "Could not reach the score server."
              : error.message) +
          " Score kept on this device—press Save score to retry.";
      } finally {
        saving = false;
        submit.disabled = false;
      }
    };
    return {
      start() {
        captured = false;
        form.hidden = !run;
      },
      sync() {
        const eligible =
          !game.practice &&
          !game.leaderboardAssisted &&
          game.score > 0 &&
          ["gameover", "victory"].includes(game.mode) &&
          (!game.cashTally || game.cashTally.phase === "done");
        if (eligible && !captured) {
          captured = true;
          const finished = {
            id: runId(),
            score: game.score,
            skill: game.experienced ? "experienced" : "training",
            version: S.CONFIG.version,
            practice: false,
            assisted: false,
          };
          pending.push(finished);
          persist();
          run ||= finished;
        }
        enter.hidden = !run;
        form.hidden = !run;
        if (!run) return;
        if (run.initials && document.activeElement !== initials)
          initials.value = run.initials;
        section.hidden = false;
        if (skill.value !== run.skill) {
          skill.value = run.skill;
          refresh();
        }
        document.querySelector("#score-final").textContent = Number(
          run.score,
        ).toLocaleString();
      },
    };
  };
})();
