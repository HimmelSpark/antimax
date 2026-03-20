import { useCanvasStore } from '../../store/canvasStore';
import ColorPicker from './ColorPicker';
import styles from './Toolbar.module.css';
import {
  MousePointer2, Square, Circle, Triangle,
  Minus, MoveRight, StickyNote, Type, ImagePlus, Presentation,
} from 'lucide-react';

const tools = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'rect', icon: Square, label: 'Rectangle (R)' },
  { id: 'circle', icon: Circle, label: 'Ellipse (C)' },
  { id: 'triangle', icon: Triangle, label: 'Triangle (T)' },
  { id: 'line', icon: Minus, label: 'Line (L)' },
  { id: 'arrow', icon: MoveRight, label: 'Arrow (A)' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky Note (S)' },
  { id: 'text', icon: Type, label: 'Text (X)' },
  { id: 'image', icon: ImagePlus, label: 'Image (I)' },
];

const shortcuts = { v: 'select', r: 'rect', c: 'circle', t: 'triangle', l: 'line', a: 'arrow', s: 'sticky', x: 'text' };

export default function Toolbar({ onPresentation }) {
  const { tool, color, strokeColor, setTool, setColor, setStrokeColor } = useCanvasStore();

  if (typeof window !== 'undefined') {
    window.__toolbarShortcuts = shortcuts;
    if (!window.__toolbarKeyListener) {
      window.__toolbarKeyListener = true;
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const t = shortcuts[e.key.toLowerCase()];
        if (t) useCanvasStore.getState().setTool(t);
      });
    }
  }

  const handlePresentationClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.pptx,.ppt,.docx,.doc';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('boardId', window.location.pathname.split('/').pop());
      try {
        const { default: api } = await import('../../api/client');
        const endpoint = isPdf ? '/upload' : '/convert';
        const { data } = await api.post(endpoint, formData);
        if (onPresentation) onPresentation(data.url);
      } catch (err) {
        console.error('Presentation upload failed:', err);
      }
    };
    input.click();
  };

  const handleImageClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('boardId', window.location.pathname.split('/').pop());
      try {
        const { default: api } = await import('../../api/client');
        const { data } = await api.post('/upload', formData);
        window.dispatchEvent(new CustomEvent('addImage', { detail: data }));
      } catch (err) {
        console.error('Upload failed:', err);
      }
    };
    input.click();
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.tools}>
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`${styles.toolBtn} ${tool === id ? styles.active : ''}`}
            onClick={() => id === 'image' ? handleImageClick() : setTool(id)}
            title={label}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <button
        className={styles.toolBtn}
        onClick={handlePresentationClick}
        title="Present file (PDF, PPTX)"
      >
        <Presentation size={18} />
      </button>

      <div className={styles.divider} />

      <ColorPicker label="Fill" color={color} onChange={setColor} />
      <ColorPicker label="Stroke" color={strokeColor} onChange={setStrokeColor} />
    </div>
  );
}
