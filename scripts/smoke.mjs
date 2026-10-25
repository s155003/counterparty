// Calls the model once per endpoint to prove the structured-output contract works.
// Usage: node scripts/smoke.mjs
import { getScenario } from "../lib/scenarios.js";
import { playTurn, debrief } from "../lib/claude.js";
import { scoreDeal } from "../lib/score.js";

const scenario = getScenario("offer");
const t0 = Date.now();
const turn = await playTurn({
  scenario,
  history: [{ role: "user", content: "Thanks Priya. Before numbers, can I ask what the team is working toward this summer? I want to understand the timeline you are hiring for." }],
  turnNumber: 1
});
console.log(`turn: ${Date.now() - t0} ms, model ${turn.model}, in ${turn.usage.input_tokens} out ${turn.usage.output_tokens}`);
console.log(JSON.stringify(turn.data, null, 2));

const agreed = { base: 96000, signing: 5000, start: 2 };
const score = scoreDeal(scenario, agreed);
console.log("score", JSON.stringify(score, null, 2));

const t1 = Date.now();
const rev = await debrief({
  scenario,
  outcome: "deal",
  score,
  moves: [
    { you: "Thanks Priya. Before numbers, can I ask what the team is working toward this summer?", them: turn.data },
    { you: "That helps. I have a competing offer at $92,000. I would rather be at Larkspur, but I need the base to be at least competitive. Could you do $98,000 with a June 30 start?", them: { say: "I can take $96,000 and June 30 to the recruiter, plus a $5,000 signing bonus.", demeanor: "firm", pressure: 62, private_note: "She named a number and a reason, that is enough to move." } },
    { you: "Deal. $96,000 base, $5,000 signing, June 30.", them: { say: "Done. I will send the revised letter today.", demeanor: "relieved", pressure: 30, private_note: "Relieved she did not push to $100k; I had room." } }
  ]
});
console.log(`debrief: ${Date.now() - t1} ms, model ${rev.model}, in ${rev.usage.input_tokens} out ${rev.usage.output_tokens}`);
console.log(JSON.stringify(rev.data, null, 2));
