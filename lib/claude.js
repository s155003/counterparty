import Anthropic from "@anthropic-ai/sdk";
import { formatValue } from "./score.js";

export const MODEL = "claude-opus-5-5";

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

// One structured call. The response is constrained to `schema` by the API,
// so JSON.parse on the text block is safe. Server-side fallbacks are on so a
// safety-classifier decline is retried on a fallback model inside the same call.
async function structured({ system, messages, schema, effort, maxTokens }) {
  const res = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
    output_config: {
      effort,
      format: { type: "json_schema", schema }
    }
  });
  if (res.stop_reason === "refusal") {
    const why = res.stop_details?.explanation || "the request was declined";
    throw new Error(`Model declined: ${why}`);
  }
  if (res.stop_reason === "max_tokens") {
    throw new Error("Model response was cut off. Try again.");
  }
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return { data: JSON.parse(text), usage: res.usage, model: res.model };
}

export const DEMEANORS = ["warm", "guarded", "firm", "hesitant", "irritated", "amused", "impatient", "relieved"];

function issueLines(scenario) {
  return scenario.issues.map((i) => {
    const kindNote = i.kind === "option"
      ? `options by index: ${i.options.map((o, idx) => `${idx} = ${o}`).join(", ")}`
      : i.kind === "money" ? "a dollar amount" : `a number of ${i.unit}`;
    return `- ${i.key} (${i.label}): ${kindNote}. Your opening position: ${formatValue(i, i.start)}. Your true bottom line: ${formatValue(i, i.themRes)}.`;
  }).join("\n");
}

function offerSchema(scenario) {
  const props = {};
  for (const i of scenario.issues) {
    props[i.key] = { anyOf: [{ type: "number" }, { type: "null" }] };
  }
  return { type: "object", properties: props, required: Object.keys(props), additionalProperties: false };
}

export function turnSchema(scenario) {
  return {
    type: "object",
    properties: {
      say: { type: "string", description: "What you say out loud, in character. Plain text, no markdown." },
      demeanor: { type: "string", enum: DEMEANORS },
      pressure: { type: "integer", description: "An integer from 0 to 100: how much pressure your character feels to concede right now. 0 = none, 100 = about to give everything." },
      status: { type: "string", enum: ["open", "deal", "walked"] },
      offer: offerSchema(scenario),
      agreed: offerSchema(scenario),
      private_note: { type: "string", description: "One sentence: what your character is actually thinking and will not say." }
    },
    required: ["say", "demeanor", "pressure", "status", "offer", "agreed", "private_note"],
    additionalProperties: false
  };
}

export function turnSystem(scenario) {
  const c = scenario.counterpart;
  return `You are playing ${c.name}, ${c.role}, in a negotiation practice tool. The user is practicing. Stay in character the whole time.

SITUATION
${scenario.setting}
The user is: ${scenario.you.role}.

YOUR CHARACTER
${scenario.hidden.persona}

WHAT YOU KNOW AND THE USER DOES NOT
${scenario.hidden.facts.map((f) => `- ${f}`).join("\n")}

TELLS (how you leak information when the user plays well)
${scenario.hidden.tells}

THE ISSUES ON THE TABLE
${issueLines(scenario)}

YOUR OPENING LINE (you already said this; the conversation continues from the user's reply)
"${scenario.opening}"

HOW TO PLAY
- Be a realistic human. Short conversational replies, usually two to five sentences. Plain text only.
- Negotiate in your own interest. Do not give things away for free. Make concessions only in response to reasons, pressure, trades, or credible alternatives, and make them gradually.
- Never state your true bottom line as a number. You may hint, deflect, or reveal non-numeric facts when a good question makes it natural for your character to answer.
- Reward good technique: specific asks, questions about your constraints, trades across issues, credible alternatives, patience. Punish bad technique: vague asks, accepting your first number, hostility, bluffs that do not hold up.
- If the user accepts your standing offer, or you both clearly agree on every issue, set status to "deal" and fill in "agreed" with the final value for every issue. Restate the final terms in what you say. Do not mark "deal" if any issue is still unsettled; ask about it instead.
- If the user is insulting, or pushes past your bottom line repeatedly with no movement, you may end it: set status to "walked" and say goodbye in character. Do this rarely; most real counterparts keep talking.
- "offer" is your current standing position on every issue after this message (null only for an issue nobody has mentioned yet). Keep it consistent with what you say.
- "agreed" is null for every issue unless status is "deal".
- "pressure" is your honest internal read: how close you are to conceding more. It should rise when the user applies real leverage and fall when they stumble.
- "private_note" is a single candid sentence of your character's actual thinking. It will be shown to the user only after the negotiation ends, as a learning tool, so be honest and specific.`;
}

export async function playTurn({ scenario, history, turnNumber }) {
  const system = turnSystem(scenario);
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  if (turnNumber >= scenario.maxTurns) {
    const last = messages[messages.length - 1];
    last.content = `${last.content}\n\n[Operator note, not spoken by the user: this is the final exchange. Either close on terms you can accept, or end the conversation in character with status "walked".]`;
  }
  return structured({
    system,
    messages,
    schema: turnSchema(scenario),
    effort: "low",
    maxTokens: 2000
  });
}

const PRINCIPLES = ["Anchoring", "Alternatives", "Asking questions", "Trading across issues", "Concession pattern", "Patience"];

export function debriefSchema(moveCount) {
  return {
    type: "object",
    properties: {
      headline: { type: "string", description: "One plain sentence summarizing how the negotiation went. No jargon." },
      moves: {
        type: "array",
        description: `Exactly one entry per user move, turns 1 through ${moveCount}, in order.`,
        items: {
          type: "object",
          properties: {
            turn: { type: "integer" },
            mark: { type: "string", enum: ["!!", "!", "!?", "?!", "?", "??", ""] },
            comment: { type: "string", description: "At most two short sentences about this specific move. Mention what it did to the counterpart. Empty string if the move was routine." }
          },
          required: ["turn", "mark", "comment"],
          additionalProperties: false
        }
      },
      missed_line: {
        type: "object",
        properties: {
          turn: { type: "integer", description: "The user move (1-based) where a better line was available." },
          instead: { type: "string", description: "What the user could have said, written as a line they could actually say. One to three sentences." },
          why: { type: "string", description: "Why it would have worked against this counterpart, citing the hidden facts. One or two sentences." }
        },
        required: ["turn", "instead", "why"],
        additionalProperties: false
      },
      principles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", enum: PRINCIPLES },
            verdict: { type: "string", enum: ["used", "partly", "missed"] },
            evidence: { type: "string", description: "One sentence pointing at a specific turn." }
          },
          required: ["name", "verdict", "evidence"],
          additionalProperties: false
        }
      },
      one_thing: { type: "string", description: "The single most useful change for next time. One sentence, imperative." }
    },
    required: ["headline", "moves", "missed_line", "principles", "one_thing"],
    additionalProperties: false
  };
}

export function debriefSystem() {
  return `You are a negotiation coach reviewing a practice session. You have the full transcript, the counterpart's hidden brief (their true bottom line, priorities and private thoughts after every move), and a deterministic score of the final deal.

Write the review the way a strong chess coach annotates a game: move by move, specific, honest, brief. Chess marks:
- !! brilliant, changed the whole negotiation
- ! strong
- !? interesting, risky but reasonable
- ?! dubious, probably worse than the alternative
- ? a mistake
- ?? a blunder (for example accepting below walk-away, or giving away leverage for nothing)
- "" (empty) routine, nothing to say

Rules:
- Comment only on the user's moves. The counterpart's moves are context.
- Ground every comment in what actually happened. Quote or paraphrase the user's words where useful. Point at what it did to the counterpart's pressure or private thinking.
- Plain English. No jargon beyond the six principle names. No em dashes. No bullet points inside strings. No markdown.
- Be direct about mistakes and give credit where it is earned. Do not pad.
- Exactly one entry per user move, in order. Exactly six principle entries, one per principle name, in the order given.
- The missed line must be a concrete sentence the user could say, aimed at the specific hidden facts of this counterpart.`;
}

export async function debrief({ scenario, moves, outcome, score }) {
  const issues = scenario.issues.map((i) =>
    `- ${i.label}: opening ${formatValue(i, i.start)}, user's walk-away ${formatValue(i, i.playerRes)}, counterpart's true bottom line ${formatValue(i, i.themRes)}, agreed ${score.rows.find((r) => r.key === i.key)?.agreedText}`
  ).join("\n");

  const transcript = moves.map((m, idx) => {
    const n = idx + 1;
    const them = m.them
      ? `THEM (${m.them.demeanor}, pressure ${m.them.pressure}): ${m.them.say}\n   [private thought: ${m.them.private_note}]`
      : "THEM: (conversation ended)";
    return `Move ${n}\nUSER: ${m.you}\n${them}`;
  }).join("\n\n");

  const user = `SCENARIO: ${scenario.title}. ${scenario.setting}
User role: ${scenario.you.role}
Counterpart: ${scenario.counterpart.name}, ${scenario.counterpart.role}

COUNTERPART'S HIDDEN BRIEF
Persona: ${scenario.hidden.persona}
${scenario.hidden.facts.map((f) => `- ${f}`).join("\n")}
Tells: ${scenario.hidden.tells}

ISSUES AND NUMBERS
${issues}

USER'S PRIORITIES (weight): ${Object.entries(scenario.priorities).map(([k, w]) => `${k} ${w}`).join(", ")}

OUTCOME: ${outcome === "deal" ? "Deal reached." : outcome === "walked_user" ? "The user walked away." : "The counterpart ended the negotiation."}
Deterministic score: the user captured ${score.share}% of the available room, weighted by their priorities.${score.anyBelow ? " The user accepted at least one term worse than their own walk-away." : ""}

COUNTERPART'S OPENING LINE
${scenario.opening}

TRANSCRIPT (${moves.length} user moves)
${transcript}

Write the review.`;

  return structured({
    system: debriefSystem(),
    messages: [{ role: "user", content: user }],
    schema: debriefSchema(moves.length),
    effort: "high",
    maxTokens: 6000
  });
}
