# ADR 0010: Scope physical motion and honour reduced-motion preferences

## Status

Accepted

## Context

Physical animation makes the clothesline memorable, but applying it broadly impairs clarity and accessibility. Windows users can express a system preference to reduce motion.

## Decision

Use spring motion only for clothesline objects: the line, clips, and cards. Use short Fluent transitions for conventional UI. When reduced motion is enabled, replace spring movement with fades and static placement.

## Consequences

Motion supports the central metaphor rather than competing with content. The renderer requires a reduced-motion mode that changes animation semantics rather than merely slowing them down.
