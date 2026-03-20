import { useState, useRef, useEffect } from 'react';
import styles from './ColorPicker.module.css';

const PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#ffffff', '#94a3b8', '#1e293b',
];

export default function ColorPicker({ label, color, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className={styles.container} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        title={label}
      >
        <div className={styles.swatch} style={{ background: color }} />
      </button>

      {open && (
        <div className={styles.popover}>
          <div className={styles.label}>{label}</div>
          <div className={styles.grid}>
            {PRESETS.map((c) => (
              <button
                key={c}
                className={`${styles.presetBtn} ${color === c ? styles.selected : ''}`}
                style={{ background: c }}
                onClick={() => { onChange(c); setOpen(false); }}
              />
            ))}
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className={styles.nativeInput}
          />
        </div>
      )}
    </div>
  );
}
