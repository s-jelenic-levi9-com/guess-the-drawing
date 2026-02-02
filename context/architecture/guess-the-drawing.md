# Guess the Drawing - System Architecture

## Overview

Real-time multiplayer drawing game with WebSocket-based synchronization, supporting 2-8 players per room.

## Architecture Type

**Real-time Microservices with WebSocket Communication**

### Core Design Principles
- Stateless API servers for horizontal scaling
- Redis-based session management and pub/sub
- WebSocket sticky sessions for connection persistence
- Event-driven architecture for real-time updates

## System Components

### Frontend Architecture

#### Technology Stack
- **Angular 18+** with standalone components
- **RxJS** for reactive state management
- **Canvas API** for drawing functionality
- **Socket.IO Client** for WebSocket communication
- **TailwindCSS** for responsive styling
- **Signals** for fine-grained reactivity

#### Module Structure
```
src/app/
├── core/
│   ├── services/
│   │   ├── websocket.service.ts      # WebSocket connection manager
│   │   ├── auth.service.ts           # JWT authentication
│   │   ├── game-state.service.ts     # Centralized game state
│   │   └── audio.service.ts          # Sound effects
│   ├── guards/
│   │   └── auth.guard.ts
│   └── interceptors/
│       └── jwt.interceptor.ts
├── features/
│   ├── auth/
│   │   ├── login/
│   │   └── register/
│   ├── lobby/
│   │   ├── room-list/
│   │   ├── create-room/
│   │   └── join-room/
│   ├── game/
│   │   ├── canvas/                   # Drawing canvas component
│   │   ├── chat/                     # Chat & guess input
│   │   ├── players-list/             # Player avatars & scores
│   │   ├── timer/                    # Round timer
│   │   ├── word-display/             # Current word (drawer) / hints (guessers)
│   │   └── game.component.ts
│   └── profile/
│       ├── stats/
│       └── settings/
├── shared/
│   ├── components/
│   │   ├── button/
│   │   ├── modal/
│   │   └── loader/
│   └── models/
│       ├── game.model.ts
│       ├── player.model.ts
│       └── drawing.model.ts
└── app.routes.ts
```

#### State Management Strategy
- **BehaviorSubjects** for complex game state
- **Signals** for UI-reactive values
- **OnPush** change detection throughout
- Immutable state updates

#### Canvas Implementation
```typescript
interface DrawingStroke {
  points: {x: number, y: number}[];
  color: string;
  width: number;
  timestamp: number;
}
```

**Features:**
- Touch and mouse support
- Pressure sensitivity (optional)
- Brush size selector (3, 6, 12, 20px)
- Color palette (12 colors)
- Eraser tool
- Clear canvas
- Undo last stroke

**Optimization:**
- Throttle stroke emissions (60/sec max)
- Delta compression for points
- Canvas offscreen rendering for smooth playback

---

### Backend Architecture

#### Technology Stack
- **Node.js 20+** with TypeScript
- **Express.js** for REST API
- **Socket.IO** for WebSocket server
- **PostgreSQL 15+** for persistent storage
- **Redis 7+** for caching and pub/sub
- **JWT** for authentication

#### Service Architecture

##### 1. Game Service
**Responsibilities:**
- Room creation and lifecycle management
- Player matching and lobby system
- Turn rotation logic
- Word selection from categorized word bank
- Score calculation algorithm
- Game state synchronization

**Key Functions:**
```typescript
class GameService {
  createRoom(config: RoomConfig): Room
  joinRoom(roomCode: string, player: Player): void
  startGame(roomId: string): void
  nextRound(roomId: string): void
  endGame(roomId: string): GameResults
  calculateScore(guessTime: number, roundTime: number): number
}
```

**Scoring Algorithm:**
```
basePoints = 100
timeBonus = (remainingTime / totalTime) * 100
difficulty Multiplier = { easy: 1, medium: 1.5, hard: 2 }
finalScore = (basePoints + timeBonus) * difficultyMultiplier
```

##### 2. Drawing Service
**Responsibilities:**
- Receive and validate drawing strokes
- Compress drawing data
- Broadcast to room members
- Store drawings for replay (optional)
- Rate limit drawing events

**Data Flow:**
```
Drawer Client → Socket.IO → Validation → Redis Cache → Broadcast → Other Clients
                                      ↓
                                 PostgreSQL (replay)
```

##### 3. User Service
**Responsibilities:**
- User registration and authentication
- Password hashing (bcrypt)
- JWT token generation and validation
- Profile management
- Statistics tracking
- Friend system

**Database Schema:**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  total_score BIGINT DEFAULT 0,
  words_guessed INT DEFAULT 0,
  words_drawn INT DEFAULT 0,
  average_guess_time FLOAT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE friendships (
  user_id UUID REFERENCES users(id),
  friend_id UUID REFERENCES users(id),
  status VARCHAR(20), -- 'pending', 'accepted'
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);
```

##### 4. Chat Service
**Responsibilities:**
- Message validation and sanitization
- Guess submission and validation
- Profanity filtering
- Rate limiting (5 messages/sec per user)
- Chat history (last 50 messages per room)

**Guess Matching Logic:**
```typescript
function isCorrectGuess(guess: string, word: string): boolean {
  const normalized = guess.toLowerCase().trim();
  const target = word.toLowerCase();
  
  // Exact match
  if (normalized === target) return true;
  
  // Fuzzy match (Levenshtein distance ≤ 1 for words > 5 chars)
  if (word.length > 5 && levenshteinDistance(normalized, target) <= 1) {
    return true;
  }
  
  return false;
}
```

---

## Real-time Communication

### WebSocket Event Schema

#### Client → Server Events

```typescript
// Join a game room
socket.emit('player:join', {
  roomCode: string,
  playerId: string,
  playerName: string
});

// Send drawing stroke
socket.emit('drawing:stroke', {
  points: {x: number, y: number}[],
  color: string,
  width: number
});

// Clear canvas
socket.emit('drawing:clear');

// Submit guess
socket.emit('guess:submit', {
  playerId: string,
  guess: string
});

// Player ready
socket.emit('game:ready', {
  playerId: string
});

// Leave room
socket.emit('player:leave', {
  playerId: string
});
```

#### Server → Client Events

```typescript
// Full game state sync
socket.emit('game:state', {
  roomCode: string,
  players: Player[],
  currentDrawer: string,
  round: number,
  maxRounds: number,
  scores: Record<string, number>,
  status: 'waiting' | 'playing' | 'finished',
  timeRemaining: number
});

// Drawing update
socket.emit('drawing:update', {
  stroke: DrawingStroke
});

// Clear canvas broadcast
socket.emit('drawing:cleared');

// Someone guessed correctly
socket.emit('guess:correct', {
  playerId: string,
  playerName: string,
  score: number,
  position: number // 1st, 2nd, 3rd...
});

// New round started
socket.emit('round:start', {
  round: number,
  drawerId: string,
  word: string, // Only sent to drawer
  wordHint: string, // "_____" for guessers
  duration: number
});

// Round ended
socket.emit('round:end', {
  word: string,
  scores: Record<string, number>,
  winners: string[] // Players who guessed
});

// Game ended
socket.emit('game:end', {
  finalScores: Record<string, number>,
  winner: string,
  gameStats: GameStats
});

// Chat message
socket.emit('chat:message', {
  playerId: string,
  playerName: string,
  message: string,
  timestamp: number
});

// Player joined
socket.emit('player:joined', {
  player: Player
});

// Player left
socket.emit('player:left', {
  playerId: string
});

// Error
socket.emit('error', {
  code: string,
  message: string
});
```

### Connection Management

**Sticky Sessions:**
- Use Socket.IO adapter with Redis for multi-server setup
- Session affinity based on socket.id
- Automatic reconnection with exponential backoff

**Redis Pub/Sub for Cross-Server Communication:**
```typescript
// Server A publishes
redis.publish('room:123:drawing', JSON.stringify(strokeData));

// Server B subscribes
redis.subscribe('room:123:drawing', (data) => {
  io.to('room:123').emit('drawing:update', data);
});
```

---

## Data Models

### Core Models

```typescript
interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
  isReady: boolean;
  isDrawing: boolean;
  hasGuessed: boolean;
  connectionStatus: 'connected' | 'disconnected';
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  isPrivate: boolean;
  status: 'waiting' | 'playing' | 'finished';
  settings: RoomSettings;
  createdAt: Date;
}

interface RoomSettings {
  maxPlayers: number; // 2-8
  roundTime: number; // 60-120 seconds
  rounds: number; // 3-10
  wordDifficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  allowHints: boolean;
}

interface GameSession {
  id: string;
  roomCode: string;
  players: Player[];
  currentDrawerId: string;
  currentWord: string;
  currentRound: number;
  maxRounds: number;
  roundStartTime: Date;
  roundDuration: number;
  scores: Record<string, number>;
  guessedPlayers: Set<string>;
  status: 'playing' | 'finished';
}

interface DrawingStroke {
  points: {x: number, y: number}[];
  color: string;
  width: number;
  timestamp: number;
}

interface GameResults {
  gameId: string;
  roomCode: string;
  players: Player[];
  finalScores: Record<string, number>;
  winner: string;
  rounds: number;
  duration: number;
  completedAt: Date;
}
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Game history
CREATE TABLE game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(10) NOT NULL,
  winner_id UUID REFERENCES users(id),
  player_ids UUID[] NOT NULL,
  final_scores JSONB NOT NULL,
  rounds INT NOT NULL,
  duration INT NOT NULL, -- seconds
  settings JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_game_history_winner ON game_history(winner_id);
CREATE INDEX idx_game_history_created ON game_history(created_at DESC);

-- User statistics
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  total_score BIGINT DEFAULT 0,
  words_guessed INT DEFAULT 0,
  words_drawn INT DEFAULT 0,
  average_guess_time FLOAT DEFAULT 0,
  fastest_guess_time FLOAT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Drawings (optional - for replay feature)
CREATE TABLE drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES game_history(id) ON DELETE CASCADE,
  drawer_id UUID REFERENCES users(id),
  word VARCHAR(100) NOT NULL,
  drawing_data JSONB NOT NULL, -- Array of strokes
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drawings_drawer ON drawings(drawer_id);
CREATE INDEX idx_drawings_game ON drawings(game_id);

-- Word bank
CREATE TABLE words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word VARCHAR(100) UNIQUE NOT NULL,
  difficulty VARCHAR(20) NOT NULL, -- 'easy', 'medium', 'hard'
  category VARCHAR(50), -- 'animals', 'objects', 'actions', etc.
  language VARCHAR(10) DEFAULT 'en',
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_words_difficulty ON words(difficulty);
CREATE INDEX idx_words_category ON words(category);

-- Friendships
CREATE TABLE friendships (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL, -- 'pending', 'accepted', 'blocked'
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id);
```

### Redis Data Structures

```
# Active game sessions
SET game:session:{gameId} {GameSession JSON}
EXPIRE game:session:{gameId} 7200 # 2 hours

# Room to game mapping
SET room:{roomCode} {gameId}
EXPIRE room:{roomCode} 7200

# Player connection state
SET player:{playerId}:socket {socketId}
EXPIRE player:{playerId}:socket 3600

# Rate limiting
INCR rate:guess:{playerId}
EXPIRE rate:guess:{playerId} 1

INCR rate:draw:{playerId}
EXPIRE rate:draw:{playerId} 1

# Leaderboard (sorted set)
ZADD leaderboard:daily {score} {userId}
ZADD leaderboard:weekly {score} {userId}
ZADD leaderboard:alltime {score} {userId}

# Active rooms list
SADD rooms:active {roomCode}
```

---

## API Endpoints

### REST API

#### Authentication
```
POST   /api/v1/auth/register
       Body: { username, email, password }
       Response: { token, user }

POST   /api/v1/auth/login
       Body: { email, password }
       Response: { token, user }

GET    /api/v1/auth/me
       Headers: Authorization: Bearer {token}
       Response: { user }

POST   /api/v1/auth/refresh
       Body: { refreshToken }
       Response: { token }
```

#### Game Management
```
POST   /api/v1/games/create
       Headers: Authorization: Bearer {token}
       Body: { settings: RoomSettings }
       Response: { roomCode, room }

POST   /api/v1/games/{roomCode}/join
       Headers: Authorization: Bearer {token}
       Response: { room, gameSession }

GET    /api/v1/games/active
       Response: { rooms: Room[] }

GET    /api/v1/games/{gameId}
       Response: { game: GameSession }

GET    /api/v1/games/{gameId}/replay
       Response: { drawings: Drawing[] }
```

#### User & Stats
```
GET    /api/v1/users/{userId}
       Response: { user, stats }

GET    /api/v1/users/{userId}/stats
       Response: { stats: UserStats }

GET    /api/v1/users/{userId}/history
       Query: ?page=1&limit=20
       Response: { games: GameHistory[], total, page }

PUT    /api/v1/users/profile
       Headers: Authorization: Bearer {token}
       Body: { username?, avatarUrl? }
       Response: { user }
```

#### Leaderboard
```
GET    /api/v1/leaderboard
       Query: ?timeframe=daily|weekly|alltime&limit=100
       Response: { rankings: LeaderboardEntry[] }
```

#### Friends
```
GET    /api/v1/friends
       Headers: Authorization: Bearer {token}
       Response: { friends: User[] }

POST   /api/v1/friends/request
       Body: { friendId }
       Response: { friendship }

PUT    /api/v1/friends/{friendId}/accept
       Response: { friendship }

DELETE /api/v1/friends/{friendId}
       Response: { success: true }
```

---

## Scalability & Performance

### Horizontal Scaling Strategy

1. **Stateless API Servers**
   - Multiple Express instances behind Nginx load balancer
   - JWT-based authentication (no server sessions)
   - Database connection pooling

2. **WebSocket Server Scaling**
   - Socket.IO with Redis adapter
   - Sticky sessions via IP hash or cookie
   - Cross-server pub/sub for room broadcasts

3. **Database Optimization**
   - Read replicas for stats/leaderboards
   - Connection pooling (pg-pool)
   - Prepared statements
   - Proper indexing

4. **Redis Cluster**
   - Separate Redis instances for:
     - Session/game state
     - Pub/sub messaging
     - Rate limiting
     - Caching

### Performance Optimizations

#### Frontend
- Lazy loading routes
- OnPush change detection
- Virtual scrolling for large lists
- Canvas rendering optimization
- Debounced input handlers
- Service Worker for offline support

#### Backend
- Drawing data throttling (60 updates/sec)
- Binary WebSocket protocol for canvas data
- Gzip compression for HTTP responses
- CDN for static assets
- Database query optimization with indexes

#### Network
- WebSocket binary frames for drawing data
- Delta compression for stroke updates
- Batch similar events
- Prioritize critical events (game state > chat)

---

## Security Measures

### Authentication & Authorization
- JWT with short expiry (15 min) + refresh tokens
- Password hashing with bcrypt (cost factor 12)
- Email verification for registration
- Rate limiting on auth endpoints

### WebSocket Security
- JWT authentication on WebSocket connection
- Origin validation (CORS)
- Socket.IO middleware for auth checks
- Automatic disconnection on invalid tokens

### Input Validation
- Sanitize all user inputs (usernames, guesses, chat)
- XSS prevention in chat messages
- SQL injection prevention (parameterized queries)
- Validate drawing data bounds

### Rate Limiting
```typescript
// Drawing strokes: 60/sec per user
// Guesses: 5/sec per user
// Chat messages: 5/sec per user
// API calls: 100/min per IP
```

### Game Security
- Server-side word selection (never sent to guessers)
- Server-side score calculation
- Anti-cheat measures (validate timestamps)
- Profanity filter for words and chat

---

## Deployment Architecture

```
                    Internet
                       ↓
                [CloudFlare CDN]
                       ↓
                  [Nginx LB]
                   /       \
          [API Servers]  [WebSocket Servers]
           (3 instances)   (3 instances)
                 |              |
                 ↓              ↓
            [Redis Cluster]
         (Session + Pub/Sub)
                 ↓
          [PostgreSQL]
       (Primary + Replica)
```

### Docker Compose Structure
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["80:80"]
  
  api:
    build: ./backend
    environment:
      - NODE_ENV=production
    depends_on: [postgres, redis]
  
  websocket:
    build: ./backend
    command: npm run start:ws
    depends_on: [redis]
  
  postgres:
    image: postgres:15
    volumes: [postgres_data:/var/lib/postgresql/data]
  
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
```

---

## Development Phases

### Phase 1: MVP (Core Game)
**Duration:** 4-6 weeks

- [ ] User authentication (register/login)
- [ ] Room creation and joining
- [ ] Basic drawing canvas (mouse support)
- [ ] WebSocket connection and events
- [ ] Turn rotation logic
- [ ] Guess submission and validation
- [ ] Basic scoring system
- [ ] Simple chat
- [ ] Timer implementation
- [ ] End game screen with results

### Phase 2: Enhanced Features
**Duration:** 3-4 weeks

- [ ] User profiles and avatars
- [ ] Game history and statistics
- [ ] Leaderboards (daily/weekly/all-time)
- [ ] Custom room settings
- [ ] Touch support for mobile
- [ ] Drawing tools (colors, brush sizes)
- [ ] Undo/clear canvas
- [ ] Word difficulty levels
- [ ] Sound effects and music
- [ ] Responsive design

### Phase 3: Advanced Features
**Duration:** 4-6 weeks

- [ ] Friend system
- [ ] Private rooms with passwords
- [ ] Drawing replay feature
- [ ] Custom word lists
- [ ] Achievements and badges
- [ ] Player reporting/moderation
- [ ] Multiple languages support
- [ ] Tournament mode
- [ ] Spectator mode
- [ ] Drawing practice mode

---

## Monitoring & Observability

### Metrics to Track
- Active concurrent users
- Active game sessions
- Average response time (API)
- WebSocket message latency
- Database query performance
- Redis hit/miss ratio
- Error rates by endpoint
- User registration/retention rates

### Logging Strategy
```typescript
// Winston logger with levels
logger.info('User joined room', { userId, roomCode });
logger.warn('Rate limit exceeded', { userId, endpoint });
logger.error('Database connection failed', { error });
```

### Alerts
- API response time > 500ms
- Error rate > 5%
- Database connection pool exhausted
- Redis connection failures
- Disk space < 20%

---

## Testing Strategy

### Frontend Tests
- **Unit Tests:** Jest for services and utilities
- **Component Tests:** Angular Testing Library
- **E2E Tests:** Playwright for critical flows

### Backend Tests
- **Unit Tests:** Jest for business logic
- **Integration Tests:** Supertest for API endpoints
- **Socket Tests:** Socket.IO client for WebSocket events
- **Load Tests:** k6 for performance testing

### Test Coverage Goals
- Backend: >80%
- Frontend: >70%
- Critical paths: 100%
