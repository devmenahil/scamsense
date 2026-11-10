# Embedded PDF fonts

Static TrueType files used only by the server-side PDF generator (`src/lib/pdf/theme.ts`) for the certificate and
the analysis report. Web pages load the same families through `next/font`.

- Nunito 700/800/900 and Inter 400/500/600/700, `latin` and `latin-ext` subsets (Fontsource builds of the Google Fonts
  releases, downloaded 2026-11-10).
- Licence: SIL Open Font License 1.1 — see `OFL-Nunito.txt` and `OFL-Inter.txt`.
