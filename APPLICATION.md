# Application write-up (draft)

A draft answer for the Mays Applied AI Fellow prompt, "describe something you have built with AI." Edit it into your own voice, add the live link once deployed, and cut anything you would not say out loud.

---

**Counterparty: a negotiation sparring partner with a hidden bottom line**

Live demo: [link]. Source: https://github.com/s155003/counterparty

Most people never practice negotiating. The few who do practice against a friend who knows the answer, or against a chatbot that folds the moment you push. I built Counterparty to fix the second problem: an AI counterpart that has a real reservation price, real priorities it will not volunteer, and a personality, and that only moves when you give it a reason.

You pick one of five situations: a new-grad job offer, a used car, a software renewal, a rent increase, a freelance quote. You see your own brief: your alternatives, your walk-away, what you care about most. The model sees the other brief: the counterpart's true bottom line on every issue, what they secretly need, and the "tells" that leak information if you ask the right question. Then you negotiate by typing.

The part I am proudest of is what happens underneath. Every reply from the counterpart is a structured object, not free text: what they say, how they come across, a 0 to 100 reading of how much pressure they feel, their standing offer on each issue, and one candid sentence of what they are actually thinking. During play you only see the words and the demeanor. Everything else is sealed. When you close or walk away, plain arithmetic scores the deal: for each issue, how far the agreed value sits between your walk-away and their bottom line, weighted by your priorities. A second model call then reads the whole transcript against the hidden brief and annotates your moves the way a chess coach annotates a game, with `!!` through `??`, the move where a better line existed, the exact sentence you could have said, and six negotiation habits checked against specific turns.

What I learned building it: the hard part of an AI product is rarely the model call. It is deciding what the model should decide and what the code should decide. The model plays the character and writes the review, because those need judgment. The code holds the hidden numbers, computes the score, and enforces the rules, because those need to be true every time. Structured outputs made that split clean: the model fills in a schema, the code trusts the schema.

It is built with vanilla JavaScript, Node serverless functions and the Claude API (Opus 5.5, structured outputs, prompt caching). The scoring is about forty lines and has no AI in it. Limits I know about: the pressure number is the model's self-report in character, and the scenarios are fictional and tuned so a deal is always possible.

---

Word count of the section between the rules: about 430. Trim to the form's limit.
