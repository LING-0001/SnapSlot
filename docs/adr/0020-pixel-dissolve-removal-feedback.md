# ADR 0020: Remove items with a local Pixel Dissolve

## Status

Accepted

## Context

The earlier suspended-card concept used a downward drop to show removal. That movement belongs to a hanging-object metaphor, which the product no longer uses. The Pixel Rail needs removal feedback that reinforces its game-inventory character without becoming distracting or suggesting that a source file was destroyed.

## Decision

When a user activates the explicit remove action or presses Delete, briefly lock the card to the rail grid, break it into a small set of square pixels, and draw those pixels a short distance into the nearest rail sink. Complete the animation locally and quickly; do not send particles across the desktop. The operation removes only the ephemeral inbox item, never its external source file. In reduced-motion mode, use a short fade.

## Consequences

Removal becomes visually coherent with the Pixel Rail while remaining bounded in time and screen area. The renderer needs a lightweight deterministic pixel-fragment effect, and accessibility semantics must continue to announce the same plain-language "Remove from inbox" operation.
