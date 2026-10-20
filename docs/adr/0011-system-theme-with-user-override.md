# ADR 0011: Follow the system theme with a user override

## Status

Accepted

## Context

The overlay must sit over arbitrary application and desktop backgrounds. A fixed light or dark visual treatment will be inappropriate for a significant group of Windows users.

## Decision

Follow the Windows light/dark preference by default and offer a settings override. Retain a warm clothesline identity in both modes, using mode-specific card highlight and shadow tokens.

## Consequences

The design system requires deliberate contrast validation for both themes. Users keep control when their application preference differs from the operating system setting.
