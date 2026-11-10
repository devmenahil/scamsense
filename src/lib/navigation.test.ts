import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAV, FOOTER_NAV, isActive, isGameplayPath, navItemsFor } from "./navigation";

const APP_DIR = join(__dirname, "..", "app");

/** Collects every static route served by an App Router page.tsx (route groups stripped). */
function collectRoutes(dir: string, acc = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectRoutes(full, acc);
    else if (entry === "page.tsx") {
      const segments = relative(APP_DIR, dir)
        .split(sep)
        .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
      acc.add(`/${segments.join("/")}`);
    }
  }
  return acc;
}

describe("navigation", () => {
  const routes = collectRoutes(APP_DIR);

  it("every primary and footer link resolves to an existing page", () => {
    expect(existsSync(APP_DIR)).toBe(true);
    for (const { href } of [...APP_NAV, ...FOOTER_NAV]) {
      const path = href.split("#")[0] || "/";
      expect(routes, `missing page for ${href}`).toContain(path);
    }
  });

  it("marks nested routes active under their section", () => {
    expect(isActive("/modules/spot-the-trap", "/modules")).toBe(true);
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
    expect(isActive("/dashboard/x", "/dashboard")).toBe(false);
    expect(isActive("/profile", "/modules")).toBe(false);
  });
});

describe("Sensei Kenshi is absent from gameplay (Step 10)", () => {
  const ID = "0b0a8a4e-5f7b-4c58-9a3e-2f1f7f0f5c11";

  it("the scenario player is a gameplay path; debrief pages are not", () => {
    expect(isGameplayPath(`/play/${ID}`)).toBe(true);
    expect(isGameplayPath(`/play/${ID}/`)).toBe(true);
    for (const p of ["results", "review", "playbook"]) expect(isGameplayPath(`/play/${ID}/${p}`)).toBe(false);
    expect(isGameplayPath("/dashboard")).toBe(false);
  });

  it("the primary navigation drops Sensei Kenshi only while playing", () => {
    expect(navItemsFor(`/play/${ID}`).map((i) => i.href)).not.toContain("/sensei");
    expect(navItemsFor(`/play/${ID}`)).toHaveLength(APP_NAV.length - 1);
    expect(navItemsFor("/dashboard").map((i) => i.href)).toContain("/sensei");
    expect(navItemsFor(`/play/${ID}/results`).map((i) => i.href)).toContain("/sensei");
  });

  it("no gameplay component imports the Kenshi chat or launcher", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e)) files.push(full);
      }
    };
    walk(join(__dirname, "..", "components", "scenario"));
    files.push(join(APP_DIR, "(app)", "play", "[attemptId]", "page.tsx"));
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/components\/kenshi|KenshiChat|KenshiLauncher|\/api\/chat|href="\/sensei"/);
    }
  });
});
