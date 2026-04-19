import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export function getProjectRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getProjectClaudeDir(): string | undefined {
  const root = getProjectRoot();
  return root ? path.join(root, '.claude') : undefined;
}

export function getGlobalClaudeDir(): string {
  return path.join(os.homedir(), '.claude');
}

export function projectPaths() {
  const dir = getProjectClaudeDir();
  const root = getProjectRoot();
  if (!dir || !root) return null;
  return {
    settingsJson: path.join(dir, 'settings.json'),
    settingsLocalJson: path.join(dir, 'settings.local.json'),
    mcpJson: path.join(dir, '.mcp.json'),
    claudeMd: path.join(root, 'CLAUDE.md'),
    rules: path.join(dir, 'rules'),
    commands: path.join(dir, 'commands'),
    skills: path.join(dir, 'skills'),
    workflows: path.join(dir, 'workflows'),
  };
}

export function globalPaths() {
  const dir = getGlobalClaudeDir();
  return {
    settingsJson: path.join(dir, 'settings.json'),
    commands: path.join(dir, 'commands'),
  };
}
