const vscode = acquireVsCodeApi();

let state = { project: null, global: null };
let currentScope = 'project';
let currentSection = 'model';

// --- Nav ---
document.querySelectorAll('.scope-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    currentScope = btn.dataset.scope;
    document.querySelectorAll('.scope-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // hide project-only nav items in global scope
    document.querySelectorAll('.project-only').forEach(el => {
      el.style.display = currentScope === 'global' ? 'none' : '';
    });
    if (currentScope === 'global' && ['claudeMd','rules','commands','skills','workflows'].includes(currentSection)) {
      activateSection('permissions');
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
  render();
}

// --- State ---
window.addEventListener('message', event => {
  const msg = event.data;
  if (msg.type === 'init') {
    state = msg.state;
    currentScope = msg.scope ?? 'project';
    activateSection(msg.section ?? 'model');
    document.querySelectorAll('.scope-tab').forEach(b => b.classList.toggle('active', b.dataset.scope === currentScope));
  } else if (msg.type === 'stateUpdate') {
    state = msg.state;
    render();
  }
});

function getConfig() {
  return currentScope === 'project' ? state.project : state.global;
}

// --- Render ---
function render() {
  if (!state.project) return;
  renderModel();
  renderMcp();
  renderPermissions();
  renderHooks();
  renderClaudeMd();
  renderFileSection('rules');
  renderFileSection('commands');
  renderFileSection('skills');
  renderFileSection('workflows');
}

// --- Model ---
function renderModel() {
  const cfg = state.project;
  if (!cfg) return;
  const sel = document.getElementById('model-select');
  sel.value = cfg.settings?.model ?? 'claude-sonnet-4-6';
}

document.getElementById('save-model').addEventListener('click', () => {
  vscode.postMessage({ type: 'saveModel', model: document.getElementById('model-select').value });
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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(name)}</strong></td>
      <td>${esc(srv.command)}</td>
      <td style="font-family:monospace;font-size:11px">${esc((srv.args ?? []).join(' '))}</td>
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

document.getElementById('add-mcp-btn').addEventListener('click', () => {
  document.getElementById('mcp-add-form').style.display = 'block';
});
document.getElementById('mcp-add-cancel').addEventListener('click', () => {
  document.getElementById('mcp-add-form').style.display = 'none';
});
document.getElementById('mcp-add-confirm').addEventListener('click', () => {
  const name = document.getElementById('mcp-name').value.trim();
  const cmd = document.getElementById('mcp-cmd').value.trim();
  const args = document.getElementById('mcp-args').value.trim().split(/\s+/).filter(Boolean);
  if (!name || !cmd) return;
  const updated = { ...(state.project?.mcpServers ?? {}), [name]: { command: cmd, args } };
  vscode.postMessage({ type: 'saveMcp', servers: updated });
  document.getElementById('mcp-add-form').style.display = 'none';
  document.getElementById('mcp-name').value = '';
  document.getElementById('mcp-cmd').value = '';
  document.getElementById('mcp-args').value = '';
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
  if (document.activeElement !== editor) {
    editor.value = state.project?.claudeMd ?? '';
  }
}

document.getElementById('save-claudemd').addEventListener('click', () => {
  vscode.postMessage({ type: 'saveClaudeMd', content: document.getElementById('claudemd-editor').value });
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

// --- Utils ---
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
