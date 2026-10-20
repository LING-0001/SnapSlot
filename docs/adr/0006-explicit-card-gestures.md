# ADR 0006: Keep card gestures explicit and non-destructive

## Status

Accepted

## Context

The primary product workflow is fast, reliable cross-application transfer. Context-sensitive drag outcomes and gesture multiplexing create ambiguity during that workflow.

## Decision

Clicking an inbox item copies its native payload. Dragging an image card exports an image file copy; dragging a Text Card exports a `.txt` copy. Either action leaves the item in the inbox. The explicit remove control removes only the item. Do not include long-press markup, double-click preview, or target-dependent removal in the MVP.

## Consequences

Users learn one drag behaviour and do not risk losing a source through an accidental destination. Rich editing and preview gestures remain possible future work rather than hidden MVP behaviour.
