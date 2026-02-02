export interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
  isReady: boolean;
  isDrawing: boolean;
  hasGuessed: boolean;
  connectionStatus: 'connected' | 'disconnected';
  socketId: string;
}

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

export interface GameSession {
  id: string;
  roomCode: string;
  players: Player[];
  currentDrawerId: string;
  currentWord: string;
  currentRound: number;
  maxRounds: number;
  roundStartTime: number;
  roundDuration: number;
  scores: Record<string, number>;
  guessedPlayers: Set<string>;
  status: 'playing' | 'finished';
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
  timestamp: number;
}

export interface GameResults {
  gameId: string;
  roomCode: string;
  players: Player[];
  finalScores: Record<string, number>;
  winner: string;
  rounds: number;
  duration: number;
  completedAt: Date;
}

export interface Word {
  id: string;
  word: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface UserStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  wordsGuessed: number;
  wordsDrawn: number;
  averageGuessTime: number;
  fastestGuessTime?: number;
}
