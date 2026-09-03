# Architecture

The extension is organized around dependency direction rather than UI screens.

```text
extension.js ──> src/shell ──> src/network
            └─> src/bing
                         └──> src/appearance ──> src/background
                                           └──> src/privileged

prefs.js ─────> src/preferences ──> src/appearance
                               ├──> src/background
                               └──> src/bing
```

## Modules

- `src/config`: schema identifiers and setting keys. This is the single source
  of truth for settings used by both the Shell process and preferences process.
- `src/network`: Linux `/proc` parsing, rate formatting, and timed sampling.
  Parsers and formatting are GI-independent and covered by smoke tests.
- `src/shell`: top-panel actors. The network indicator only renders the latest
  sample and intentionally creates no popup menu.
- `src/bing`: Bing metadata access, download scheduling, deduplication,
  compact history, resolution selection, and bounded cleanup. It never writes
  desktop wallpaper settings.
- `src/background`: image discovery, desktop wallpaper lookup, validation, and
  the desktop portal file chooser.
- `src/appearance`: application-level workflows plus image and session state
  changes.
- `src/privileged`: the fixed privileged script and the only subprocess entry
  point. Callers pass structured options rather than constructing commands.
- `src/preferences`: preferences composition and feature-specific groups.

Root `extension.js` and `prefs.js` are entrypoints only. Infrastructure must
not import Shell or preferences modules, keeping business services usable from
both processes.

## Persistent state and ownership

- The extension schema is `org.gnome.shell.extensions.ubuntu-appearance`.
  `src/config/constants.js` is the canonical list of schema keys; consumers
  must not repeat string literals for those keys.
- Images selected for desktop, login, and Plymouth are copied into the
  extension's managed image store before use. The stored path and the original
  display name are separate settings, so deleting a source file does not break
  an active background.
- Bing downloads are kept in the selected download directory and tracked in a
  compact GSettings history. Cleanup may remove only files owned and recorded
  by this extension; favorite records are excluded.
- `src/privileged/script.js` is the sole owner of system-wide GDM and Plymouth
  mutations. Its operations are fixed, arguments are validated before and
  after privilege elevation, and it is invoked only through
  `src/privileged/runner.js`.

## Verification

The `tests/*-smoke.js` scripts cover GI-independent parsing and formatting,
plus GJS-based history cleanup, managed-image bookkeeping, and generated
privileged-script invariants. Run the GI-independent tests with Node.js; run
the remaining tests with GJS and a compiled extension schema where required.
