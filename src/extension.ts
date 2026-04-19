import * as vscode from 'vscode';
import { ClaudeTreeProvider } from './tree/ClaudeTreeProvider';
import { ConfigManager } from './config/ConfigManager';
import { WebviewPanel } from './webview/WebviewPanel';

export function activate(context: vscode.ExtensionContext) {
  const configManager = new ConfigManager();
  const treeProvider = new ClaudeTreeProvider(configManager);
  const treeView = vscode.window.createTreeView('claudeAdminTree', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeAdmin.refresh', () => {
      configManager.reload();
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand(
      'claudeAdmin.openSection',
      (section: string, scope: 'project' | 'global') => {
        WebviewPanel.createOrShow(context, configManager, section, scope);
      },
    ),

    vscode.commands.registerCommand(
      'claudeAdmin.newFile',
      async (item: any) => {
        const name = await vscode.window.showInputBox({
          prompt: `New ${item.sectionType} name (without .md)`,
        });
        if (!name) return;
        await configManager.createMarkdownFile(
          item.sectionType,
          name,
          item.scope,
        );
        treeProvider.refresh();
      },
    ),

    vscode.commands.registerCommand(
      'claudeAdmin.deleteFile',
      async (item: any) => {
        const confirm = await vscode.window.showWarningMessage(
          `Delete ${item.label}?`,
          { modal: true },
          'Delete',
        );
        if (confirm !== 'Delete') return;
        await configManager.deleteMarkdownFile(item.filePath);
        treeProvider.refresh();
      },
    ),
  );

  configManager.onDidChange(() => {
    treeProvider.refresh();
    WebviewPanel.currentPanel?.update(configManager);
  });
}

export function deactivate() {}
