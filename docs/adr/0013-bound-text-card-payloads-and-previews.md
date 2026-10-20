# ADR 0013: Bound text card previews and intake size

## Status

Accepted

## Context

The clothesline is a compact delivery surface. Copied logs, code, and documents can be far larger than a readable top-edge card and can create expensive or unstable rendering.

## Decision

Show no more than three lines or 180 characters in a Text Card preview while retaining its full payload for copy and export. Reject plain-text clipboard payloads larger than 64 KB and show a one-time lightweight notice.

## Consequences

Text Cards remain compact without corrupting or truncating their exported content. The product deliberately does not ingest arbitrarily large text as a substitute for a document-transfer tool.
