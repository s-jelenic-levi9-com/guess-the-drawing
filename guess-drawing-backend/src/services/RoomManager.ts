import { Room, RoomSettings, Player } from '../types';
import { config } from '../config';

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(hostId: string, hostName: string, settings: Partial<RoomSettings> = {}): Room {
    const code = this.generateRoomCode();
    
    const defaultSettings: RoomSettings = {
      maxPlayers: settings.maxPlayers || config.game.maxPlayersPerRoom,
      roundTime: settings.roundTime || config.game.defaultRoundTime,
      rounds: settings.rounds || config.game.defaultRounds,
      wordDifficulty: settings.wordDifficulty || 'mixed',
      allowHints: settings.allowHints !== undefined ? settings.allowHints : true,
    };

    const host: Player = {
      id: hostId,
      name: hostName,
      score: 0,
      isReady: true,
      isDrawing: false,
      hasGuessed: false,
      connectionStatus: 'connected',
      socketId: '',
    };

    const room: Room = {
      code,
      hostId,
      players: [host],
      maxPlayers: defaultSettings.maxPlayers,
      isPrivate: false,
      status: 'waiting',
      settings: defaultSettings,
      createdAt: new Date(),
    };

    this.rooms.set(code, room);

    // Auto-cleanup after timeout
    setTimeout(() => {
      if (this.rooms.has(code) && this.rooms.get(code)!.status === 'waiting') {
        this.rooms.delete(code);
      }
    }, config.game.roomTimeout);

    return room;
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  joinRoom(roomCode: string, player: Player): Room {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      throw new Error('Room not found');
    }
    
    if (room.status !== 'waiting') {
      throw new Error('Game already started');
    }
    
    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }
    
    // Check if player already in room
    const existingPlayer = room.players.find(p => p.id === player.id);
    if (existingPlayer) {
      existingPlayer.connectionStatus = 'connected';
      existingPlayer.socketId = player.socketId;
      return room;
    }
    
    room.players.push(player);
    return room;
  }

  leaveRoom(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);

    // Delete room if empty or reassign host
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
    } else if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
    }
  }

  updatePlayerSocket(roomCode: string, playerId: string, socketId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.socketId = socketId;
      player.connectionStatus = 'connected';
    }
  }

  setPlayerReady(roomCode: string, playerId: string, isReady: boolean): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = isReady;
    }
  }

  allPlayersReady(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room || room.players.length < 2) return false;

    return room.players.every(p => p.isReady);
  }

  getActiveRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => r.status === 'waiting');
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    
    do {
      code = Array.from({ length: 6 }, () => 
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
    } while (this.rooms.has(code));
    
    return code;
  }
}
