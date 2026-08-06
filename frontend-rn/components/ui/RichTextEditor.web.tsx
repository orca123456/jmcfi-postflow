import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const TOOLBAR_STYLE = `
  display:flex;align-items:center;gap:4px;padding:6px 10px;
  background:#F9FAFB;border-bottom:1px solid #E5E7EB;flex-wrap:wrap;
`;
const BTN_STYLE = `
  border:none;background:transparent;cursor:pointer;padding:4px 8px;
  border-radius:4px;font-size:14px;color:#374151;
`;
const BTN_HOVER = `background:#E5E7EB;`;
const DIVIDER_STYLE = `width:1px;height:20px;background:#E5E7EB;margin:0 4px;`;

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = 150,
}) => {
  const editorRef = useRef<any>(null);
  const isInternalChange = useRef(false);

  // Inject Quill CSS dynamically at the root level
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('rich-editor-css')) return;
    const link = document.createElement('link');
    link.id = 'rich-editor-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css';
    document.head.appendChild(link);
  }, []);

  // Sync external value changes into the editor
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = editorRef.current;
    if (!el || isInternalChange.current) return;
    el.innerHTML = value || '';
  }, [value]);

  const execFormat = (cmd: string, val?: string) => {
    if (typeof document === 'undefined') return;
    const el = editorRef.current;
    if (el) el.focus();
    document.execCommand(cmd, false, val);
  };

  const handleInput = () => {
    isInternalChange.current = true;
    onChange(editorRef.current?.innerHTML || '');
    setTimeout(() => { isInternalChange.current = false; }, 0);
  };

  if (typeof document === 'undefined') return null;

  return (
    <View style={[styles.container, { minHeight }]}>
      {/* @ts-ignore */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', flexWrap: 'wrap' }}>
        {[
          { cmd: 'bold', label: <b>B</b>, title: 'Bold' },
          { cmd: 'italic', label: <i>I</i>, title: 'Italic' },
          { cmd: 'underline', label: <u>U</u>, title: 'Underline' },
        ].map(({ cmd, label, title }) => (
          // @ts-ignore
          <button
            key={cmd}
            title={title}
            onMouseDown={(e: any) => { e.preventDefault(); execFormat(cmd); }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontSize: 14, color: '#374151', fontWeight: cmd === 'bold' ? 'bold' : 'normal' }}
          >
            {label}
          </button>
        ))}
        {/* @ts-ignore */}
        <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px' }} />
        {[
          { cmd: 'insertUnorderedList', label: '≡', title: 'Bullet List' },
          { cmd: 'insertOrderedList', label: '⊟', title: 'Ordered List' },
        ].map(({ cmd, label, title }) => (
          // @ts-ignore
          <button
            key={cmd}
            title={title}
            onMouseDown={(e: any) => { e.preventDefault(); execFormat(cmd); }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontSize: 16, color: '#374151' }}
          >
            {label}
          </button>
        ))}
        {/* @ts-ignore */}
        <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px' }} />
        {/* @ts-ignore */}
        <button
          title="Remove Formatting"
          onMouseDown={(e: any) => { e.preventDefault(); execFormat('removeFormat'); }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: 4, fontSize: 12, color: '#6B7280' }}
        >
          ✕
        </button>
      </div>
      {/* @ts-ignore */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        style={{
          minHeight: minHeight - 45,
          padding: '10px 12px',
          fontSize: 14,
          color: '#1F2937',
          outline: 'none',
          fontFamily: 'sans-serif',
          lineHeight: 1.6,
          overflowY: 'auto',
        }}
      />
      {/* @ts-ignore */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
        }
        [contenteditable] b, [contenteditable] strong { font-weight: bold; }
        [contenteditable] i, [contenteditable] em { font-style: italic; }
        [contenteditable] u { text-decoration: underline; }
        [contenteditable] ul { list-style-type: disc; padding-left: 20px; margin: 4px 0; }
        [contenteditable] ol { list-style-type: decimal; padding-left: 20px; margin: 4px 0; }
      `}</style>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
});
