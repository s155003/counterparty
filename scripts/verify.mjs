// Renders the app in a real browser, drives a short negotiation, and saves
// screenshots. Fails on console errors, page errors, or failed requests.
// Usage: node scripts/verify.mjs [baseUrl]   (default http://localhost:3000)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = path.resolve("screenshots");
fs.mkdirSync(OUT, { recursive: true });

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
if (!CHROME) throw new Error("No Chrome or Edge found");

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1240, height: 900, deviceScaleFactor: 1 });

const problems = [];
page.on("console", (m) => { if (m.type() === "error") problems.push(`console.error: ${m.text()}`); });
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true });
  console.log("saved", name);
}
async function visible(sel) {
  return page.$eval(sel, (n) => {
    const r = n.getBoundingClientRect();
    const cs = getComputedStyle(n);
    return r.width > 0 && r.height > 0 && cs.opacity !== "0" && cs.visibility !== "hidden";
  }).catch(() => false);
}
function assert(cond, msg) { if (!cond) problems.push(`assert: ${msg}`); }

await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.waitForSelector("table.pick tbody tr");
assert(await visible("h1"), "landing h1 visible");
assert((await page.$$("table.pick tbody tr")).length === 5, "five scenarios listed");
assert((await page.$$("#view-landing .strip")).length === 0, "no summary strip before a choice");
await shot("1-landing");

// Mobile check of landing
await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 1 });
await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
assert(overflow <= 1, `no horizontal overflow on mobile (got ${overflow})`);
await shot("1b-landing-mobile");
await page.setViewport({ width: 1240, height: 900, deviceScaleFactor: 1 });

// Start "The offer"
await page.click("table.pick tbody tr:first-child");
await page.waitForSelector("#composer-text");
assert(await visible(".namebar h1"), "play name bar visible");
assert(await visible("table.moves"), "scoresheet visible");
await shot("2-play-empty");

const lines = [
  "Thanks Priya. Before we talk numbers, what is the team working toward this summer? I want to understand the timeline you are hiring for.",
  "That helps. I should be straightforward: I have another offer at $92,000. I would rather be at Larkspur, but I need the base to reflect that. Could you do $100,000? I can also start June 30 so I am ramped before the launch.",
];
for (const line of lines) {
  await page.type("#composer-text", line);
  await page.click("#send-btn");
  await page.waitForSelector("td.waiting");
  if (line === lines[0]) await shot("3-play-waiting");
  await page.waitForFunction(() => !document.querySelector("td.waiting"), { timeout: 90000 });
}
assert((await page.$$("table.moves tbody tr")).length === 3, "opening plus two moves on the sheet");
await shot("4-play-two-moves");

// Accept their current offer, which should close the deal and trigger the review.
const acceptBtn = await page.$("button.btn:not(.primary):not(.quiet)");
const acceptDisabled = await acceptBtn.evaluate((b) => b.disabled);
assert(!acceptDisabled, "accept button enabled after an offer exists");
await acceptBtn.click();
await page.waitForFunction(() => !document.getElementById("view-review").hidden, { timeout: 90000 });
await shot("5-review-loading");
await page.waitForSelector("#view-review .strip", { timeout: 120000 });
await page.waitForSelector("#view-review .chart svg path.line");
assert(await visible("#view-review .chart svg"), "pressure chart visible");
assert((await page.$$("#view-review table.moves td.mark")).length >= 3, "marks column rendered");
assert((await page.$$("#view-review tbody tr")).length > 5, "review tables populated");
const undef = await page.evaluate(() => document.body.innerText.includes("undefined") || document.body.innerText.includes("NaN"));
assert(!undef, "no literal undefined/NaN on the review page");
const emdash = await page.evaluate(() => document.body.innerText.includes("\u2014"));
assert(!emdash, "no em dash rendered");
await shot("6-review");

// Hover the chart to show the tooltip
const rect = await page.$eval("#view-review .chart svg", (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await page.mouse.move(rect.x + rect.w * 0.5, rect.y + rect.h * 0.5);
await page.waitForFunction(() => { const t = document.querySelector(".tip"); return t && !t.hidden; });
await page.screenshot({ path: path.join(OUT, "7-review-chart-hover.png"), clip: { x: rect.x - 10, y: rect.y - 40, width: rect.w + 20, height: rect.h + 80 } });
console.log("saved 7-review-chart-hover");

// Mobile review
await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 1 });
await new Promise((r) => setTimeout(r, 300));
const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
assert(overflow2 <= 1, `no horizontal overflow on mobile review (got ${overflow2})`);
await shot("8-review-mobile");

await browser.close();
if (problems.length) {
  console.error("\nPROBLEMS:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log("\nAll checks passed.");
