import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';

class SocketService {
  public socket: Socket | null = null;

  public connect(userId: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[SOCKET] Connected to WebSocket server successfully.', this.socket?.id);
      // Automatically join the user's personal channel
      this.joinRoom(`user:${userId}`);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[SOCKET] Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[SOCKET] Connection error:', err);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[SOCKET] Disconnected and torn down.');
    }
  }

  public joinRoom(room: string) {
    if (this.socket) {
      this.socket.emit('join_room', { room });
      console.log(`[SOCKET] Subscribing client to room channel: '${room}'`);
    }
  }

  public leaveRoom(room: string) {
    if (this.socket) {
      this.socket.emit('leave_room', { room });
      console.log(`[SOCKET] Unsubscribing client from room: '${room}'`);
    }
  }

  public emitLocation(workerId: string, bookingId: string | null, lat: number, lng: number) {
    if (this.socket) {
      this.socket.emit('worker:location_update', { workerId, bookingId, lat, lng });
    }
  }

  public emitChatMessage(bookingId: string, senderId: string, senderName: string, text: string) {
    if (this.socket) {
      this.socket.emit('booking:new_message', { bookingId, senderId, senderName, text });
    }
  }
}

export const socketService = new SocketService();
