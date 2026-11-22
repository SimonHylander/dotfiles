// Usage: node capture.mjs <surface.json> <round dir>
// Screenshots every state of a surface at desktop and phone, light and dark, from the
// design-check harness, and runs the gates on each: axe (WCAG 2.x A/AA, contrast included) and
// 44 px hit areas on the surface's own controls. Writes <state>.png files and gates.json.
// Run it from a directory with playwright@1.55.0 and axe-core@4.10.3 installed.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const [configPath, out] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
fs.mkdirSync(out, { recursive: true });

const viewports = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
};
const report = { axe: [], targets: [] };

// NixOS has no Playwright browser cache: use the system Chrome there. The --lang flag and LANG
// make time inputs 24-hour.
const nixChrome = "/run/current-system/sw/bin/google-chrome";
const browser = await chromium.launch({
  executablePath: fs.existsSync(nixChrome) ? nixChrome : undefined,
  args: ["--lang=en-GB"],
  env: { ...process.env, LANG: "en_GB.UTF-8", LANGUAGE: "en_GB" },
});
for (const [viewport, { width, height, ...device }] of Object.entries(viewports)) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      locale: "en-GB",
      timezoneId: "Europe/Stockholm",
      reducedMotion: "reduce",
      ...device,
    });
    await context.addInitScript((t) => {
      try { localStorage.setItem("theme", t); } catch {}
    }, theme);
    const page = await context.newPage();
    // A request whose URL contains a stub's key gets that stub as its JSON body.
    const stubs = Object.entries(config.stubs ?? {});
    if (stubs.length > 0) {
      await page.route("**/*", (route) => {
        const stub = stubs.find(([key]) => route.request().url().includes(key));
        return stub ? route.fulfill({ contentType: "application/json", body: JSON.stringify(stub[1]) }) : route.continue();
      });
    }
    for (const state of config.states) {
      // Each state loads fresh, at the harness URL plus its own path or query.
      // `networkidle` may never come: wait for the page's heading.
      await page.goto(config.url + (state.path ?? ""), { waitUntil: "load" });
      await page.getByRole("heading", { name: config.ready }).waitFor();
      await page.waitForTimeout(1500);
      if (state.open !== undefined) {
        await page.getByRole("button", { name: state.open }).filter({ visible: true }).first().click();
        await page.getByRole("dialog").waitFor();
        await page.waitForTimeout(700);
      }
      const shot = `${viewport}-${theme}-${state.name}`;
      await page.screenshot({ path: path.join(out, `${shot}.png`) });

      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
        });
        return result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })),
        }));
      });
      for (const v of violations) report.axe.push({ shot, ...v });

      const scope = state.open !== undefined ? page.getByRole("dialog") : page.locator("body");
      const controls = scope.locator(
        'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=combobox], [role=link], summary, [tabindex="0"]',
      );
      for (let i = 0; i < (await controls.count()); i++) {
        const control = controls.nth(i);
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        if (box === null || box.width === 0 || box.height === 0 || (box.width >= 44 && box.height >= 44)) continue;
        const info = await control.evaluate((node) => {
          // The hit area, where an absolute ::after widens it (a stretched card link, the close
          // button's ring): the ::after's box from its containing block and insets.
          const after = getComputedStyle(node, "::after");
          let hit = null;
          if (after.position === "absolute" && after.content !== "none") {
            let block = node;
            while (block !== null && getComputedStyle(block).position === "static") block = block.parentElement;
            if (block !== null) {
              const r = block.getBoundingClientRect();
              const px = (v) => (v === "auto" ? 0 : parseFloat(v));
              hit = { width: r.width - px(after.left) - px(after.right), height: r.height - px(after.top) - px(after.bottom) };
            }
          }
          return {
            hit,
            tag: node.tagName.toLowerCase(),
            label: (node.getAttribute("aria-label") || node.textContent || node.getAttribute("placeholder") || "").trim().slice(0, 40),
            // A link inside a sentence, which WCAG exempts.
            inline:
              node.tagName === "A" &&
              getComputedStyle(node).display === "inline" &&
              /\S/.test(node.parentElement?.textContent?.replace(node.textContent ?? "", "") ?? ""),
            inDialog: node.closest("[role=dialog]") !== null,
            // The surface's own controls: page content and dialogs, not the app shell.
            surface: node.closest("[role=dialog], main") !== null,
          };
        });
        if (info.hit !== null && info.hit.width >= 44 && info.hit.height >= 44) continue;
        if (state.open !== undefined && !info.inDialog) continue;
        report.targets.push({ shot, ...info, w: Math.round(box.width), h: Math.round(box.height) });
      }
    }
    await context.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(out, "gates.json"), JSON.stringify(report, null, 2));

const small = report.targets.filter((t) => t.surface && !t.inline);
console.log(`axe: ${report.axe.reduce((sum, v) => sum + v.nodes.length, 0)} nodes`);
for (const v of report.axe) console.log(`  [${v.shot}] ${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target).join(" | ")}`);
console.log(`surface targets under 44 px: ${small.length}`);
const seen = new Map();
for (const t of small) seen.set(`${t.tag} "${t.label}" ${t.w}x${t.h}`, [...(seen.get(`${t.tag} "${t.label}" ${t.w}x${t.h}`) ?? []), t.shot]);
for (const [target, shots] of seen) console.log(`  ${target} in ${shots.join(", ")}`);
console.log(`outside the gate (shell): ${report.targets.filter((t) => !t.surface).length}`);
