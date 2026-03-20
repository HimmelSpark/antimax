import { useState, useRef, useCallback } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import api from '../api/client';

export function useLivekit(boardId) {
  const roomRef = useRef(null);
  const [participants, setParticipants] = useState([]);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(false);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [screenShareTrack, setScreenShareTrack] = useState(null);

  const join = useCallback(async () => {
    if (!boardId || connected || joining) return;
    setJoining(true);

    try {
      const { data } = await api.get('/livekit/token', { params: { boardId } });

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      const updateParticipants = () => {
        if (!room) return;
        const all = [room.localParticipant, ...room.remoteParticipants.values()];
        setParticipants([...all]);

        let screenTrack = null;
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
      room.on(RoomEvent.Connected, () => { setConnected(true); updateParticipants(); });
      room.on(RoomEvent.Reconnected, () => { setConnected(true); updateParticipants(); });
      room.on(RoomEvent.Disconnected, () => {
        setConnected(false);
        setParticipants([]);
        setScreenShareTrack(null);
        roomRef.current = null;
      });

      // Always use current host for LiveKit (Caddy/nginx proxies /rtc → livekit)
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const livekitUrl = `${proto}//${window.location.host}`;

      await room.connect(livekitUrl, data.token);
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
    } catch (err) {
      console.error('Livekit error:', err);
    } finally {
      setJoining(false);
    }
  }, [boardId, connected, joining]);

  const leave = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setConnected(false);
    setParticipants([]);
    setLocalVideoEnabled(false);
    setLocalAudioEnabled(false);
    setScreenShareTrack(null);
  }, []);

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
    joining,
    localVideoEnabled,
    localAudioEnabled,
    screenShareTrack,
    join,
    leave,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
  };
}
