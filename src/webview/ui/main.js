const vscode = acquireVsCodeApi();

let state = { project: null, global: null, isProjectInitialized: false };
let currentScope = 'project';
let currentSection = 'dashboard';

// temporary env rows for MCP add form
let mcpEnvRows = [];

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
    if (currentScope === 'global' && ['claudeMd','claudeIgnore','rules','commands','skills','workflows'].includes(currentSection)) {
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
    render();
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
  const hookCount = Object.values(cfg.settings?.hooks ?? {}).reduce((n, arr) => n + arr.length, 0);
  const envCount = Object.keys(cfg.settings?.env ?? {}).length;
  const memCount = (glob?.memory ?? []).length;

  const cards = [
    { label: 'Model', value: cfg.settings?.model ?? 'not set', icon: '⚙', section: 'model' },
    { label: 'MCP Servers', value: mcpCount, icon: '⚡', section: 'mcp' },
    { label: 'Allow Rules', value: allowCount, icon: '✅', section: 'permissions' },
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
    );
  }

  // not-initialized banner
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
  document.getElementById('model-select').value = cfg.settings?.model ?? 'claude-sonnet-4-6';
  document.getElementById('small-model-select').value = cfg.settings?.smallModel ?? '';
}

document.getElementById('save-model').addEventListener('click', () => {
  vscode.postMessage({
    type: 'saveModel',
    scope: currentScope,
    model: document.getElementById('model-select').value,
    smallModel: document.getElementById('small-model-select').value,
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
function renderAdvanced() {
  const cfg = getConfig();
  if (!cfg) return;
  const s = cfg.settings ?? {};
  if (document.activeElement !== document.getElementById('system-prompt'))
    document.getElementById('system-prompt').value = s.systemPrompt ?? '';
  if (document.activeElement !== document.getElementById('append-system-prompt'))
    document.getElementById('append-system-prompt').value = s.appendSystemPrompt ?? '';
  document.getElementById('bash-timeout').value = s.bashTimeout ?? '';
  document.getElementById('max-thinking-tokens').value = s.maxThinkingTokens ?? '';
}

document.getElementById('save-advanced').addEventListener('click', () => {
  vscode.postMessage({
    type: 'saveAdvanced',
    scope: currentScope,
    systemPrompt: document.getElementById('system-prompt').value,
    appendSystemPrompt: document.getElementById('append-system-prompt').value,
    bashTimeout: document.getElementById('bash-timeout').value,
    maxThinkingTokens: document.getElementById('max-thinking-tokens').value,
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
    const envEntries = Object.entries(srv.env ?? {});
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(name)}</strong></td>
      <td>${esc(srv.command)}</td>
      <td style="font-family:monospace;font-size:11px">${esc((srv.args ?? []).join(' '))}</td>
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

  // update table header if needed
  const thead = document.querySelector('#mcp-table thead tr');
  if (thead && thead.children.length === 5) {
    thead.innerHTML = '<th>Name</th><th>Command</th><th>Args</th><th>Env</th><th>Enabled</th><th></th>';
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

document.getElementById('add-mcp-btn').addEventListener('click', () => {
  document.getElementById('mcp-add-form').style.display = 'block';
});
document.getElementById('mcp-add-cancel').addEventListener('click', () => {
  document.getElementById('mcp-add-form').style.display = 'none';
  mcpEnvRows = [];
  renderMcpEnvRows();
});
document.getElementById('mcp-add-confirm').addEventListener('click', () => {
  const name = document.getElementById('mcp-name').value.trim();
  const cmd = document.getElementById('mcp-cmd').value.trim();
  const args = document.getElementById('mcp-args').value.trim().split(/\s+/).filter(Boolean);
  if (!name || !cmd) return;
  const env = mcpEnvRows.length ? Object.fromEntries(mcpEnvRows.map(r => [r.k, r.v])) : undefined;
  const updated = { ...(state.project?.mcpServers ?? {}), [name]: { command: cmd, args, ...(env ? { env } : {}) } };
  vscode.postMessage({ type: 'saveMcp', servers: updated });
  document.getElementById('mcp-add-form').style.display = 'none';
  document.getElementById('mcp-name').value = '';
  document.getElementById('mcp-cmd').value = '';
  document.getElementById('mcp-args').value = '';
  mcpEnvRows = [];
  renderMcpEnvRows();
});

// --- Permissions ---
function renderPermissions() {
  const cfg = getConfig();
  if (!cfg) return;
  const perms = cfg.settings?.permissions ?? { allow: [], deny: [] };
  renderTags('allow-tags', perms.allow ?? [], 'allow');
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
  if (!perms[type].includes(val)) perms[type].push(val);
  if (currentScope === 'project') state.project.settings.permissions = perms;
  else state.global.settings.permissions = perms;
  input.value = '';
  renderPermissions();
}

document.getElementById('allow-add').addEventListener('click', () => addPermission('allow'));
document.getElementById('deny-add').addEventListener('click', () => addPermission('deny'));
document.getElementById('allow-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPermission('allow'); });
document.getElementById('deny-input').addEventListener('keydown', e => { if (e.key === 'Enter') addPermission('deny'); });
document.getElementById('save-permissions').addEventListener('click', () => {
  const cfg = getConfig();
  vscode.postMessage({ type: 'savePermissions', scope: currentScope, permissions: cfg.settings?.permissions });
});

// --- Hooks ---
function renderHooks() {
  const cfg = getConfig();
  const hooks = cfg?.settings?.hooks ?? {};
  const container = document.getElementById('hooks-list');
  container.innerHTML = '';

  const events = ['PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
  let any = false;
  for (const event of events) {
    const entries = hooks[event] ?? [];
    entries.forEach((entry, ei) => {
      any = true;
      entry.hooks.forEach((h, hi) => {
        const div = document.createElement('div');
        div.className = 'hook-item';
        div.innerHTML = `
          <div class="hook-event">${event}</div>
          ${entry.matcher ? `<div class="hook-matcher">matcher: ${esc(entry.matcher)}</div>` : ''}
          <div class="hook-command">${esc(h.command)}</div>
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

document.getElementById('add-hook-btn').addEventListener('click', () => {
  document.getElementById('hook-add-form').style.display = 'block';
});
document.getElementById('hook-add-cancel').addEventListener('click', () => {
  document.getElementById('hook-add-form').style.display = 'none';
});
document.getElementById('hook-add-confirm').addEventListener('click', () => {
  const event = document.getElementById('hook-event').value;
  const matcher = document.getElementById('hook-matcher').value.trim();
  const command = document.getElementById('hook-command').value.trim();
  if (!command) return;
  const cfg = getConfig();
  const hooks = JSON.parse(JSON.stringify(cfg.settings?.hooks ?? {}));
  if (!hooks[event]) hooks[event] = [];
  hooks[event].push({ matcher: matcher || undefined, hooks: [{ type: 'command', command }] });
  if (currentScope === 'project') state.project.settings.hooks = hooks;
  else state.global.settings.hooks = hooks;
  renderHooks();
  document.getElementById('hook-add-form').style.display = 'none';
  document.getElementById('hook-matcher').value = '';
  document.getElementById('hook-command').value = '';
});
document.getElementById('save-hooks').addEventListener('click', () => {
  const cfg = getConfig();
  vscode.postMessage({ type: 'saveHooks', scope: currentScope, hooks: cfg.settings?.hooks ?? {} });
});

// --- CLAUDE.md ---
function renderClaudeMd() {
  const editor = document.getElementById('claudemd-editor');
  if (document.activeElement !== editor) editor.value = state.project?.claudeMd ?? '';
}
document.getElementById('save-claudemd').addEventListener('click', () => {
  vscode.postMessage({ type: 'saveClaudeMd', content: document.getElementById('claudemd-editor').value });
});

// --- .claudeignore ---
function renderClaudeIgnore() {
  const editor = document.getElementById('claudeignore-editor');
  if (document.activeElement !== editor) editor.value = state.project?.claudeIgnore ?? '';
}
document.getElementById('save-claudeignore').addEventListener('click', () => {
  vscode.postMessage({ type: 'saveClaudeIgnore', content: document.getElementById('claudeignore-editor').value });
});

// --- Memory ---
function renderMemory() {
  const glob = state.global;
  const editor = document.getElementById('memory-md-editor');
  if (document.activeElement !== editor) editor.value = glob?.memoryMd ?? '';

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
  vscode.postMessage({ type: 'saveMemoryMd', content: document.getElementById('memory-md-editor').value });
});

// --- File Sections ---
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
  files.forEach(f => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
      <span class="name">${esc(f.name)}</span>
      <span class="desc">${esc(f.firstLine.replace(/^#+\s*/, ''))}</span>
      <span class="actions">
        <button class="icon-btn secondary open-file" data-path="${esc(f.filePath)}">Open</button>
        <button class="icon-btn danger delete-file" data-path="${esc(f.filePath)}" data-name="${esc(f.name)}">✕</button>
      </span>
    `;
    container.appendChild(div);
  });
  container.querySelectorAll('.open-file').forEach(btn => {
    btn.addEventListener('click', () => vscode.postMessage({ type: 'openFile', filePath: btn.dataset.path }));
  });
  container.querySelectorAll('.delete-file').forEach(btn => {
    btn.addEventListener('click', () => vscode.postMessage({ type: 'deleteFile', filePath: btn.dataset.path, name: btn.dataset.name }));
  });
}

document.querySelectorAll('.add-file-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    vscode.postMessage({ type: 'newFile', sectionType: btn.dataset.type, scope: currentScope });
  });
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

  // pre-fill CLAUDE.md template only if empty
  const editor = document.getElementById('init-claudemd');
  if (!editor.value) {
    const projectName = (state.project?.claudeMd ? '' : '');
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

// --- Utils ---
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
