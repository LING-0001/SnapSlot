# Website skin format, version 1

The website, Windows and macOS clients share this version 1 data format and
appearance editor. Native hosts also validate files before applying them and
watch their application-support `Skins/active.json` with a 250 ms debounce.
Both in-place writes and atomic replacement are supported. Invalid edits retain
the previous applied style; `last-good.json` is a recovery copy. See the root
README for platform paths and native acceptance boundaries.

Start with `public/skins/notes.json` or `public/skins/cards.json`. In the website's
Appearance section, choose Customize appearance to open the workbench, then
import a JSON file or expand Edit JSON. Valid edits are applied after
250 ms without removing the current inbox items. Invalid edits show the offending
field and keep the last valid skin. Download skin exports the applied definition,
not an invalid draft. Changes last until the page is reloaded; nothing is uploaded.

## Fields

All fields in the examples are required. The optional `background` group can be omitted,
so existing version 1 files remain compatible. Unknown fields and unsupported versions
are rejected rather than silently ignored. Colors use `#RRGGBB` or `#RRGGBBAA`.
Lengths use CSS logical pixels; the browser handles display scaling.

| Group | Properties |
| --- | --- |
| Metadata | `schemaVersion: 1`, `name` (1–60 characters) |
| `card` | `width`, `textWidth` (100–480), `height` (80–280), `gap` (8–64), `padding` (2–24), `radius` (0–48), `borderWidth` (0–8), `frame`, `textBackground`, `ink`, `fontSize` (12–24), `imageFit` (`contain` or `cover`) |
| `background` (optional) | `image` (embedded PNG/JPEG/WebP data URI), `fit` (`cover` or `contain`) |
| `shadow` | `color`, `blur` (0–48), `offsetY` (0–24) |
| `pin` | `enabled`, `color`, `shade`, `width` (8–40), `height` (8–48), `x` (10–90%), `y` (−24–8 pixels from the card's top) |
| `buttons` | `size` (20–40), `inset` (0–16 from the top-right), `background`, `foreground`, `copyBackground`, `copyForeground` |

`pin.x: 50` anchors the pin at the horizontal center as the card changes width.
Set `pin.enabled: false` to omit it. `imageFit: contain` preserves the whole image;
`cover` fills the card with a proportional crop. Neither changes the copied PNG.
The width slider adjusts image and text widths together; JSON can set them separately.
Preview pairs fit their available space, while the actual inbox uses the configured
pixel dimensions. Changing a field clears preset selection unless every value still
matches that preset.
The content area must remain at least 48 pixels in each dimension. Very large cards
scroll horizontally inside the demo rather than increasing the page width.

JSON is capped at 2 MB including embedded artwork. Upload image accepts PNG, JPEG
and WebP files up to 5 MB, decodes them locally and resizes the longest edge to
at most 1024 pixels. The resulting raster data is embedded in `background.image`,
so downloading and importing the JSON also carries its artwork. Fit/Fill changes
`background.fit`. Remove image removes that optional group; resetting or choosing
a built-in preset also removes custom artwork. Imports reject non-raster data,
remote URLs, SVG, HTML, scripts and CSS strings. The input file is never uploaded.

Artwork fills the card face behind the original content. Uploading switches sample
images to contain mode so artwork can show around them; text gets a translucent
reading surface. Neither changes the original image/text copied to the clipboard.

Version 1 does not accept external asset paths or fonts. Native clients watch
`active.json`; local asset packages are not supported. Browser import reads one
JSON file once, while its editor provides immediate live preview. Native changes
persist; website changes last only until reload.

Validation and CSS mapping live in `lib/skin.ts`; the two built-in presets use the
same parser and renderer as player-created skins.
