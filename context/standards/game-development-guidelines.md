# Game Development Guidelines

Guidelines specific to developing real-time multiplayer games with Angular and Node.js.

## Angular Game UI Best Practices

### Canvas Management

```typescript
// Use ViewChild for canvas access
@Component({...})
export class CanvasComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  
  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.setupCanvas();
  }
  
  private setupCanvas() {
    // Always set canvas size based on container
    const container = this.canvasRef.nativeElement.parentElement;
    this.canvasRef.nativeElement.width = container.clientWidth;
    this.canvasRef.nativeElement.height = container.clientHeight;
  }
}
```

### Real-time State Management

```typescript
// Use signals for fine-grained reactivity
export class GameStateService {
  // Game state signals
  readonly players = signal<Player[]>([]);
  readonly currentDrawer = signal<string | null>(null);
  readonly timeRemaining = signal<number>(0);
  readonly scores = signal<Record<string, number>>({});
  
  // Computed values
  readonly isMyTurn = computed(() => 
    this.currentDrawer() === this.currentPlayerId
  );
  
  readonly sortedPlayers = computed(() => 
    [...this.players()].sort((a, b) => b.score - a.score)
  );
}
```

### WebSocket Connection Management

```typescript
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: Socket;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  
  constructor() {
    this.socket = io(environment.wsUrl, {
      auth: { token: this.getAuthToken() },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS
    });
    
    this.setupConnectionHandlers();
  }
  
  private setupConnectionHandlers() {
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });
    
    this.socket.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Manually reconnect
        this.socket.connect();
      }
    });
    
    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error('Connection error:', error);
    });
  }
  
  // Type-safe event emission
  emit<T = any>(event: string, data: T): void {
    this.socket.emit(event, data);
  }
  
  // Observable-based event listening
  on<T = any>(event: string): Observable<T> {
    return new Observable(observer => {
      this.socket.on(event, (data: T) => observer.next(data));
      return () => this.socket.off(event);
    });
  }
}
```

### Canvas Drawing Optimization

```typescript
export class DrawingService {
  private pendingStrokes: DrawingPoint[] = [];
  private lastEmitTime = 0;
  private readonly THROTTLE_MS = 16; // ~60fps
  
  // Throttle drawing updates
  addPoint(point: DrawingPoint) {
    this.pendingStrokes.push(point);
    
    const now = Date.now();
    if (now - this.lastEmitTime >= this.THROTTLE_MS) {
      this.emitStrokes();
      this.lastEmitTime = now;
    }
  }
  
  private emitStrokes() {
    if (this.pendingStrokes.length === 0) return;
    
    // Send batch of points
    this.wsService.emit('drawing:stroke', {
      points: this.pendingStrokes,
      color: this.currentColor,
      width: this.currentWidth
    });
    
    this.pendingStrokes = [];
  }
  
  // Use requestAnimationFrame for smooth rendering
  private renderLoop() {
    requestAnimationFrame(() => {
      this.renderPendingStrokes();
      this.renderLoop();
    });
  }
}
```

## Node.js Game Server Best Practices

### Room Management

```typescript
export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  
  createRoom(hostId: string, settings: RoomSettings): GameRoom {
    const code = this.generateRoomCode();
    const room = new GameRoom(code, hostId, settings);
    this.rooms.set(code, room);
    
    // Auto-cleanup after timeout
    setTimeout(() => {
      if (room.isEmpty()) {
        this.rooms.delete(code);
      }
    }, ROOM_TIMEOUT);
    
    return room;
  }
  
  joinRoom(roomCode: string, player: Player): GameRoom {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.isFull()) throw new Error('Room is full');
    
    room.addPlayer(player);
    return room;
  }
  
  private generateRoomCode(): string {
    // Generate unique 6-character code
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
```

### Game State Management

```typescript
export class GameSession {
  private currentRound = 0;
  private roundTimer?: NodeJS.Timeout;
  private guessedPlayers = new Set<string>();
  
  startRound() {
    this.currentRound++;
    this.guessedPlayers.clear();
    
    const drawer = this.selectNextDrawer();
    const word = this.selectWord();
    
    // Notify players
    this.io.to(this.roomCode).emit('round:start', {
      round: this.currentRound,
      drawerId: drawer.id,
      wordHint: this.createHint(word),
      duration: this.roundDuration
    });
    
    // Send word only to drawer
    this.io.to(drawer.socketId).emit('round:word', { word });
    
    // Start timer
    this.roundTimer = setTimeout(() => {
      this.endRound(word);
    }, this.roundDuration * 1000);
  }
  
  handleGuess(playerId: string, guess: string): boolean {
    if (this.guessedPlayers.has(playerId)) return false;
    if (playerId === this.currentDrawer.id) return false;
    
    const isCorrect = this.isCorrectGuess(guess, this.currentWord);
    
    if (isCorrect) {
      this.guessedPlayers.add(playerId);
      const score = this.calculateScore();
      this.scores[playerId] += score;
      
      this.io.to(this.roomCode).emit('guess:correct', {
        playerId,
        playerName: this.players.get(playerId).name,
        score,
        position: this.guessedPlayers.size
      });
      
      // End round if everyone guessed
      if (this.guessedPlayers.size === this.players.size - 1) {
        clearTimeout(this.roundTimer);
        this.endRound(this.currentWord);
      }
    }
    
    return isCorrect;
  }
  
  private isCorrectGuess(guess: string, word: string): boolean {
    const normalized = guess.toLowerCase().trim();
    const target = word.toLowerCase();
    
    // Exact match
    if (normalized === target) return true;
    
    // Fuzzy match for longer words
    if (word.length > 5) {
      return this.levenshteinDistance(normalized, target) <= 1;
    }
    
    return false;
  }
  
  private calculateScore(): number {
    const timeElapsed = Date.now() - this.roundStartTime;
    const timeRemaining = this.roundDuration * 1000 - timeElapsed;
    const timeBonus = (timeRemaining / (this.roundDuration * 1000)) * 100;
    
    const basePoints = 100;
    const positionMultiplier = 1 + (1 / this.guessedPlayers.size);
    
    return Math.floor((basePoints + timeBonus) * positionMultiplier);
  }
}
```

### Socket.IO Event Handling

```typescript
export class GameSocketHandler {
  constructor(
    private io: Server,
    private roomManager: RoomManager,
    private gameManager: GameManager
  ) {}
  
  handleConnection(socket: Socket) {
    // Authenticate socket
    const userId = this.verifyJWT(socket.handshake.auth.token);
    if (!userId) {
      socket.disconnect();
      return;
    }
    
    socket.data.userId = userId;
    
    // Rate limiters
    const drawingLimiter = this.createRateLimiter(60, 1000); // 60/sec
    const guessLimiter = this.createRateLimiter(5, 1000); // 5/sec
    
    socket.on('player:join', async (data) => {
      try {
        const room = await this.roomManager.joinRoom(data.roomCode, {
          id: userId,
          name: data.playerName,
          socketId: socket.id
        });
        
        socket.join(data.roomCode);
        
        // Send game state to new player
        socket.emit('game:state', room.getState());
        
        // Notify others
        socket.to(data.roomCode).emit('player:joined', {
          player: room.getPlayer(userId)
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
    
    socket.on('drawing:stroke', (data) => {
      if (!drawingLimiter()) return;
      
      const game = this.gameManager.getActiveGame(socket.data.roomCode);
      if (!game || game.currentDrawer !== userId) return;
      
      // Validate and broadcast
      const validated = this.validateStroke(data);
      socket.to(socket.data.roomCode).emit('drawing:update', validated);
      
      // Cache in Redis
      this.cacheDrawingData(game.id, validated);
    });
    
    socket.on('guess:submit', async (data) => {
      if (!guessLimiter()) return;
      
      const game = this.gameManager.getActiveGame(socket.data.roomCode);
      if (!game) return;
      
      const isCorrect = game.handleGuess(userId, data.guess);
      
      if (!isCorrect) {
        // Broadcast as chat message
        this.io.to(socket.data.roomCode).emit('chat:message', {
          playerId: userId,
          playerName: socket.data.playerName,
          message: data.guess
        });
      }
    });
    
    socket.on('disconnect', () => {
      this.handlePlayerDisconnect(userId, socket.data.roomCode);
    });
  }
  
  private createRateLimiter(max: number, windowMs: number) {
    let count = 0;
    let resetTime = Date.now() + windowMs;
    
    return () => {
      const now = Date.now();
      if (now > resetTime) {
        count = 0;
        resetTime = now + windowMs;
      }
      
      count++;
      return count <= max;
    };
  }
  
  private validateStroke(stroke: any): DrawingStroke {
    // Validate bounds
    const points = stroke.points.filter((p: any) => 
      p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
    );
    
    // Validate color (hex format)
    const color = /^#[0-9A-F]{6}$/i.test(stroke.color) 
      ? stroke.color 
      : '#000000';
    
    // Validate width
    const width = Math.max(1, Math.min(20, stroke.width || 3));
    
    return { points, color, width, timestamp: Date.now() };
  }
}
```

### Redis Integration

```typescript
export class RedisGameStore {
  constructor(private redis: Redis) {}
  
  async saveGameState(gameId: string, state: GameSession) {
    await this.redis.setex(
      `game:${gameId}`,
      7200, // 2 hours
      JSON.stringify(state)
    );
  }
  
  async getGameState(gameId: string): Promise<GameSession | null> {
    const data = await this.redis.get(`game:${gameId}`);
    return data ? JSON.parse(data) : null;
  }
  
  async cacheDrawing(gameId: string, stroke: DrawingStroke) {
    await this.redis.rpush(
      `drawing:${gameId}`,
      JSON.stringify(stroke)
    );
    await this.redis.expire(`drawing:${gameId}`, 3600);
  }
  
  async getDrawingHistory(gameId: string): Promise<DrawingStroke[]> {
    const strokes = await this.redis.lrange(`drawing:${gameId}`, 0, -1);
    return strokes.map(s => JSON.parse(s));
  }
}
```

## Performance Guidelines

### Frontend Performance

1. **Use OnPush Change Detection**
   ```typescript
   @Component({
     changeDetection: ChangeDetectionStrategy.OnPush
   })
   ```

2. **Optimize Canvas Rendering**
   - Use OffscreenCanvas for background rendering
   - Implement dirty region tracking
   - Use requestAnimationFrame for animations

3. **Lazy Load Routes**
   ```typescript
   const routes: Routes = [
     { path: 'game', loadComponent: () => import('./game/game.component') }
   ];
   ```

4. **Debounce/Throttle Events**
   ```typescript
   fromEvent(canvas, 'mousemove').pipe(
     throttleTime(16), // ~60fps
     map(e => this.getCoordinates(e))
   );
   ```

### Backend Performance

1. **Connection Pooling**
   ```typescript
   const pool = new Pool({
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000
   });
   ```

2. **Redis Caching**
   - Cache active game states
   - Use pub/sub for cross-server events
   - Implement cache invalidation strategy

3. **Optimize Socket.IO**
   ```typescript
   io.of('/game').use(async (socket, next) => {
     // Verify authentication once
     const user = await verifyToken(socket.handshake.auth.token);
     socket.data.user = user;
     next();
   });
   ```

4. **Database Query Optimization**
   - Use indexes on frequently queried columns
   - Implement pagination for large datasets
   - Use prepared statements

## Testing Guidelines

### Frontend Testing

```typescript
describe('CanvasComponent', () => {
  it('should emit stroke when drawing', () => {
    const component = createComponent(CanvasComponent);
    const strokeSpy = jest.spyOn(component.strokeEmitted, 'emit');
    
    component.onMouseDown({ x: 10, y: 10 });
    component.onMouseMove({ x: 20, y: 20 });
    component.onMouseUp();
    
    expect(strokeSpy).toHaveBeenCalled();
  });
});
```

### Backend Testing

```typescript
describe('GameSession', () => {
  it('should handle correct guess', () => {
    const session = new GameSession('TEST123', settings);
    session.currentWord = 'elephant';
    
    const result = session.handleGuess('player1', 'elephant');
    
    expect(result).toBe(true);
    expect(session.scores['player1']).toBeGreaterThan(0);
  });
});
```

### Socket Testing

```typescript
describe('Game Socket Events', () => {
  it('should broadcast drawing to other players', (done) => {
    const clientA = io(`http://localhost:${PORT}`);
    const clientB = io(`http://localhost:${PORT}`);
    
    clientB.on('drawing:update', (data) => {
      expect(data.points).toBeDefined();
      done();
    });
    
    clientA.emit('drawing:stroke', { points: [...] });
  });
});
```

## Security Checklist

- [ ] Validate all user inputs
- [ ] Sanitize chat messages (XSS prevention)
- [ ] Implement rate limiting on all events
- [ ] Use HTTPS/WSS in production
- [ ] Store passwords with bcrypt
- [ ] Use short-lived JWT tokens
- [ ] Validate WebSocket origin
- [ ] Server-side game logic (never trust client)
- [ ] Prevent cheating (server-side validation)
- [ ] Implement profanity filter
- [ ] Add CSRF protection
- [ ] Use parameterized SQL queries
