import { createContext, useContext } from 'react';
import { useLivekit } from './useLivekit';

const LivekitContext = createContext(null);

export function LivekitProvider({ boardId, children }) {
  const livekit = useLivekit(boardId);
  return (
    <LivekitContext.Provider value={livekit}>
      {children}
    </LivekitContext.Provider>
  );
}

export function useLivekitContext() {
  return useContext(LivekitContext);
}
