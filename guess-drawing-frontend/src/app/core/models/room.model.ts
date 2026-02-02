import { Player } from './player.model';

export interface RoomSettings {
  maxPlayers: number;
  roundTime: number;
  rounds: number;
  wordDifficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  allowHints: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  isPrivate: boolean;
  status: 'waiting' | 'playing' | 'finished';
  settings: RoomSettings;
  createdAt: Date;
}
