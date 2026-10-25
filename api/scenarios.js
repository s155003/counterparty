import { SCENARIOS, publicScenario } from "../lib/scenarios.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ scenarios: SCENARIOS.map(publicScenario) });
}
