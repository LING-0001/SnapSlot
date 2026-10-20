# ADR 0001: Use a composited renderer for the clothesline overlay

## Status

Accepted

## Context

The temporary screenshot inbox must remain visually smooth on the Visual Quality Baseline: two 4K displays at 144 Hz. It needs a transparent, top-edge overlay with animated cards, a flexible clothesline, and drag interaction.

WPF provides suitable native Windows controls, tray integration, settings UI, and accessibility support. Its transparent layered-window animation path is not the appropriate sole rendering foundation for this high-refresh overlay.

## Decision

Build the client with C# and .NET 10. Use WPF for conventional application UI and Win32 for system integration. Render the clothesline overlay and its animations through DirectComposition and Direct3D.

## Consequences

The application keeps a native Windows UX while separating presentation-sensitive rendering from normal UI. The team accepts the extra interop and rendering complexity in exchange for a credible high-DPI, high-refresh performance target.
