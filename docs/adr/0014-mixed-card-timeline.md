# ADR 0014: Mix image and text items in one chronological clothesline

## Status

Accepted

## Context

The temporary inbox receives image and optional text payloads. Separate lanes would give each medium a different retrieval location, while a single undifferentiated visual treatment would make text hard to recognise.

## Decision

Place Image Cards and Text Cards in one chronological clothesline. Render Text Cards in a more compact form with an explicit text type marker. Do not create a second text lane.

## Consequences

The temporary inbox retains one simple retrieval model. The card layout needs clear type distinction without disrupting chronological scanning.
