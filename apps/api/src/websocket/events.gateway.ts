import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

/**
 * CORS callback that mirrors the REST app's logic in main.ts:
 *  - if CORS_ORIGINS contains '*' → reflect the request origin (browsers
 *    refuse `Access-Control-Allow-Origin: *` together with credentials, so
 *    we must echo the actual origin back).
 *  - otherwise allow only listed origins.
 *  - missing Origin (e.g. server-to-server) is allowed.
 */
const corsOriginCheck = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
): void => {
  const list = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!origin || list.includes('*') || list.includes(origin)) {
    cb(null, true);
    return;
  }
  cb(new Error(`Origin ${origin} not allowed by CORS`), false);
};

@WebSocketGateway({
  cors: {
    origin: corsOriginCheck,
    credentials: true,
  },
  // polling first so the connection establishes via plain HTTP (which the
  // Next.js rewrite proxies fine); the client will then attempt to upgrade
  // to websocket. If the upgrade is blocked by the proxy/edge, the socket
  // stays on polling — fully functional, just chattier.
  transports: ['polling', 'websocket'],
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private onlineUsers = new Map<string, Set<string>>();

  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwt.verify(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role;

      // Track online users
      if (!this.onlineUsers.has(payload.sub)) {
        this.onlineUsers.set(payload.sub, new Set());
      }
      this.onlineUsers.get(payload.sub)!.add(client.id);

      this.server.emit('user.online', { userId: payload.sub, count: this.onlineUsers.size });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      const sockets = this.onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.onlineUsers.delete(userId);
          this.server.emit('user.offline', { userId, count: this.onlineUsers.size });
        }
      }
    }
  }

  @SubscribeMessage('track.join')
  handleJoinTrack(@ConnectedSocket() client: Socket, @MessageBody() data: { trackId: string }) {
    client.join(`track:${data.trackId}`);
    // Silenced — too noisy for Railway log limits
  }

  @SubscribeMessage('track.leave')
  handleLeaveTrack(@ConnectedSocket() client: Socket, @MessageBody() data: { trackId: string }) {
    client.leave(`track:${data.trackId}`);
  }

  emitToTrack(trackId: string, event: string, data: any) {
    this.server.to(`track:${trackId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  getOnlineCount() {
    return this.onlineUsers.size;
  }
}
