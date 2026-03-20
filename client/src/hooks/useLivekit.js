import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import api from '../api/client';

export function useLivekit(boardId) {
  const roomRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(false);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [screenShareTrack, setScreenShareTrack] = useState(null);

  useEffect(() => {
    if (!boardId) return;

    let room;
    let cancelled = false;

    const connect = async () => {
      try {
        const { data } = await api.get('/livekit/token', { params: { boardId } });
        if (cancelled) return;

        room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        const updateParticipants = () => {
          if (!room || cancelled) return;
          const all = [room.localParticipant, ...room.remoteParticipants.values()];
          setParticipants([...all]);

          let screenTrack = null;
          // Check all participants (including local) for screen share
          for (const p of all) {
            for (const pub of p.trackPublications.values()) {
              if (pub.source === Track.Source.ScreenShare && pub.track) {
                screenTrack = { track: pub.track, participant: p, isLocal: p === room.localParticipant };
                break;
              }
            }
            if (screenTrack) break;
          }
          setScreenShareTrack(screenTrack);
        };

        room.on(RoomEvent.ParticipantConnected, updateParticipants);
        room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
        room.on(RoomEvent.TrackSubscribed, updateParticipants);
        room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
        room.on(RoomEvent.TrackPublished, updateParticipants);
        room.on(RoomEvent.TrackUnpublished, updateParticipants);
        room.on(RoomEvent.TrackMuted, updateParticipants);
        room.on(RoomEvent.TrackUnmuted, updateParticipants);
        room.on(RoomEvent.LocalTrackPublished, updateParticipants);
        room.on(RoomEvent.LocalTrackUnpublished, updateParticipants);
        room.on(RoomEvent.Connected, () => {
          setConnected(true);
          updateParticipants();
        });
        room.on(RoomEvent.Reconnected, () => {
          setConnected(true);
          updateParticipants();
        });
        room.on(RoomEvent.Disconnected, () => setConnected(false));

        // Always use current host for LiveKit (nginx proxies /rtc → livekit)
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const livekitUrl = `${proto}//${window.location.host}`;

        // Retry connection up to 3 times
        let connectSuccess = false;
        for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
          try {
            await room.connect(livekitUrl, data.token);
            connectSuccess = true;
            break;
          } catch (connErr) {
            console.warn(`Livekit connect attempt ${attempt + 1}/3 failed:`, connErr.message);
            if (attempt < 2 && !cancelled) {
              room.disconnect();
              room = new Room({ adaptiveStream: true, dynacast: true });
              roomRef.current = room;
              room.on(RoomEvent.ParticipantConnected, updateParticipants);
              room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
              room.on(RoomEvent.TrackSubscribed, updateParticipants);
              room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
              room.on(RoomEvent.TrackPublished, updateParticipants);
              room.on(RoomEvent.TrackUnpublished, updateParticipants);
              room.on(RoomEvent.TrackMuted, updateParticipants);
              room.on(RoomEvent.TrackUnmuted, updateParticipants);
              room.on(RoomEvent.LocalTrackPublished, updateParticipants);
              room.on(RoomEvent.LocalTrackUnpublished, updateParticipants);
              room.on(RoomEvent.Connected, () => { setConnected(true); updateParticipants(); });
              room.on(RoomEvent.Reconnected, () => { setConnected(true); updateParticipants(); });
              room.on(RoomEvent.Disconnected, () => setConnected(false));
              // Get a fresh token for retry
              try {
                const fresh = await api.get('/livekit/token', { params: { boardId } });
                data.token = fresh.data.token;
              } catch {}
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }

        if (cancelled) return;

        if (connectSuccess) {
          setConnected(true);
          updateParticipants();

          try {
            await room.localParticipant.enableCameraAndMicrophone();
            setLocalVideoEnabled(true);
            setLocalAudioEnabled(true);
          } catch (mediaErr) {
            console.warn('Camera/mic failed:', mediaErr.message);
          }
          updateParticipants();
        } else {
          console.error('Livekit: all connection attempts failed');
        }
      } catch (err) {
        console.error('Livekit error:', err);
      }
    };

    connect();

    return () => {
      cancelled = true;
      room?.disconnect();
      roomRef.current = null;
    };
  }, [boardId]);

  const toggleVideo = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = !localVideoEnabled;
    await room.localParticipant.setCameraEnabled(enabled);
    setLocalVideoEnabled(enabled);
  }, [localVideoEnabled]);

  const toggleAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = !localAudioEnabled;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    setLocalAudioEnabled(enabled);
  }, [localAudioEnabled]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const isSharing = room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(!isSharing);
  }, []);

  return {
    room: roomRef,
    participants,
    connected,
    localVideoEnabled,
    localAudioEnabled,
    screenShareTrack,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
  };
}
