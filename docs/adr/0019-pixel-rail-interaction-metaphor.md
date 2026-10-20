# ADR 0019: Use a quiet Pixel Rail rather than a clothesline or pegboard

## Status

Accepted

## Context

The product is a persistent desktop utility. A full pegboard gives the capture inbox an independent, game-library character, but creates too much visual weight when it is continuously visible. The earlier clothesline direction is also no longer the desired product metaphor.

## Decision

Use a thin Pixel Rail as the only default-visible capture affordance. It lives on each display's top edge and shows only compact, non-content state cues. Hovering for approximately 200 milliseconds or using the global shortcut expands the rail into the compact capture surface. The expanded rail uses original pixel-inspired geometry, a cream/charcoal foundation, and restrained red, cobalt, gold, and green accents.

Do not use a rope, clips, a full pegboard, Mario characters, or other recognisable game IP in the product UI or brand assets.

## Consequences

The default experience stays quieter than both a suspended-card row and a panel-sized pegboard, while the expanded state remains recognisable and playful. The overlay no longer needs physical spring simulation; it needs precise, short rail and card transitions. Earlier clothesline-specific visual and motion decisions are superseded where they conflict with this ADR.
