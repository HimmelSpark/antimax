import styles from './ReactionBar.module.css';

const REACTIONS = ['👍', '❤️', '😂', '🎉', '🤔', '👏'];

export default function ReactionBar({ onReaction }) {
  return (
    <div className={styles.bar}>
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className={styles.btn}
          onClick={() => onReaction(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
