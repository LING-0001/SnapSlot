# ADR 0017: Prefer visual fidelity over universal dynamic compatibility

## Status

Accepted

## Context

Windows 10 version 1809+ covers a wide range of hardware. Some devices may install and run the app yet fail the UI Quality Gate for the full dynamic overlay.

## Decision

Keep Windows 10 version 1809+ x64 as the installation range, but promise the full dynamic visual experience only on hardware that passes the UI Quality Gate. Do not replace the product with a flat, visually compromised list view on lower-performing devices; allow only a clearly identified static compatibility mode.

## Consequences

The product preserves its visual identity and makes support expectations honest. QA needs a benchmark or preflight mechanism and documented compatibility behaviour.
