# CC Admin

**GUI for all Claude Code configuration — no more hand-editing JSON or markdown files.** Manage models, MCP servers, permissions, hooks, slash commands, skills, agents, memory, and more from a single VSCode panel, at both project and global scope.

> This project is not affiliated with or endorsed by Anthropic. Claude is a trademark of Anthropic.

![Dashboard](media/screenshot-dashboard.png)

## Requirements

- VSCode `^1.85.0`
- [Claude Code CLI](https://docs.claude.com/claude-code) installed. CC Admin reads and writes the same `.claude/` files Claude Code uses — it is not useful without it.

## Getting Started

1. Install the extension from the Marketplace.
2. Open any project in VSCode.
3. Press `Ctrl+Shift+Alt+C` (Mac: `Cmd+Shift+Alt+C`), or click **⚙ CC Admin** in the status bar.
4. Use the **Project** / **Global** toggle in the sidebar to switch scope.

If the project has no Claude Code config yet, the dashboard shows an **Initialize** banner that walks you through creating one without overwriting anything.

## Features

### Dashboard

Live overview of your setup: current model, MCP servers, permission rules (allow / ask / deny), hooks, env vars, memory files, plans, and project file counts. Each card links to the matching detail page.

### Initialize Project

Setup wizard for projects without Claude Code configured. Choose a model, edit the CLAUDE.md template, select which directories to scaffold (`rules/`, `commands/`, `skills/`, `workflows/`), and optionally create a `.claudeignore`. Safe to re-run — existing files are never overwritten.

### Model

- Primary model (Opus 4.7, Sonnet 4.6, Haiku 4.5)
- Separate small/background model for lightweight tasks
- **Effort level** — `low`, `medium`, `high`, `xhigh`, `max`
- **Extended Thinking** toggle (`alwaysThinkingEnabled`)
- **Show Thinking Summaries** toggle

### MCP Servers

- Add, remove, and enable/disable MCP servers
- Support for `stdio`, `sse`, and `http` server types
- Per-server environment variables and headers

### Permissions

- **Default Mode** — `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`
- Tag-style editors for `allow`, `ask`, and `deny` lists
- Project and global scope

### Hooks

- View, add, and delete hooks by event (PreToolUse, PostToolUse, Stop, Notification)
- Matcher (regex) support
- Inline hints for `if` and exit-code conventions

### Environment Variables

- Manage `env` key/value pairs passed to Claude on every run
- Project and global scope

### Advanced

- Override or append to the system prompt (`systemPrompt`, `appendSystemPrompt`)
- **Available Models** — restrict which models users can pick
- **Bash Timeout** and **Max Thinking Tokens**
- **View Mode** — `default`, `verbose`, `focus`
- **Response Language** and **Output Style**
- **Session Cleanup Period** — how many days to keep session files
- **Status Line Command** and **File Suggestion Command**
- **Auto Memory Directory**
- **Include Git Instructions**, **Respect .gitignore**, **Prefers Reduced Motion**, **Fast Mode Per Session**
- Commit attribution settings

### Sandbox

- Enable/disable sandbox mode globally
- **Excluded commands** that bypass sandboxing
- **Filesystem** — allow/deny lists for read and write path patterns
- **Network** — allowed/denied domain lists, toggle local binding

### CLAUDE.md and .claudeignore

- Full editor for your project's main Claude instructions
- Editor for the project-level ignore file

### Rules · Commands · Skills · Workflows · Agents

- Browse, open, and delete `.md` files in each category
- Create new files with a name prompt; opens in the editor automatically
- Agents support front-matter fields (model, tools, effort, color)

### Memory

- Edit `~/.claude/MEMORY.md` directly
- Browse global memory files (`~/.claude/memory/*.md`)
- Browse per-project memory files (`~/.claude/projects/<slug>/memory/*.md`)

### Plans

Read-only listing of active plans from `~/.claude/plans/` created during Claude Code conversations.

### App Config

- **Account** — view the logged-in Claude Code account; log out or switch account
- **Editor mode** — `default` or `vim`
- **Auto Scroll**, **Show Turn Duration**, **Terminal Progress Bar**
- **Auto Connect IDE**, **Auto Install IDE Extension**
- **Plugins** — enable/disable installed plugins
- **Extra Known Marketplaces** — additional plugin marketplace URLs

## Opening the Panel

- **Status bar** — click `⚙ CC Admin` in the bottom-right corner
- **Keyboard shortcut** — `Ctrl+Shift+Alt+C` (Mac: `Cmd+Shift+Alt+C`)
- **Command palette** — `CC Admin: Open`

## Config Files Managed

| File                                     | Scope                                             |
| ---------------------------------------- | ------------------------------------------------- |
| `.claude/settings.json`                  | Project — model, env, prompts, permissions, hooks |
| `.claude/settings.local.json`            | Project local — MCP toggles                       |
| `.claude/.mcp.json`                      | Project — MCP server definitions                  |
| `CLAUDE.md`                              | Project — main instructions                       |
| `.claudeignore`                          | Project — paths to exclude from context           |
| `.claude/rules/*.md`                     | Project — coding standards                        |
| `.claude/commands/*.md`                  | Project — slash commands                          |
| `.claude/skills/*.md`                    | Project — reusable tasks                          |
| `.claude/workflows/*.md`                 | Project — multi-step workflows                    |
| `.claude/agents/*.md`                    | Project — sub-agents                              |
| `~/.claude/settings.json`                | Global — model, env, permissions, hooks           |
| `~/.claude/commands/*.md`                | Global — slash commands                           |
| `~/.claude/rules/*.md`                   | Global — coding standards                         |
| `~/.claude/skills/*.md`                  | Global — skills                                   |
| `~/.claude/workflows/*.md`               | Global — workflows                                |
| `~/.claude/agents/*.md`                  | Global — sub-agents                               |
| `~/.claude/MEMORY.md`                    | Global — memory index                             |
| `~/.claude/memory/*.md`                  | Global — individual memory files                  |
| `~/.claude/projects/<slug>/memory/*.md`  | Project-scoped memory under the global tree       |
| `~/.claude/plans/*.md`                   | Active plans (read-only)                          |

## Release Notes

See [GitHub Releases](https://github.com/lozymon/vscode-cc-admin/releases).

## Development

```bash
npm install
npm run build    # one-off build
npm run watch    # rebuild on change
```

Press **F5** in VSCode to launch the Extension Development Host. See [CLAUDE.md](CLAUDE.md) for architecture notes.

## License

[MIT](LICENSE)
