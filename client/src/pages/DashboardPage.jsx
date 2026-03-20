import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBoardStore } from '../store/boardStore';
import BoardCard from '../components/board/BoardCard';
import styles from './DashboardPage.module.css';
import { Plus, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { boards, loading, fetchBoards, createBoard, deleteBoard } = useBoardStore();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const handleCreate = async () => {
    if (creating) {
      if (newTitle.trim()) {
        const board = await createBoard(newTitle.trim());
        navigate(`/board/${board.id}`);
      }
      setCreating(false);
      setNewTitle('');
    } else {
      setCreating(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setCreating(false);
      setNewTitle('');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.logo}>Antimax</h1>
        <div className={styles.headerRight}>
          <span className={styles.userName}>{user?.displayName}</span>
          <button className={styles.logoutBtn} onClick={logout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>My Boards</h2>
          <button className={styles.createBtn} onClick={handleCreate}>
            <Plus size={18} />
            New Board
          </button>
        </div>

        {creating && (
          <div className={styles.createInput}>
            <input
              autoFocus
              placeholder="Board title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.input}
            />
          </div>
        )}

        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : boards.length === 0 ? (
          <div className={styles.empty}>
            No boards yet. Create your first one!
          </div>
        ) : (
          <div className={styles.grid}>
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onClick={() => navigate(`/board/${board.id}`)}
                onDelete={() => deleteBoard(board.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
