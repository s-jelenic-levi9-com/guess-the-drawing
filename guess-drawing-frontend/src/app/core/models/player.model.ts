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
