export const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#a855f7', '#6366f1', '#e11d48',
];

export const STICKY_COLORS = [
  '#fef08a', '#bef264', '#67e8f9', '#c4b5fd',
  '#fda4af', '#fdba74', '#86efac', '#93c5fd',
];

export function getUserColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
