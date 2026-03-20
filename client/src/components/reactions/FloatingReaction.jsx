import { motion } from 'framer-motion';

export default function FloatingReaction({ emoji, name }) {
  const x = Math.random() * (window.innerWidth - 100) + 50;

  return (
    <motion.div
      initial={{ opacity: 1, y: window.innerHeight - 100, x, scale: 1 }}
      animate={{ opacity: 0, y: window.innerHeight - 400, scale: 1.5 }}
      transition={{ duration: 2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 40 }}>{emoji}</span>
      {name && (
        <span style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)',
          padding: '2px 8px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
        }}>
          {name}
        </span>
      )}
    </motion.div>
  );
}
