export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isCorrectGuess?: boolean;
}
