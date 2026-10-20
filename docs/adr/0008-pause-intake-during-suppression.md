# ADR 0008: Pause screenshot intake during capture suppression

## Status

Accepted

## Context

The overlay is suppressed during full-screen, presentation, and mouse-capture activity to avoid interfering with focused tasks. Collecting captures invisibly in those situations would be surprising and may expose sensitive material later.

## Decision

While Capture Suppression is active, do not reveal overlays, receive new capture sources, or later backfill sources created during the suppressed interval.

## Consequences

The privacy and interruption boundary is unambiguous. Some captures made in games, presentations, or remote-control sessions will intentionally not appear in the temporary screenshot inbox.
