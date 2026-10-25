import { getScenario } from "../lib/scenarios.js";
import { playTurn } from "../lib/claude.js";

const MAX_MESSAGE_CHARS = 800;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { scenarioId, history } = req.body || {};
    const scenario = getScenario(scenarioId);
    if (!scenario) return res.status(400).json({ error: "Unknown scenario" });
    if (!Array.isArray(history) || history.length === 0) return res.status(400).json({ error: "Missing history" });

    // History starts with the user's first reply to the scripted opening (which
    // lives in the system prompt), alternates user/assistant, and ends on user.
    const clean = [];
    for (const m of history) {
      if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
        return res.status(400).json({ error: "Bad history entry" });
      }
      const content = m.content.trim().slice(0, m.role === "user" ? MAX_MESSAGE_CHARS : 4000);
      if (!content) return res.status(400).json({ error: "Empty message" });
      clean.push({ role: m.role, content });
    }
    if (clean[0].role !== "user") return res.status(400).json({ error: "History must start with the user" });
    if (clean[clean.length - 1].role !== "user") return res.status(400).json({ error: "History must end with the user" });
    const turnNumber = clean.filter((m) => m.role === "user").length;
    if (turnNumber > scenario.maxTurns) return res.status(400).json({ error: "Turn limit reached" });

    const { data, usage, model } = await playTurn({ scenario, history: clean, turnNumber });
    res.status(200).json({
      turn: data,
      usage: { input: usage.input_tokens, output: usage.output_tokens, cached: usage.cache_read_input_tokens || 0 },
      model
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
