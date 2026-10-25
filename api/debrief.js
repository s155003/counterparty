import { getScenario } from "../lib/scenarios.js";
import { scoreDeal, scoreWalk } from "../lib/score.js";
import { debrief } from "../lib/claude.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { scenarioId, moves, outcome, agreed } = req.body || {};
    const scenario = getScenario(scenarioId);
    if (!scenario) return res.status(400).json({ error: "Unknown scenario" });
    if (!Array.isArray(moves) || moves.length === 0) return res.status(400).json({ error: "Nothing to review" });
    if (!["deal", "walked_user", "walked_them"].includes(outcome)) return res.status(400).json({ error: "Bad outcome" });

    const cleanMoves = moves.slice(0, scenario.maxTurns).map((m) => ({
      you: String(m.you || "").slice(0, 800),
      them: m.them ? {
        say: String(m.them.say || "").slice(0, 4000),
        demeanor: String(m.them.demeanor || ""),
        pressure: Number(m.them.pressure) || 0,
        private_note: String(m.them.private_note || "").slice(0, 600)
      } : null
    }));

    const score = outcome === "deal" ? scoreDeal(scenario, agreed || {}) : scoreWalk(scenario);
    const { data, usage, model } = await debrief({ scenario, moves: cleanMoves, outcome, score });

    res.status(200).json({
      review: data,
      score,
      hidden: scenario.hidden,
      issues: scenario.issues,
      usage: { input: usage.input_tokens, output: usage.output_tokens },
      model
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
