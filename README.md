# dsh-deeplink — Web UI deep links

Open a specific DeepSeek Harness conversation or workspace from a URL, and keep the address bar ready to copy or bookmark.

**Compatibility target:** DSH **0.2.1-alpha.3**, Node.js **22+**. Version 0.7.0 uses the current split Controller / UI services and Plugins detail-page API. Older DSH versions using the removed client-runtime or settings namespace APIs are not supported by this release.

## Install this checkout

Use the profile that serves your Web GUI (replace `web` if yours has another name):

```sh
dsh --version
dsh plugin --profile web add /absolute/path/to/dsh-deeplink
```

For example, from the checkout directory on macOS/Linux:

```sh
dsh plugin --profile web add "link:$PWD"
```

This command changes the selected DSH profile. Restart that profile's existing DSH process and refresh the browser after installation. No DSH source modification, package build, or additional server is needed. The directly authored [browser bundle](<lib/client.js>) and [host entry](<lib/index.js>) are already included.

Use `link:` to explicitly keep the profile dependency pointing at your checkout. A plain local-path install may be copied by the package manager; in that case, re-add it after editing. Even with `link:`, restart DSH and refresh the browser after host changes. Do not assume editing this repository updates a running GUI automatically.

The bundle patch is declared in [the package manifest](<package.json>) and mounts the host plugin through [the Cordis patch](<cordis.patch.yml>).

## Usage

Append the parameter to the actual URL of your DSH instance:

| Parameter | Meaning | Example |
|---|---|---|
| `?session=<session-id>` | Open an existing, listed, non-archived conversation | `http://127.0.0.1:3080/?session=session-id` |
| `?workspace=<workspace-id>` | Open a new or reusable blank conversation in that workspace | `http://127.0.0.1:3080/?workspace=workspace-id` |

- Session wins if both nonempty parameters are present.
- The plugin waits for **both** session and workspace baselines before resolving a target, so archive facts are available too.
- Unknown, unlisted, or archived sessions, and unknown workspaces, leave default navigation unchanged. Connection failures are handled and logged to the browser console.
- A workspace link follows the current DSH new-conversation flow: it is **not** a guarantee of opening the latest existing conversation.
- After navigation, the URL follows the main conversation using `history.replaceState`, without adding browser history entries or reloading. Background agents and sidebar references do not become the selected link.
- Clearing the main conversation removes the plugin's parameters. Other query parameters, the URL hash, the proxy base path, and the existing history state are preserved.
- HTTP(S) links rendered in conversations normally open a new tab; pasting a URL into the address bar navigates that tab.
- Links do not bypass authentication or grant access. Use the URL of an instance the recipient can actually reach, and do not share authentication tokens.

## Settings

Open **Plugins**, then the **dsh-deeplink bundle's detail page**. Its **Deep links** settings appear through the current `plugins.bundle.config` slot, keyed by `@dsh-community/dsh-deeplink`. The old Settings → Plugins → Plugin configuration card API has been removed from current DSH.

Both toggles default to on, are saved immediately in this browser's `localStorage`, and retain the keys used by earlier releases:

| Toggle | Storage key | Effect |
|---|---|---|
| Open linked conversation | `dsh-deeplink.jump` | Process URL targets on page load; reload/open a link after changing it. |
| Follow current conversation | `dsh-deeplink.follow` | Update the address bar; changing it takes effect immediately. |

These are browser-local preferences, not host/profile configuration. There is no host settings schema or save button. Styles are owned by the plugin rather than relying on private, hashed DSH CSS class names.

## Model prompt and IDs

The host registers `plugin:dsh-deeplink` as a system-prompt section. It reads `webApp.getAdvertisedUrl()` lazily, after the listener can be bound, respecting HTTPS, IPv6, and a configured reverse-proxy public URL/base path rather than assuming localhost and a fixed port.

The prompt guides the model through the indexed session tools **when they are exposed by the current profile**:

| Tool | When to use it |
|---|---|
| `session_search` | Literal full-text search of prior conversations in the caller workspace; returns the strongest matching event per session. It does not search the current conversation. |
| `session_event_search` | Find earlier events in this conversation (omit `session_id`), or within another authorized session whose ID is known. |
| `session_event_read` | Read the exact event behind a hit, using its sequence number; a snippet is not the full context. |
| `session_trace` | Identify the current session or inspect ancestors/descendants; this is lineage, not a transcript reader. |
| `session_event_trace` | Inspect replacements and source relationships before relying on a historical/shadowed event. |

Search with short, distinctive literal phrases rather than assuming semantic matching. Narrow with supported event/sequence/time filters as needed. No matches do not prove absence, and workspace-scoped search is not a global search across all projects. Search, read, and trace were manually exercised against the development conversation; local conversation IDs and content are not embedded in this package.

These tools are provided by DSH/the selected profile, not implemented or installed by this plugin. The plugin uses the exposed tool contract whether the host search implementation is standard or incrementally indexed; it does not require a particular third-party search package. If tools are unavailable, the model must say so or ask for the ID, not scan private storage files.

Only IDs returned by tools or explicitly supplied by the user may become links. To get a conversation link yourself, open it and copy the address bar with Follow enabled. Workspace IDs must come from a workspace-aware tool or the instance's workspace data; directory names and display titles are not workspace IDs.

## Development and validation

No dependency installation or build is needed:

```sh
npm run check
npm test
```

[Behavior tests](<test/deeplink.test.js>) exercise the module-loader bundle with current-shape service fixtures, navigation readiness, archive handling, URL preservation, independent preferences, errors, and cleanup on unload.

To additionally validate against a local DSH installation:

```sh
DSH_INSTALL_ROOT=/absolute/path/to/node_modules/@deepseek-ai/dsh npm test
```

[The runtime smoke test](<test/runtime.test.js>) checks the real Cordis lifecycle, system-prompt assembly/removal, current slot registration contract, and resolution of every declared client package. It is skipped when `DSH_INSTALL_ROOT` is not set. It does not touch profiles, session data, or listening sockets.

Manual check after installing/restarting your profile:

1. Open a known `?session=` link and confirm it wins over the restored conversation.
2. Open a known `?workspace=` link and confirm it creates/reuses a blank there.
3. Switch conversations and check the URL follows; unknown/archived targets must not open.
4. Open the plugin bundle's detail page and test both toggles independently.
5. Test at the advertised public URL if using HTTPS or a reverse proxy.

Automated smoke tests do not replace this installed-browser check. A client-plugin HMR receiver alone does not guarantee rebuilt bundles: automatic updates also require the DSH checkout's active `pnpm run dev:web` watcher. Otherwise reinstall/restart/refresh as above. Host changes always require a DSH restart.

## License

[MIT](<LICENSE>) · Copyright (c) 2026 DSH Community Contributors

## Changelog

### 2026-10-15 · v0.7.0 — DSH 0.2.1-alpha.3 compatibility

- Replace the removed client-runtime package edge with current Controller, renderer, layout, workspace UI, and plugin-manager packages.
- Navigate through `uiWorkspace.openSession/openWorkspace`; follow main-view retention instead of removed `sessions.list.current` / `sessions.open` APIs.
- Replace removed `settings.register` / `settings.plugin.item` with browser-local settings on `plugins.bundle.config`; remove the undeclared schemastery import and private DSH CSS classes.
- Use the advertised Web app URL lazily for model links, including HTTPS/proxy paths; remove obsolete storage-file discovery instructions.
- Preserve unrelated query/hash/history state, handle async failures and disposal, and add unit/runtime smoke tests.
- Guide the model through indexed prior-session search, current-session event search, exact reads, lineage, and replacement checks without relying on private storage layouts.

### 2026-09-13 · v0.6.1 — Current DSH settings compatibility

- Replaced the removed `settingsNamespace` / `installSettingsSection` named imports with direct optional-service registration through `ctx.settings.register()`.
- Restored startup compatibility with current DSH releases while preserving the configurable-plugin card and browser-local toggle behavior.

### 2026-08-29 · v0.6.0 — Settings move to a configurable-plugin card

- The 深链 settings (two toggles) now appear in **设置 → 插件 → 插件配置** as a **collapsible card**, next to 终端 / Agent 循环 / 网页搜索, rendered through the official `settings.plugin.item` slot and keyed by the `dsh-deeplink` settings namespace (same structure and `YyYd_a_*` classes as the built-in PluginCard).
- The node half registers the namespace via `installSettingsSection` with a schemastery schema; card toggles still persist in `localStorage`.
- Dependency links (`schemastery`, `dsh-settings`) are git-ignored — install via `dsh plugin --profile web add github:qyw233/dsh-deeplink` which links them at runtime.

### 2026-08-13 · v0.5.0 — Settings toggles

- Added a **深链** section in Settings with two independent toggles: `jump` (deep-link jump, default on) and `follow` (address-bar following, default on), both persisted in `localStorage`.

### 2026-08-13 · v0.4.0 — Persistent links + newer-version compatibility

- Address bar follows the current session: after a deep-link switch or a manual switch, the URL is rewritten to `?session=<current-session-id>` via `history.replaceState`; cleared when no session is current. No history pollution, no reload.
- Adapted to the `httpServer` → `webServer` service rename.
- Added the `dsh.bundle` declaration and `cordis.patch.yml` for the newer `dsh plugin` bundle mechanism.

### 2026-08-12 · v0.3.0 — Dropped the new-window parameter, unified new-tab open

- Reverted the `&new=1` `window.open` logic (the renderer already forces `_blank` on http links, so `new` would open two windows).
- Prompt and README aligned: a deep-link click opens a new tab.

### 2026-08-12 · v0.2.0 — New-window mode + model prompt (reverted)

- (Reverted) `&new=1` new-window mode.
- Node half registers the `plugin:dsh-deeplink` prompt section so the model knows deep links exist and can attach links when referring to other conversations/projects.

### 2026-08-12 · v0.1.0 — Initial release

- `?session=` / `?workspace=` deep-link support; unknown targets fall back silently; read-only, never rewrites the URL.