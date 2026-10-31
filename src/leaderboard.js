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
    let run = null,
      saving = false;
    try {
      initials.value = localStorage.getItem("720-initials") || "";
    } catch {}
    async function refresh() {
      status.textContent = "Loading scores…";
      try {
        const response = await fetch(endpoint + "?skill=" + skill.value, {
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw Error();
        const data = await response.json();
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
        status.textContent =
          "Score server unavailable. Your local best is still saved.";
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
      saving = true;
      submit.disabled = true;
      status.textContent = "Saving score…";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...run, initials: name }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw Error();
        attempt.saved = true;
        if (attempt !== run) return;
        form.hidden = true;
        enter.hidden = true;
        try {
          localStorage.setItem("720-initials", name);
        } catch {}
        await refresh();
        status.textContent = "Score saved to the server.";
      } catch {
        status.textContent = "Could not save. Press Save score to retry.";
      } finally {
        saving = false;
        submit.disabled = false;
      }
    };
    return {
      start() {
        run = null;
        form.hidden = true;
      },
      sync() {
        const eligible =
          !game.practice &&
          !game.leaderboardAssisted &&
          game.score > 0 &&
          ["gameover", "victory"].includes(game.mode) &&
          (!game.cashTally || game.cashTally.phase === "done");
        enter.hidden = !eligible || !!run?.saved;
        if (!eligible) {
          form.hidden = true;
          return;
        }
        if (!run) {
          run = {
            id: crypto.randomUUID(),
            score: game.score,
            skill: game.experienced ? "experienced" : "training",
            version: S.CONFIG.version,
            practice: false,
            assisted: false,
          };
          section.hidden = false;
          skill.value = run.skill;
          refresh();
        }
        form.hidden = !!run.saved;
        document.querySelector("#score-final").textContent = Number(
          run.score,
        ).toLocaleString();
      },
    };
  };
})();
