import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBoardStore } from '../store/boardStore';
import { useYjs } from '../hooks/useYjs';
import { LivekitProvider } from '../hooks/LivekitContext';
import WhiteboardCanvas from '../components/canvas/WhiteboardCanvas';
import CursorOverlay from '../components/canvas/CursorOverlay';
import Toolbar from '../components/toolbar/Toolbar';
import BubbleContainer from '../components/video/BubbleContainer';
import MediaControls from '../components/video/MediaControls';
import ChatPanel from '../components/chat/ChatPanel';
import ReactionBar from '../components/reactions/ReactionBar';
import FloatingReaction from '../components/reactions/FloatingReaction';
import InviteDialog from '../components/board/InviteDialog';
import PresentationMode from '../components/presentation/PresentationMode';
import styles from './BoardPage.module.css';
import { MessageCircle, Share2, ArrowLeft, Wifi, WifiOff } from 'lucide-react';

export default function BoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const fetchBoard = useBoardStore((s) => s.fetchBoard);
  const [board, setBoard] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [reactions, setReactions] = useState([]);
  const reactionIdRef = useRef(0);

  const yjs = useYjs(id, token, user);
  const [presentationUrl, setPresentationUrl] = useState(null);

  useEffect(() => {
    fetchBoard(id).then(setBoard).catch(() => navigate('/dashboard'));
  }, [id, fetchBoard, navigate]);

  useEffect(() => {
    return yjs.onReaction((reaction) => {
      if (reaction.userId === user?.id) return;
      const rid = ++reactionIdRef.current;
      setReactions((prev) => [...prev, { ...reaction, id: rid }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== rid));
      }, 2000);
    });
  }, [yjs.onReaction, user?.id]);

  const handleReaction = useCallback((emoji) => {
    yjs.sendReaction(emoji);
    const rid = ++reactionIdRef.current;
    setReactions((prev) => [...prev, { emoji, displayName: user?.displayName, id: rid }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== rid));
    }, 2000);
  }, [yjs, user]);

  if (!board) {
    return <div className={styles.loading}>Loading board...</div>;
  }

  return (
    <LivekitProvider boardId={id}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.iconBtn} onClick={() => navigate('/dashboard')} title="Back">
              <ArrowLeft size={18} />
            </button>
            <span className={styles.boardTitle}>{board.title}</span>
            <span className={styles.status}>
              {yjs.connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            </span>
          </div>

          <div className={styles.headerRight}>
            <ReactionBar onReaction={handleReaction} />
            <button className={styles.iconBtn} onClick={() => setShowChat(!showChat)} title="Chat">
              <MessageCircle size={18} />
            </button>
            <button className={styles.iconBtn} onClick={() => setShowInvite(true)} title="Invite">
              <Share2 size={18} />
            </button>
            <MediaControls />
          </div>
        </header>

        <div className={styles.workspace}>
          <Toolbar onPresentation={setPresentationUrl} />

          <div className={styles.canvasArea}>
            <WhiteboardCanvas yjs={yjs} />
            <CursorOverlay cursors={yjs.cursors} currentUserId={user?.id} />
            <BubbleContainer />
            <PresentationMode
              yjs={yjs}
              pendingUrl={presentationUrl}
              onClearPending={() => setPresentationUrl(null)}
            />
          </div>

          {showChat && (
            <ChatPanel
              yjs={yjs}
              user={user}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>

        {reactions.map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} name={r.displayName} />
        ))}

        {showInvite && (
          <InviteDialog boardId={id} onClose={() => setShowInvite(false)} />
        )}
      </div>
    </LivekitProvider>
  );
}
