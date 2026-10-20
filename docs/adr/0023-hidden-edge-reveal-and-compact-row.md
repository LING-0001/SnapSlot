# ADR 0023: Hide at rest and reveal one shallow, full-width row

## Status

Accepted. Supersedes the visible idle handle in ADRs 0005 and 0019.

## Context

The first implementation exposed a large panel and persistent status controls.
The user requested a fully hidden resting state, an upward pointer gesture at
the physical screen edge, a reveal from above, and a full-screen-width layout
that consumes much less vertical space. They also rejected padded counters and
the browser's unstyled language select.

## Decision

- No visible pixels or input-intercepting overlay when idle.
- Upward contact with the screen's top edge, followed by a 220 ms dwell, reveals
  the rail without activating it. Ordinary top-edge clicks and pressed mouse
  buttons must not trigger the overlay.
- The expanded native rail spans the current supported monitor's full width.
  The preview supports the primary screen; independent monitors remain future
  work. Its single row is 124 logical pixels high, reduced from 294.
- Pointer departure starts a 450 ms grace period. Reentry cancels dismissal.
  Keyboard use and active dragging or menus keep the rail available.
- Secondary controls are compact icons; language preferences and exit move to
  the tray. No permanent count, prototype label, or status row.
- The website simulates the same state machine at the mock desktop's edge.
  An explicit reveal button outside the demo supports touch and keyboard users.
- Language selection uses native language names in a custom accessible menu,
  with checked current language, keyboard navigation and outside-click dismissal.

## Implementation boundaries

The native preview hides its HWND and uses a passive event-driven mouse hook,
not a permanently visible or click-blocking sensor strip and not cursor polling.
It checks for held mouse buttons and foreground full-screen windows before an
edge reveal. Comprehensive presentation, capture, and multi-display suppression
still require production validation.

Web captures added while idle do not force the rail open. The invisible web
sensor is only inside the mock desktop and does not imply access to the real
screen edge.
