export interface Hook {
  type: 'command';
  command: string;
}

export interface HookEntry {
  matcher?: string;
  hooks: Hook[];
}

export interface Hooks {
  PreToolUse?: HookEntry[];
  PostToolUse?: HookEntry[];
  Stop?: HookEntry[];
  Notification?: HookEntry[];
}

export interface Permissions {
  allow: string[];
  deny: string[];
}

export interface McpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpJson {
  mcpServers: Record<string, McpServer>;
}

export interface Settings {
  model?: string;
  permissions?: Permissions;
  hooks?: Hooks;
  mcpServers?: Record<string, McpServer>;
}

export interface SettingsLocal {
  permissions?: Permissions;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
}

export interface MarkdownFile {
  name: string;
  firstLine: string;
  filePath: string;
}

export interface ClaudeConfig {
  settings: Settings;
  settingsLocal: SettingsLocal;
  mcpServers: Record<string, McpServer>;
  claudeMd: string;
  rules: MarkdownFile[];
  commands: MarkdownFile[];
  skills: MarkdownFile[];
  workflows: MarkdownFile[];
}
