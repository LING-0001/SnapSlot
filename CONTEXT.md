# Ubiquitous Language

## Temporary Screenshot Inbox

A local-only, ephemeral collection of newly captured screenshots that stays accessible from a top-edge Pixel Rail and is intended for rapid transfer into another application. It is not a permanent screenshot library or cloud-sync service.

## Visual Quality Baseline

The supported desktop scenario against which interaction smoothness is judged: Windows 10 version 1809 or later on x64, with two 4K displays at 144 Hz.

## Display-Local Pixel Rail

The screen-specific projection of the temporary screenshot inbox. Each display has its own Pixel Rail and exposes only captures assigned to that display; it is not a duplicated view of captures from other displays.

## Clipboard Image Intake

An optional feature that places images copied by other applications into the temporary screenshot inbox. It is distinct from screenshot capture and is disabled by default because it can receive non-screenshot images.

## Ephemeral Session

The lifetime of the temporary screenshot inbox from application start until normal exit. Inbox items do not return after a restart. Files created by the application for this session are temporary; externally created screenshot files remain owned by their originating location.

## Idle Rail

A completely hidden capture surface, with no visible track, count, state lights, or click-intercepting window at rest. Moving upward to the physical top edge and dwelling for approximately 220 milliseconds reveals a full-width single row. Moving away dismisses it after approximately 450 milliseconds. A global shortcut supports keyboard access. It is unavailable while full-screen, presentation, or mouse-capture states are active.

## Card Gesture Contract

The MVP's fixed interaction rules for an inbox item: click copies its native payload, an external drag exports a copy while retaining the item, and the explicit remove control only removes the item from the inbox using the Pixel Dissolve animation.

## Pixel Dissolve

The removal feedback for a Pixel Rail item. The card briefly locks to the rail grid, breaks into a small local burst of square pixels, and is drawn into the nearest rail sink before disappearing. It communicates removal from the ephemeral inbox only; it never implies deletion of the original screenshot file. With reduced motion enabled, it is a short fade rather than particle movement.

## Overflow Stack

A compact `+N` card on a Display-Local Pixel Rail that represents session items beyond the eight fully visible cards. Opening it exposes only the additional items from the current Ephemeral Session; it is not a persistent history view.

## Capture Suppression

A state active during full-screen, presentation, or mouse-capture activity. The application neither reveals a Display-Local Pixel Rail nor receives new items during this state, and it does not backfill items after the state ends.

## Visual Language

The product's visual system: Windows Fluent conventions for conventional UI, with an original, low-key pixel-game inventory rail for capture presentation. The full-width overlay is a compact single row (124 logical pixels high in the current native preview); import and secondary actions are icon controls, while language and exit live in the tray menu. No persistent item counter, title bar, toolbar, or status row occupies the capture surface. The rail uses a restrained cream/charcoal base and small red, cobalt, gold, and green state accents.

## Motion Contract

The product's animation rule: the Pixel Rail slides between idle and expanded states with short, eased transitions; conventional UI uses short Fluent transitions. When Windows requests reduced motion, movement is replaced by simple fades and static placement.

## Theme Policy

The visual theme follows the Windows light or dark preference by default and may be explicitly overridden in settings. The Pixel Rail retains its restrained arcade accents in either theme, while card highlights and shadows adapt for contrast.

## Plain Text Intake

An optional, disabled-by-default feature that receives clipboard plain text as a Text Card in the temporary screenshot inbox. It is distinct from OCR: it does not derive text from a screenshot.

## Text Card

An inbox item whose payload is plain text. A click copies text in the native clipboard text format; an external drag exports a `.txt` copy while retaining the item.

## Text Card Preview

The compact visual representation of a Text Card on an expanded Pixel Rail: at most three lines or 180 characters. The full payload remains available to copy and export. Plain-text clipboard payloads larger than 64 KB are not received.

## Mixed Timeline

The single chronological ordering of Image Cards and Text Cards on a Display-Local Pixel Rail. Text Cards use a compact form and an explicit text type marker; there is no separate text lane.

## Accessible Pixel Rail

The keyboard- and assistive-technology representation of a Display-Local Pixel Rail. It can be opened with a global shortcut; its items support arrow-key navigation, Enter to copy, Delete to remove, and Escape to collapse, while exposing type, summary, and action names through Windows UI Automation.

## UI Quality Gate

The release criterion for the Visual Quality Baseline: with eight visible cards and an Overflow Stack, rail expansion, entry, hover, and drag interactions have a p95 render frame time of at most 8.3 milliseconds. While idle, average process CPU use is below 0.3% without clipboard polling. Reduced-motion mode runs no continuous animation.

## Visual Compatibility Policy

Windows 10 version 1809+ on x64 is the installation range. The full dynamic experience is guaranteed only on devices that pass the UI Quality Gate; a device that does not pass may use a clearly identified static compatibility mode rather than a visually degraded substitute design.

## Brand Identity

The product is named SnapSlot, with the Chinese name 快照槽. Its code is MIT-licensed; its names, icon, and website visual identity are retained brand assets. Its visual direction is an original Pixel Rail: hidden at rest, revealing a shallow full-width row of screenshot and text cards with restrained red, cobalt, gold, and green accents. It deliberately avoids ropes, clothespins, pegboards, and recognisable game IP.

## Release Locales

The first public release supports English (`en`), Simplified Chinese (`zh-Hans`), Traditional Chinese (`zh-Hant`), Japanese (`ja`), Korean (`ko`), and Spanish (`es`) in both the Windows client and the website. The product name remains SnapSlot in every locale; 快照槽 is the Chinese display name. User-created capture content is never translated.

## Product Website

The official SnapSlot website is a first-class product surface, not a static afterthought. It presents the Pixel Rail visual language, provides an interactive web demonstration of idle, capture, expansion, and Pixel Dissolve states, explains local-first privacy and accessibility, and distributes Windows releases with version notes and SHA-256 checksums in every Release Locale. It does not receive or store a visitor's screenshots.
