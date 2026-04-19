import * as vscode from 'vscode';
import { ConfigManager } from '../config/ConfigManager';
import { MarkdownFile } from '../config/schema';

type Scope = 'project' | 'global';

export class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly section?: string,
    public readonly scope?: Scope,
    public readonly sectionType?: string,
    public readonly filePath?: string,
  ) {
    super(label, collapsibleState);
    this.contextValue = filePath
      ? 'file'
      : sectionType
        ? 'fileSection'
        : undefined;
  }
}

export class ClaudeTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private config: ConfigManager) {}

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) return this.getRoots();
    if (element.label === 'PROJECT') return this.getProjectChildren();
    if (element.label === 'GLOBAL') return this.getGlobalChildren();
    if (element.section && element.scope)
      return this.getSectionChildren(element.section, element.scope);
    return [];
  }

  private getRoots(): TreeItem[] {
    return [
      this.scopeItem('PROJECT', 'project'),
      this.scopeItem('GLOBAL', 'global'),
    ];
  }

  private scopeItem(label: string, scope: Scope): TreeItem {
    const item = new TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
    item.description = scope === 'project' ? '.claude/' : '~/.claude/';
    item.iconPath = new vscode.ThemeIcon('folder');
    return item;
  }

  private getProjectChildren(): TreeItem[] {
    const { settings, mcpServers, rules, commands, skills, workflows } =
      this.config.projectConfig;
    const model = settings.model ?? 'not set';
    const mcpCount = Object.keys(mcpServers).length;
    const allowCount = settings.permissions?.allow.length ?? 0;
    const denyCount = settings.permissions?.deny.length ?? 0;

    return [
      this.sectionItem('Model', `model`, 'project', `${model}`, 'symbol-misc'),
      this.sectionItem('MCP Servers', 'mcp', 'project', `${mcpCount}`, 'plug'),
      this.sectionItem(
        'Permissions',
        'permissions',
        'project',
        `allow ${allowCount} / deny ${denyCount}`,
        'shield',
      ),
      this.sectionItem('Hooks', 'hooks', 'project', undefined, 'zap'),
      this.sectionItem(
        'CLAUDE.md',
        'claudeMd',
        'project',
        undefined,
        'file-text',
      ),
      this.fileSectionItem('Rules', 'rules', 'project', rules),
      this.fileSectionItem('Commands', 'commands', 'project', commands),
      this.fileSectionItem('Skills', 'skills', 'project', skills),
      this.fileSectionItem('Workflows', 'workflows', 'project', workflows),
    ];
  }

  private getGlobalChildren(): TreeItem[] {
    const { settings, commands } = this.config.globalConfig;
    const allowCount = settings.permissions?.allow.length ?? 0;
    const denyCount = settings.permissions?.deny.length ?? 0;

    return [
      this.sectionItem(
        'Permissions',
        'permissions',
        'global',
        `allow ${allowCount} / deny ${denyCount}`,
        'shield',
      ),
      this.sectionItem('Hooks', 'hooks', 'global', undefined, 'zap'),
      this.fileSectionItem('Commands', 'commands', 'global', commands),
    ];
  }

  private getSectionChildren(section: string, scope: Scope): TreeItem[] {
    let files: MarkdownFile[] = [];
    if (scope === 'project') {
      files = (this.config.projectConfig as any)[section] ?? [];
    } else {
      files = (this.config.globalConfig as any)[section] ?? [];
    }
    return files.map((f) => {
      const item = new TreeItem(
        f.name,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        scope,
        section,
        f.filePath,
      );
      item.description = f.firstLine.replace(/^#+\s*/, '').slice(0, 60);
      item.iconPath = new vscode.ThemeIcon('file');
      item.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(f.filePath)],
      };
      return item;
    });
  }

  private sectionItem(
    label: string,
    section: string,
    scope: Scope,
    description?: string,
    icon?: string,
  ): TreeItem {
    const item = new TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
      section,
      scope,
    );
    if (description) item.description = description;
    if (icon) item.iconPath = new vscode.ThemeIcon(icon);
    item.command = {
      command: 'claudeAdmin.openSection',
      title: 'Open',
      arguments: [section, scope],
    };
    return item;
  }

  private fileSectionItem(
    label: string,
    sectionType: string,
    scope: Scope,
    files: MarkdownFile[],
  ): TreeItem {
    const item = new TreeItem(
      label,
      vscode.TreeItemCollapsibleState.Collapsed,
      sectionType,
      scope,
      sectionType,
    );
    item.description = `${files.length}`;
    item.iconPath = new vscode.ThemeIcon('files');
    item.command = {
      command: 'claudeAdmin.openSection',
      title: 'Open',
      arguments: [sectionType, scope],
    };
    return item;
  }
}
