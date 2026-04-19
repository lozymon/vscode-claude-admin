import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { search, searchKeymap, openSearchPanel } from '@codemirror/search';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle, indentOnInput } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { marked } from 'marked';

marked.use({ breaks: true, gfm: true });

// ── Theme ──────────────────────────────────────────────────────────────────

function vscodeDarkTheme() {
  return EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '13px',
      fontFamily: 'var(--vscode-editor-font-family, monospace)',
      background: 'var(--vscode-input-background)',
      color: 'var(--vscode-editor-foreground)',
    },
    '.cm-content': { caretColor: 'var(--vscode-editor-foreground)', padding: '8px 0' },
    '.cm-cursor': { borderLeftColor: 'var(--vscode-editor-foreground)' },
    '.cm-focused': { outline: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.04)' },
    '.cm-gutters': {
      background: 'var(--vscode-input-background)',
      color: 'var(--vscode-editorLineNumber-foreground, #555)',
      border: 'none',
      borderRight: '1px solid rgba(255,255,255,0.06)',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 4px', minWidth: '32px' },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--vscode-editor-selectionBackground, #264f78) !important' },
    '.cm-searchMatch': { backgroundColor: 'rgba(255,200,0,0.25)', outline: '1px solid rgba(255,200,0,0.5)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'rgba(255,200,0,0.5)' },
    '.cm-panels': { background: 'var(--vscode-sideBar-background)', borderTop: '1px solid var(--border)', padding: '8px 10px' },
    '.cm-search': { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
    '.cm-search br': { display: 'none' },
    '.cm-textfield': { background: 'var(--vscode-input-background) !important', color: 'var(--vscode-editor-foreground) !important', border: '1px solid var(--vscode-input-border) !important', borderRadius: '3px !important', padding: '4px 8px !important', fontSize: '12px !important', width: '180px !important' },
    '.cm-search label': { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', opacity: '0.65', whiteSpace: 'nowrap' },
    '.cm-search input[type=checkbox]': { width: 'auto !important', margin: '0', accentColor: 'var(--vscode-focusBorder)' },
    '.cm-search button': { background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: '3px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' },
    '.cm-search button:hover': { background: 'var(--vscode-button-hoverBackground)' },
    '.cm-search button[name=close]': { background: 'transparent', color: 'var(--vscode-editor-foreground)', border: '1px solid var(--vscode-input-border) !important', borderRadius: '3px', opacity: '0.55', fontSize: '13px', padding: '4px 10px !important', marginLeft: 'auto', lineHeight: '1' },
    '.cm-search button[name=close]:hover': { opacity: '1', background: 'var(--vscode-errorForeground, #f44)', color: '#fff', borderColor: 'transparent !important' },
  }, { dark: true });
}

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.15em' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.08em' },
  { tag: tags.heading3, fontWeight: '600' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', opacity: '0.85' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', opacity: '0.6' },
  { tag: tags.link, opacity: '0.75', textDecoration: 'underline' },
  { tag: tags.url, opacity: '0.5' },
  { tag: tags.monospace, fontFamily: 'monospace', opacity: '0.85' },
  { tag: tags.meta, opacity: '0.4' },
  { tag: tags.processingInstruction, opacity: '0.4' },
  { tag: tags.comment, opacity: '0.4', fontStyle: 'italic' },
  { tag: tags.quote, opacity: '0.65', fontStyle: 'italic' },
]);

// ── Editor actions ─────────────────────────────────────────────────────────

function wrapSel(view, before, after = before) {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: before + sel + after },
    selection: { anchor: from + before.length, head: from + before.length + sel.length },
  });
  view.focus();
}

function linePrefix(view, prefix) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  if (line.text.startsWith(prefix)) {
    view.dispatch({ changes: { from: line.from, to: line.from + prefix.length, insert: '' } });
  } else {
    view.dispatch({ changes: { from: line.from, insert: prefix } });
  }
  view.focus();
}

function insertCodeBlock(view) {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  const insert = '```\n' + (sel || '') + '\n```';
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + 4, head: from + 4 + (sel || '').length },
  });
  view.focus();
}

// ── createMarkdownEditor ───────────────────────────────────────────────────

export function createMarkdownEditor(container, initialDoc, { onChange, height = '400px' } = {}) {
  let view;
  let previewVisible = false;
  let previewBtnEl = null;

  function togglePreview() {
    previewVisible = !previewVisible;
    previewEl.classList.toggle('md-preview-visible', previewVisible);
    if (previewBtnEl) previewBtnEl.classList.toggle('tb-active', previewVisible);
    if (previewVisible) renderPreview();
  }

  function renderPreview() {
    if (!previewVisible || !view) return;
    previewEl.innerHTML = marked.parse(view.state.doc.toString());
  }

  function updateWordCount() {
    if (!view) return;
    const text = view.state.doc.toString();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCountEl.textContent = `${words.toLocaleString()} words · ${text.length.toLocaleString()} chars`;
  }

  // ── DOM ──
  container.innerHTML = '';
  container.style.cssText = `height:${height};display:flex;flex-direction:column;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden`;

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'md-toolbar';

  const toolDefs = [
    { label: 'H1', tip: 'Heading 1', fn: () => linePrefix(view, '# ') },
    { label: 'H2', tip: 'Heading 2', fn: () => linePrefix(view, '## ') },
    { label: 'H3', tip: 'Heading 3', fn: () => linePrefix(view, '### ') },
    'sep',
    { label: 'Bold', tip: 'Bold (wrap with **)', style: 'font-weight:700', fn: () => wrapSel(view, '**') },
    { label: 'Italic', tip: 'Italic (wrap with *)', style: 'font-style:italic', fn: () => wrapSel(view, '*') },
    { label: 'Code', tip: 'Inline code', style: 'font-family:monospace', fn: () => wrapSel(view, '`') },
    { label: 'Block', tip: 'Code block', style: 'font-family:monospace', fn: () => insertCodeBlock(view) },
    'sep',
    { label: '• List', tip: 'Bullet list', fn: () => linePrefix(view, '- ') },
    { label: '1. List', tip: 'Numbered list', fn: () => linePrefix(view, '1. ') },
    { label: 'Quote', tip: 'Blockquote', fn: () => linePrefix(view, '> ') },
    { label: '── HR', tip: 'Horizontal rule', fn: () => { const { from } = view.state.selection.main; const line = view.state.doc.lineAt(from); view.dispatch({ changes: { from: line.to, insert: '\n\n---\n' } }); view.focus(); } },
    'spacer',
    { label: 'Find', tip: 'Find & Replace (Ctrl+F)', fn: () => openSearchPanel(view) },
    { label: 'Preview', tip: 'Toggle preview', id: 'preview-toggle', fn: () => togglePreview() },
  ];

  toolDefs.forEach(t => {
    if (t === 'sep') {
      const el = document.createElement('div'); el.className = 'tb-sep'; toolbar.appendChild(el);
    } else if (t === 'spacer') {
      const el = document.createElement('div'); el.className = 'tb-spacer'; toolbar.appendChild(el);
    } else {
      const btn = document.createElement('button');
      btn.className = 'tb-btn';
      btn.textContent = t.label;
      if (t.tip) btn.title = t.tip;
      if (t.style) btn.style.cssText = t.style;
      btn.addEventListener('click', t.fn);
      toolbar.appendChild(btn);
      if (t.id === 'preview-toggle') previewBtnEl = btn;
    }
  });

  // Body
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;min-height:0;display:flex;overflow:hidden';

  const cmHost = document.createElement('div');
  cmHost.style.cssText = 'flex:1;min-height:0;overflow:hidden';

  const previewEl = document.createElement('div');
  previewEl.className = 'md-preview';

  body.appendChild(cmHost);
  body.appendChild(previewEl);

  // Status bar
  const statusBar = document.createElement('div');
  statusBar.className = 'md-statusbar';
  const wordCountEl = document.createElement('span');
  statusBar.appendChild(wordCountEl);

  container.appendChild(toolbar);
  container.appendChild(body);
  container.appendChild(statusBar);

  // ── CodeMirror ──
  view = new EditorView({
    state: EditorState.create({
      doc: initialDoc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        search({ top: false }),
        syntaxHighlighting(markdownHighlight, { fallback: true }),
        markdown({ base: markdownLanguage }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        vscodeDarkTheme(),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            updateWordCount();
            renderPreview();
            onChange?.(update.state.doc.toString());
          }
        }),
      ],
    }),
    parent: cmHost,
  });

  updateWordCount();

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(content) {
      if (view.state.doc.toString() === content) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
    },
  };
}

// ── Legacy compat (used by existing callers) ───────────────────────────────

export function createEditor(parent, doc, onChange) {
  return createMarkdownEditor(parent, doc, { onChange }).view;
}

export function setEditorContent(view, content) {
  if (view.state.doc.toString() === content) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
}
