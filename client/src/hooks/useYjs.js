import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as Y from 'yjs';

const MSG_SYNC = 0x00;
const MSG_UPDATE = 0x01;
const MSG_AWARENESS = 0x02;
const MSG_CHAT = 0x10;
const MSG_REACTION = 0x11;
const MSG_PRESENTATION = 0x12;

export function useYjs(boardId, token, user) {
  const docRef = useRef(null);
  const wsRef = useRef(null);
  const awarenessRef = useRef(new Map());
  const [connected, setConnected] = useState(false);
  const [elements, setElements] = useState(new Map());
  const [cursors, setCursors] = useState(new Map());
  const listenersRef = useRef({ chat: [], reaction: [], presentation: [] });

  useEffect(() => {
    if (!boardId || !token) return;

    const doc = new Y.Doc();
    docRef.current = doc;

    const elementsMap = doc.getMap('elements');
    const updateElements = () => {
      const result = new Map();
      elementsMap.forEach((val, key) => {
        if (val instanceof Y.Map) {
          result.set(key, val.toJSON());
        }
      });
      setElements(new Map(result));
    };
    elementsMap.observeDeep(updateElements);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/board/${boardId}?token=${token}`;
    let ws;
    let reconnectTimeout;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        // Ignore messages from stale WebSocket (e.g. StrictMode double-mount)
        if (ws !== wsRef.current) return;
        const data = new Uint8Array(event.data);
        if (data.length === 0) return;

        const msgType = data[0];
        const payload = data.slice(1);

        switch (msgType) {
          case MSG_SYNC: {
            Y.applyUpdate(doc, payload);
            updateElements();
            break;
          }
          case MSG_UPDATE: {
            Y.applyUpdate(doc, payload);
            break;
          }
          case MSG_AWARENESS: {
            try {
              const awareness = JSON.parse(new TextDecoder().decode(payload));
              awarenessRef.current.set(awareness.userId, awareness);
              setCursors(new Map(awarenessRef.current));
            } catch {}
            break;
          }
          case MSG_CHAT: {
            try {
              const chat = JSON.parse(new TextDecoder().decode(payload));
              listenersRef.current.chat.forEach((fn) => fn(chat));
            } catch {}
            break;
          }
          case MSG_REACTION: {
            try {
              const reaction = JSON.parse(new TextDecoder().decode(payload));
              listenersRef.current.reaction.forEach((fn) => fn(reaction));
            } catch {}
            break;
          }
          case MSG_PRESENTATION: {
            try {
              const pres = JSON.parse(new TextDecoder().decode(payload));
              listenersRef.current.presentation.forEach((fn) => fn(pres));
            } catch {}
            break;
          }
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    doc.on('update', (update, origin) => {
      if (origin === 'remote') return;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const msg = new Uint8Array(update.length + 1);
        msg[0] = MSG_UPDATE;
        msg.set(update, 1);
        wsRef.current.send(msg);
      }
    });

    return () => {
      clearTimeout(reconnectTimeout);
      ws?.close();
      doc.destroy();
      docRef.current = null;
      wsRef.current = null;
    };
  }, [boardId, token]);

  const sendAwareness = useCallback((data) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const payload = new TextEncoder().encode(JSON.stringify({ ...data, userId: user?.id, displayName: user?.displayName }));
    const msg = new Uint8Array(payload.length + 1);
    msg[0] = MSG_AWARENESS;
    msg.set(payload, 1);
    wsRef.current.send(msg);
  }, [user]);

  const sendChat = useCallback((content) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const payload = new TextEncoder().encode(JSON.stringify({
      userId: user?.id,
      displayName: user?.displayName,
      content,
      timestamp: new Date().toISOString(),
    }));
    const msg = new Uint8Array(payload.length + 1);
    msg[0] = MSG_CHAT;
    msg.set(payload, 1);
    wsRef.current.send(msg);
  }, [user]);

  const sendReaction = useCallback((emoji) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const payload = new TextEncoder().encode(JSON.stringify({
      userId: user?.id,
      displayName: user?.displayName,
      emoji,
    }));
    const msg = new Uint8Array(payload.length + 1);
    msg[0] = MSG_REACTION;
    msg.set(payload, 1);
    wsRef.current.send(msg);
  }, [user]);

  const sendPresentation = useCallback((data) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const payload = new TextEncoder().encode(JSON.stringify({
      ...data,
      userId: user?.id,
      displayName: user?.displayName,
    }));
    const msg = new Uint8Array(payload.length + 1);
    msg[0] = MSG_PRESENTATION;
    msg.set(payload, 1);
    wsRef.current.send(msg);
  }, [user]);

  const addElement = useCallback((id, data) => {
    const doc = docRef.current;
    if (!doc) return;
    const elementsMap = doc.getMap('elements');
    const el = new Y.Map();
    Object.entries(data).forEach(([k, v]) => el.set(k, v));
    elementsMap.set(id, el);
  }, []);

  const updateElement = useCallback((id, updates) => {
    const doc = docRef.current;
    if (!doc) return;
    const elementsMap = doc.getMap('elements');
    const el = elementsMap.get(id);
    if (el instanceof Y.Map) {
      doc.transact(() => {
        Object.entries(updates).forEach(([k, v]) => el.set(k, v));
      });
    }
  }, []);

  const deleteElement = useCallback((id) => {
    const doc = docRef.current;
    if (!doc) return;
    doc.getMap('elements').delete(id);
  }, []);

  const deleteElements = useCallback((ids) => {
    const doc = docRef.current;
    if (!doc) return;
    const elementsMap = doc.getMap('elements');
    doc.transact(() => {
      ids.forEach((id) => elementsMap.delete(id));
    });
  }, []);

  const onChat = useCallback((fn) => {
    listenersRef.current.chat.push(fn);
    return () => {
      listenersRef.current.chat = listenersRef.current.chat.filter((f) => f !== fn);
    };
  }, []);

  const onReaction = useCallback((fn) => {
    listenersRef.current.reaction.push(fn);
    return () => {
      listenersRef.current.reaction = listenersRef.current.reaction.filter((f) => f !== fn);
    };
  }, []);

  const onPresentation = useCallback((fn) => {
    listenersRef.current.presentation.push(fn);
    return () => {
      listenersRef.current.presentation = listenersRef.current.presentation.filter((f) => f !== fn);
    };
  }, []);

  const getUndoManager = useCallback(() => {
    const doc = docRef.current;
    if (!doc) return null;
    return new Y.UndoManager(doc.getMap('elements'));
  }, []);

  return useMemo(() => ({
    doc: docRef,
    connected,
    elements,
    cursors,
    sendAwareness,
    sendChat,
    sendReaction,
    sendPresentation,
    addElement,
    updateElement,
    deleteElement,
    deleteElements,
    onChat,
    onReaction,
    onPresentation,
    getUndoManager,
  }), [connected, elements, cursors, sendAwareness, sendChat, sendReaction, sendPresentation, addElement, updateElement, deleteElement, deleteElements, onChat, onReaction, onPresentation, getUndoManager]);
}
