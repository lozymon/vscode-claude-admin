# Claude Code Admin

A VSCode extension that provides a GUI admin panel for managing all Claude Code configuration — no more hand-editing JSON or markdown files.

## Features

- **Model** — Switch models (Opus, Sonnet, Haiku) from a dropdown
- **MCP Servers** — Add, remove, and toggle MCP servers with an enable/disable switch
- **Permissions** — Manage allow/deny lists with a tag-style editor
- **Hooks** — View, add, and delete hooks grouped by event type (PreToolUse, PostToolUse, Stop, Notification)
- **CLAUDE.md** — Edit your project's main Claude instructions directly
- **Rules / Commands / Skills / Workflows** — Browse, create, and delete `.md` files in each category
- **Project + Global scope** — Clear separation between `.claude/` (project) and `~/.claude/` (global) config

## Usage

1. Open any project in VSCode
2. Click the **Claude Code** icon in the Activity Bar (left sidebar)
3. Browse your config in the tree panel
4. Click any section to open the admin panel

## Config Files Managed

| File                          | Scope                               |
| ----------------------------- | ----------------------------------- |
| `.claude/settings.json`       | Project — permissions, hooks, model |
| `.claude/settings.local.json` | Project local — MCP toggles         |
| `.claude/.mcp.json`           | Project — MCP server definitions    |
| `CLAUDE.md`                   | Project — main instructions         |
| `.claude/rules/*.md`          | Project — coding standards          |
| `.claude/commands/*.md`       | Project — slash commands            |
| `.claude/skills/*.md`         | Project — reusable tasks            |
| `.claude/workflows/*.md`      | Project — multi-step workflows      |
| `~/.claude/settings.json`     | Global — permissions, hooks         |
| `~/.claude/commands/*.md`     | Global — slash commands             |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch
```

Press **F5** in VSCode to launch the Extension Development Host.

## Project Structure

```
src/
├── extension.ts              # Activation entry point
├── config/
│   ├── ConfigManager.ts      # Read/write all config files + file watchers
│   ├── paths.ts              # Resolve project and global .claude/ paths
│   └── schema.ts             # TypeScript types
├── tree/
│   └── ClaudeTreeProvider.ts # Sidebar tree (PROJECT / GLOBAL)
└── webview/
    ├── WebviewPanel.ts        # Webview lifecycle + message handling
    └── ui/
        ├── index.html         # Panel layout
        └── main.js            # Frontend logic
```
