# Historical pixel-rail exploration

Archived. The approved pinned-note direction is documented in
`apps/website/DESIGN.md` and `docs/adr/0024-native-notes-parity.md`.
The colors, composition and overflow behavior below are not the current contract.

---

# SnapSlot implementation direction

The website introduces a local Windows capture inbox. Its primary job is to let
someone experience the quiet rail before deciding to install the client.

## Tokens

- Canvas: `#f6f4ed`
- Ink / rail: `#252b28`
- Capture blue: `#2878ed`
- Remove red: `#e95843`
- Text gold: `#eabd42`
- Local green: `#508b62`

Display typography uses tightly spaced, bold Segoe UI with a system CJK fallback.
Body typography uses Segoe UI / Microsoft YaHei / Yu Gothic / Malgun Gothic.
Consolas provides compact captions, slots and keyboard notation. Pixel geometry
belongs to the logo, state lights and removal effect, never to captured content.

## Composition

    brand                          demo / details / language
                    a short, large promise
                   demo and download actions
           ┌──────────────────────────────────────┐
           │        working dark pixel rail       │
           │   realistic sample capture content   │
           │          desktop breathing room      │
           └──────────────────────────────────────┘
                    interactive controls
       quiet by default        image and text        local
             download status and concise FAQ

The signature is a functioning rail inside a miniature desktop, with localized
sample content and a bounded pixel-fragment removal animation. No decoration
animates continuously. Normal screenshots are not pixelated.

## Critique before implementation

A dashboard-style dark hero would turn the rail into generic software chrome.
Keep the surrounding page warm and spacious so the rail itself carries the
identity. Do not reproduce the generated four-column storyboard as a hero image:
it cannot demonstrate real interaction or adapt to a narrow viewport.

## Validation

Check six static locale routes, keyboard operations, empty and overflow states,
reduced motion, real clipboard success/failure messaging, and 390px layout.
The public download area must state that no signed release exists yet.
