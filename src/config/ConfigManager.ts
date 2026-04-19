import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  ClaudeConfig,
  GlobalConfig,
  GlobalUserConfig,
  MarkdownFile,
  MemoryFile,
  McpServer,
  Settings,
  SettingsLocal,
} from './schema';
import { projectPaths, globalPaths, globalUserConfigPath } from './paths';

export class ConfigManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private watchers: vscode.FileSystemWatcher[] = [];

  projectConfig: ClaudeConfig = this.emptyProjectConfig();
  globalConfig: GlobalConfig = this.emptyGlobalConfig();
  globalUserConfig: GlobalUserConfig = {};

  constructor() {
    this.reload();
    this.setupWatchers();
  }

  reload() {
    this.projectConfig = this.loadProject();
    this.globalConfig = this.loadGlobal();
    this.globalUserConfig = this.loadGlobalUserConfig();
  }

  private emptyProjectConfig(): ClaudeConfig {
    return {
      settings: { permissions: { allow: [], deny: [] } },
      settingsLocal: {},
      mcpServers: {},
      claudeMd: '',
      claudeIgnore: '',
      rules: [],
      commands: [],
      skills: [],
      workflows: [],
      agents: [],
    };
  }

  private emptyGlobalConfig(): GlobalConfig {
    return {
      settings: { permissions: { allow: [], deny: [] } },
      commands: [],
      rules: [],
      skills: [],
      workflows: [],
      agents: [],
      memoryMd: '',
      memory: [],
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

  private readText(filePath: string): string {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
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

  private readMemoryFiles(dir: string): MemoryFile[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const filePath = path.join(dir, f);
        const content = fs.readFileSync(filePath, 'utf8');
        return { name: f.replace(/\.md$/, ''), filePath, content };
      });
  }

  private loadProject(): ClaudeConfig {
    const p = projectPaths();
    if (!p) return this.emptyProjectConfig();

    const settings = this.readJson<Settings>(p.settingsJson) ?? {
      permissions: { allow: [], deny: [] },
    };
    const settingsLocal = this.readJson<SettingsLocal>(p.settingsLocalJson) ?? {};
    const mcpFile = this.readJson<{ mcpServers: Record<string, McpServer> }>(p.mcpJson);
    const mcpServers = mcpFile?.mcpServers ?? settings.mcpServers ?? {};

    if (!settings.permissions) settings.permissions = { allow: [], deny: [] };

    return {
      settings,
      settingsLocal,
      mcpServers,
      claudeMd: this.readText(p.claudeMd),
      claudeIgnore: this.readText(p.claudeIgnore),
      rules: this.readMarkdownFiles(p.rules),
      commands: this.readMarkdownFiles(p.commands),
      skills: this.readMarkdownFiles(p.skills),
      workflows: this.readMarkdownFiles(p.workflows),
      agents: this.readMarkdownFiles(p.agents),
    };
  }

  private loadGlobal(): GlobalConfig {
    const g = globalPaths();
    const settings = this.readJson<Settings>(g.settingsJson) ?? {};
    if (!settings.permissions) settings.permissions = { allow: [], deny: [] };

    return {
      settings,
      commands: this.readMarkdownFiles(g.commands),
      rules: this.readMarkdownFiles(g.rules),
      skills: this.readMarkdownFiles(g.skills),
      workflows: this.readMarkdownFiles(g.workflows),
      agents: this.readMarkdownFiles(g.agents),
      memoryMd: this.readText(g.memoryMd),
      memory: this.readMemoryFiles(g.memory),
    };
  }

  private loadGlobalUserConfig(): GlobalUserConfig {
    return this.readJson<GlobalUserConfig>(globalUserConfigPath()) ?? {};
  }

  private setupWatchers() {
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [];

    const patterns = [
      '**/.claude/settings.json',
      '**/.claude/settings.local.json',
      '**/.claude/.mcp.json',
      '**/CLAUDE.md',
      '**/.claudeignore',
      '**/.claude/rules/*.md',
      '**/.claude/commands/*.md',
      '**/.claude/skills/*.md',
      '**/.claude/workflows/*.md',
      '**/.claude/agents/*.md',
    ];

    for (const pattern of patterns) {
      const w = vscode.workspace.createFileSystemWatcher(pattern);
      const fire = () => { this.reload(); this._onDidChange.fire(); };
      w.onDidChange(fire);
      w.onDidCreate(fire);
      w.onDidDelete(fire);
      this.watchers.push(w);
    }
  }

  // --- Write methods ---

  get isProjectInitialized(): boolean {
    const p = projectPaths();
    return !!p && fs.existsSync(path.dirname(p.settingsJson));
  }

  saveProjectSettings(patch: Partial<Settings>) {
    const p = projectPaths();
    if (!p) return;
    const existing = this.readJson<Settings>(p.settingsJson) ?? {};
    this.writeJson(p.settingsJson, { ...existing, ...patch });
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

  saveClaudeIgnore(content: string) {
    const p = projectPaths();
    if (!p) return;
    fs.writeFileSync(p.claudeIgnore, content, 'utf8');
    this.reload();
    this._onDidChange.fire();
  }

  saveGlobalSettings(patch: Partial<Settings>) {
    const g = globalPaths();
    const existing = this.readJson<Settings>(g.settingsJson) ?? {};
    this.writeJson(g.settingsJson, { ...existing, ...patch });
    this.reload();
    this._onDidChange.fire();
  }

  saveMemoryMd(content: string) {
    const g = globalPaths();
    fs.mkdirSync(path.dirname(g.memoryMd), { recursive: true });
    fs.writeFileSync(g.memoryMd, content, 'utf8');
    this.reload();
    this._onDidChange.fire();
  }

  saveGlobalUserConfig(config: GlobalUserConfig) {
    this.writeJson(globalUserConfigPath(), config);
    this.reload();
    this._onDidChange.fire();
  }

  async initProject(options: {
    model: string;
    claudeMd: string;
    claudeIgnore: boolean;
    dirs: string[];
  }) {
    const p = projectPaths();
    if (!p) return;

    const claudeDir = path.dirname(p.settingsJson);
    fs.mkdirSync(claudeDir, { recursive: true });

    this.writeJson(p.settingsJson, {
      model: options.model,
      permissions: { allow: [], deny: [] },
    });

    fs.writeFileSync(p.claudeMd, options.claudeMd, 'utf8');

    if (options.claudeIgnore) {
      fs.writeFileSync(p.claudeIgnore, 'node_modules/\ndist/\n.env\n', 'utf8');
    }

    for (const dir of options.dirs) {
      const dirPath = (p as any)[dir];
      if (dirPath) fs.mkdirSync(dirPath, { recursive: true });
    }

    this.reload();
    this._onDidChange.fire();
  }

  async createAgentFile(name: string, content: string, scope: 'project' | 'global') {
    let dir: string;
    if (scope === 'global') {
      dir = globalPaths().agents;
    } else {
      const p = projectPaths();
      if (!p) return;
      dir = p.agents;
    }
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${name}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    this.reload();
    this._onDidChange.fire();
  }

  async createMarkdownFile(sectionType: string, name: string, scope: 'project' | 'global') {
    let dir: string | undefined;
    if (scope === 'global') {
      const g = globalPaths();
      dir = (g as any)[sectionType];
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
