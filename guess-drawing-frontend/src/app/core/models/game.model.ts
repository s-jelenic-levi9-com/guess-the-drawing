import { Player } from './player.model';

export interface GameSession {
  id: string;
  roomCode: string;
  players: Player[];
  currentDrawerId: string;
  currentRound: number;
  maxRounds: number;
  roundStartTime: number;
  roundDuration: number;
  scores: Record<string, number>;
  status: 'playing' | 'finished';
}

export interface GameState {
  room: import('./room.model').Room | null;
  game: GameSession | null;
}

export interface RoundStartData {
  round: number;
  drawerId: string;
  wordHint: string;
  duration: number;
}

export interface RoundEndData {
  word: string;
  scores: Record<string, number>;
  winners: string[];
}

export interface GameResults {
  gameId: string;
  roomCode: string;
  finalScores: Record<string, number>;
  winnerId: string;
  winnerName: string;
  rounds: number;
  duration: number;
}

export interface GuessResult {
  playerId: string;
  playerName: string;
  score: number;
  position: number;
}
