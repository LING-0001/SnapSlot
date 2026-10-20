# ADR 0021: Ship six supported locales in the first public release

## Status

Accepted

## Context

SnapSlot's interaction is compact, but its capture, privacy, accessibility, shortcut, and removal explanations must be clear in every language that the product claims to support. Adding language support after UI strings, layout rules, website content, and release notes have been hard-coded would create avoidable rework.

## Decision

Ship the Windows client and the official website in English (`en`), Simplified Chinese (`zh-Hans`), Traditional Chinese (`zh-Hant`), Japanese (`ja`), Korean (`ko`), and Spanish (`es`). Keep the product mark `SnapSlot` unchanged in all locales; display `快照槽` as its Chinese name. Localize every first-party UI string, accessible name, documentation page, release note, download checksum instruction, and website metadata. Never translate the user's captured image or text payload.

Use language resources rather than strings embedded in UI layout code. Test each locale for clipping, keyboard navigation, bidirectional-safe layout primitives, and accessible labels before release.

## Consequences

Internationalization becomes a release requirement for the desktop and web repositories. Locale review needs native-quality editorial checks, especially for Japanese, Korean, and Traditional Chinese, and feature work must add all six translations before it is considered complete.
