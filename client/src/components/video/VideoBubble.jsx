import { useRef, useEffect, useState, useCallback } from 'react';
import { Track } from 'livekit-client';
import { BubblePhysics } from '../../utils/physics';
import styles from './VideoBubble.module.css';
import { MicOff } from 'lucide-react';

const BUBBLE_SIZE = 120;

export default function VideoBubble({ participant, index }) {
  const videoRef = useRef(null);
  const bubbleRef = useRef(null);
  const physicsRef = useRef(null);
  const animFrameRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const videoTrack = Array.from(participant.trackPublications.values()).find(
    (pub) => pub.source === Track.Source.Camera && pub.track && !pub.isMuted
  );

  const isMuted = !Array.from(participant.trackPublications.values()).some(
    (pub) => pub.source === Track.Source.Microphone && pub.track && !pub.isMuted
  );

  useEffect(() => {
    if (videoRef.current && videoTrack?.track) {
      videoTrack.track.attach(videoRef.current);
      return () => videoTrack.track.detach(videoRef.current);
    }
  }, [videoTrack]);

  useEffect(() => {
    const offsetX = 20 + (index % 4) * (BUBBLE_SIZE + 12);
    const offsetY = window.innerHeight - BUBBLE_SIZE - 80 - Math.floor(index / 4) * (BUBBLE_SIZE + 12);
    physicsRef.current = new BubblePhysics(offsetX, offsetY, BUBBLE_SIZE);

    const animate = () => {
      const physics = physicsRef.current;
      if (!physics) return;
      physics.update(window.innerWidth, window.innerHeight);
      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translate(${physics.x}px, ${physics.y}px)`;
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [index]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    physicsRef.current?.startDrag(e.clientX, e.clientY);

    const handleMove = (e) => {
      physicsRef.current?.drag(e.clientX, e.clientY);
    };
    const handleUp = () => {
      setIsDragging(false);
      physicsRef.current?.release();
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, []);

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    physicsRef.current?.startDrag(touch.clientX, touch.clientY);

    const handleMove = (e) => {
      const t = e.touches[0];
      physicsRef.current?.drag(t.clientX, t.clientY);
    };
    const handleEnd = () => {
      setIsDragging(false);
      physicsRef.current?.release();
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  }, []);

  const displayName = participant.name || participant.identity;
  const hasVideo = !!videoTrack;

  return (
    <div
      ref={bubbleRef}
      className={`${styles.bubble} ${isDragging ? styles.dragging : ''}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
    >
      {hasVideo ? (
        <video ref={videoRef} className={styles.video} autoPlay playsInline muted={participant.isLocal} />
      ) : (
        <div className={styles.avatar}>
          {displayName?.[0]?.toUpperCase() || '?'}
        </div>
      )}

      <div className={styles.nameTag}>
        {isMuted && <MicOff size={10} />}
        <span>{displayName}</span>
      </div>
    </div>
  );
}
