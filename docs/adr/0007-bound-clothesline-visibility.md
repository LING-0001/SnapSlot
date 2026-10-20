# ADR 0007: Limit the expanded clothesline to eight cards

## Status

Accepted

## Context

The clothesline must preserve visual clarity and the Visual Quality Baseline during sustained capture activity. An unbounded row makes cards too small and increases rendering and interaction cost.

## Decision

Show at most eight complete cards on a display-local clothesline. Represent remaining session items with an Overflow Stack, opened only on demand. Never evict an item merely because it exceeds the visible limit.

## Consequences

The primary view remains readable and performant without turning into a screenshot wall. The UI needs a deliberate transient list for overflow items, but does not become a persistent gallery.
