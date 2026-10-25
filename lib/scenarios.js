// Five negotiation scenarios. Each has a public side (what the player sees)
// and a hidden side (what the AI counterpart knows and the player does not).
//
// Issue fields:
//   key          stable identifier used in model output and scoring
//   label        shown in the UI
//   kind         "money" | "number" | "option"
//   unit         display unit for money/number ("$", "$/seat", "weeks", ...)
//   direction    "high" means a higher value is better for the player
//   start        the counterpart's opening position
//   playerRes    the player's walk-away value (worst they should accept)
//   themRes      the counterpart's true bottom line (hidden from the player)
//   options      for kind "option": index-ordered labels. Values are indices.
//
// The gap between playerRes and themRes is the room (ZOPA). Scoring measures
// how much of that room the player captured, weighted by their priorities.

export const SCENARIOS = [
  {
    id: "offer",
    title: "The offer",
    setting: "A new-grad software offer that came in under your other option.",
    counterpart: { name: "Priya Natarajan", role: "Engineering manager, Larkspur Payments" },
    you: {
      role: "Graduating senior with an offer letter from Larkspur Payments (Austin)",
      goal: "Improve the offer without losing it.",
      brief: [
        "The letter: $88,000 base, no signing bonus, start date June 2.",
        "You have a verbal offer from a smaller startup at $92,000. You would rather be at Larkspur, but not for less than $90,000.",
        "You want to start in mid-July. You have a trip booked through July 10 and would prefer not to cancel it.",
        "Priorities: base salary matters most, then start date, then a signing bonus."
      ],
      walkaway: "Below $90,000 base, take the startup."
    },
    issues: [
      { key: "base", label: "Base salary", kind: "money", unit: "$", direction: "high", start: 88000, playerRes: 90000, themRes: 104000 },
      { key: "signing", label: "Signing bonus", kind: "money", unit: "$", direction: "high", start: 0, playerRes: 0, themRes: 8000 },
      { key: "start", label: "Start date", kind: "option", direction: "high", start: 0, playerRes: 0, themRes: 3,
        options: ["June 2", "June 16", "June 30", "July 14"] }
    ],
    priorities: { base: 3, start: 2, signing: 1 },
    hidden: {
      persona: "Warm, process-minded, a little tired. Likes this candidate. Opens by calling the band 'pretty fixed' even though it is not. Stalls with 'I would need to check on that' when pushed too fast, but moves when given a concrete reason or a competing number.",
      facts: [
        "The band for this level runs $85,000 to $108,000. You can approve up to $104,000 without escalating.",
        "There is a signing-bonus pool of up to $8,000 per hire that expires at the end of the quarter. You would rather give signing bonus than base, because base compounds.",
        "You need someone productive before a July 1 launch. A June 16 start is ideal. July 14 is painful but survivable; you would trade it for a lower base.",
        "Two reqs are open and one candidate already declined last week. Losing this one would mean restarting a six-week search.",
        "You will not reveal the band ceiling or the bonus pool unless the candidate asks a direct, specific question that your character would plausibly answer."
      ],
      tells: "Mentions the July launch early if asked about the team's timeline. Softens noticeably when the candidate names the competing offer with a number."
    },
    opening: "Hi, thanks for making time. I know you have the letter in front of you: $88,000 base and a June 2 start. I will be honest, our new-grad band is pretty fixed, but I wanted to hear what you are thinking before anything gets signed. What is on your mind?",
    maxTurns: 12
  },

  {
    id: "civic",
    title: "The Civic",
    setting: "A private-party used car, listed above what you want to pay.",
    counterpart: { name: "Marcus Bell", role: "Private seller" },
    you: {
      role: "Buyer, looking at a 2019 Honda Civic EX with 61,000 miles",
      goal: "Buy the car for a fair price before the weekend.",
      brief: [
        "Listed at $17,500. Comparable private sales in your area have closed between $15,800 and $17,200.",
        "A dealer across town has a similar car at $18,400 with a 90-day warranty. That is your fallback.",
        "The listing shows a set of winter tires and a roof rack in the garage. You would use both.",
        "You want your own mechanic to look at it before money changes hands.",
        "Priorities: price first, then the inspection, then the extras."
      ],
      walkaway: "Above $16,800, go to the dealer."
    },
    issues: [
      { key: "price", label: "Price", kind: "money", unit: "$", direction: "low", start: 17500, playerRes: 16800, themRes: 15300 },
      { key: "extras", label: "Included extras", kind: "option", direction: "high", start: 0, playerRes: 0, themRes: 2,
        options: ["None", "Winter tires", "Tires and roof rack"] },
      { key: "inspection", label: "Pre-sale inspection", kind: "option", direction: "high", start: 0, playerRes: 0, themRes: 1,
        options: ["No", "Yes, at your mechanic"] }
    ],
    priorities: { price: 3, inspection: 2, extras: 1 },
    hidden: {
      persona: "Friendly, talkative, slightly rushed. Proud of how he maintained the car. Says 'I have another guy coming Thursday' early on, which is half true: someone texted and never confirmed. Dislikes feeling lowballed but responds well to a buyer who is ready to transact.",
      facts: [
        "You are moving to Denver on Saturday. The car has to be sold or stored by then, and storage would cost $180 a month plus hassle.",
        "Your true floor is $15,300. You told yourself $16,000 but you will take less to be done.",
        "The winter tires and roof rack are worth nothing to you; you cannot take them. You will throw them in before you cut price, and you will act like it is a concession.",
        "An inspection is fine as long as it happens tomorrow. You have nothing to hide; the car had a new battery in March.",
        "You will not say the floor out loud. You will reveal the move if asked why you are selling."
      ],
      tells: "Gets noticeably more flexible when the buyer mentions paying cash this week. Mentions the move if asked directly why he is selling."
    },
    opening: "Hey, thanks for coming by. So that is the Civic, 2019 EX, 61k, one owner, that was me. I am asking $17,500 and honestly I have another guy who said he might come Thursday, so I am not in a rush to drop it. You want to take it around the block?",
    maxTurns: 12
  },

  {
    id: "renewal",
    title: "The renewal",
    setting: "A software renewal where the vendor wants a price increase.",
    counterpart: { name: "Dana Whitfield", role: "Account executive, Cadence" },
    you: {
      role: "Head of operations at Fieldnote, a 42-person company on Cadence project software",
      goal: "Renew without the increase, and get better support.",
      brief: [
        "You pay $48 per seat per month on a one-year term. The renewal proposal is $55 per seat, their list price.",
        "A competitor quoted $36 per seat. Switching would cost about two weeks of your team's time and some goodwill, so you would only do it above $46.",
        "Your team complains about support response times. You are on the standard tier. Priority support would help.",
        "You prefer a one-year term. A two-year term is acceptable if the price is right.",
        "Priorities: price first, then support tier, then term length."
      ],
      walkaway: "Above $46 per seat, start the migration to the competitor."
    },
    issues: [
      { key: "price", label: "Price per seat per month", kind: "money", unit: "$", direction: "low", start: 55, playerRes: 46, themRes: 39 },
      { key: "support", label: "Support tier", kind: "option", direction: "high", start: 0, playerRes: 0, themRes: 1,
        options: ["Standard", "Priority"] },
      { key: "term", label: "Term", kind: "option", direction: "high", start: 1, playerRes: 1, themRes: 0,
        options: ["Two years", "One year"] }
    ],
    priorities: { price: 3, support: 2, term: 1 },
    hidden: {
      persona: "Upbeat, polished, uses urgency and social proof. Says 'pricing goes up next quarter' and name-drops other customers. Has been coached to push two-year terms. Becomes very accommodating once she believes the deal will close before her quarter ends.",
      facts: [
        "Your quarter closes in nine days and you are one logo short of quota, where an accelerator kicks in. This renewal counts.",
        "Your floor is $40 per seat on a one-year term and $37 on a two-year term. Anything above $44 is a great outcome for you.",
        "Priority support costs you nothing to add. Your manager approves it with one click. You present it as a big ask.",
        "The competitor at $36 is real and you know it; you have lost two accounts to them this year.",
        "You will not reveal quota or quarter timing unless asked something that makes it natural to admit."
      ],
      tells: "Asks about signing 'this week' more than once. Gives in on support quickly if the customer frames it as the thing that keeps them from migrating."
    },
    opening: "Great to connect! So, your renewal is coming up on the 15th. Pricing across the board is moving to $55 a seat for new terms, and I managed to hold your tier at list rather than the new rate that kicks in next quarter. I also put together a two-year option that locks that in. How is the team liking Cadence?",
    maxTurns: 12
  },

  {
    id: "lease",
    title: "The lease",
    setting: "A rent increase on an apartment you would rather not leave.",
    counterpart: { name: "Gloria Reyes", role: "Owner, three rental units" },
    you: {
      role: "Tenant of two years in a one-bedroom, renewal due",
      goal: "Keep the apartment without paying the full increase.",
      brief: [
        "Current rent is $1,450. The renewal letter proposes $1,625, a 12% increase.",
        "A comparable unit across town lists at $1,500, but moving would cost about $1,200 and a weekend. You would stay here up to $1,560.",
        "The dishwasher has been broken for a month and the living room needs repainting. Both were promised and neither has happened.",
        "You prefer a 12-month lease. 18 months is acceptable.",
        "Priorities: rent first, then the repairs, then lease length."
      ],
      walkaway: "Above $1,560, take the unit across town."
    },
    issues: [
      { key: "rent", label: "Monthly rent", kind: "money", unit: "$", direction: "low", start: 1625, playerRes: 1560, themRes: 1500 },
      { key: "repairs", label: "Repairs", kind: "option", direction: "high", start: 0, playerRes: 0, themRes: 2,
        options: ["None promised", "Dishwasher fixed", "Dishwasher and repaint"] },
      { key: "term", label: "Lease length", kind: "option", direction: "high", start: 1, playerRes: 0, themRes: 0,
        options: ["18 months", "12 months"] }
    ],
    priorities: { rent: 3, repairs: 2, term: 1 },
    hidden: {
      persona: "Polite, a little wounded by pushback. Reminds the tenant she kept rent flat for two years. Values being appreciated and a tenant who pays on time. Does not like confrontation and will offer small things to end it.",
      facts: [
        "A vacancy costs you about $2,400 once you count a month empty, cleaning, and listing. You badly want this tenant to stay.",
        "You would accept $1,500 on a 12-month lease and $1,475 on an 18-month lease. You started at $1,625 because your property tax went up and because you expected a counter.",
        "The dishwasher is your legal obligation and you will fix it either way, but you would rather not be reminded. Repainting costs you about $600; you would trade it for an 18-month commitment.",
        "The unit across town at $1,500 is real; you saw the listing.",
        "You will not reveal the vacancy cost. You will admit the tax increase if asked why rent is going up."
      ],
      tells: "Softens when thanked for the two flat years. Mentions the tax bill when asked for a reason. Offers the dishwasher fix as if it were a gift."
    },
    opening: "Hi, come in. I got your message about the renewal. I know $1,625 is a jump, and I want you to know I held your rent flat for two years when I did not have to. Costs have just gone up. I would love for you to stay. What were you hoping for?",
    maxTurns: 12
  },

  {
    id: "project",
    title: "The project",
    setting: "A freelance quote where the client has already named a low number.",
    counterpart: { name: "Tobias Lund", role: "Marketing director, Halden Outdoor" },
    you: {
      role: "Freelance brand and web designer",
      goal: "Win the project at a fee and timeline you can deliver well.",
      brief: [
        "The job: a brand refresh and a five-page website. Tobias suggested $5,500, four weeks, unlimited revisions.",
        "Your rate works out to about $7,000 for six weeks. Four weeks is possible but means nights and weekends.",
        "Unlimited revisions have burned you before. You want revisions capped at two rounds per deliverable.",
        "You have one other lead this month, smaller and less interesting.",
        "Priorities: fee first, then timeline, then the revision cap."
      ],
      walkaway: "Below $7,000, or unlimited revisions at four weeks, pass."
    },
    issues: [
      { key: "fee", label: "Fee", kind: "money", unit: "$", direction: "high", start: 5500, playerRes: 7000, themRes: 9500 },
      { key: "weeks", label: "Timeline", kind: "number", unit: "weeks", direction: "high", start: 4, playerRes: 4, themRes: 6 },
      { key: "revisions", label: "Revision rounds", kind: "option", direction: "high", start: 0, playerRes: 0, themRes: 2,
        options: ["Unlimited", "Three rounds", "Two rounds"] }
    ],
    priorities: { fee: 3, weeks: 2, revisions: 1 },
    hidden: {
      persona: "Busy, decisive, speaks in short sentences. Respects people who state a number and hold it with a reason. Mild allergy to being 'sold'. Has been burned by a freelancer who vanished mid-project, so structure and milestones reassure him.",
      facts: [
        "Your approved budget is $9,500. An agency quoted $14,000 for the same scope, which is why you are talking to a freelancer.",
        "The real deadline is a trade show in seven weeks. Six weeks is fine. You said four because you pad everything.",
        "'Unlimited revisions' is a habit from past contracts. You do not actually need it; two rounds with a clear sign-off process is fine.",
        "If this freelancer walks you will have to go back to the agency and ask for more budget, which you would hate.",
        "You will not reveal the budget. You will reveal the trade show if asked what is driving the timeline."
      ],
      tells: "Relaxes on timeline when asked what the deadline is actually for. Agrees to a revision cap quickly if a sign-off process is proposed. Responds to the agency comparison if the designer asks what else was quoted."
    },
    opening: "Thanks for the quick turnaround on the portfolio. Here is where I am: brand refresh plus a five-page site, $5,500, four weeks, and we will need revisions until it is right. I know that is tight. Can you make that work?",
    maxTurns: 12
  }
];

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}

// What the browser is allowed to see before the review: everything except `hidden`.
export function publicScenario(s) {
  const { hidden, ...rest } = s;
  const issues = rest.issues.map(({ themRes, ...issue }) => issue);
  return { ...rest, issues };
}
