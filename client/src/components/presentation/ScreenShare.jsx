import { useRef, useEffect, useState } from 'react';
import styles from './ScreenShare.module.css';
import { Minimize2, Maximize2, X } from 'lucide-react';

export default function ScreenShareOverlay({ track, participantName, isLocal, onStop }) {
  const videoRef = useRef(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (el && track) {
      track.attach(el);
      return () => track.detach(el);
    }
  }, [track]);

  return (
    <div className={`${styles.root} ${minimized ? styles.rootMinimized : ''}`}>
      {/* Backdrop — only visible when expanded */}
      <div
        className={`${styles.backdrop} ${minimized ? styles.backdropHidden : ''}`}
        onClick={() => setMinimized(true)}
      />

      <div className={`${styles.container} ${minimized ? styles.containerMinimized : ''}`}>
        {/* Header — only in expanded mode */}
        <div className={`${styles.header} ${minimized ? styles.headerHidden : ''}`}>
          <span className={styles.title}>
            {isLocal ? 'You are sharing your screen' : `${participantName} is sharing their screen`}
          </span>
          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={() => setMinimized(true)} title="Minimize">
              <Minimize2 size={16} />
            </button>
            {isLocal && onStop && (
              <button className={`${styles.actionBtn} ${styles.stopBtn}`} onClick={onStop} title="Stop sharing">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className={styles.videoWrap}>
          <video ref={videoRef} className={styles.video} autoPlay playsInline />
        </div>

        {/* Minimized overlay controls */}
        {minimized && (
          <div className={styles.miniOverlay} onClick={() => setMinimized(false)}>
            <Maximize2 size={16} />
            {isLocal && onStop && (
              <button
                className={styles.miniStop}
                onClick={(e) => { e.stopPropagation(); onStop(); }}
                title="Stop sharing"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
