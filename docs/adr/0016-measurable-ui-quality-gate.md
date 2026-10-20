# ADR 0016: Make UI performance a release gate

## Status

Accepted

## Context

Visual quality is a primary product requirement, not an incidental implementation detail. Subjective claims of smoothness are insufficient to validate a high-refresh composited overlay.

## Decision

On the Visual Quality Baseline, with eight visible cards and an Overflow Stack, require a p95 render frame time no greater than 8.3 milliseconds for reveal, entry, hover, and drag interactions. Require idle average process CPU usage below 0.3% without clipboard polling. Reduced-motion mode must not run spring simulation.

## Consequences

Performance traces become a release artifact. A feature that violates the gate must be optimized, visually redesigned, or deferred rather than justified by subjective feel.
