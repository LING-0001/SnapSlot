# ADR 0004: Keep the inbox session-ephemeral

## Status

Accepted

## Context

The product is a temporary screenshot inbox rather than a screenshot history library. Screenshot sources can either be files created by the application or pre-existing user files in `Pictures\Screenshots`.

## Decision

Do not restore inbox items after an application restart. On normal exit, remove temporary files created by the application; after an abnormal exit, remove those files at the next startup. Never delete an externally created source file merely because its card is removed from the clothesline.

## Consequences

The product has a bounded storage lifetime and avoids silently deleting user-owned files. It does not provide crash recovery or a historical gallery in the MVP.
