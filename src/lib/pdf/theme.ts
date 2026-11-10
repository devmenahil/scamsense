import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Brand tokens for server-generated PDFs (Step 11). PDFs can't use the Tailwind theme, so this is the single place
 * that mirrors the `@theme` tokens in src/app/globals.css (Brand Identity Guide). PDF components use these, never hex.
 */
export const PDF_COLORS = {
  teal: "#0B5F66",
  tealShade: "#073F44",
  mist: "#E8F3F2",
  white: "#FFFFFF",
  yellow: "#FFC93C",
  yellowShade: "#D9A21B",
  yellowTint: "#FFF3D1",
  /** Teal at reduced opacity, for secondary text on white (still AA at the sizes used). */
  tealSoft: "#3C7F84",
} as const;

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

/** Latin first, Latin Extended as a per-glyph fallback (e.g. "Łukasz", "Žofia"). */
export const HEADING_FONT = ["Nunito", "NunitoExt"];
export const BODY_FONT = ["Inter", "InterExt"];

let registered = false;

/** Registers the embedded brand fonts (Nunito + Inter, SIL OFL, see src/assets/fonts/README.md) once per process. */
export function registerPdfFonts(): void {
  if (registered) return;
  const f = (file: string) => path.join(FONT_DIR, file);
  Font.register({
    family: "Nunito",
    fonts: [700, 800, 900].map((w) => ({ src: f(`nunito-${w}.ttf`), fontWeight: w })),
  });
  Font.register({
    family: "NunitoExt",
    fonts: [700, 800, 900].map((w) => ({ src: f(`nunito-ext-${w}.ttf`), fontWeight: w })),
  });
  Font.register({
    family: "Inter",
    fonts: [400, 500, 600, 700].map((w) => ({ src: f(`inter-${w}.ttf`), fontWeight: w })),
  });
  Font.register({
    family: "InterExt",
    fonts: [400, 500, 600, 700].map((w) => ({ src: f(`inter-ext-${w}.ttf`), fontWeight: w })),
  });
  // Never hyphenate names, IDs, or URLs.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
