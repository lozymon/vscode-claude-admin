import * as vscode from 'vscode';
import { ConfigManager } from './config/ConfigManager';
import { WebviewPanel } from './webview/WebviewPanel';

export function activate(context: vscode.ExtensionContext) {
  const configManager = new ConfigManager();

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(gear) Claude Code';
  statusBar.tooltip = 'Open Claude Code Admin';
  statusBar.command = 'claudeAdmin.open';
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeAdmin.open', () => {
      WebviewPanel.createOrShow(context, configManager, 'model', 'project');
    }),

    vscode.commands.registerCommand('claudeAdmin.refresh', () => {
      configManager.reload();
      WebviewPanel.currentPanel?.update(configManager);
    }),
  );

  configManager.onDidChange(() => {
    WebviewPanel.currentPanel?.update(configManager);
  });
}

export function deactivate() {}
