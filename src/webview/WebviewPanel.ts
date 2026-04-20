import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config/ConfigManager';
import { Settings, SettingsLocal, GlobalUserConfig } from '../config/schema';

export class WebviewPanel {
  static currentPanel: WebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    context: vscode.ExtensionContext,
    config: ConfigManager,
    section: string,
    scope: 'project' | 'global',
  ) {
    if (WebviewPanel.currentPanel) {
      WebviewPanel.currentPanel.panel.reveal();
      WebviewPanel.currentPanel.postState(config, section, scope);
      return;
    }
    const uiDir = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview', 'ui'));
    const panel = vscode.window.createWebviewPanel(
      'claudeAdmin',
      'Claude Code Admin',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [uiDir] },
    );
    WebviewPanel.currentPanel = new WebviewPanel(panel, context, config);
    WebviewPanel.currentPanel.postState(config, section, scope);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private context: vscode.ExtensionContext,
    private config: ConfigManager,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
  }

  update(config: ConfigManager) {
    this.config = config;
    this.panel.webview.postMessage({ type: 'stateUpdate', state: this.buildState() });
  }

  postState(config: ConfigManager, section: string, scope: 'project' | 'global') {
    this.config = config;
    this.panel.webview.postMessage({ type: 'init', state: this.buildState(), section, scope });
  }

  private buildState() {
    return {
      project: this.config.projectConfig,
      global: this.config.globalConfig,
      globalUserConfig: this.config.globalUserConfig,
      isProjectInitialized: this.config.isProjectInitialized,
    };
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'initProject':
        this.config.initProject(msg.options).then(() => {
          this.panel.webview.postMessage({ type: 'init', state: this.buildState(), section: 'dashboard', scope: 'project' });
        });
        break;
      case 'saveModel':
        this.saveSettings(msg.scope, {
          model: msg.model,
          smallModel: msg.smallModel || undefined,
          effortLevel: msg.effortLevel || undefined,
          alwaysThinkingEnabled: msg.alwaysThinkingEnabled,
          showThinkingSummaries: msg.showThinkingSummaries,
        });
        break;
      case 'saveAdvanced':
        this.saveSettings(msg.scope, {
          systemPrompt: msg.systemPrompt || undefined,
          appendSystemPrompt: msg.appendSystemPrompt || undefined,
          bashTimeout: msg.bashTimeout ? Number(msg.bashTimeout) : undefined,
          maxThinkingTokens: msg.maxThinkingTokens ? Number(msg.maxThinkingTokens) : undefined,
          viewMode: msg.viewMode || undefined,
          language: msg.language || undefined,
          cleanupPeriodDays: msg.cleanupPeriodDays ? Number(msg.cleanupPeriodDays) : undefined,
          includeGitInstructions: msg.includeGitInstructions,
          respectGitignore: msg.respectGitignore,
          autoUpdatesChannel: msg.autoUpdatesChannel || undefined,
          defaultShell: msg.defaultShell || undefined,
          outputStyle: msg.outputStyle || undefined,
          attribution: (msg.attributionCommit || msg.attributionPr)
            ? { commit: msg.attributionCommit || undefined, pr: msg.attributionPr || undefined }
            : undefined,
          prefersReducedMotion: msg.prefersReducedMotion,
          availableModels: msg.availableModels?.length ? msg.availableModels : undefined,
          autoMemoryDirectory: msg.autoMemoryDirectory || undefined,
          fastModePerSessionOptIn: msg.fastModePerSessionOptIn,
          worktree: (msg.symlinkDirs?.length || msg.sparsePaths?.length)
            ? { symlinkDirectories: msg.symlinkDirs, sparsePaths: msg.sparsePaths }
            : undefined,
          companyAnnouncements: msg.companyAnnouncements?.length ? msg.companyAnnouncements : undefined,
          statusLine: msg.statusLine || undefined,
          fileSuggestion: msg.fileSuggestion || undefined,
        });
        break;
      case 'saveEnv':
        this.saveSettings(msg.scope, { env: msg.env });
        break;
      case 'saveMcp':
        this.config.saveMcpServers(msg.servers);
        break;
      case 'toggleMcp': {
        const local: SettingsLocal = this.config.projectConfig.settingsLocal;
        const enabled = new Set(local.enabledMcpjsonServers ?? []);
        const disabled = new Set(local.disabledMcpjsonServers ?? []);
        if (msg.enabled) { enabled.add(msg.name); disabled.delete(msg.name); }
        else { disabled.add(msg.name); enabled.delete(msg.name); }
        this.config.saveSettingsLocal({
          ...local,
          enabledMcpjsonServers: [...enabled],
          disabledMcpjsonServers: [...disabled],
        });
        break;
      }
      case 'savePermissions':
        this.saveSettings(msg.scope, { permissions: msg.permissions });
        break;
      case 'saveHooks':
        this.saveSettings(msg.scope, { hooks: msg.hooks });
        break;
      case 'saveSandbox':
        this.saveSettings(msg.scope, { sandbox: msg.sandbox });
        break;
      case 'saveGlobalUserConfig':
        this.config.saveGlobalUserConfig(msg.config as GlobalUserConfig);
        break;
      case 'saveClaudeMd':
        this.config.saveClaudeMd(msg.content);
        break;
      case 'saveClaudeIgnore':
        this.config.saveClaudeIgnore(msg.content);
        break;
      case 'saveNewAgent':
        this.config.createAgentFile(msg.name, msg.content, msg.scope).then(() => {
          this.panel.webview.postMessage({ type: 'stateUpdate', state: this.buildState() });
        });
        break;
      case 'saveMemoryMd':
        this.config.saveMemoryMd(msg.content);
        break;
      case 'readFile': {
        const content = fs.existsSync(msg.filePath) ? fs.readFileSync(msg.filePath, 'utf8') : '';
        this.panel.webview.postMessage({ type: 'fileContent', filePath: msg.filePath, content });
        break;
      }
      case 'saveFileContent':
        fs.writeFileSync(msg.filePath, msg.content, 'utf8');
        this.config.reload();
        this.panel.webview.postMessage({ type: 'stateUpdate', state: this.buildState() });
        break;
      case 'openFile':
        vscode.window.showTextDocument(vscode.Uri.file(msg.filePath));
        break;
      case 'newFile':
        this.handleNewFile(msg.sectionType, msg.scope);
        break;
      case 'deleteFile':
        this.handleDeleteFile(msg.filePath, msg.name);
        break;
    }
  }

  private saveSettings(scope: 'project' | 'global', patch: Partial<Settings>) {
    if (scope === 'project') this.config.saveProjectSettings(patch);
    else this.config.saveGlobalSettings(patch);
  }

  private async handleNewFile(sectionType: string, scope: 'project' | 'global') {
    const name = await vscode.window.showInputBox({ prompt: `New ${sectionType} name (without .md)` });
    if (!name) return;
    await this.config.createMarkdownFile(sectionType, name, scope);
  }

  private async handleDeleteFile(filePath: string, name: string) {
    const confirm = await vscode.window.showWarningMessage(`Delete ${name}?`, { modal: true }, 'Delete');
    if (confirm !== 'Delete') return;
    await this.config.deleteMarkdownFile(filePath);
  }

  private getHtml(): string {
    const uiDir = path.join(this.context.extensionPath, 'src', 'webview', 'ui');
    const htmlPath = path.join(uiDir, 'index.html');
    if (!fs.existsSync(htmlPath)) return '<html><body>UI not found.</body></html>';
    const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(uiDir, 'main.js')));
    const cmUri = this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(uiDir, 'cm-bundle.js')));
    return fs.readFileSync(htmlPath, 'utf8')
      .replace('<script src="main.js"></script>', `<script src="${cmUri}"></script><script src="${scriptUri}"></script>`);
  }

  private dispose() {
    WebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
