# ADR 0003: Make clipboard image intake opt-in

## Status

Accepted

## Context

Windows does not provide a reliable, privacy-preserving signal that distinguishes an image placed on the clipboard by `Win + Shift + S` from an image copied by another application. Automatically receiving all clipboard images would add convenience but can unexpectedly collect private or unrelated content.

## Decision

By default, receive only captures created by the application's own shortcut and screenshot files created in `Pictures\Screenshots` by `Win + PrtSc`. Provide clipboard image intake as an explicitly enabled option with clear disclosure.

## Consequences

The default product behaviour is predictable and has a narrow privacy boundary. Users who want `Win + Shift + S` support can enable clipboard intake, accepting that other copied images may also appear.
