# ADR 0005: Use a visible, deliberate reveal handle

## Status

Accepted

## Context

The top edge of a Windows display is frequently used by window controls, browser tabs, games, and remote-desktop flows. An invisible display-wide hot zone would cause accidental reveals and make the overlay difficult to discover.

## Decision

Expose a faint approximately 2-pixel Reveal Handle. Reveal the local clothesline only after a hover of approximately 200 milliseconds. Hide and disable it during full-screen, presentation, or mouse-capture states. Offer a configurable global shortcut as an alternative entry point.

## Consequences

The overlay has a discoverable, intentional entry gesture with less interference in normal desktop work. The visual design must keep the handle elegant without suggesting it is an interactive control.
