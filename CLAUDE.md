# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # compile src/ → dist/extension.js via esbuild
npm run watch        # rebuild on file changes
npm run vscode:prepublish  # minified production build
```

Press **F5** in VSCode (with `.vscode/launch.json` present) to launch the Extension Development Host.

## Architecture

The extension is a VSCode sidebar panel for managing Claude Code config. It has three layers:

**Config layer** (`src/config/`)

- `paths.ts` — resolves `.claude/` in the workspace root and `~/.claude/` globally
- `schema.ts` — TypeScript types for all config structures (`Settings`, `SettingsLocal`, `McpServer`, `ClaudeConfig`, etc.)
- `ConfigManager.ts` — single source of truth; reads all files on init, exposes `projectConfig` and `globalConfig`, watches `.claude/**` with `vscode.workspace.createFileSystemWatcher`, fires `onDidChange` on any mutation. All write methods (`saveProjectSettings`, `saveMcpServers`, etc.) merge into existing JSON to avoid overwriting unmanaged keys.

**Tree layer** (`src/tree/ClaudeTreeProvider.ts`)

- Implements `TreeDataProvider<TreeItem>`. Root nodes are `PROJECT` and `GLOBAL`. Clicking leaf items runs `claudeAdmin.openSection` with `(section, scope)` args. File-type nodes (rules/commands/skills/workflows) are collapsible and list individual `.md` files.

**Webview layer** (`src/webview/`)

- `WebviewPanel.ts` — singleton webview panel. Loads `src/webview/ui/index.html` from disk, replaces `<script src="main.js">` with a `webview.asWebviewUri()` path so the CSP allows it. Receives messages from the frontend and delegates to `ConfigManager`. Sends full state via `postMessage` on open and on every `ConfigManager.onDidChange`.
- `ui/index.html` + `ui/main.js` — vanilla JS frontend (no framework). State flows in one direction: extension → `postMessage({ type: 'init'|'stateUpdate', state })` → frontend renders. User actions post back messages (`saveModel`, `saveMcp`, `toggleMcp`, `savePermissions`, `saveHooks`, `saveClaudeMd`, `openFile`, `newFile`, `deleteFile`).

**Entry point** (`src/extension.ts`)

- Wires `ConfigManager` → `ClaudeTreeProvider` → `WebviewPanel`. Registers four commands: `refresh`, `openSection`, `newFile`, `deleteFile`. The `configManager.onDidChange` handler refreshes both the tree and the open webview panel.

## Key Constraints

- `vscode` is marked `external` in esbuild — never import it in UI files, only in `src/**/*.ts`.
- The webview HTML is read directly from `src/` at runtime (not copied to `dist/`), so the `localResourceRoots` must include the `src/webview/ui/` directory.
- MCP server enable/disable state lives in `settings.local.json` (`enabledMcpjsonServers` / `disabledMcpjsonServers`), not in `.mcp.json`.
- Write methods shallow-merge with existing JSON to preserve keys we don't manage (e.g. `mcpServers` inside `settings.json` vs `.mcp.json`).
