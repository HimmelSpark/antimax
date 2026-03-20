import { useLivekitContext } from '../../hooks/LivekitContext';
import styles from './MediaControls.module.css';
import { Video, VideoOff, Mic, MicOff, Monitor } from 'lucide-react';

export default function MediaControls() {
  const livekit = useLivekitContext();
  if (!livekit || !livekit.connected) return null;

  return (
    <div className={styles.controls}>
      <button className={`${styles.btn} ${!livekit.localVideoEnabled ? styles.off : ''}`} onClick={livekit.toggleVideo} title="Toggle video">
        {livekit.localVideoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
      </button>
      <button className={`${styles.btn} ${!livekit.localAudioEnabled ? styles.off : ''}`} onClick={livekit.toggleAudio} title="Toggle audio">
        {livekit.localAudioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
      </button>
      <button
        className={`${styles.btn} ${livekit.screenShareTrack?.isLocal ? styles.active : ''}`}
        onClick={livekit.toggleScreenShare}
        title="Share screen"
      >
        <Monitor size={16} />
      </button>
    </div>
  );
}
