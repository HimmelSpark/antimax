import { useLivekitContext } from '../../hooks/LivekitContext';
import VideoBubble from './VideoBubble';
import ScreenShareOverlay from '../presentation/ScreenShare';

export default function BubbleContainer() {
  const livekit = useLivekitContext();
  if (!livekit) return null;

  return (
    <>
      {livekit.participants.map((participant, index) => (
        <VideoBubble key={participant.identity} participant={participant} index={index} />
      ))}
      {livekit.screenShareTrack && (
        <ScreenShareOverlay
          track={livekit.screenShareTrack.track}
          participantName={livekit.screenShareTrack.participant.name || livekit.screenShareTrack.participant.identity}
          isLocal={livekit.screenShareTrack.isLocal}
          onStop={livekit.toggleScreenShare}
        />
      )}
    </>
  );
}
