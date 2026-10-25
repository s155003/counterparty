# Counterparty

Practice a negotiation against an AI counterpart that has a number it will not tell you. When you close or walk away, you get a chess-style review: every move annotated, the numbers they were hiding, and the line you missed.

## How it works

Each of the five situations (a job offer, a used car, a software renewal, a rent increase, a freelance quote) has two briefs.

- **You see yours**: your role, your alternatives, your walk-away, and what you care about most.
- **The model sees the other one**: the counterpart's true bottom line on every issue, their hidden priorities, a personality, and the "tells" that leak information when you ask the right question.

Every reply from the counterpart is a structured object, not free text: what they say, how they come across, a 0 to 100 pressure reading, their standing offer on each issue, and one candid sentence of what they are actually thinking. During play you see only the words and the demeanor. The rest is sealed until the review.

When the negotiation ends, plain arithmetic scores the deal (`lib/score.js`): for each issue, how far the agreed value sits between your walk-away and their bottom line, weighted by your stated priorities. A second model call then reads the transcript, the hidden brief and the score, and annotates your moves with chess marks (`!!` to `??`), names the move where a better line existed and writes that line out, and checks six negotiation habits against specific turns.

## Stack

- Vanilla HTML, CSS and JavaScript. No framework, no build step.
- Node 22 serverless functions in `api/` (Vercel layout). `server.js` runs the same handlers locally.
- Claude Opus 5.5 through the official `@anthropic-ai/sdk`, with structured outputs (`output_config.format`), prompt caching on the system prompt, adaptive thinking at low effort for turns and high effort for the review, and server-side refusal fallbacks.

## Run it locally

```
npm install
set ANTHROPIC_API_KEY=sk-ant-...      # PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..."
npm run dev
```

Open http://localhost:3000.

## Deploy

The project is laid out for Vercel. From the project folder:

```
npx vercel login
npx vercel --prod
```

Add `ANTHROPIC_API_KEY` as an environment variable in the Vercel project settings (or `npx vercel env add ANTHROPIC_API_KEY production`) and redeploy.

## Verify

```
npm run verify
```

`scripts/verify.mjs` opens the app in a real headless Chrome, plays two moves of "The offer", accepts the counterpart's offer, waits for the review, and saves screenshots to `screenshots/`. It fails on any console error, page error, failed request, literal `undefined` or `NaN` on the page, em dash in rendered text, or horizontal overflow at phone width.

`scripts/smoke.mjs` exercises both model calls without a browser.

## Cost

A full twelve-move negotiation plus review costs roughly $0.25 to $0.40 in API usage at Opus 5.5 pricing, mostly from the review's higher effort setting. Set a spend limit on the API key before sharing the link widely.

## Known limits

- The counterpart's pressure number is the model's self-report in character, not a measured quantity. It is useful for the review and should be read that way.
- There is no rate limiting on the endpoints beyond the twelve-move cap and an 800-character message limit. For a public demo, rely on the API key's spend limit.
- Scenario numbers are fictional and tuned so a deal is always possible. Real counterparts are not guaranteed to have a bottom line above your walk-away.
