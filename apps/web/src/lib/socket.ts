import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');

let socket: Socket | null = null;

/**
 * Build (or return cached) Socket.IO client.
 *
 * Transport order: polling → websocket. Polling uses regular HTTP so the
 * Next.js `/socket.io/:path*` rewrite handles it cleanly. After the polling
 * handshake succeeds, Socket.IO will attempt a WS upgrade; if Render's edge
 * blocks it (Next.js rewrites do not forward WS Upgrade headers), the
 * connection stays on polling — slower per-event, but fully functional.
 *
 * Putting `websocket` first (the previous setting) made the handshake fail
 * outright when WS upgrade was blocked, leaving the client unconnected.
 */
export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      timeout: 20_000,
    });

    // Surface connection errors to the console with enough context to
    // diagnose. Without this, a silent socket failure looked indistinguishable
    // from a REST failure to whoever was debugging.
    socket.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[socket] connect_error', {
        message: err.message,
        name: (err as { name?: string }).name,
        transport: socket?.io?.engine?.transport?.name,
        url: SOCKET_URL,
      });
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  const token = localStorage.getItem('access_token');
  if (token) {
    s.auth = { token };
    s.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinTrack(trackId: string) {
  getSocket().emit('track.join', { trackId });
}

export function leaveTrack(trackId: string) {
  getSocket().emit('track.leave', { trackId });
}
