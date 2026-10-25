// Deterministic scoring. No model involved.
//
// For each issue, the room is the interval between the player's walk-away
// (playerRes) and the counterpart's true bottom line (themRes). The player's
// share of that room is 0 at their own walk-away and 1 at the counterpart's
// bottom line. Values outside the interval are clamped, but we also report
// whether the player accepted something worse than their own walk-away,
// because that is the most common and most expensive mistake.

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function issueShare(issue, agreed) {
  const room = issue.themRes - issue.playerRes;
  if (room === 0) return 1;
  // For direction "low", playerRes > themRes, so the ratio is positive when the
  // agreed value sits below the player's walk-away, which is the good direction.
  // The same formula therefore works for both directions.
  return clamp01((agreed - issue.playerRes) / room);
}

export function belowWalkaway(issue, agreed) {
  return issue.direction === "high" ? agreed < issue.playerRes : agreed > issue.playerRes;
}

export function formatValue(issue, v) {
  if (v === null || v === undefined) return "not set";
  if (issue.kind === "option") return issue.options[v] ?? String(v);
  if (issue.kind === "money") return "$" + Number(v).toLocaleString("en-US");
  return `${v} ${issue.unit}`;
}

// Room left on the table, in the issue's own unit, from the player's point of view.
export function roomLeft(issue, agreed) {
  const left = issue.direction === "high" ? issue.themRes - agreed : agreed - issue.themRes;
  return Math.max(0, left);
}

export function scoreDeal(scenario, agreed) {
  const rows = scenario.issues.map((issue) => {
    const v = agreed[issue.key];
    const has = v !== null && v !== undefined;
    return {
      key: issue.key,
      label: issue.label,
      agreed: has ? v : null,
      agreedText: formatValue(issue, has ? v : null),
      themResText: formatValue(issue, issue.themRes),
      playerResText: formatValue(issue, issue.playerRes),
      startText: formatValue(issue, issue.start),
      share: has ? issueShare(issue, v) : 0,
      weight: scenario.priorities[issue.key] || 1,
      below: has ? belowWalkaway(issue, v) : false,
      roomLeft: has ? roomLeft(issue, v) : null,
      roomLeftText: has ? (issue.kind === "money" ? "$" + roomLeft(issue, v).toLocaleString("en-US")
        : issue.kind === "option" ? `${roomLeft(issue, v)} step${roomLeft(issue, v) === 1 ? "" : "s"}`
        : `${roomLeft(issue, v)} ${issue.unit}`) : null
    };
  });
  const totalWeight = rows.reduce((a, r) => a + r.weight, 0);
  const share = rows.reduce((a, r) => a + r.share * r.weight, 0) / totalWeight;
  return {
    share: Math.round(share * 100),
    anyBelow: rows.some((r) => r.below),
    rows
  };
}

export function scoreWalk(scenario) {
  return {
    share: 0,
    anyBelow: false,
    rows: scenario.issues.map((issue) => ({
      key: issue.key,
      label: issue.label,
      agreed: null,
      agreedText: "no deal",
      themResText: formatValue(issue, issue.themRes),
      playerResText: formatValue(issue, issue.playerRes),
      startText: formatValue(issue, issue.start),
      share: 0,
      weight: scenario.priorities[issue.key] || 1,
      below: false,
      roomLeft: null,
      roomLeftText: null
    }))
  };
}
