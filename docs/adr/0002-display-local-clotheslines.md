# ADR 0002: Project captures onto display-local clotheslines

## Status

Accepted

## Context

The product supports the Visual Quality Baseline of two high-resolution displays. A screenshot can originate on either display or span both, while drag targets can exist on either display.

## Decision

Create one clothesline overlay per display. A capture appears on the display containing its primary capture region; a capture spanning displays is assigned to the display containing its geometric center. Hovering a display's top edge reveals only that display's assigned captures.

## Consequences

Capture placement is spatially predictable and cards are never duplicated across displays. Users needing a capture on another display retrieve it from its originating display, including through a cross-display drag.
