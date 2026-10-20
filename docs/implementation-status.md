# UI prototype — 2026-10-20

## Implemented and checked

- Static Next.js website, all six requested locale routes, localized metadata.
- Original local SVG sample imagery; no third-party image/font requests.
- Working rail demo: add image / text samples, copy real PNG / text, remove,
  bounded fragment animation, eight-item first page, overflow, reset, empty state.
- Keyboard navigation, deletion focus recovery, reduced-motion handling.
- Mobile layouts verified at 390px across six languages.
- Native .NET 10 WPF preview: fully hidden idle window, full-width single-row
  edge reveal, delayed dismissal, tray, global reveal shortcut,
  manual file import and one-shot clipboard paste, text/image copy, OLE file
  drag source, local remove animation, locale picker.
- Native self-test: six-locale rebuild, export round trip, collapse/expand,
  eight-item limit and overflow, removal semantics, oversized text, empty state.
- CI configuration for website build + browser tests and Windows compilation.

## Validation evidence

- `npm run build`: static generation succeeds for six locale pages.
- `npx playwright test`: 12 browser tests pass, including edge dwell, pointer
  dismissal, non-activating reveal, keyboard language menu, PNG/text clipboard
  payloads and denied-permission feedback.
- Desktop build: zero warnings, zero errors.
- Desktop `--smoke-test`: 19 checks pass, exit code 0.
- Rendered evidence is in `artifacts/qa` and `artifacts/qa-v2`.

## Boundaries

The native preview uses WPF rendering, not the planned DirectComposition /
Direct3D implementation. This does not replace ADR 0001. Screenshot listeners,
complete capture suppression, independent multi-display overlays and performance gates
remain outstanding. External application drag/drop compatibility and real
screen-reader operation still need manual validation.

Neither the website nor the native prototype is a signed public release. There
is no live domain, installer, update channel, checksum publication or release
history yet. The static site can be deployed after these release inputs exist.

## Design review

The frontend-design pass concentrates the pixel language in rail indicators,
the small mark and removal fragments; content remains sharp. The actual browser
review reduced hero whitespace so the rail is visible sooner. Reusable desktop
and mobile screenshots are captured by the browser tests.

The native preview now uses a 124-DIP row (previously 294), without a persistent
counter, header or toolbar. Language lives in the tray; manual paste/sample
operations live in the overflow menu. Normal launch starts empty and hidden.
Final renderer finish and full native edge-gesture validation still remain.
