import { useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { getUserColor } from '../../utils/colors';
import styles from './CursorOverlay.module.css';

export default function CursorOverlay({ cursors, currentUserId }) {
  const zoom = useCanvasStore((s) => s.zoom);
  const stagePos = useCanvasStore((s) => s.stagePos);

  const otherCursors = useMemo(() => {
    const result = [];
    cursors.forEach((data, userId) => {
      if (userId === currentUserId) return;
      if (!data.cursor) return;
      result.push({ ...data, color: getUserColor(userId) });
    });
    return result;
  }, [cursors, currentUserId]);

  return (
    <div className={styles.overlay}>
      {otherCursors.map((c) => (
        <div
          key={c.userId}
          className={styles.cursor}
          style={{
            transform: `translate(${c.cursor.x * zoom + stagePos.x}px, ${c.cursor.y * zoom + stagePos.y}px)`,
          }}
        >
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
            <path d="M0 0L16 12H6L3 20L0 0Z" fill={c.color} />
          </svg>
          <span className={styles.name} style={{ background: c.color }}>
            {c.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}
