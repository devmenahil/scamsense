import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAV, FOOTER_NAV, isActive } from "./navigation";

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
