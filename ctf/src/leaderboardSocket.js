import { io } from 'socket.io-client';

// Read backend url from Vite env or fallback
const BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) || process.env.BACKEND_URL || 'http://localhost:5000';

let socket = null;
const leaderboardListeners = new Set();
const userRankListeners = new Set();
const newSolveListeners = new Set();

const handleLeaderboardEvent = (payload) => {
  console.log('📨 handleLeaderboardEvent called with payload:', payload);
  console.log('📊 Current listeners count:', leaderboardListeners.size);
  
  // payload shape from backend: { leaderboard, difficulty, timestamp, updated_user }
  const normalized = {
    difficulty: payload?.difficulty || null,
    data: payload?.leaderboard || payload?.data || payload || [],
    timestamp: payload?.timestamp || null,
    updated_user: payload?.updated_user || null
  };
  
  console.log('📦 Normalized payload:', { 
    difficulty: normalized.difficulty, 
    dataLength: Array.isArray(normalized.data) ? normalized.data.length : 'not-array',
    timestamp: normalized.timestamp 
  });
  
  leaderboardListeners.forEach(cb => {
    try { 
      console.log('🔔 Calling listener callback');
      cb(normalized); 
    } catch (e) { 
      console.error('❌ leaderboard listener err', e); 
    }
  });
};

const handleUserRank = (payload) => {
  userRankListeners.forEach(cb => {
    try { cb(payload); } catch (e) { console.error('user rank listener err', e); }
  });
};

const handleNewSolve = (payload) => {
  newSolveListeners.forEach(cb => {
    try { cb(payload); } catch (e) { console.error('new solve listener err', e); }
  });
};

export const connectLeaderboardSocket = (onConnect = () => {}, options = {}) => {
  if (socket && socket.connected) {
    console.log('🔄 Reusing existing socket connection:', socket.id);
    onConnect(socket);
    return socket;
  }

  console.log('🆕 Creating new socket connection to:', BACKEND_URL);

  // Allow auth token from options or fallback to localStorage
  const token = options?.auth?.token || localStorage.getItem('token') || null;

  socket = io(BACKEND_URL, {
    path: '/socket.io',
    // prefer websocket but allow polling fallback for strict proxies
    transports: options.transports || ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: options.reconnectionAttempts ?? Infinity,
    reconnectionDelay: options.reconnectionDelay ?? 1000,
    timeout: options.timeout ?? 20000,
    auth: { token },
    ...options
  });

  socket.on('connect', () => {
    onConnect(socket);
    console.log('Connected to leaderboard socket:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Leaderboard socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('Leaderboard socket connect_error:', err && err.message ? err.message : err);
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log('Leaderboard socket reconnect attempt', attempt);
  });

  socket.on('reconnect', (attempt) => {
    console.log('Leaderboard socket reconnected after', attempt, 'attempt(s)');
  });

  socket.on('reconnect_failed', () => {
    console.error('Leaderboard socket failed to reconnect');
  });

  // Backend emits difficulty-specific events
  socket.on('leaderboard_update_beginner', (payload) => {
    console.log('🟢 Received leaderboard_update_beginner event:', payload);
    handleLeaderboardEvent(payload);
  });
  socket.on('leaderboard_update_intermediate', (payload) => {
    console.log('🟡 Received leaderboard_update_intermediate event:', payload);
    handleLeaderboardEvent(payload);
  });

  // Other events
  socket.on('user_rank_change', (payload) => {
    console.log('🔵 Received user_rank_change event:', payload);
    handleUserRank(payload);
  });
  socket.on('new_solve', (payload) => {
    console.log('🟣 Received new_solve event:', payload);
    handleNewSolve(payload);
  });

  return socket;
};

export const onLeaderboardUpdate = (cb) => {
  leaderboardListeners.add(cb);
  return () => leaderboardListeners.delete(cb);
};

export const onUserRankChange = (cb) => {
  userRankListeners.add(cb);
  return () => userRankListeners.delete(cb);
};

export const onNewSolve = (cb) => {
  newSolveListeners.add(cb);
  return () => newSolveListeners.delete(cb);
};

export const disconnectLeaderboardSocket = () => {
  if (!socket) return;
  socket.off('leaderboard_update_beginner', handleLeaderboardEvent);
  socket.off('leaderboard_update_intermediate', handleLeaderboardEvent);
  socket.off('user_rank_change', handleUserRank);
  socket.off('new_solve', handleNewSolve);
  socket.disconnect();
  socket = null;
  leaderboardListeners.clear();
  userRankListeners.clear();
  newSolveListeners.clear();
};

export default {
  connectLeaderboardSocket,
  onLeaderboardUpdate,
  onUserRankChange,
  onNewSolve,
  disconnectLeaderboardSocket
};
