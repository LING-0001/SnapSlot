# ADR 0022: Build a first-class product website alongside the Windows client

## Status

Accepted

## Context

SnapSlot's Pixel Rail interaction is its central product idea. A download-only page cannot show why the desktop overlay is quiet at rest or how it expands, accepts a capture, and removes an item. The website must also make local-first behavior, release integrity, and six-language support visible before a visitor installs the app.

## Decision

Build an independent, six-locale product website with Next.js, TypeScript, and Tailwind CSS. It will provide a lightweight interactive simulation of the Pixel Rail's idle, capture, expansion, and Pixel Dissolve states; product, privacy, accessibility, FAQ, download, release-notes, and checksum pages; and localized SEO metadata. Use static output where possible and host it on Cloudflare Pages. Keep the website and Windows client as separate renderers that share visual tokens and behavior specifications rather than UI code.

## Consequences

Website content, translations, release assets, checksums, and the web interaction demo are release deliverables. The browser demo must be clearly presented as a simulation and must not access or upload screenshots. Visual changes to the Pixel Rail need coordinated review in the desktop client and website.
