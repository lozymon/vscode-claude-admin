export interface Hook {
  type: 'command' | 'http' | 'prompt' | 'agent';
  command?: string;
  url?: string;
  prompt?: string;
  agent?: string;
  if?: string;
}

export interface HookEntry {
  matcher?: string;
  hooks: Hook[];
}

export interface Hooks {
  SessionStart?: HookEntry[];
  UserPromptSubmit?: HookEntry[];
  PreToolUse?: HookEntry[];
  PermissionRequest?: HookEntry[];
  PermissionDenied?: HookEntry[];
  PostToolUse?: HookEntry[];
  PostToolUseFailure?: HookEntry[];
  Notification?: HookEntry[];
  SubagentStart?: HookEntry[];
  SubagentStop?: HookEntry[];
  TaskCreated?: HookEntry[];
  TaskCompleted?: HookEntry[];
  Stop?: HookEntry[];
  StopFailure?: HookEntry[];
  TeammateIdle?: HookEntry[];
  InstructionsLoaded?: HookEntry[];
  ConfigChange?: HookEntry[];
  CwdChanged?: HookEntry[];
  FileChanged?: HookEntry[];
  WorktreeCreate?: HookEntry[];
  WorktreeRemove?: HookEntry[];
  PreCompact?: HookEntry[];
  PostCompact?: HookEntry[];
  Elicitation?: HookEntry[];
  ElicitationResult?: HookEntry[];
  SessionEnd?: HookEntry[];
}

export interface Permissions {
  allow: string[];
  deny: string[];
  ask?: string[];
  defaultMode?: 'default' | 'acceptEdits' | 'plan' | 'auto' | 'dontAsk' | 'bypassPermissions';
}

export interface McpServer {
  type?: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface McpJson {
  mcpServers: Record<string, McpServer>;
}

export interface SandboxFilesystem {
  allowWrite?: string[];
  denyWrite?: string[];
  denyRead?: string[];
  allowRead?: string[];
}

export interface SandboxNetwork {
  allowedDomains?: string[];
  deniedDomains?: string[];
  allowLocalBinding?: boolean;
}

export interface SandboxConfig {
  enabled?: boolean;
  excludedCommands?: string[];
  filesystem?: SandboxFilesystem;
  network?: SandboxNetwork;
}

export interface Settings {
  model?: string;
  smallModel?: string;
  effortLevel?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  alwaysThinkingEnabled?: boolean;
  showThinkingSummaries?: boolean;
  maxThinkingTokens?: number;
  permissions?: Permissions;
  hooks?: Hooks;
  mcpServers?: Record<string, McpServer>;
  env?: Record<string, string>;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  bashTimeout?: number;
  viewMode?: 'default' | 'verbose' | 'focus';
  language?: string;
  includeGitInstructions?: boolean;
  cleanupPeriodDays?: number;
  respectGitignore?: boolean;
  autoUpdatesChannel?: 'stable' | 'latest';
  defaultShell?: 'bash' | 'powershell';
  outputStyle?: string;
  attribution?: { commit?: string; pr?: string };
  prefersReducedMotion?: boolean;
  availableModels?: string[];
  autoMemoryDirectory?: string;
  fastModePerSessionOptIn?: boolean;
  worktree?: { symlinkDirectories?: string[]; sparsePaths?: string[] };
  companyAnnouncements?: string[];
  sandbox?: SandboxConfig;
  statusLine?: string;
  fileSuggestion?: string;
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

export interface MemoryFile {
  name: string;
  filePath: string;
  content: string;
}

export interface GlobalUserConfig {
  editorMode?: 'default' | 'vim';
  autoScrollEnabled?: boolean;
  showTurnDuration?: boolean;
  terminalProgressBarEnabled?: boolean;
  autoConnectIde?: boolean;
  autoInstallIdeExtension?: boolean;
}

export interface ClaudeConfig {
  settings: Settings;
  settingsLocal: SettingsLocal;
  mcpServers: Record<string, McpServer>;
  claudeMd: string;
  claudeIgnore: string;
  rules: MarkdownFile[];
  commands: MarkdownFile[];
  skills: MarkdownFile[];
  workflows: MarkdownFile[];
  agents: MarkdownFile[];
}

export interface GlobalConfig {
  settings: Settings;
  commands: MarkdownFile[];
  rules: MarkdownFile[];
  skills: MarkdownFile[];
  workflows: MarkdownFile[];
  agents: MarkdownFile[];
  memoryMd: string;
  memory: MemoryFile[];
}
