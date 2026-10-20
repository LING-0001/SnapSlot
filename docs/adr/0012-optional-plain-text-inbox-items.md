# ADR 0012: Support optional plain-text inbox items, not OCR

## Status

Accepted

## Context

Users transfer both screenshots and copied text between applications. OCR would make screenshot text searchable, but introduces recognition quality, language, CPU, and privacy concerns that are outside the temporary-inbox workflow.

## Decision

Offer optional, disabled-by-default clipboard plain-text intake. Create a distinct Text Card for each accepted text payload. Do not add OCR in the MVP.

## Consequences

The inbox can support a common cross-application text workflow with the same explicit opt-in privacy boundary as clipboard images. Text needs an intentional compact card layout and standard `.txt` export; image analysis remains out of scope.
