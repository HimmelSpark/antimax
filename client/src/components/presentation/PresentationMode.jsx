import { useState, useEffect, useCallback, useRef } from 'react';
import DocumentViewer from './DocumentViewer';
import styles from './PresentationMode.module.css';
import { ChevronLeft, ChevronRight, Minimize2, Maximize2, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function PresentationMode({ yjs, pendingUrl, onClearPending }) {
  const user = useAuthStore((s) => s.user);

  // Viewer state (receiving presentation from someone else)
  const [viewing, setViewing] = useState(null);

  // Presenter state (I am presenting)
  const [presenting, setPresenting] = useState(null);

  const [minimized, setMinimized] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const startSentRef = useRef(false);

  // Handle incoming presentation events (for viewers)
  useEffect(() => {
    return yjs.onPresentation((data) => {
      // Ignore own events
      if (data.userId === user?.id) return;

      switch (data.action) {
        case 'start':
          setViewing({
            docUrl: data.docUrl,
            totalPages: data.total,
            currentPage: data.page || 1,
            presenterCursor: null,
            presenter: data.displayName,
          });
          setMinimized(false);
          break;
        case 'stop':
          setViewing(null);
          break;
        case 'page_change':
          setViewing((prev) => prev ? { ...prev, currentPage: data.page } : null);
          break;
        case 'cursor':
          setViewing((prev) => prev ? { ...prev, presenterCursor: { x: data.x, y: data.y } } : null);
          break;
      }
    });
  }, [yjs.onPresentation, user?.id]);

  // When toolbar triggers a presentation file
  useEffect(() => {
    if (!pendingUrl) return;
    startSentRef.current = false;
    setPresenting({ docUrl: pendingUrl, currentPage: 1 });
    setMinimized(false);
    onClearPending?.();
  }, [pendingUrl, onClearPending]);

  // When PDF loads, get total pages and broadcast start (only once per presentation)
  const handleDocLoaded = useCallback((numPages) => {
    setTotalPages(numPages);
    if (presenting && !startSentRef.current) {
      startSentRef.current = true;
      yjs.sendPresentation({ action: 'start', docUrl: presenting.docUrl, total: numPages });
    }
  }, [presenting, yjs]);

  const changePage = useCallback((delta) => {
    setPresenting((prev) => {
      if (!prev) return null;
      const next = Math.max(1, Math.min(totalPages, prev.currentPage + delta));
      if (next !== prev.currentPage) {
        yjs.sendPresentation({ action: 'page_change', page: next });
      }
      return { ...prev, currentPage: next };
    });
  }, [totalPages, yjs]);

  const stopPresenting = useCallback(() => {
    yjs.sendPresentation({ action: 'stop' });
    setPresenting(null);
    setTotalPages(0);
    startSentRef.current = false;
  }, [yjs]);

  const stopViewing = useCallback(() => {
    setViewing(null);
  }, []);

  // Determine what to show
  const active = presenting || viewing;
  if (!active) return null;

  const isPresenter = !!presenting;
  const currentPage = active.currentPage || 1;
  const pages = isPresenter ? totalPages : (active.totalPages || 0);
  const label = isPresenter ? 'You are presenting' : `${active.presenter} is presenting`;

  return (
    <div className={`${styles.root} ${minimized ? styles.rootMinimized : ''}`}>
      <div
        className={`${styles.backdrop} ${minimized ? styles.backdropHidden : ''}`}
      />

      <div className={`${styles.container} ${minimized ? styles.containerMinimized : ''}`}>
        {/* Header */}
        <div className={`${styles.header} ${minimized ? styles.headerHidden : ''}`}>
          <span className={styles.title}>{label}</span>

          <div className={styles.headerCenter}>
            {isPresenter && (
              <div className={styles.pageNav}>
                <button
                  className={styles.navBtn}
                  onClick={() => changePage(-1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className={styles.pageInfo}>{currentPage} / {pages}</span>
                <button
                  className={styles.navBtn}
                  onClick={() => changePage(1)}
                  disabled={currentPage >= pages}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            {!isPresenter && pages > 0 && (
              <span className={styles.pageInfo}>{currentPage} / {pages}</span>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.actionBtn} onClick={() => setMinimized(true)} title="Minimize">
              <Minimize2 size={16} />
            </button>
            <button
              className={`${styles.actionBtn} ${styles.stopBtn}`}
              onClick={isPresenter ? stopPresenting : stopViewing}
              title={isPresenter ? 'Stop presenting' : 'Close'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Document */}
        <div className={styles.viewerWrap}>
          <DocumentViewer
            url={active.docUrl}
            page={currentPage}
            presenterCursor={active.presenterCursor}
            onLoaded={handleDocLoaded}
          />
        </div>

        {/* Minimized overlay */}
        {minimized && (
          <div className={styles.miniOverlay} onClick={() => setMinimized(false)}>
            <Maximize2 size={16} />
            <span className={styles.miniLabel}>{currentPage}/{pages}</span>
          </div>
        )}
      </div>
    </div>
  );
}
