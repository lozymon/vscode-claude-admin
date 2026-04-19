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
    claudeIgnore: path.join(root, '.claudeignore'),
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
    rules: path.join(dir, 'rules'),
    skills: path.join(dir, 'skills'),
    workflows: path.join(dir, 'workflows'),
    memoryMd: path.join(dir, 'MEMORY.md'),
    memory: path.join(dir, 'memory'),
  };
}
