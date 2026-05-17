import type { WebSocket } from 'ws';
import { logger } from '../common/logger';
import type { WsEvent } from './events';

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;

class ConnectionManager {
  private connections = new Map<string, Set<WebSocket>>();
  private rooms = new Map<string, Set<string>>();
  private heartbeats = new Map<WebSocket, NodeJS.Timeout>();
  private pingTimeouts = new Map<WebSocket, NodeJS.Timeout>();

  addConnection(userId: string, socket: WebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(socket);
    this.startHeartbeat(socket);
    logger.debug({ userId, connectionCount: this.getConnectionCount() }, 'WebSocket connected');
  }

  removeConnection(userId: string, socket: WebSocket): void {
    this.stopHeartbeat(socket);

    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.delete(socket);
      if (userSockets.size === 0) {
        this.connections.delete(userId);
      }
    }

    for (const [roomId, members] of this.rooms.entries()) {
      if (members.has(userId)) {
        members.delete(userId);
        if (members.size === 0) {
          this.rooms.delete(roomId);
        }
      }
    }

    logger.debug({ userId, connectionCount: this.getConnectionCount() }, 'WebSocket disconnected');
  }

  sendToUser(userId: string, event: WsEvent): void {
    const userSockets = this.connections.get(userId);
    if (!userSockets) return;

    const message = JSON.stringify(event);
    for (const socket of userSockets) {
      if (socket.readyState === 1) {
        socket.send(message);
      }
    }
  }

  sendToRoom(workspaceId: string, event: WsEvent, excludeUserId?: string): void {
    const members = this.rooms.get(workspaceId);
    if (!members) return;

    for (const userId of members) {
      if (userId === excludeUserId) continue;
      this.sendToUser(userId, event);
    }
  }

  joinRoom(workspaceId: string, userId: string): void {
    if (!this.rooms.has(workspaceId)) {
      this.rooms.set(workspaceId, new Set());
    }
    this.rooms.get(workspaceId)!.add(userId);
  }

  leaveRoom(workspaceId: string, userId: string): void {
    const members = this.rooms.get(workspaceId);
    if (members) {
      members.delete(userId);
      if (members.size === 0) {
        this.rooms.delete(workspaceId);
      }
    }
  }

  broadcast(event: WsEvent): void {
    const message = JSON.stringify(event);
    for (const userSockets of this.connections.values()) {
      for (const socket of userSockets) {
        if (socket.readyState === 1) {
          socket.send(message);
        }
      }
    }
  }

  getConnectionCount(): number {
    let count = 0;
    for (const userSockets of this.connections.values()) {
      count += userSockets.size;
    }
    return count;
  }

  getUserConnections(): Map<string, Set<WebSocket>> {
    return this.connections;
  }

  private startHeartbeat(socket: WebSocket): void {
    const interval = setInterval(() => {
      if (socket.readyState !== 1) {
        this.stopHeartbeat(socket);
        return;
      }
      socket.ping();

      const timeout = setTimeout(() => {
        if (socket.readyState === 1) {
          socket.terminate();
        }
        this.stopHeartbeat(socket);
      }, HEARTBEAT_TIMEOUT);

      this.pingTimeouts.set(socket, timeout);
    }, HEARTBEAT_INTERVAL);

    this.heartbeats.set(socket, interval);

    socket.on('pong', () => {
      const timeout = this.pingTimeouts.get(socket);
      if (timeout) {
        clearTimeout(timeout);
        this.pingTimeouts.delete(socket);
      }
    });
  }

  private stopHeartbeat(socket: WebSocket): void {
    const interval = this.heartbeats.get(socket);
    if (interval) {
      clearInterval(interval);
      this.heartbeats.delete(socket);
    }

    const timeout = this.pingTimeouts.get(socket);
    if (timeout) {
      clearTimeout(timeout);
      this.pingTimeouts.delete(socket);
    }
  }
}

export const connectionManager = new ConnectionManager();
