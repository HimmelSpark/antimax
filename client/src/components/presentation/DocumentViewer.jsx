import { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import styles from './DocumentViewer.module.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function DocumentViewer({ url, page, presenterCursor, onLoaded }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setPdfDoc(null);
    pdfjsLib.getDocument(url).promise.then((doc) => {
      if (cancelled) return;
      setPdfDoc(doc);
      onLoadedRef.current?.(doc.numPages);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    let cancelled = false;
    const renderPage = async () => {
      const pageObj = await pdfDoc.getPage(page);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const viewport = pageObj.getViewport({ scale: 1 });

      const scale = Math.min(
        containerWidth / viewport.width,
        containerHeight / viewport.height
      ) * 0.95;

      const scaledViewport = pageObj.getViewport({ scale });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      setDimensions({ width: scaledViewport.width, height: scaledViewport.height });

      await pageObj.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise;
    };

    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, page]);

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {presenterCursor && dimensions.width > 0 && (
        <div
          className={styles.cursor}
          style={{
            left: `calc(50% - ${dimensions.width / 2}px + ${presenterCursor.x * dimensions.width}px)`,
            top: `calc(50% - ${dimensions.height / 2}px + ${presenterCursor.y * dimensions.height}px)`,
          }}
        />
      )}
    </div>
  );
}
