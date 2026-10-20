# ADR 0015: Provide keyboard and UI Automation semantics for the overlay

## Status

Accepted

## Context

The clothesline uses a custom composited visual layer. Visual nodes in that layer do not automatically make a keyboard-operable or screen-reader-accessible application.

## Decision

Provide a global shortcut that opens and focuses the display-local clothesline. Support Left/Right navigation, Enter to copy, Delete to remove, and Escape to collapse. Expose every item through Windows UI Automation with its type, content summary, and operation names.

## Consequences

The renderer needs an accessibility semantic layer kept in sync with the visual overlay. The core inbox workflow becomes operable without pointer interaction.
