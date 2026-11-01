# Original local UI sample

`coast-master.png` was generated with the built-in imagegen tool. Prompt: `coast-prompt.txt`. Source output: `exec-b853078e-2c58-4214-95d8-eaf4ffce1dbe.png`. It is an illustrative sample, not a user capture or proof of a real trip.

The website uses a resized 960×640 WebP at `apps/website/public/coast.webp`. Only resizing/encoding was applied. The live PC app continues to display the user's own clipboard images; this sample is used by the website and optional isolated smoke checks.

Local native visual check after a normal local build:

```sh
artifacts/macos/SnapSlot.app/Contents/MacOS/SnapSlot --smoke-test /absolute/path/to/output --smoke-image /absolute/path/to/assets/demo/coast-master.png
```

This uses an isolated temporary store and a private named pasteboard. A source build or old successful smoke log does not prove a new native visual run passed. Read the current run's exit status and images.
