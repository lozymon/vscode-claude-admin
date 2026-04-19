import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  ClaudeConfig,
  MarkdownFile,
  McpServer,
  Settings,
  SettingsLocal,
} from './schema';
import { projectPaths, globalPaths } from './paths';

export class ConfigManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private watchers: vscode.FileSystemWatcher[] = [];

  projectConfig: ClaudeConfig = this.emptyConfig();
  globalConfig: { settings: Settings; commands: MarkdownFile[] } = {
    settings: {},
    commands: [],
  };

  constructor() {
    this.reload();
    this.setupWatchers();
  }

  reload() {
    this.projectConfig = this.loadProject();
    this.globalConfig = this.loadGlobal();
  }

  private emptyConfig(): ClaudeConfig {
    return {
      settings: { permissions: { allow: [], deny: [] } },
      settingsLocal: {},
      mcpServers: {},
      claudeMd: '',
      rules: [],
      commands: [],
      skills: [],
      workflows: [],
    };
  }

  private readJson<T>(filePath: string): T | null {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private writeJson(filePath: string, data: unknown) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }

  private readMarkdownFiles(dir: string): MarkdownFile[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const filePath = path.join(dir, f);
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        const firstLine = lines.find((l) => l.trim()) ?? '';
        return { name: f.replace(/\.md$/, ''), firstLine, filePath };
      });
  }

  private loadProject(): ClaudeConfig {
    const p = projectPaths();
    if (!p) return this.emptyConfig();

    const settings = this.readJson<Settings>(p.settingsJson) ?? {
      permissions: { allow: [], deny: [] },
    };
    const settingsLocal =
      this.readJson<SettingsLocal>(p.settingsLocalJson) ?? {};
    const mcpFile = this.readJson<{ mcpServers: Record<string, McpServer> }>(
      p.mcpJson,
    );
    const mcpServers = mcpFile?.mcpServers ?? settings.mcpServers ?? {};
    const claudeMd = fs.existsSync(p.claudeMd)
      ? fs.readFileSync(p.claudeMd, 'utf8')
      : '';

    if (!settings.permissions) settings.permissions = { allow: [], deny: [] };

    return {
      settings,
      settingsLocal,
      mcpServers,
      claudeMd,
      rules: this.readMarkdownFiles(p.rules),
      commands: this.readMarkdownFiles(p.commands),
      skills: this.readMarkdownFiles(p.skills),
      workflows: this.readMarkdownFiles(p.workflows),
    };
  }

  private loadGlobal() {
    const g = globalPaths();
    const settings = this.readJson<Settings>(g.settingsJson) ?? {};
    if (!settings.permissions) settings.permissions = { allow: [], deny: [] };
    const commands = this.readMarkdownFiles(g.commands);
    return { settings, commands };
  }

  private setupWatchers() {
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [];

    const patterns = [
      '**/.claude/settings.json',
      '**/.claude/settings.local.json',
      '**/.claude/.mcp.json',
      '**/CLAUDE.md',
      '**/.claude/rules/*.md',
      '**/.claude/commands/*.md',
      '**/.claude/skills/*.md',
      '**/.claude/workflows/*.md',
    ];

    for (const pattern of patterns) {
      const w = vscode.workspace.createFileSystemWatcher(pattern);
      w.onDidChange(() => {
        this.reload();
        this._onDidChange.fire();
      });
      w.onDidCreate(() => {
        this.reload();
        this._onDidChange.fire();
      });
      w.onDidDelete(() => {
        this.reload();
        this._onDidChange.fire();
      });
      this.watchers.push(w);
    }
  }

  // --- Write methods ---

  saveProjectSettings(settings: Settings) {
    const p = projectPaths();
    if (!p) return;
    const existing = this.readJson<Settings>(p.settingsJson) ?? {};
    this.writeJson(p.settingsJson, { ...existing, ...settings });
    this.reload();
    this._onDidChange.fire();
  }

  saveSettingsLocal(local: SettingsLocal) {
    const p = projectPaths();
    if (!p) return;
    const existing = this.readJson<SettingsLocal>(p.settingsLocalJson) ?? {};
    this.writeJson(p.settingsLocalJson, { ...existing, ...local });
    this.reload();
    this._onDidChange.fire();
  }

  saveMcpServers(servers: Record<string, McpServer>) {
    const p = projectPaths();
    if (!p) return;
    this.writeJson(p.mcpJson, { mcpServers: servers });
    this.reload();
    this._onDidChange.fire();
  }

  saveClaudeMd(content: string) {
    const p = projectPaths();
    if (!p) return;
    fs.writeFileSync(p.claudeMd, content, 'utf8');
    this.reload();
    this._onDidChange.fire();
  }

  saveGlobalSettings(settings: Settings) {
    const g = globalPaths();
    const existing = this.readJson<Settings>(g.settingsJson) ?? {};
    this.writeJson(g.settingsJson, { ...existing, ...settings });
    this.reload();
    this._onDidChange.fire();
  }

  async createMarkdownFile(
    sectionType: string,
    name: string,
    scope: 'project' | 'global',
  ) {
    let dir: string | undefined;
    if (scope === 'global') {
      dir = globalPaths().commands;
    } else {
      const p = projectPaths();
      if (!p) return;
      dir = (p as any)[sectionType];
    }
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${name}.md`);
    fs.writeFileSync(filePath, `# ${name}\n`, 'utf8');
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    this.reload();
    this._onDidChange.fire();
  }

  async deleteMarkdownFile(filePath: string) {
    fs.rmSync(filePath);
    this.reload();
    this._onDidChange.fire();
  }

  dispose() {
    this.watchers.forEach((w) => w.dispose());
    this._onDidChange.dispose();
  }
}
