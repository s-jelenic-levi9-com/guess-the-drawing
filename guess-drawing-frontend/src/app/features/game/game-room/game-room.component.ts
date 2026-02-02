import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SocketService } from '../../../core/services/socket.service';
import { AuthService } from '../../../core/services/auth.service';
import { Player, Room, GameSession, DrawingStroke, ChatMessage, RoundStartData, GameResults } from '../../../core/models';
import { DrawingCanvasComponent } from '../drawing-canvas/drawing-canvas.component';
import { ChatComponent } from '../chat/chat.component';
import { PlayerListComponent } from '../player-list/player-list.component';
import { TimerComponent } from '../../../shared/components/timer/timer.component';

@Component({
  selector: 'app-game-room',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DrawingCanvasComponent,
    ChatComponent,
    PlayerListComponent,
    TimerComponent
  ],
  templateUrl: './game-room.component.html',
  styleUrl: './game-room.component.scss'
})
export class GameRoomComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  roomCode = '';
  
  // Room state
  players = signal<Player[]>([]);
  maxPlayers = signal(8);
  isReady = signal(false);
  
  // Game state
  gameActive = signal(false);
  currentRound = signal(0);
  maxRounds = signal(3);
  currentDrawerId = signal('');
  currentWord = signal('');
  wordHint = signal('');
  roundDuration = signal(90);
  roundStartTime = signal(0);
  scores = signal<Record<string, number>>({});
  
  // Chat
  chatMessages = signal<ChatMessage[]>([]);
  
  // Round end
  roundEnded = signal(false);
  revealedWord = signal('');
  
  // Game end
  gameResults = signal<GameResults | null>(null);
  
  isCurrentDrawer = computed(() => {
    const user = this.authService.user();
    return user?.id === this.currentDrawerId();
  });

  sortedScores = computed(() => {
    const results = this.gameResults();
    if (!results) return [];
    
    const players = this.players();
    return Object.entries(results.finalScores)
      .map(([playerId, score]) => ({
        playerId,
        playerName: players.find(p => p.id === playerId)?.name || 'Unknown',
        score
      }))
      .sort((a, b) => b.score - a.score);
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private socketService: SocketService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.roomCode = this.route.snapshot.paramMap.get('roomCode') || '';
    
    // Connect to socket and join room
    this.socketService.connect();
    
    setTimeout(() => {
      this.socketService.joinRoom(this.roomCode);
    }, 500);

    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socketService.leaveRoom();
  }

  private setupSubscriptions(): void {
    // Game state
    this.socketService.getGameState()
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.room) {
          this.players.set(state.room.players);
          this.maxPlayers.set(state.room.maxPlayers);
          this.gameActive.set(state.room.status === 'playing');
        }
        if (state.game) {
          this.currentRound.set(state.game.currentRound);
          this.maxRounds.set(state.game.maxRounds);
          this.currentDrawerId.set(state.game.currentDrawerId);
          this.roundDuration.set(state.game.roundDuration);
          this.roundStartTime.set(state.game.roundStartTime);
          this.scores.set(state.game.scores);
        }
      });

    // Players
    this.socketService.getPlayers()
      .pipe(takeUntil(this.destroy$))
      .subscribe(players => {
        this.players.set(players);
        const user = this.authService.user();
        const currentPlayer = players.find(p => p.id === user?.id);
        if (currentPlayer) {
          this.isReady.set(currentPlayer.isReady);
        }
      });

    // Chat messages
    this.socketService.getChatMessages()
      .pipe(takeUntil(this.destroy$))
      .subscribe(messages => this.chatMessages.set(messages));

    // Round start
    this.socketService.onRoundStart()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.gameActive.set(true);
        this.currentRound.set(data.round);
        this.currentDrawerId.set(data.drawerId);
        this.wordHint.set(data.wordHint);
        this.roundDuration.set(data.duration);
        this.roundStartTime.set(Date.now());
        this.currentWord.set('');
        this.roundEnded.set(false);
      });

    // Word for drawer
    this.socketService.onRoundWord()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.currentWord.set(data.word);
      });

    // Round end
    this.socketService.onRoundEnd()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.revealedWord.set(data.word);
        this.scores.set(data.scores);
        this.roundEnded.set(true);
        
        setTimeout(() => {
          this.roundEnded.set(false);
        }, 4000);
      });

    // Game end
    this.socketService.onGameEnd()
      .pipe(takeUntil(this.destroy$))
      .subscribe(results => {
        this.gameActive.set(false);
        this.gameResults.set(results);
      });

    // Correct guess
    this.socketService.onGuessCorrect()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        // Update player's guessed status
        const players = this.players();
        this.players.set(
          players.map(p => p.id === data.playerId ? { ...p, hasGuessed: true } : p)
        );
      });

    // Errors
    this.socketService.onError()
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        console.error('Socket error:', error.message);
      });
  }

  setReady(ready: boolean): void {
    this.isReady.set(ready);
    this.socketService.setReady(ready);
  }

  onStroke(stroke: DrawingStroke): void {
    this.socketService.sendDrawingStroke(stroke);
  }

  onClearCanvas(): void {
    this.socketService.clearDrawing();
  }

  onChatMessage(message: string): void {
    if (this.gameActive() && !this.isCurrentDrawer()) {
      // Submit as guess
      this.socketService.submitGuess(message);
    } else {
      // Regular chat message
      this.socketService.sendChatMessage(message);
    }
  }

  leaveRoom(): void {
    this.router.navigate(['/']);
  }

  playAgain(): void {
    this.gameResults.set(null);
    this.isReady.set(false);
    this.currentWord.set('');
    this.wordHint.set('');
  }
}
