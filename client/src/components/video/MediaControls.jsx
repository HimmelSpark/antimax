import { useLivekitContext } from '../../hooks/LivekitContext';
import styles from './MediaControls.module.css';
import { Video, VideoOff, Mic, MicOff, Monitor, Phone, PhoneOff } from 'lucide-react';

export default function MediaControls() {
  const livekit = useLivekitContext();
  if (!livekit) return null;

  if (!livekit.connected) {
    return (
      <div className={styles.controls}>
        <button
          className={`${styles.btn} ${styles.join}`}
          onClick={livekit.join}
          disabled={livekit.joining}
          title="Join call"
        >
          <Phone size={16} />
        </button>
      </div>
    );
  }

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
      <button className={`${styles.btn} ${styles.leave}`} onClick={livekit.leave} title="Leave call">
        <PhoneOff size={16} />
      </button>
    </div>
  );
}
