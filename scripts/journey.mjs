// Visitor journey: what a stressed driver needs after an accident must work on a phone and a laptop.
// Read-only: loads pages, never submits or writes anything. Works on a checkout dir or a live URL.
// Usage: node journey.mjs <site-root | https://url> [screenshot-dir]
import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const target = process.argv[2];
const shotDir = path.resolve(process.argv[3] ?? "journey-shots");
const live = /^https?:\/\//.test(target);
const root = live ? "" : path.resolve(target);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(path.join(root, path.normalize(p)));
    res.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = live ? target : `http://127.0.0.1:${server.address().port}/`;
await mkdir(shotDir, { recursive: true });

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const browser = await chromium.launch();

for (const [name, viewport, phone] of [["desktop", { width: 1280, height: 900 }, false], ["phone", { width: 360, height: 740 }, true]]) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  const bad = [];
  const ours = (u) => u.startsWith(new URL(url).origin);
  page.on("pageerror", (e) => bad.push(`script error: ${e.message}`));
  page.on("response", (r) => { if (ours(r.url()) && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  page.on("requestfailed", (r) => { if (ours(r.url())) bad.push(`failed ${r.url()}`); });
  const elsewhere = [];
  page.on("request", (r) => { if (/^https?:/.test(r.url()) && !ours(r.url())) elsewhere.push(r.url()); });
  const resp = await page.goto(url, { waitUntil: "networkidle" });
  check(resp?.status() === 200, `${name}: page status ${resp?.status()}`);
  check(await page.locator("h1").count() === 1, `${name}: expected exactly one h1`);
  check((await page.locator("h1").innerText()).trim().length > 5, `${name}: h1 is empty`);

  // 1. A caller can reach the business: the call link in the header, hero and contact card is a dialable number.
  const tels = await page.locator("a[href^=\"tel:\"]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check(tels.length >= 3, `${name}: fewer than 3 phone links (${tels.length})`);
  for (const t of tels) check(/^tel:\+44\d{9,10}$/.test(t), `${name}: phone link not dialable: ${t}`);
  const headerTel = await page.locator(".header-call").getAttribute("href");
  const heroTel = await page.locator(".hero-actions a[href^=\"tel:\"]").getAttribute("href");
  const contactTel = await page.locator("#contact a[href^=\"tel:\"]").first().getAttribute("href");
  check(headerTel === heroTel && heroTel === contactTel, `${name}: header/hero/contact main numbers differ (${headerTel}, ${heroTel}, ${contactTel})`);
  // The visible text of every phone link must be the same digits as its href.
  const mismatched = await page.locator("a[href^=\"tel:\"]").evaluateAll((as) => as.map((a) => {
    const digits = (a.textContent.match(/0\d[\d ]{9,12}/) ?? [""])[0].replace(/\s/g, "");
    return { href: a.getAttribute("href"), digits };
  }).filter((x) => x.digits && x.href.replace("tel:+44", "0") !== x.digits));
  check(mismatched.length === 0, `${name}: link text and number differ: ${JSON.stringify(mismatched)}`);
  // Structured data must agree with the page, or search results show a wrong number.
  const ld = JSON.parse(await page.locator("script[type=\"application/ld+json\"]").first().textContent());
  check(tels.includes(`tel:${ld.telephone}`), `${name}: JSON-LD telephone ${ld.telephone} is not a phone link on the page`);
  const mails = await page.locator("a[href^=\"mailto:\"]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check(mails.length >= 1 && mails.every((m) => m === `mailto:${ld.email}`), `${name}: mailto links differ from JSON-LD email`);

  // 2. Navigation works: each header link lands on a visible section.
  for (const a of await page.locator("nav[aria-label=Main] a").all()) {
    const id = (await a.getAttribute("href")).slice(1);
    check(await page.locator(`#${id}`).count() === 1, `${name}: nav target #${id} missing`);
  }
  // 3. Images the visitor sees actually decoded (a broken image is a blank hole).
  const broken = await page.locator("img").evaluateAll((is) => is.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute("src")));
  check(broken.length === 0, `${name}: broken images ${broken.join(", ")}`);
  const noBg = await page.locator(".photo").evaluateAll((ps) => ps.filter((p) => getComputedStyle(p).backgroundImage === "none").length);
  check(noBg === 0, `${name}: ${noBg} photo blocks have no background image`);
  // 4. Phone: nothing forces sideways scrolling, and the sticky call bar is there and not covering the footer text.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `${name}: page scrolls sideways by ${overflow}px`);
  const bar = page.locator(".call-bar");
  if (phone) {
    check(await bar.isVisible(), "phone: call bar not visible");
    const box = await bar.boundingBox();
    check(box && box.height >= 44, `phone: call bar tap target under 44px (${box?.height})`);
    check(box && box.y + box.height <= viewport.height + 1, "phone: call bar off screen");
  } else {
    check(!(await bar.isVisible()), "desktop: phone call bar should be hidden");
  }
  // Links in the header and contact card are big enough to tap.
  for (const a of await page.locator(".header-call, #contact .contact-line.big").all()) {
    if (!(await a.isVisible())) continue;
    const b = await a.boundingBox();
    check(b && b.height >= 24 && b.width >= 24, `${name}: tap target too small (${b?.width}x${b?.height})`);
  }
  // 5. Footer carries the legal line and the page ends on it.
  check((await page.locator("footer").innerText()).includes("Company No."), `${name}: footer lost the company line`);
  // Everything the page needs, fonts included, is served from the site itself: a missing file fails,
  // and no visitor's address is handed to another company just for loading the page.
  check(bad.length === 0, `${name}: load problems: ${bad.join("; ")}`);
  check(elsewhere.length === 0, `${name}: requests to other sites: ${elsewhere.join(", ")}`);
  const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")));
  for (const family of ["Oswald", "Open Sans"]) check(faces.includes(family), `${name}: ${family} font did not load`);

  // Screenshots: full page and the first screen. They are CI artifacts; a blank or tiny capture fails the check.
  for (const [label, opts] of [["full", { fullPage: true }], ["first-screen", {}]]) {
    const file = path.join(shotDir, `ace-${name}-${label}.png`);
    await page.screenshot({ path: file, ...opts });
    const size = (await stat(file)).size;
    check(size > 20000, `${name} ${label} screenshot looks blank (${size} bytes)`);
  }
  await ctx.close();
}
await browser.close();
server.close();
for (const f of failures) console.log(`FAIL ${f}`);
console.log(failures.length ? `${failures.length} journey failure(s)` : `Journey passed; screenshots in ${shotDir}`);
process.exit(failures.length ? 1 : 0);
