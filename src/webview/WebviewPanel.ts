import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config/ConfigManager';
import { Settings, SettingsLocal } from '../config/schema';

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
    };
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'saveModel':
        this.config.saveProjectSettings({ model: msg.model });
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
      case 'savePermissions': {
        const scope: 'project' | 'global' = msg.scope;
        const settings: Settings = scope === 'project'
          ? { ...this.config.projectConfig.settings, permissions: msg.permissions }
          : { ...this.config.globalConfig.settings, permissions: msg.permissions };
        if (scope === 'project') this.config.saveProjectSettings(settings);
        else this.config.saveGlobalSettings(settings);
        break;
      }
      case 'saveHooks': {
        const scope: 'project' | 'global' = msg.scope;
        if (scope === 'project') this.config.saveProjectSettings({ hooks: msg.hooks });
        else this.config.saveGlobalSettings({ hooks: msg.hooks });
        break;
      }
      case 'saveClaudeMd':
        this.config.saveClaudeMd(msg.content);
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

    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(uiDir, 'main.js'))
    );
    return fs.readFileSync(htmlPath, 'utf8').replace('<script src="main.js"></script>', `<script src="${scriptUri}"></script>`);
  }

  private dispose() {
    WebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
