const vscode = acquireVsCodeApi();

let state = { project: null, global: null, globalUserConfig: {}, isProjectInitialized: false };
let currentScope = 'project';
let currentSection = 'dashboard';

// --- CodeMirror editors ---
const mdEditors = {}; // id → { view, getValue, setValue }

function getOrCreateMdEditor(id, initialDoc, onChange, height = '400px') {
  if (mdEditors[id]) return mdEditors[id];
  const container = document.getElementById(id);
  if (!container) return null;
  const ed = CM.createMarkdownEditor(container, initialDoc, { onChange, height });
  mdEditors[id] = ed;
  return ed;
}

function editorValue(id) {
  return mdEditors[id] ? mdEditors[id].getValue() : '';
}

// Inline file editors: type → { filePath, ed }
const inlineEditors = {};

let mcpEnvRows = [];
let mcpHeaderRows = [];

// sandbox tag state
const sandboxTags = {
  excluded: [], allowWrite: [], denyWrite: [], allowRead: [], denyRead: [],
  allowedDomains: [], deniedDomains: [],
};

// --- Nav ---
document.querySelectorAll('.scope-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    currentScope = btn.dataset.scope;
    document.querySelectorAll('.scope-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('topbar-scope').textContent = currentScope === 'project' ? 'Project' : 'Global';
    document.querySelectorAll('.project-only').forEach(el => {
      el.style.display = currentScope === 'global' ? 'none' : '';
    });
    const projectOnlySections = ['claudeMd','claudeIgnore','rules','commands','skills','workflows','agents','init'];
    if (currentScope === 'global' && projectOnlySections.includes(currentSection)) {
      activateSection('dashboard');
    } else {
      render();
    }
  });
});

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => activateSection(btn.dataset.section));
});

function activateSection(name) {
  currentSection = name;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === name));
  document.querySelectorAll('section').forEach(s => s.classList.toggle('active', s.id === `sec-${name}`));
  const activeBtn = document.querySelector(`.nav-btn[data-section="${name}"]`);
  if (activeBtn) document.getElementById('topbar-title').textContent = activeBtn.textContent.trim();
  document.getElementById('topbar-scope').textContent = currentScope === 'project' ? 'Project' : 'Global';
  render();
}

// --- State ---
window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'init') {
    state = msg.state;
    currentScope = msg.scope ?? 'project';
    document.querySelectorAll('.scope-tab').forEach(b => b.classList.toggle('active', b.dataset.scope === currentScope));
    updateInitNav();
    activateSection(msg.section ?? 'dashboard');
  } else if (msg.type === 'stateUpdate') {
    state = msg.state;
    updateInitNav();
    clearAllDirty();
    showToast('Saved');
    render();
  } else if (msg.type === 'fileContent') {
    window._onFileContent(msg.filePath, msg.content);
  }
});

function getConfig() {
  return currentScope === 'project' ? state.project : state.global;
}

// --- Render ---
function render() {
  if (!state.project) return;
  renderDashboard();
  renderInit();
  renderModel();
  renderEnv();
  renderAdvanced();
  renderMcp();
  renderPermissions();
  renderHooks();
  renderClaudeMd();
  renderClaudeIgnore();
  renderMemory();
  renderFileSection('rules');
  renderFileSection('commands');
  renderFileSection('skills');
  renderFileSection('workflows');
  renderFileSection('agents');
  renderSandbox();
  renderAppConfig();
}

// --- Dashboard ---
function renderDashboard() {
  const grid = document.getElementById('dash-grid');
  if (!grid) return;
  const proj = state.project;
  const glob = state.global;
  const cfg = getConfig();
  if (!cfg) return;

  const mcpCount = Object.keys(proj?.mcpServers ?? {}).length;
  const allowCount = cfg.settings?.permissions?.allow?.length ?? 0;
  const denyCount = cfg.settings?.permissions?.deny?.length ?? 0;
  const askCount = cfg.settings?.permissions?.ask?.length ?? 0;
  const hookCount = Object.values(cfg.settings?.hooks ?? {}).reduce((n, arr) => n + arr.length, 0);
  const envCount = Object.keys(cfg.settings?.env ?? {}).length;
  const memCount = (glob?.memory ?? []).length;

  const cards = [
    { label: 'Model', value: cfg.settings?.model ?? 'not set', icon: '⚙', section: 'model' },
    { label: 'MCP Servers', value: mcpCount, icon: '⚡', section: 'mcp' },
    { label: 'Allow Rules', value: allowCount, icon: '✅', section: 'permissions' },
    { label: 'Ask Rules', value: askCount, icon: '❓', section: 'permissions' },
    { label: 'Deny Rules', value: denyCount, icon: '🚫', section: 'permissions' },
    { label: 'Hooks', value: hookCount, icon: '🪝', section: 'hooks' },
    { label: 'Env Vars', value: envCount, icon: '🌿', section: 'env' },
    { label: 'Memory Files', value: memCount, icon: '🧠', section: 'memory' },
  ];

  if (currentScope === 'project') {
    cards.push(
      { label: 'Rules', value: proj?.rules?.length ?? 0, icon: '📏', section: 'rules' },
      { label: 'Commands', value: proj?.commands?.length ?? 0, icon: '💬', section: 'commands' },
      { label: 'Skills', value: proj?.skills?.length ?? 0, icon: '🛠', section: 'skills' },
      { label: 'Workflows', value: proj?.workflows?.length ?? 0, icon: '🔄', section: 'workflows' },
      { label: 'Agents', value: proj?.agents?.length ?? 0, icon: '🤖', section: 'agents' },
    );
  }

  let banner = document.getElementById('dash-not-init');
  if (!state.isProjectInitialized) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dash-not-init';
      banner.className = 'not-init-bar';
      banner.innerHTML = `<span>⚠️ This project has no Claude Code configuration.</span><button id="dash-init-btn">Initialize</button>`;
      banner.querySelector('#dash-init-btn').addEventListener('click', () => activateSection('init'));
      grid.parentElement.insertBefore(banner, grid);
    }
  } else {
    banner?.remove();
  }

  grid.innerHTML = cards.map(c => `
    <div class="dash-card" data-section="${c.section}" style="cursor:pointer">
      <div class="dash-icon">${c.icon}</div>
      <div class="dash-value">${c.value}</div>
      <div class="dash-label">${c.label}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.dash-card').forEach(card => {
    card.addEventListener('click', () => activateSection(card.dataset.section));
  });
}

// --- Model ---
function renderModel() {
  const cfg = getConfig();
  if (!cfg) return;
  const s = cfg.settings ?? {};
  document.getElementById('model-select').value = s.model ?? 'claude-sonnet-4-6';
  document.getElementById('small-model-select').value = s.smallModel ?? '';
  document.getElementById('effort-level-select').value = s.effortLevel ?? 'medium';
  document.getElementById('thinking-toggle').checked = s.alwaysThinkingEnabled ?? false;
  document.getElementById('thinking-summaries-toggle').checked = s.showThinkingSummaries ?? false;
}

document.getElementById('save-model').addEventListener('click', () => {
  vscode.postMessage({
    type: 'saveModel',
    scope: currentScope,
    model: document.getElementById('model-select').value,
    smallModel: document.getElementById('small-model-select').value,
    effortLevel: document.getElementById('effort-level-select').value,
    alwaysThinkingEnabled: document.getElementById('thinking-toggle').checked,
    showThinkingSummaries: document.getElementById('thinking-summaries-toggle').checked,
  });
});

// --- Environment Variables ---
function renderEnv() {
  const cfg = getConfig();
  if (!cfg) return;
  const env = cfg.settings?.env ?? {};
  const tbody = document.getElementById('env-tbody');
  tbody.innerHTML = '';
  Object.entries(env).forEach(([k, v]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${esc(k)}</code></td>
      <td style="font-family:monospace;font-size:11px">${esc(v)}</td>
      <td><button class="icon-btn danger remove-env" data-key="${esc(k)}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.remove-env').forEach(btn => {
    btn.addEventListener('click', () => {
      const cfg = getConfig();
      const env = { ...(cfg.settings?.env ?? {}) };
      delete env[btn.dataset.key];
      if (currentScope === 'project') state.project.settings.env = env;
      else state.global.settings.env = env;
      renderEnv();
    });
  });
}

document.getElementById('env-add').addEventListener('click', () => {
  const k = document.getElementById('env-key').value.trim();
  const v = document.getElementById('env-val').value.trim();
  if (!k) return;
  const cfg = getConfig();
  const env = { ...(cfg.settings?.env ?? {}), [k]: v };
  if (currentScope === 'project') state.project.settings.env = env;
  else state.global.settings.env = env;
  document.getElementById('env-key').value = '';
  document.getElementById('env-val').value = '';
  renderEnv();
});

document.getElementById('save-env').addEventListener('click', () => {
  const cfg = getConfig();
  vscode.postMessage({ type: 'saveEnv', scope: currentScope, env: cfg.settings?.env ?? {} });
});

// --- Advanced ---
let availableModels = [];
let symlinkDirs = [];
let sparsePaths = [];
let announcements = [];

function renderAdvanced() {
  const cfg = getConfig();
  if (!cfg) return;
  const s = cfg.settings ?? {};

  const sp = document.getElementById('system-prompt');
  if (document.activeElement !== sp) sp.value = s.systemPrompt ?? '';
  const asp = document.getElementById('append-system-prompt');
  if (document.activeElement !== asp) asp.value = s.appendSystemPrompt ?? '';

  document.getElementById('bash-timeout').value = s.bashTimeout ?? '';
  document.getElementById('max-thinking-tokens').value = s.maxThinkingTokens ?? '';
  document.getElementById('view-mode').value = s.viewMode ?? '';
  document.getElementById('default-shell').value = s.defaultShell ?? '';
  document.getElementById('language').value = s.language ?? '';
  document.getElementById('output-style').value = s.outputStyle ?? '';
  document.getElementById('cleanup-period-days').value = s.cleanupPeriodDays ?? '';
  document.getElementById('auto-updates-channel').value = s.autoUpdatesChannel ?? '';
  document.getElementById('include-git-instructions').checked = s.includeGitInstructions ?? true;
  document.getElementById('respect-gitignore').checked = s.respectGitignore ?? true;
  document.getElementById('fast-mode-per-session').checked = s.fastModePerSessionOptIn ?? false;
  document.getElementById('prefers-reduced-motion').checked = s.prefersReducedMotion ?? false;
  document.getElementById('attribution-commit').value = s.attribution?.commit ?? '';
  document.getElementById('attribution-pr').value = s.attribution?.pr ?? '';
  document.getElementById('auto-memory-directory').value = s.autoMemoryDirectory ?? '';
  document.getElementById('status-line').value = s.statusLine ?? '';
  document.getElementById('file-suggestion').value = s.fileSuggestion ?? '';

  availableModels = [...(s.availableModels ?? [])];
  symlinkDirs = [...(s.worktree?.symlinkDirectories ?? [])];
  sparsePaths = [...(s.worktree?.sparsePaths ?? [])];
  announcements = [...(s.companyAnnouncements ?? [])];

  renderTagList('available-models-tags', availableModels, () => renderAdvanced());
  renderTagList('symlink-dirs-tags', symlinkDirs, () => renderAdvanced());
  renderTagList('sparse-paths-tags', sparsePaths, () => renderAdvanced());
  renderTagList('announcements-tags', announcements, () => renderAdvanced());
}

function renderTagList(containerId, items, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item, i) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${esc(item)} <button data-i="${i}">×</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      items.splice(i, 1);
      onChange();
    });
    container.appendChild(tag);
  });
}

function addTagFromInput(inputId, arr, onChange) {
  const input = document.getElementById(inputId);
  const val = input.value.trim();
  if (!val) return;
  arr.push(val);
  input.value = '';
  onChange();
}

document.getElementById('available-models-add').addEventListener('click', () =>
  addTagFromInput('available-models-input', availableModels, () => renderTagList('available-models-tags', availableModels, () => {})));
document.getElementById('symlink-dirs-add').addEventListener('click', () =>
  addTagFromInput('symlink-dirs-input', symlinkDirs, () => renderTagList('symlink-dirs-tags', symlinkDirs, () => {})));
document.getElementById('sparse-paths-add').addEventListener('click', () =>
  addTagFromInput('sparse-paths-input', sparsePaths, () => renderTagList('sparse-paths-tags', sparsePaths, () => {})));
document.getElementById('announcements-add').addEventListener('click', () =>
  addTagFromInput('announcements-input', announcements, () => renderTagList('announcements-tags', announcements, () => {})));

document.getElementById('save-advanced').addEventListener('click', () => {
  vscode.postMessage({
    type: 'saveAdvanced',
    scope: currentScope,
    systemPrompt: document.getElementById('system-prompt').value,
    appendSystemPrompt: document.getElementById('append-system-prompt').value,
    bashTimeout: document.getElementById('bash-timeout').value,
    maxThinkingTokens: document.getElementById('max-thinking-tokens').value,
    viewMode: document.getElementById('view-mode').value,
    defaultShell: document.getElementById('default-shell').value,
    language: document.getElementById('language').value,
    outputStyle: document.getElementById('output-style').value,
    cleanupPeriodDays: document.getElementById('cleanup-period-days').value,
    autoUpdatesChannel: document.getElementById('auto-updates-channel').value,
    includeGitInstructions: document.getElementById('include-git-instructions').checked,
    respectGitignore: document.getElementById('respect-gitignore').checked,
    fastModePerSessionOptIn: document.getElementById('fast-mode-per-session').checked,
    prefersReducedMotion: document.getElementById('prefers-reduced-motion').checked,
    attributionCommit: document.getElementById('attribution-commit').value,
    attributionPr: document.getElementById('attribution-pr').value,
    autoMemoryDirectory: document.getElementById('auto-memory-directory').value,
    availableModels,
    symlinkDirs,
    sparsePaths,
    companyAnnouncements: announcements,
    statusLine: document.getElementById('status-line').value,
    fileSuggestion: document.getElementById('file-suggestion').value,
  });
});

// --- MCP ---
function renderMcp() {
  const cfg = state.project;
  if (!cfg) return;
  const tbody = document.getElementById('mcp-tbody');
  const servers = cfg.mcpServers ?? {};
  const local = cfg.settingsLocal ?? {};
  const disabled = new Set(local.disabledMcpjsonServers ?? []);

  tbody.innerHTML = '';
  for (const [name, srv] of Object.entries(servers)) {
    const enabled = !disabled.has(name);
    const isHttp = srv.type === 'sse' || srv.type === 'http';
    const typeLabel = srv.type ?? 'stdio';
    const commandOrUrl = isHttp ? (srv.url ?? '—') : (srv.command ?? '—');
    const argsOrHeaders = isHttp
      ? Object.keys(srv.headers ?? {}).join(', ') || '—'
      : (srv.args ?? []).join(' ') || '—';
    const envEntries = Object.entries(srv.env ?? {});
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(name)}</strong></td>
      <td style="font-size:11px;opacity:0.7">${esc(typeLabel)}</td>
      <td style="font-family:monospace;font-size:11px">${esc(commandOrUrl)}</td>
      <td style="font-family:monospace;font-size:11px">${esc(argsOrHeaders)}</td>
      <td style="font-size:11px;opacity:0.7">${envEntries.map(([k]) => esc(k)).join(', ') || '—'}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${enabled ? 'checked' : ''} data-name="${esc(name)}">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td><button class="icon-btn danger delete-mcp" data-name="${esc(name)}">✕</button></td>
    `;
    tbody.appendChild(tr);
  }

  const thead = document.querySelector('#mcp-table thead tr');
  if (thead) {
    thead.innerHTML = '<th>Name</th><th>Type</th><th>Command/URL</th><th>Args/Headers</th><th>Env</th><th>Enabled</th><th></th>';
  }

  tbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => vscode.postMessage({ type: 'toggleMcp', name: cb.dataset.name, enabled: cb.checked }));
  });
  tbody.querySelectorAll('.delete-mcp').forEach(btn => {
    btn.addEventListener('click', () => {
      const updated = { ...state.project.mcpServers };
      delete updated[btn.dataset.name];
      vscode.postMessage({ type: 'saveMcp', servers: updated });
    });
  });
}

// MCP type toggle
document.getElementById('mcp-type').addEventListener('change', () => {
  const isHttp = ['sse', 'http'].includes(document.getElementById('mcp-type').value);
  document.getElementById('mcp-cmd-field').style.display = isHttp ? 'none' : '';
  document.getElementById('mcp-args-field').style.display = isHttp ? 'none' : '';
  document.getElementById('mcp-url-field').style.display = isHttp ? '' : 'none';
  document.getElementById('mcp-headers-field').style.display = isHttp ? '' : 'none';
});

// MCP env rows
document.getElementById('mcp-env-add').addEventListener('click', () => {
  const k = document.getElementById('mcp-env-key').value.trim();
  const v = document.getElementById('mcp-env-val').value.trim();
  if (!k) return;
  mcpEnvRows.push({ k, v });
  document.getElementById('mcp-env-key').value = '';
  document.getElementById('mcp-env-val').value = '';
  renderMcpEnvRows();
});

function renderMcpEnvRows() {
  const tbody = document.getElementById('mcp-env-tbody');
  tbody.innerHTML = '';
  mcpEnvRows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><code>${esc(row.k)}</code></td><td>${esc(row.v)}</td><td><button class="icon-btn danger" data-i="${i}">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { mcpEnvRows.splice(Number(btn.dataset.i), 1); renderMcpEnvRows(); });
  });
}

// MCP header rows
document.getElementById('mcp-header-add').addEventListener('click', () => {
  const k = document.getElementById('mcp-header-key').value.trim();
  const v = document.getElementById('mcp-header-val').value.trim();
  if (!k) return;
  mcpHeaderRows.push({ k, v });
  document.getElementById('mcp-header-key').value = '';
  document.getElementById('mcp-header-val').value = '';
  renderMcpHeaderRows();
});

function renderMcpHeaderRows() {
  const tbody = document.getElementById('mcp-headers-tbody');
  tbody.innerHTML = '';
  mcpHeaderRows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><code>${esc(row.k)}</code></td><td>${esc(row.v)}</td><td><button class="icon-btn danger" data-i="${i}">✕</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { mcpHeaderRows.splice(Number(btn.dataset.i), 1); renderMcpHeaderRows(); });
  });
}

document.getElementById('add-mcp-btn').addEventListener('click', () => {
  document.getElementById('mcp-add-form').style.display = 'block';
});
document.getElementById('mcp-add-cancel').addEventListener('click', () => {
  document.getElementById('mcp-add-form').style.display = 'none';
  mcpEnvRows = [];
  mcpHeaderRows = [];
  renderMcpEnvRows();
  renderMcpHeaderRows();
});
document.getElementById('mcp-add-confirm').addEventListener('click', () => {
  const name = document.getElementById('mcp-name').value.trim();
  const type = document.getElementById('mcp-type').value;
  const isHttp = ['sse', 'http'].includes(type);
  if (!name) return;

  let server = { type };
  if (isHttp) {
    const url = document.getElementById('mcp-url').value.trim();
    if (!url) return;
    server.url = url;
    if (mcpHeaderRows.length) server.headers = Object.fromEntries(mcpHeaderRows.map(r => [r.k, r.v]));
  } else {
    const cmd = document.getElementById('mcp-cmd').value.trim();
    if (!cmd) return;
    const args = document.getElementById('mcp-args').value.trim().split(/\s+/).filter(Boolean);
    server.command = cmd;
    server.args = args;
  }
  if (mcpEnvRows.length) server.env = Object.fromEntries(mcpEnvRows.map(r => [r.k, r.v]));

  const updated = { ...(state.project?.mcpServers ?? {}), [name]: server };
  vscode.postMessage({ type: 'saveMcp', servers: updated });
  document.getElementById('mcp-add-form').style.display = 'none';
  document.getElementById('mcp-name').value = '';
  document.getElementById('mcp-type').value = 'stdio';
  document.getElementById('mcp-cmd').value = '';
  document.getElementById('mcp-args').value = '';
  document.getElementById('mcp-url').value = '';
  document.getElementById('mcp-cmd-field').style.display = '';
  document.getElementById('mcp-args-field').style.display = '';
  document.getElementById('mcp-url-field').style.display = 'none';
  document.getElementById('mcp-headers-field').style.display = 'none';
  mcpEnvRows = [];
  mcpHeaderRows = [];
  renderMcpEnvRows();
  renderMcpHeaderRows();
});

// --- Permissions ---
function renderPermissions() {
  const cfg = getConfig();
  if (!cfg) return;
  const perms = cfg.settings?.permissions ?? { allow: [], deny: [] };
  document.getElementById('permissions-default-mode').value = perms.defaultMode ?? '';
  renderTags('allow-tags', perms.allow ?? [], 'allow');
  renderTags('ask-tags', perms.ask ?? [], 'ask');
  renderTags('deny-tags', perms.deny ?? [], 'deny');
}

function renderTags(containerId, items, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach((item, i) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${esc(item)} <button data-i="${i}" data-type="${type}" class="remove-tag">×</button>`;
    container.appendChild(tag);
  });
  container.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const cfg = getConfig();
      const perms = JSON.parse(JSON.stringify(cfg.settings?.permissions ?? { allow: [], deny: [] }));
      if (!perms[btn.dataset.type]) perms[btn.dataset.type] = [];
      perms[btn.dataset.type].splice(Number(btn.dataset.i), 1);
      if (currentScope === 'project') state.project.settings.permissions = perms;
      else state.global.settings.permissions = perms;
      renderPermissions();
    });
  });
}

function addPermission(type) {
  const input = document.getElementById(`${type}-input`);
  const val = input.value.trim();
  if (!val) return;
  const cfg = getConfig();
  const perms = JSON.parse(JSON.stringify(cfg.settings?.permissions ?? { allow: [], deny: [] }));
  if (!perms[type]) perms[type] = [];
  if (!perms[type].includes(val)) perms[type].push(val);
  if (currentScope === 'project') state.project.settings.permissions = perms;
  else state.global.settings.permissions = perms;
  input.value = '';
  renderPermissions();
}

document.getElementById('allow-add').addEventListener('click', () => addPermission('allow'));
document.getElementById('ask-add').addEventListener('click', () => addPermission('ask'));
document.getElementById('deny-add').addEventListener('click', () => addPermission('deny'));
document.getElementById('allow-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPermission('allow'); });
document.getElementById('ask-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPermission('ask'); });
document.getElementById('deny-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPermission('deny'); });
document.getElementById('save-permissions').addEventListener('click', () => {
  const cfg = getConfig();
  const perms = JSON.parse(JSON.stringify(cfg.settings?.permissions ?? { allow: [], deny: [] }));
  const mode = document.getElementById('permissions-default-mode').value;
  if (mode) perms.defaultMode = mode;
  else delete perms.defaultMode;
  vscode.postMessage({ type: 'savePermissions', scope: currentScope, permissions: perms });
});

// --- Hooks ---
const ALL_HOOK_EVENTS = [
  'PreToolUse','PostToolUse','PostToolUseFailure','Stop','StopFailure','Notification',
  'SessionStart','SessionEnd','UserPromptSubmit','PermissionRequest','PermissionDenied',
  'SubagentStart','SubagentStop','TaskCreated','TaskCompleted','TeammateIdle',
  'InstructionsLoaded','ConfigChange','CwdChanged','FileChanged',
  'WorktreeCreate','WorktreeRemove','PreCompact','PostCompact','Elicitation','ElicitationResult',
];

function hookValue(h) {
  if (h.type === 'command') return h.command ?? '';
  if (h.type === 'http') return h.url ?? '';
  if (h.type === 'prompt') return h.prompt ?? '';
  if (h.type === 'agent') return h.agent ?? '';
  return h.command ?? '';
}

function renderHooks() {
  const cfg = getConfig();
  const hooks = cfg?.settings?.hooks ?? {};
  const container = document.getElementById('hooks-list');
  container.innerHTML = '';

  let any = false;
  for (const event of ALL_HOOK_EVENTS) {
    const entries = hooks[event] ?? [];
    entries.forEach((entry, ei) => {
      entry.hooks.forEach((h, hi) => {
        any = true;
        const div = document.createElement('div');
        div.className = 'hook-item';
        const typeLabel = h.type ?? 'command';
        div.innerHTML = `
          <div class="hook-event">${event}</div>
          ${entry.matcher ? `<div class="hook-matcher">matcher: ${esc(entry.matcher)}</div>` : ''}
          ${h.if ? `<div class="hook-matcher">if: ${esc(h.if)}</div>` : ''}
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;opacity:0.5;margin-bottom:2px">${typeLabel}</div>
          <div class="hook-command">${esc(hookValue(h))}</div>
          <div class="hook-actions">
            <button class="icon-btn danger delete-hook" data-event="${event}" data-ei="${ei}" data-hi="${hi}">Delete</button>
          </div>
        `;
        container.appendChild(div);
      });
    });
  }

  if (!any) container.innerHTML = '<div class="empty">No hooks configured.</div>';

  container.querySelectorAll('.delete-hook').forEach(btn => {
    btn.addEventListener('click', () => {
      const cfg = getConfig();
      const hooks = JSON.parse(JSON.stringify(cfg.settings?.hooks ?? {}));
      const entries = hooks[btn.dataset.event] ?? [];
      const entry = entries[Number(btn.dataset.ei)];
      if (entry) entry.hooks.splice(Number(btn.dataset.hi), 1);
      if (entry && entry.hooks.length === 0) entries.splice(Number(btn.dataset.ei), 1);
      if (entries.length === 0) delete hooks[btn.dataset.event];
      else hooks[btn.dataset.event] = entries;
      if (currentScope === 'project') state.project.settings.hooks = hooks;
      else state.global.settings.hooks = hooks;
      renderHooks();
    });
  });
}

// Hook type conditional fields
document.getElementById('hook-type').addEventListener('change', () => {
  const t = document.getElementById('hook-type').value;
  document.getElementById('hook-command-field').style.display = t === 'command' ? '' : 'none';
  document.getElementById('hook-url-field').style.display = t === 'http' ? '' : 'none';
  document.getElementById('hook-prompt-field').style.display = t === 'prompt' ? '' : 'none';
  document.getElementById('hook-agent-field').style.display = t === 'agent' ? '' : 'none';
});

document.getElementById('add-hook-btn').addEventListener('click', () => {
  document.getElementById('hook-add-form').style.display = 'block';
});
document.getElementById('hook-add-cancel').addEventListener('click', () => {
  document.getElementById('hook-add-form').style.display = 'none';
});
document.getElementById('hook-add-confirm').addEventListener('click', () => {
  const event = document.getElementById('hook-event').value;
  const matcher = document.getElementById('hook-matcher').value.trim();
  const hookType = document.getElementById('hook-type').value;
  let hookObj = { type: hookType };

  if (hookType === 'command') {
    const cmd = document.getElementById('hook-command').value.trim();
    if (!cmd) return;
    hookObj.command = cmd;
  } else if (hookType === 'http') {
    const url = document.getElementById('hook-url').value.trim();
    if (!url) return;
    hookObj.url = url;
  } else if (hookType === 'prompt') {
    const prompt = document.getElementById('hook-prompt').value.trim();
    if (!prompt) return;
    hookObj.prompt = prompt;
  } else if (hookType === 'agent') {
    const agent = document.getElementById('hook-agent').value.trim();
    if (!agent) return;
    hookObj.agent = agent;
  }
  const hookIf = document.getElementById('hook-if').value.trim();
  if (hookIf) hookObj.if = hookIf;

  const cfg = getConfig();
  const hooks = JSON.parse(JSON.stringify(cfg.settings?.hooks ?? {}));
  if (!hooks[event]) hooks[event] = [];
  hooks[event].push({ matcher: matcher || undefined, hooks: [hookObj] });
  if (currentScope === 'project') state.project.settings.hooks = hooks;
  else state.global.settings.hooks = hooks;
  renderHooks();
  document.getElementById('hook-add-form').style.display = 'none';
  document.getElementById('hook-matcher').value = '';
  document.getElementById('hook-command').value = '';
  document.getElementById('hook-url').value = '';
  document.getElementById('hook-prompt').value = '';
  document.getElementById('hook-agent').value = '';
  document.getElementById('hook-if').value = '';
  document.getElementById('hook-type').value = 'command';
  document.getElementById('hook-command-field').style.display = '';
  document.getElementById('hook-url-field').style.display = 'none';
  document.getElementById('hook-prompt-field').style.display = 'none';
  document.getElementById('hook-agent-field').style.display = 'none';
});
document.getElementById('save-hooks').addEventListener('click', () => {
  const cfg = getConfig();
  vscode.postMessage({ type: 'saveHooks', scope: currentScope, hooks: cfg.settings?.hooks ?? {} });
});

// --- CLAUDE.md ---
function renderClaudeMd() {
  const content = state.project?.claudeMd ?? '';
  const ed = getOrCreateMdEditor('claudemd-editor', content, () => markEditorDirty('save-claudemd'), '500px');
  if (ed) ed.setValue(content);
}
document.getElementById('save-claudemd').addEventListener('click', () => {
  vscode.postMessage({ type: 'saveClaudeMd', content: editorValue('claudemd-editor') });
});

// --- .claudeignore ---
function renderClaudeIgnore() {
  const content = state.project?.claudeIgnore ?? '';
  const ed = getOrCreateMdEditor('claudeignore-editor', content, () => markEditorDirty('save-claudeignore'), '300px');
  if (ed) ed.setValue(content);
}
document.getElementById('save-claudeignore').addEventListener('click', () => {
  vscode.postMessage({ type: 'saveClaudeIgnore', content: editorValue('claudeignore-editor') });
});

// --- Memory ---
function renderMemory() {
  const glob = state.global;
  const content = glob?.memoryMd ?? '';
  const ed = getOrCreateMdEditor('memory-md-editor', content, () => markEditorDirty('save-memory-md'), '400px');
  if (ed) ed.setValue(content);

  const list = document.getElementById('memory-files-list');
  const empty = document.getElementById('memory-files-empty');
  const files = glob?.memory ?? [];
  list.innerHTML = '';
  if (files.length === 0) {
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    files.forEach(f => {
      const div = document.createElement('div');
      div.className = 'file-item';
      div.innerHTML = `
        <span class="name">${esc(f.name)}</span>
        <span class="desc">${esc(f.content.split('\n').find(l => l.trim())?.replace(/^[-*#]+\s*/, '') ?? '')}</span>
        <span class="actions">
          <button class="icon-btn secondary open-mem" data-path="${esc(f.filePath)}">Open</button>
        </span>
      `;
      list.appendChild(div);
    });
    list.querySelectorAll('.open-mem').forEach(btn => {
      btn.addEventListener('click', () => vscode.postMessage({ type: 'openFile', filePath: btn.dataset.path }));
    });
  }
}

document.getElementById('save-memory-md').addEventListener('click', () => {
  vscode.postMessage({ type: 'saveMemoryMd', content: editorValue('memory-md-editor') });
});

// --- File Sections (rules, commands, skills, workflows, agents) ---
function renderFileSection(type) {
  const cfg = currentScope === 'project' ? state.project : state.global;
  const files = (cfg ?? {})[type] ?? [];
  const container = document.getElementById(`files-${type}`);
  if (!container) return;
  container.innerHTML = '';
  if (files.length === 0) {
    container.innerHTML = `<div class="empty">No ${type} yet.</div>`;
    return;
  }
  const activeFile = inlineEditors[type]?.filePath;
  files.forEach(f => {
    const div = document.createElement('div');
    div.className = 'file-item' + (f.filePath === activeFile ? ' file-item-active' : '');
    div.innerHTML = `
      <span class="name">${esc(f.name)}</span>
      <span class="desc">${esc(f.firstLine.replace(/^#+\s*/, ''))}</span>
      <span class="actions">
        <button class="icon-btn secondary edit-inline" data-path="${esc(f.filePath)}" data-name="${esc(f.name)}" data-type="${type}">${f.filePath === activeFile ? 'Close' : 'Edit'}</button>
        <button class="icon-btn secondary open-file" data-path="${esc(f.filePath)}">↗</button>
        <button class="icon-btn danger delete-file" data-path="${esc(f.filePath)}" data-name="${esc(f.name)}">✕</button>
      </span>
    `;
    container.appendChild(div);
  });
  container.querySelectorAll('.edit-inline').forEach(btn => {
    btn.addEventListener('click', () => toggleInlineEditor(btn.dataset.type, btn.dataset.path, btn.dataset.name));
  });
  container.querySelectorAll('.open-file').forEach(btn => {
    btn.addEventListener('click', () => vscode.postMessage({ type: 'openFile', filePath: btn.dataset.path }));
  });
  container.querySelectorAll('.delete-file').forEach(btn => {
    btn.addEventListener('click', () => vscode.postMessage({ type: 'deleteFile', filePath: btn.dataset.path, name: btn.dataset.name }));
  });
}

function toggleInlineEditor(type, filePath, name) {
  const wrap = document.getElementById(`inline-editor-${type}`);
  if (!wrap) return;
  if (inlineEditors[type]?.filePath === filePath) {
    // Close
    delete inlineEditors[type];
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    renderFileSection(type);
    return;
  }
  // Open — request file content from extension
  inlineEditors[type] = { filePath, name, ed: null };
  vscode.postMessage({ type: 'readFile', filePath });
  renderFileSection(type);
}

function openInlineEditor(type, filePath, name, content) {
  const wrap = document.getElementById(`inline-editor-${type}`);
  if (!wrap) return;
  wrap.style.display = 'block';
  wrap.innerHTML = '';

  // Header bar
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px';
  header.innerHTML = `<span style="font-size:12px;font-weight:600;opacity:0.7">${esc(name)}.md</span>`;
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.id = `save-inline-${type}`;
  saveBtn.addEventListener('click', () => {
    const ed = inlineEditors[type]?.ed;
    if (!ed) return;
    vscode.postMessage({ type: 'saveFileContent', filePath, content: ed.getValue() });
  });
  header.appendChild(saveBtn);
  wrap.appendChild(header);

  // Editor container
  const edContainer = document.createElement('div');
  edContainer.id = `cm-inline-${type}`;
  wrap.appendChild(edContainer);

  const ed = CM.createMarkdownEditor(edContainer, content, {
    onChange: () => saveBtn.classList.add('dirty'),
    height: '380px',
  });
  inlineEditors[type].ed = ed;
}

// Handle fileContent message from extension
window._fileContentHandlers = window._fileContentHandlers || {};
window._onFileContent = function(filePath, content) {
  for (const [type, info] of Object.entries(inlineEditors)) {
    if (info.filePath === filePath) {
      openInlineEditor(type, filePath, info.name, content);
      return;
    }
  }
};

document.querySelectorAll('.add-file-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    vscode.postMessage({ type: 'newFile', sectionType: btn.dataset.type, scope: currentScope });
  });
});

// --- Agent create form ---
document.getElementById('new-agent-btn').addEventListener('click', () => {
  document.getElementById('agent-create-form').style.display = 'block';
});
document.getElementById('agent-create-cancel').addEventListener('click', () => {
  document.getElementById('agent-create-form').style.display = 'none';
  resetAgentForm();
});
document.getElementById('agent-create-confirm').addEventListener('click', () => {
  const name = document.getElementById('agent-name').value.trim();
  if (!name) return;

  const fields = {};
  const desc = document.getElementById('agent-description').value.trim();
  const model = document.getElementById('agent-model').value;
  const permMode = document.getElementById('agent-permission-mode').value;
  const maxTurns = document.getElementById('agent-max-turns').value.trim();
  const isolation = document.getElementById('agent-isolation').value;
  const effort = document.getElementById('agent-effort').value;
  const color = document.getElementById('agent-color').value.trim();
  const tools = document.getElementById('agent-tools').value.trim();
  const disallowed = document.getElementById('agent-disallowed-tools').value.trim();
  const instructions = document.getElementById('agent-instructions').value.trim();

  if (desc) fields.description = desc;
  if (model) fields.model = model;
  if (effort) fields.effort = effort;
  if (permMode) fields.permissionMode = permMode;
  if (maxTurns) fields.maxTurns = Number(maxTurns);
  if (isolation) fields.isolation = isolation;
  if (color) fields.color = color;
  if (tools) fields.tools = tools.split(/[\s,]+/).filter(Boolean).join(', ');
  if (disallowed) fields.disallowedTools = disallowed.split(/[\s,]+/).filter(Boolean).join(', ');

  const frontmatter = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const content = `---\n${frontmatter}\n---\n\n${instructions || `# ${name}\n\nDescribe what this agent does.`}\n`;

  vscode.postMessage({ type: 'saveNewAgent', name, content, scope: currentScope });
  document.getElementById('agent-create-form').style.display = 'none';
  resetAgentForm();
});

function resetAgentForm() {
  ['agent-name','agent-description','agent-max-turns','agent-color','agent-tools','agent-disallowed-tools','agent-instructions'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('agent-model').value = '';
  document.getElementById('agent-effort').value = '';
  document.getElementById('agent-permission-mode').value = '';
  document.getElementById('agent-isolation').value = '';
}

// --- Sandbox ---
function renderSandbox() {
  const cfg = getConfig();
  if (!cfg) return;
  const sb = cfg.settings?.sandbox ?? {};
  document.getElementById('sandbox-enabled').checked = sb.enabled ?? false;
  document.getElementById('sandbox-allow-local-binding').checked = sb.network?.allowLocalBinding ?? false;

  sandboxTags.excluded = [...(sb.excludedCommands ?? [])];
  sandboxTags.allowWrite = [...(sb.filesystem?.allowWrite ?? [])];
  sandboxTags.denyWrite = [...(sb.filesystem?.denyWrite ?? [])];
  sandboxTags.allowRead = [...(sb.filesystem?.allowRead ?? [])];
  sandboxTags.denyRead = [...(sb.filesystem?.denyRead ?? [])];
  sandboxTags.allowedDomains = [...(sb.network?.allowedDomains ?? [])];
  sandboxTags.deniedDomains = [...(sb.network?.deniedDomains ?? [])];

  renderTagList('sandbox-excluded-tags', sandboxTags.excluded, renderSandbox);
  renderTagList('sandbox-allow-write-tags', sandboxTags.allowWrite, renderSandbox);
  renderTagList('sandbox-deny-write-tags', sandboxTags.denyWrite, renderSandbox);
  renderTagList('sandbox-allow-read-tags', sandboxTags.allowRead, renderSandbox);
  renderTagList('sandbox-deny-read-tags', sandboxTags.denyRead, renderSandbox);
  renderTagList('sandbox-allowed-domains-tags', sandboxTags.allowedDomains, renderSandbox);
  renderTagList('sandbox-denied-domains-tags', sandboxTags.deniedDomains, renderSandbox);
}

function sandboxAddBtn(inputId, arrKey) {
  const input = document.getElementById(inputId);
  const val = input.value.trim();
  if (!val) return;
  sandboxTags[arrKey].push(val);
  input.value = '';
  renderTagList(`sandbox-${inputId.replace('sandbox-','').replace('-input','')}-tags`, sandboxTags[arrKey], renderSandbox);
}

document.getElementById('sandbox-excluded-add').addEventListener('click', () => sandboxAddBtn('sandbox-excluded-input', 'excluded'));
document.getElementById('sandbox-allow-write-add').addEventListener('click', () => sandboxAddBtn('sandbox-allow-write-input', 'allowWrite'));
document.getElementById('sandbox-deny-write-add').addEventListener('click', () => sandboxAddBtn('sandbox-deny-write-input', 'denyWrite'));
document.getElementById('sandbox-allow-read-add').addEventListener('click', () => sandboxAddBtn('sandbox-allow-read-input', 'allowRead'));
document.getElementById('sandbox-deny-read-add').addEventListener('click', () => sandboxAddBtn('sandbox-deny-read-input', 'denyRead'));
document.getElementById('sandbox-allowed-domains-add').addEventListener('click', () => sandboxAddBtn('sandbox-allowed-domains-input', 'allowedDomains'));
document.getElementById('sandbox-denied-domains-add').addEventListener('click', () => sandboxAddBtn('sandbox-denied-domains-input', 'deniedDomains'));

document.getElementById('save-sandbox').addEventListener('click', () => {
  const sandbox = {
    enabled: document.getElementById('sandbox-enabled').checked,
    excludedCommands: sandboxTags.excluded.length ? sandboxTags.excluded : undefined,
    filesystem: (sandboxTags.allowWrite.length || sandboxTags.denyWrite.length || sandboxTags.allowRead.length || sandboxTags.denyRead.length) ? {
      allowWrite: sandboxTags.allowWrite.length ? sandboxTags.allowWrite : undefined,
      denyWrite: sandboxTags.denyWrite.length ? sandboxTags.denyWrite : undefined,
      allowRead: sandboxTags.allowRead.length ? sandboxTags.allowRead : undefined,
      denyRead: sandboxTags.denyRead.length ? sandboxTags.denyRead : undefined,
    } : undefined,
    network: (sandboxTags.allowedDomains.length || sandboxTags.deniedDomains.length || document.getElementById('sandbox-allow-local-binding').checked) ? {
      allowedDomains: sandboxTags.allowedDomains.length ? sandboxTags.allowedDomains : undefined,
      deniedDomains: sandboxTags.deniedDomains.length ? sandboxTags.deniedDomains : undefined,
      allowLocalBinding: document.getElementById('sandbox-allow-local-binding').checked || undefined,
    } : undefined,
  };
  vscode.postMessage({ type: 'saveSandbox', scope: currentScope, sandbox });
});

// --- App Config ---
function renderAppConfig() {
  const cfg = state.globalUserConfig ?? {};
  document.getElementById('appconfig-editor-mode').value = cfg.editorMode ?? '';
  document.getElementById('appconfig-auto-scroll').checked = cfg.autoScrollEnabled ?? false;
  document.getElementById('appconfig-show-turn-duration').checked = cfg.showTurnDuration ?? false;
  document.getElementById('appconfig-terminal-progress').checked = cfg.terminalProgressBarEnabled ?? false;
  document.getElementById('appconfig-auto-connect-ide').checked = cfg.autoConnectIde ?? false;
  document.getElementById('appconfig-auto-install-ext').checked = cfg.autoInstallIdeExtension ?? false;
}

document.getElementById('save-appconfig').addEventListener('click', () => {
  const editorMode = document.getElementById('appconfig-editor-mode').value;
  const config = {
    editorMode: editorMode || undefined,
    autoScrollEnabled: document.getElementById('appconfig-auto-scroll').checked,
    showTurnDuration: document.getElementById('appconfig-show-turn-duration').checked,
    terminalProgressBarEnabled: document.getElementById('appconfig-terminal-progress').checked,
    autoConnectIde: document.getElementById('appconfig-auto-connect-ide').checked,
    autoInstallIdeExtension: document.getElementById('appconfig-auto-install-ext').checked,
  };
  vscode.postMessage({ type: 'saveGlobalUserConfig', config });
});

// --- Init ---
function updateInitNav() {
  const navInit = document.getElementById('nav-init');
  if (!navInit) return;
  if (!state.isProjectInitialized) {
    navInit.style.color = 'var(--vscode-notificationsWarningIcon-foreground, orange)';
    navInit.title = 'Project not initialized';
  } else {
    navInit.style.color = '';
    navInit.title = '';
  }
}

function renderInit() {
  const initialized = state.isProjectInitialized;
  document.getElementById('init-already').style.display = initialized ? 'flex' : 'none';
  const editor = document.getElementById('init-claudemd');
  if (!editor.value) {
    editor.value = `# Project\n\n## Overview\nDescribe your project here.\n\n## Development\n- Add key commands and workflows here.\n\n## Guidelines\n- Add project-specific coding standards here.\n`;
  }
}

document.getElementById('init-run').addEventListener('click', () => {
  const dirs = [];
  if (document.getElementById('init-dir-rules').checked) dirs.push('rules');
  if (document.getElementById('init-dir-commands').checked) dirs.push('commands');
  if (document.getElementById('init-dir-skills').checked) dirs.push('skills');
  if (document.getElementById('init-dir-workflows').checked) dirs.push('workflows');

  vscode.postMessage({
    type: 'initProject',
    options: {
      model: document.getElementById('init-model').value,
      claudeMd: document.getElementById('init-claudemd').value,
      claudeIgnore: document.getElementById('init-claudeignore').checked,
      dirs,
    },
  });
});

// --- Toast ---
let _toastTimer = null;
function showToast(msg, type = 'success') {
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, 1800);
  }, 80);
}

// --- Dirty tracking ---
function markDirty(sectionEl) {
  sectionEl.querySelectorAll('button[id^="save-"], button.save-trigger').forEach(btn => btn.classList.add('dirty'));
}

function clearAllDirty() {
  document.querySelectorAll('button.dirty').forEach(btn => btn.classList.remove('dirty'));
}

function markEditorDirty(btnId) {
  document.getElementById(btnId)?.classList.add('dirty');
}

// Listen for any input/change in each section and mark its save buttons dirty
document.querySelectorAll('section').forEach(sec => {
  sec.addEventListener('input', () => markDirty(sec));
  sec.addEventListener('change', () => markDirty(sec));
});

// --- Utils ---
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
