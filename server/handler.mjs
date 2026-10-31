/** Durable SQL leaderboard. Browser scores are community submissions, not replay verified. */
export function handler(db) {
  return async function (request) {
    const origin = request.headers.get("origin");
    const allowed =
      origin === "https://mysticalg.github.io" ||
      origin === "null" || // Local file:// builds of the game.
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (allowed)
      Object.assign(headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
    const reply = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !allowed) return reply({ error: "Origin not allowed" }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    try {
      if (request.method === "GET") {
        const skill =
          new URL(request.url).searchParams.get("skill") || "training";
        if (!["training", "experienced"].includes(skill))
          return reply({ error: "Invalid board" }, 400);
        const rows = await db.query(
          "SELECT initials,score,skill,created_at FROM arcade720_scores WHERE skill=$1 ORDER BY score DESC,created_at ASC,id ASC LIMIT 20",
          [skill],
        );
        return reply({ scores: rows.rows });
      }
      if (request.method !== "POST")
        return reply({ error: "Method not allowed" }, 405);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "JSON required" }, 415);
      const text = await request.text();
      if (text.length > 1024) return reply({ error: "Request too large" }, 413);
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return reply({ error: "Invalid JSON" }, 400);
      }
      if (!data || typeof data !== "object" || Array.isArray(data))
        return reply({ error: "Invalid submission" }, 400);
      if (data.practice !== false || data.assisted !== false)
        return reply({ error: "Only ordinary game runs qualify" }, 400);
      if (
        !/^[A-Z0-9]{1,3}$/.test(data.initials) ||
        !Number.isSafeInteger(data.score) ||
        data.score < 1 ||
        data.score > 4294967295 ||
        !["training", "experienced"].includes(data.skill) ||
        !/^\d+\.\d+(?:\.\d+)?$/.test(data.version) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          data.id,
        )
      )
        return reply({ error: "Invalid score submission" }, 400);
      const values = [
        data.id,
        data.initials,
        data.score,
        data.skill,
        data.version,
      ];
      const saved = await db.query(
        "INSERT INTO arcade720_scores(id,initials,score,skill,version) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id",
        values,
      );
      if (!saved.rows.length) {
        const existing = await db.query(
          "SELECT initials,score,skill,version FROM arcade720_scores WHERE id=$1",
          [data.id],
        );
        const e = existing.rows[0];
        if (
          !e ||
          e.initials !== data.initials ||
          Number(e.score) !== data.score ||
          e.skill !== data.skill ||
          e.version !== data.version
        )
          return reply({ error: "Run was already submitted" }, 409);
      }
      return reply({ saved: true });
    } catch (error) {
      console.error("Leaderboard storage failure", error.message);
      return reply({ error: "Scores unavailable; please retry" }, 503);
    }
  };
}
