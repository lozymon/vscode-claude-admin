import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle, indentOnInput } from '@codemirror/language';
import { tags } from '@lezer/highlight';

function vscodeDarkTheme() {
  return EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '13px',
      fontFamily: 'var(--vscode-editor-font-family, monospace)',
      background: 'var(--vscode-input-background)',
      color: 'var(--vscode-editor-foreground)',
      border: '1px solid var(--vscode-input-border)',
      borderRadius: '4px',
    },
    '.cm-content': { caretColor: 'var(--vscode-editor-foreground)', padding: '8px 0' },
    '.cm-cursor': { borderLeftColor: 'var(--vscode-editor-foreground)' },
    '.cm-focused': { outline: 'none' },
    '&.cm-focused': { borderColor: 'var(--vscode-focusBorder)', boxShadow: '0 0 0 1px var(--vscode-focusBorder)' },
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
  }, { dark: true });
}

// Subtle markdown highlight style — uses foreground variations, no bright colours
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
  { tag: tags.meta, opacity: '0.45' },           // punctuation like **, __, []()
  { tag: tags.processingInstruction, opacity: '0.45' }, // markers
  { tag: tags.comment, opacity: '0.4', fontStyle: 'italic' },
  { tag: tags.quote, opacity: '0.6', fontStyle: 'italic' },
]);

export function createEditor(parent, doc, onChange) {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        syntaxHighlighting(markdownHighlight, { fallback: true }),
        markdown({ base: markdownLanguage }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        vscodeDarkTheme(),
        EditorView.updateListener.of(update => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    }),
    parent,
  });
  return view;
}

export function setEditorContent(view, content) {
  if (view.state.doc.toString() === content) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
}
