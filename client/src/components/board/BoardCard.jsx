import { Trash2 } from 'lucide-react';
import styles from './BoardCard.module.css';

export default function BoardCard({ board, onClick, onDelete }) {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm('Delete this board?')) {
      onDelete();
    }
  };

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.preview}>
        <span className={styles.initial}>{board.title[0]?.toUpperCase()}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{board.title}</span>
        <span className={styles.date}>
          {new Date(board.createdAt).toLocaleDateString()}
        </span>
      </div>
      <button className={styles.deleteBtn} onClick={handleDelete} title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
