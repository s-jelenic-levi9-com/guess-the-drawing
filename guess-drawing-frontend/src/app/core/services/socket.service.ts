import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  Player,
  Room,
  GameSession,
  GameState,
  DrawingStroke,
  ChatMessage,
  RoundStartData,
  RoundEndData,
  GameResults,
  GuessResult,
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  
  // Connection state
  private connected = signal(false);
  readonly isConnected = this.connected.asReadonly();

  // Game state subjects
  private gameState$ = new BehaviorSubject<GameState>({ room: null, game: null });
  private players$ = new BehaviorSubject<Player[]>([]);
  private chatMessages$ = new BehaviorSubject<ChatMessage[]>([]);
  
  // Event subjects
  private playerJoined$ = new Subject<{ player: Player }>();
  private playerLeft$ = new Subject<{ playerId: string; playerName: string }>();
  private playerReady$ = new Subject<{ playerId: string; isReady: boolean }>();
  private drawingUpdate$ = new Subject<DrawingStroke>();
  private drawingCleared$ = new Subject<void>();
  private roundStart$ = new Subject<RoundStartData>();
  private roundWord$ = new Subject<{ word: string }>();
  private roundEnd$ = new Subject<RoundEndData>();
  private guessCorrect$ = new Subject<GuessResult>();
  private chatMessage$ = new Subject<ChatMessage>();
  private gameEnd$ = new Subject<GameResults>();
  private error$ = new Subject<{ message: string }>();

  constructor(private authService: AuthService) {}

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.authService.getToken();
    if (!token) {
      console.error('No auth token available');
      return;
    }

    this.socket = io(environment.wsUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected.set(false);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.connected.set(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected.set(false);
    });

    this.socket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      this.error$.next(data);
    });

    // Game state
    this.socket.on('game:state', (data: GameState) => {
      this.gameState$.next(data);
      if (data.room) {
        this.players$.next(data.room.players);
      }
    });

    // Player events
    this.socket.on('player:joined', (data: { player: Player }) => {
      this.playerJoined$.next(data);
      const current = this.players$.value;
      this.players$.next([...current, data.player]);
    });

    this.socket.on('player:left', (data: { playerId: string; playerName: string }) => {
      this.playerLeft$.next(data);
      const current = this.players$.value;
      this.players$.next(current.filter(p => p.id !== data.playerId));
    });

    this.socket.on('player:ready', (data: { playerId: string; isReady: boolean }) => {
      this.playerReady$.next(data);
      const current = this.players$.value;
      this.players$.next(
        current.map(p => p.id === data.playerId ? { ...p, isReady: data.isReady } : p)
      );
    });

    // Drawing events
    this.socket.on('drawing:update', (stroke: DrawingStroke) => {
      this.drawingUpdate$.next(stroke);
    });

    this.socket.on('drawing:cleared', () => {
      this.drawingCleared$.next();
    });

    // Round events
    this.socket.on('round:start', (data: RoundStartData) => {
      this.roundStart$.next(data);
      this.chatMessages$.next([]); // Clear chat for new round
    });

    this.socket.on('round:word', (data: { word: string }) => {
      this.roundWord$.next(data);
    });

    this.socket.on('round:end', (data: RoundEndData) => {
      this.roundEnd$.next(data);
    });

    // Guess events
    this.socket.on('guess:correct', (data: GuessResult) => {
      this.guessCorrect$.next(data);
    });

    // Chat events
    this.socket.on('chat:message', (data: ChatMessage) => {
      this.chatMessage$.next(data);
      const current = this.chatMessages$.value;
      this.chatMessages$.next([...current, data]);
    });

    // Game end
    this.socket.on('game:end', (data: GameResults) => {
      this.gameEnd$.next(data);
    });
  }

  // Emit events
  joinRoom(roomCode: string): void {
    this.socket?.emit('player:join', { roomCode });
  }

  leaveRoom(): void {
    this.socket?.emit('player:leave');
  }

  setReady(isReady: boolean): void {
    this.socket?.emit('player:ready', { isReady });
  }

  sendDrawingStroke(stroke: DrawingStroke): void {
    this.socket?.emit('drawing:stroke', stroke);
  }

  clearDrawing(): void {
    this.socket?.emit('drawing:clear');
  }

  submitGuess(guess: string): void {
    this.socket?.emit('guess:submit', { guess });
  }

  sendChatMessage(message: string): void {
    this.socket?.emit('chat:message', { message });
  }

  // Observable getters
  getGameState(): Observable<GameState> {
    return this.gameState$.asObservable();
  }

  getPlayers(): Observable<Player[]> {
    return this.players$.asObservable();
  }

  getChatMessages(): Observable<ChatMessage[]> {
    return this.chatMessages$.asObservable();
  }

  onPlayerJoined(): Observable<{ player: Player }> {
    return this.playerJoined$.asObservable();
  }

  onPlayerLeft(): Observable<{ playerId: string; playerName: string }> {
    return this.playerLeft$.asObservable();
  }

  onPlayerReady(): Observable<{ playerId: string; isReady: boolean }> {
    return this.playerReady$.asObservable();
  }

  onDrawingUpdate(): Observable<DrawingStroke> {
    return this.drawingUpdate$.asObservable();
  }

  onDrawingCleared(): Observable<void> {
    return this.drawingCleared$.asObservable();
  }

  onRoundStart(): Observable<RoundStartData> {
    return this.roundStart$.asObservable();
  }

  onRoundWord(): Observable<{ word: string }> {
    return this.roundWord$.asObservable();
  }

  onRoundEnd(): Observable<RoundEndData> {
    return this.roundEnd$.asObservable();
  }

  onGuessCorrect(): Observable<GuessResult> {
    return this.guessCorrect$.asObservable();
  }

  onChatMessage(): Observable<ChatMessage> {
    return this.chatMessage$.asObservable();
  }

  onGameEnd(): Observable<GameResults> {
    return this.gameEnd$.asObservable();
  }

  onError(): Observable<{ message: string }> {
    return this.error$.asObservable();
  }
}
