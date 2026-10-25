/* Counterparty front end. No framework. State lives in `S`; each view is a
   pure render of it. The game is also mirrored to localStorage so a refresh
   mid-negotiation does not lose the transcript. */

const S = {
  scenarios: [],
  scenario: null,     // public scenario object
  moves: [],          // [{ you, them: {say, demeanor, pressure, status, offer, private_note} | null }]
  pending: false,
  outcome: null,      // "deal" | "walked_user" | "walked_them"
  agreed: null,
  review: null,       // server debrief payload
  error: null
};

const $ = (sel) => document.querySelector(sel);
const views = { landing: $("#view-landing"), play: $("#view-play"), review: $("#view-review") };

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "hidden") node.hidden = Boolean(v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

function money(n) { return "$" + Number(n).toLocaleString("en-US"); }
function fmt(issue, v) {
  if (v === null || v === undefined) return "not yet stated";
  if (issue.kind === "option") return issue.options[v] ?? String(v);
  if (issue.kind === "money") return money(v);
  return `${v} ${issue.unit}`;
}

/* ---------- persistence ---------- */
const KEY = "counterparty.game.v1";
function save() {
  try {
    if (!S.scenario) { localStorage.removeItem(KEY); return; }
    localStorage.setItem(KEY, JSON.stringify({ id: S.scenario.id, moves: S.moves, outcome: S.outcome, agreed: S.agreed, review: S.review }));
  } catch (e) { /* storage unavailable: play on without it */ }
}
function restore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const g = JSON.parse(raw);
    const sc = S.scenarios.find((s) => s.id === g.id);
    if (!sc) return false;
    S.scenario = sc; S.moves = g.moves || []; S.outcome = g.outcome || null; S.agreed = g.agreed || null; S.review = g.review || null;
    return true;
  } catch (e) { return false; }
}

/* ---------- view switching ---------- */
function show(name) {
  for (const [k, v] of Object.entries(views)) v.hidden = k !== name;
  renderNav(name);
  window.scrollTo(0, 0);
}
function renderNav(name) {
  const nav = $("#nav");
  nav.replaceChildren();
  if (name === "landing") {
    nav.append(el("a", { href: "#how" }, "How it works"));
  } else {
    nav.append(el("button", { onclick: () => { if (confirmLeave()) goHome(); } }, "All situations"));
  }
}
function confirmLeave() {
  if (S.outcome || S.moves.length === 0) return true;
  return window.confirm("Leave this negotiation? The transcript will be discarded.");
}
function goHome() {
  S.scenario = null; S.moves = []; S.outcome = null; S.agreed = null; S.review = null; S.error = null; S.pending = false;
  save();
  renderLanding();
  show("landing");
}

/* ---------- landing ---------- */
function renderLanding() {
  const v = views.landing;
  v.replaceChildren(
    el("h1", null, "Practice a negotiation against someone with a number they will not tell you."),
    el("p", { class: "lede" },
      "Pick a situation and negotiate by typing. An AI plays the other side with a hidden bottom line, hidden priorities and a personality of its own. ",
      "When you close or walk away, you get the review: every move annotated, the numbers they were hiding, and the line you missed."),
    el("div", { class: "glossary" },
      el("div", null, el("span", { class: "term" }, "Walk-away"), el("span", { class: "def" }, "the worst deal you should accept")),
      el("div", null, el("span", { class: "term" }, "Bottom line"), el("span", { class: "def" }, "the worst deal they will accept")),
      el("div", null, el("span", { class: "term" }, "The room"), el("span", { class: "def" }, "everything between the two"))
    ),
    scenarioTable(),
    el("p", { class: "fine" }, "A full negotiation takes about five minutes and twelve moves at most. Each move is a live call to Claude; the other side's replies take a few seconds."),
    el("details", { id: "how" },
      el("summary", null, "Show how it works"),
      el("div", { class: "body" },
        el("p", null, "Each situation has two briefs. You see yours: your role, your alternatives, your walk-away and what you care about most. The AI sees the other one: the counterpart's true bottom line on every issue, what they secretly care about, their personality, and the tells that leak information when you ask the right question. It is instructed to negotiate in its own interest, concede only in response to reasons, trades or pressure, and never state its bottom line."),
        el("p", null, "Every reply comes back as structured data, not just text: what the counterpart says, how they come across, how much pressure they feel, their current standing offer on each issue, and one candid sentence of what they are actually thinking. During play you see only the words and the demeanor. Everything else is sealed until the end."),
        el("p", null, "When the negotiation ends, arithmetic scores the deal: for each issue, how far the agreed value sits between your walk-away and their bottom line, weighted by your stated priorities. Then a second model call reads the full transcript, the hidden brief and the score, and annotates your moves the way a chess coach annotates a game."))
    )
  );
}

function scenarioTable() {
  const tbody = el("tbody");
  for (const s of S.scenarios) {
    tbody.append(el("tr", { onclick: () => startScenario(s.id), tabindex: 0, role: "button",
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startScenario(s.id); } } },
      el("td", { class: "lab" }, s.title),
      el("td", null, s.setting),
      el("td", null, s.counterpart.name, el("br"), el("span", { class: "note" }, s.counterpart.role)),
      el("td", null, s.issues.map((i) => i.label).join(", ")),
      el("td", { class: "num" }, s.maxTurns),
      el("td", null, el("span", { class: "go" }, "Sit down"))
    ));
  }
  return el("div", { class: "sheet-wrap" },
    el("table", { class: "sheet pick", "aria-label": "Situations" },
      el("thead", null, el("tr", null,
        el("th", null, "Situation"), el("th", null, "What is going on"), el("th", null, "Across the table"),
        el("th", null, "Issues"), el("th", { class: "num" }, "Moves"), el("th", null, ""))),
      tbody));
}

/* ---------- play ---------- */
function startScenario(id) {
  const sc = S.scenarios.find((s) => s.id === id);
  if (!sc) return;
  S.scenario = sc; S.moves = []; S.outcome = null; S.agreed = null; S.review = null; S.error = null; S.pending = false;
  save();
  renderPlay();
  show("play");
  const ta = $("#composer-text");
  if (ta) ta.focus();
}

function currentOffer() {
  for (let i = S.moves.length - 1; i >= 0; i--) {
    if (S.moves[i].them && S.moves[i].them.offer) return S.moves[i].them.offer;
  }
  return null;
}
function currentDemeanor() {
  for (let i = S.moves.length - 1; i >= 0; i--) if (S.moves[i].them) return S.moves[i].them.demeanor;
  return null;
}

function renderPlay() {
  const sc = S.scenario;
  const v = views.play;
  const demeanor = currentDemeanor();
  const movesUsed = S.moves.length;
  const offer = currentOffer();

  const brief = el("aside", null,
    el("div", { class: "panel" },
      el("h3", null, "Your brief"),
      el("div", { class: "kv" },
        el("div", { class: "label" }, "You are"), el("div", null, sc.you.role),
        el("div", { class: "label" }, "Goal"), el("div", null, sc.you.goal)),
      el("ul", null, sc.you.brief.map((b) => el("li", null, b))),
      el("div", { class: "kv" },
        el("div", { class: "label" }, "Walk-away"), el("div", null, sc.you.walkaway))
    ),
    el("div", { class: "panel" },
      el("h3", null, "Their standing offer"),
      el("table", { class: "sheet", "aria-label": "Their standing offer" },
        el("thead", null, el("tr", null, el("th", null, "Issue"), el("th", null, "Opened at"), el("th", null, "Now"))),
        el("tbody", null, sc.issues.map((i) => el("tr", null,
          el("td", { class: "lab" }, i.label),
          el("td", null, fmt(i, i.start)),
          el("td", null, offer ? fmt(i, offer[i.key]) : fmt(i, i.start)))))),
      el("p", { class: "note", style: "margin-top:8px" }, "Updated from what they say. Their bottom line on each issue is hidden until the review.")
    )
  );

  const main = el("div", null,
    el("div", { class: "sheet-wrap" }, movesTable(false)),
    composer()
  );

  v.replaceChildren(
    el("div", { class: "namebar" },
      el("h1", null, sc.counterpart.name),
      el("div", { class: "meta" },
        el("span", null, sc.counterpart.role),
        el("span", { class: "chip" }, "Reads as ", el("b", null, demeanor || "unknown")),
        el("span", null, `Move ${Math.min(movesUsed + 1, sc.maxTurns)} of ${sc.maxTurns}`))),
    el("div", { class: "cols" }, brief, main)
  );
}

function movesTable(annotated) {
  const sc = S.scenario;
  const rev = annotated ? S.review?.review : null;
  const marks = new Map((rev?.moves || []).map((m) => [m.turn, m]));
  const missedTurn = rev?.missed_line?.turn;

  const head = el("tr", null,
    el("th", { class: "num" }, "#"),
    annotated ? el("th", null, "") : null,
    el("th", null, "You"),
    el("th", null, sc.counterpart.name.split(" ")[0]));

  const rows = [el("tr", { class: "opening" },
    el("td", { class: "n" }, "0"),
    annotated ? el("td", { class: "mark" }, "") : null,
    el("td", { class: "you note" }, "They open."),
    el("td", { class: "them" }, sc.opening))];

  S.moves.forEach((m, idx) => {
    const n = idx + 1;
    const a = marks.get(n);
    const youCell = el("td", { class: "you" }, m.you);
    if (annotated && a && a.comment) youCell.append(el("span", { class: "annot" }, a.comment));
    let themCell;
    if (m.them) {
      themCell = el("td", { class: "them" }, m.them.say);
      if (annotated) themCell.append(el("span", { class: "thought" },
        el("b", null, "Thinking: "), m.them.private_note,
        el("span", { class: "pressure" }, `pressure ${m.them.pressure}`)));
    } else if (S.pending && idx === S.moves.length - 1) {
      themCell = el("td", { class: "them waiting" }, el("i"), el("i"), el("i"), " thinking");
    } else {
      themCell = el("td", { class: "them note" }, S.outcome === "walked_user" ? "You walked away." : "The conversation ended.");
    }
    rows.push(el("tr", { class: annotated && missedTurn === n ? "missed" : null },
      el("td", { class: "n" }, n),
      annotated ? el("td", { class: `mark ${markClass(a?.mark)}`, title: markTitle(a?.mark) }, a?.mark || "") : null,
      youCell, themCell));
  });

  return el("table", { class: "sheet moves", "aria-label": "Scoresheet" }, el("thead", null, head), el("tbody", null, rows));
}

function markClass(m) {
  if (m === "!!" || m === "!") return "mark-good";
  if (m === "??" || m === "?" || m === "?!") return "mark-bad";
  if (m === "!?") return "mark-mixed";
  return "";
}
function markTitle(m) {
  return { "!!": "Brilliant", "!": "Strong", "!?": "Interesting", "?!": "Dubious", "?": "Mistake", "??": "Blunder" }[m] || "";
}

function composer() {
  const sc = S.scenario;
  const done = Boolean(S.outcome);
  const outOfMoves = S.moves.length >= sc.maxTurns;
  const ta = el("textarea", { id: "composer-text", placeholder: "Say something to " + sc.counterpart.name.split(" ")[0] + ".",
    maxlength: 800, disabled: S.pending || done || outOfMoves,
    onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCurrent(); } } });
  const offer = currentOffer();
  const canAccept = Boolean(offer) && !S.pending && !done && !outOfMoves;
  return el("div", { class: "composer" },
    ta,
    el("div", { class: "row" },
      el("button", { class: "btn primary", id: "send-btn", disabled: S.pending || done || outOfMoves, onclick: sendCurrent }, "Send"),
      el("button", { class: "btn", disabled: !canAccept, title: canAccept ? "Close on their current offer" : "Available once they have stated an offer", onclick: acceptOffer }, "Accept their offer"),
      el("button", { class: "btn quiet", disabled: S.pending || done, onclick: walkAway }, "Walk away"),
      el("span", { class: "hint" }, "Enter sends. Shift+Enter for a new line.")),
    S.error ? el("div", { class: "error" }, S.error) : null
  );
}

function historyForApi(extraUser) {
  const h = [];
  for (const m of S.moves) {
    h.push({ role: "user", content: m.you });
    if (m.them) h.push({ role: "assistant", content: m.them.say });
  }
  if (extraUser) h.push({ role: "user", content: extraUser });
  return h;
}

async function sendCurrent() {
  const ta = $("#composer-text");
  const text = (ta?.value || "").trim();
  if (!text) return;
  await send(text);
}

async function acceptOffer() {
  const sc = S.scenario;
  const offer = currentOffer();
  if (!offer) return;
  const terms = sc.issues.filter((i) => offer[i.key] !== null && offer[i.key] !== undefined)
    .map((i) => `${i.label.toLowerCase()} ${fmt(i, offer[i.key])}`).join(", ");
  await send(`I accept your current offer as it stands: ${terms}. Let's close on those terms.`);
}

async function send(text) {
  if (S.pending || S.outcome) return;
  S.error = null;
  S.pending = true;
  S.moves.push({ you: text, them: null });
  save();
  renderPlay();
  try {
    const res = await fetch("/api/turn", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: S.scenario.id, history: historyForApi() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    const t = data.turn;
    S.moves[S.moves.length - 1].them = t;
    S.pending = false;
    if (t.status === "deal") { S.outcome = "deal"; S.agreed = t.agreed; }
    else if (t.status === "walked") { S.outcome = "walked_them"; }
    else if (S.moves.length >= S.scenario.maxTurns) { S.outcome = "walked_them"; }
    save();
    if (S.outcome) { renderPlay(); await finish(); return; }
    renderPlay();
    const ta = $("#composer-text");
    if (ta) ta.focus();
  } catch (err) {
    // Roll the move back so the user can retry.
    S.moves.pop();
    S.pending = false;
    S.error = `Could not reach the other side: ${err.message}`;
    save();
    renderPlay();
    const ta = $("#composer-text");
    if (ta) { ta.value = text; ta.focus(); }
  }
}

async function walkAway() {
  if (S.pending || S.outcome) return;
  if (!window.confirm("Walk away from the table? The negotiation ends and the review begins.")) return;
  if (S.moves.length === 0) {
    S.moves.push({ you: "(walks away without a word)", them: null });
  }
  S.outcome = "walked_user";
  save();
  renderPlay();
  await finish();
}

/* ---------- review ---------- */
async function finish() {
  renderReviewLoading();
  show("review");
  try {
    const res = await fetch("/api/debrief", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: S.scenario.id, moves: S.moves, outcome: S.outcome, agreed: S.agreed })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    S.review = data;
    save();
    renderReview();
  } catch (err) {
    views.review.replaceChildren(
      el("div", { class: "namebar" }, el("h1", null, "Review"), el("div", { class: "meta" }, el("span", null, S.scenario.title))),
      el("div", { class: "error" }, `The review could not be generated: ${err.message}`),
      el("div", { class: "actions" },
        el("button", { class: "btn primary", onclick: finish }, "Try again"),
        el("button", { class: "btn", onclick: goHome }, "All situations")));
  }
}

function renderReviewLoading() {
  const n = S.moves.length;
  views.review.replaceChildren(
    el("div", { class: "namebar" },
      el("h1", null, `Review: ${S.scenario.title}`),
      el("div", { class: "meta" }, el("span", null, `against ${S.scenario.counterpart.name}`), el("span", null, `${n} move${n === 1 ? "" : "s"}`))),
    el("div", { class: "empty waiting" }, el("i"), el("i"), el("i"),
      ` Reading ${n} move${n === 1 ? "" : "s"} against the hidden brief. This takes about twenty seconds.`),
    el("div", { class: "sheet-wrap", style: "margin-top:14px" }, movesTable(false))
  );
}

function outcomeText() {
  if (S.outcome === "deal") return "Deal";
  if (S.outcome === "walked_user") return "You walked";
  return "No deal";
}

function renderReview() {
  const sc = S.scenario;
  const R = S.review;
  const rev = R.review;
  const score = R.score;
  const n = S.moves.length;
  const pressures = S.moves.filter((m) => m.them).map((m) => m.them.pressure);
  const peak = pressures.length ? Math.max(...pressures) : null;
  const peakMove = peak === null ? null : S.moves.findIndex((m) => m.them && m.them.pressure === peak) + 1;

  const strip = el("div", { class: "strip" },
    el("div", null, el("span", { class: "label" }, "Result"), el("span", { class: "val" }, outcomeText())),
    el("div", null, el("span", { class: "label" }, "Share of the room"), el("span", { class: "val" }, S.outcome === "deal" ? `${score.share}%` : "0%")),
    el("div", null, el("span", { class: "label" }, "Moves"), el("span", { class: "val" }, n)),
    el("div", null, el("span", { class: "label" }, "Their peak pressure"), el("span", { class: "val" }, peak === null ? "n/a" : `${peak} at move ${peakMove}`)),
    el("div", null, el("span", { class: "label" }, "Walk-away"), el("span", { class: `val ${score.anyBelow ? "neg" : ""}` }, score.anyBelow ? "Crossed" : "Held"))
  );

  const reveal = el("div", { class: "sheet-wrap" }, el("table", { class: "sheet tight", "aria-label": "What they were hiding" },
    el("thead", null, el("tr", null,
      el("th", null, "Issue"), el("th", null, "Opened"), el("th", null, "Agreed"),
      el("th", null, "Bottom line"), el("th", null, "Left over"))),
    el("tbody", null, score.rows.map((r) => el("tr", null,
      el("td", { class: "lab" }, r.label),
      el("td", null, r.startText),
      el("td", { class: r.below ? "neg" : "" }, r.agreedText + (r.below ? " (below your walk-away)" : "")),
      el("td", null, r.themResText),
      el("td", null, r.roomLeftText ?? "n/a"))))));

  const left = el("div", null,
    el("h3", null, "Pressure on them, by move"),
    pressureChart(),
    el("p", { class: "note", style: "margin-top:6px" }, "Their own 0 to 100 read of how close they were to conceding more, recorded after each of your moves and sealed until now."),
    el("h3", { style: "margin-top:16px" }, "What they were hiding"),
    reveal,
    el("p", { class: "note", style: "margin-top:6px" },
      "Share of the room is where each agreed value sits between your walk-away and their bottom line, weighted by your priorities (",
      sc.issues.map((i) => `${i.label.toLowerCase()} ${sc.priorities[i.key]}`).join(", "), ").")
  );

  const right = el("div", null,
    el("h3", null, "The scoresheet, annotated"),
    el("div", { class: "sheet-wrap" }, movesTable(true)),
    el("p", { class: "note", style: "margin-top:6px" }, "Marks follow chess convention: !! brilliant, ! strong, !? interesting, ?! dubious, ? mistake, ?? blunder. The outlined move is where a better line was available.")
  );

  const missed = rev.missed_line;
  const missedBlock = el("div", { class: "block" },
    el("h3", null, `The line you missed, at move ${missed.turn}`),
    el("p", { class: "note" }, "What you said:"),
    el("div", { class: "quote" }, S.moves[missed.turn - 1]?.you || ""),
    el("p", { class: "note" }, "What you could have said:"),
    el("div", { class: "quote", style: "border-left-color: var(--accent)" }, missed.instead),
    el("p", null, missed.why));

  const principles = el("div", { class: "sheet-wrap" }, el("table", { class: "sheet", "aria-label": "Principles" },
    el("thead", null, el("tr", null, el("th", null, "Principle"), el("th", null, "Verdict"), el("th", null, "Evidence"))),
    el("tbody", null, rev.principles.map((p) => el("tr", null,
      el("td", { class: "lab" }, p.name),
      el("td", { class: `verdict-${p.verdict}` }, p.verdict),
      el("td", null, p.evidence))))));

  const hiddenBrief = el("details", null,
    el("summary", null, `Show ${sc.counterpart.name.split(" ")[0]}'s full hidden brief`),
    el("div", { class: "body" },
      el("p", null, el("b", null, "Persona. "), R.hidden.persona),
      el("ul", null, R.hidden.facts.map((f) => el("li", null, f))),
      el("p", null, el("b", null, "Tells. "), R.hidden.tells)));

  views.review.replaceChildren(
    el("div", { class: "namebar" },
      el("h1", null, `Review: ${sc.title}`),
      el("div", { class: "meta" }, el("span", null, `against ${sc.counterpart.name}`), el("span", null, `${n} move${n === 1 ? "" : "s"}`), el("span", null, outcomeText()))),
    el("p", { class: "lede" }, rev.headline),
    strip,
    el("div", { class: "cols even", style: "margin-top:18px" }, left, right),
    missedBlock,
    el("h3", { style: "margin-top:18px" }, "Six habits, checked"),
    principles,
    el("div", { class: "block" }, el("h3", null, "Next time"), el("p", { style: "margin:0;color:var(--ink)" }, rev.one_thing)),
    hiddenBrief,
    el("div", { class: "actions" },
      el("button", { class: "btn primary", onclick: () => startScenario(sc.id) }, "Play this again"),
      el("button", { class: "btn", onclick: goHome }, "Try another situation")),
    el("p", { class: "fine" }, `Review written by ${R.model}. Score computed locally from the hidden brief.`)
  );
}

/* Single-series line: pressure (0 to 100) per move. One axis. Hover tooltip. */
function pressureChart() {
  const pts = S.moves.map((m, i) => ({ x: i + 1, y: m.them ? m.them.pressure : null, note: m.them?.private_note || "", say: m.you }))
    .filter((p) => p.y !== null);
  const wrap = el("div", { class: "chart" });
  if (pts.length === 0) {
    wrap.append(el("div", { class: "empty" }, "No replies to chart."));
    return wrap;
  }
  const W = 520, H = 170, L = 30, R = 12, T = 14, B = 26;
  const xmax = Math.max(pts.length, S.moves.length, 2);
  const xs = (x) => L + ((x - 1) / (xmax - 1)) * (W - L - R);
  const ys = (y) => T + (1 - y / 100) * (H - T - B);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Pressure on the counterpart after each of your moves");
  const ns = (tag, attrs, text) => {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  for (const y of [0, 50, 100]) {
    svg.append(ns("line", { class: "axis", x1: L, x2: W - R, y1: ys(y), y2: ys(y) }));
    svg.append(ns("text", { class: "tick", x: L - 6, y: ys(y) + 3, "text-anchor": "end" }, y));
  }
  for (let x = 1; x <= xmax; x++) {
    svg.append(ns("text", { class: "tick", x: xs(x), y: H - 8, "text-anchor": "middle" }, x));
  }
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xs(p.x).toFixed(1)},${ys(p.y).toFixed(1)}`).join(" ");
  svg.append(ns("path", { class: "line", d }));
  const peak = Math.max(...pts.map((p) => p.y));
  const peakPt = pts.find((p) => p.y === peak);
  for (const p of pts) svg.append(ns("circle", { class: `dot${p === peakPt ? " peak" : ""}`, cx: xs(p.x), cy: ys(p.y), r: 4 }));
  svg.append(ns("text", { class: "dlabel", x: Math.min(xs(peakPt.x) + 8, W - R - 70), y: Math.max(ys(peakPt.y) - 8, 11) }, `peak ${peak}, move ${peakPt.x}`));

  const cross = ns("line", { class: "cross", x1: 0, x2: 0, y1: T, y2: H - B, visibility: "hidden" });
  svg.append(cross);
  const tip = el("div", { class: "tip", hidden: true });
  const hit = ns("rect", { class: "hit", x: L, y: 0, width: W - L - R, height: H });
  hit.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    let best = pts[0];
    for (const p of pts) if (Math.abs(xs(p.x) - sx) < Math.abs(xs(best.x) - sx)) best = p;
    cross.setAttribute("x1", xs(best.x)); cross.setAttribute("x2", xs(best.x)); cross.setAttribute("visibility", "visible");
    tip.replaceChildren(el("b", null, `Move ${best.x}: pressure ${best.y}`), el("br"), best.note);
    tip.hidden = false;
    const px = (xs(best.x) / W) * rect.width;
    tip.style.left = Math.min(px + 10, rect.width - 270) + "px";
    tip.style.top = (ys(best.y) / H) * rect.height - 10 + "px";
  });
  hit.addEventListener("mouseleave", () => { cross.setAttribute("visibility", "hidden"); tip.hidden = true; });
  svg.append(hit);
  wrap.append(svg, tip);
  return wrap;
}

/* ---------- boot ---------- */
async function boot() {
  $("#home-link").addEventListener("click", (e) => { e.preventDefault(); if (confirmLeave()) goHome(); });
  try {
    const res = await fetch("/api/scenarios");
    const data = await res.json();
    S.scenarios = data.scenarios;
  } catch (err) {
    views.landing.replaceChildren(el("div", { class: "error" }, "Could not load the situations. Refresh to try again."));
    show("landing");
    return;
  }
  if (restore()) {
    if (S.review) { renderReview(); show("review"); }
    else if (S.outcome) { renderPlay(); show("play"); finish(); }
    else { renderPlay(); show("play"); }
  } else {
    renderLanding();
    show("landing");
  }
}
boot();
