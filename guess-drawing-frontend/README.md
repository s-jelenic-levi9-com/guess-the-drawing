# 🎨 Guess the Drawing - Frontend

A real-time multiplayer drawing and guessing game built with Angular 18+, Socket.IO, and TailwindCSS.

## � Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Project Structure](#-project-structure)
- [Architecture](#-architecture)
- [Components Specification](#-components-specification)
- [Services Specification](#-services-specification)
- [Models & Interfaces](#-models--interfaces)
- [Routing](#-routing)
- [Socket Events](#-socket-events)
- [REST API Integration](#-rest-api-integration)
- [State Management](#-state-management)
- [Styling](#-styling)
- [Configuration](#-configuration)
- [Building & Deployment](#-building--deployment)
- [Game Flow](#-game-flow)

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| **Real-time Drawing Canvas** | HTML5 Canvas with customizable colors, brush sizes, eraser, and undo |
| **Live Multiplayer** | WebSocket-based real-time communication using Socket.IO |
| **Game Rooms** | Create private/public rooms with customizable settings |
| **Chat & Guessing** | Integrated chat system that doubles as guess input |
| **Leaderboard** | Live score tracking with player rankings |
| **Round Timer** | Visual countdown timer with color-coded urgency |
| **Word Hints** | Progressive letter hints for guessers |
| **Responsive Design** | Optimized for desktop and tablet devices |
| **JWT Authentication** | Secure token-based authentication with refresh tokens |

---

## 🛠 Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Angular** | 18.2+ | Frontend framework |
| **TypeScript** | 5.4+ | Type-safe JavaScript |
| **Socket.IO Client** | 4.x | Real-time WebSocket communication |
| **TailwindCSS** | 3.x | Utility-first CSS framework |
| **RxJS** | 7.x | Reactive programming & state management |
| **Angular Router** | 18.x | Client-side routing with guards |

---

## 📋 Prerequisites

- **Node.js**: 20.0.0 or higher
- **npm**: 10.0.0 or higher
- **Angular CLI**: 18.x (installed globally recommended)
- **Backend Server**: `guess-drawing-backend` running on port 3000

---

## 🛠️ Installation

```bash
# Clone or navigate to the project
cd guess-drawing-frontend

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

**Development URLs:**
- Frontend: http://localhost:4200
- Backend API: http://localhost:3000/api/v1
- WebSocket: http://localhost:3000

---

## 📁 Project Structure

```
guess-drawing-frontend/
├── src/
│   ├── app/
│   │   ├── core/                           # Singleton services & guards
│   │   │   ├── guards/
│   │   │   │   └── auth.guard.ts           # Route protection
│   │   │   ├── interceptors/
│   │   │   │   └── auth.interceptor.ts     # JWT token injection
│   │   │   ├── models/                     # TypeScript interfaces
│   │   │   │   ├── index.ts                # Barrel export
│   │   │   │   ├── player.model.ts
│   │   │   │   ├── room.model.ts
│   │   │   │   ├── game.model.ts
│   │   │   │   ├── drawing.model.ts
│   │   │   │   ├── chat.model.ts
│   │   │   │   └── user.model.ts
│   │   │   └── services/
│   │   │       ├── index.ts                # Barrel export
│   │   │       ├── auth.service.ts         # Authentication
│   │   │       ├── game.service.ts         # REST API calls
│   │   │       └── socket.service.ts       # WebSocket handling
│   │   │
│   │   ├── features/                       # Feature modules (lazy-loaded)
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   └── login.component.ts
│   │   │   │   └── register/
│   │   │   │       └── register.component.ts
│   │   │   ├── lobby/
│   │   │   │   └── home/
│   │   │   │       └── home.component.ts
│   │   │   └── game/
│   │   │       ├── game-room/
│   │   │       │   └── game-room.component.ts
│   │   │       ├── drawing-canvas/
│   │   │       │   └── drawing-canvas.component.ts
│   │   │       ├── chat/
│   │   │       │   └── chat.component.ts
│   │   │       └── player-list/
│   │   │           └── player-list.component.ts
│   │   │
│   │   ├── shared/                         # Reusable components
│   │   │   └── components/
│   │   │       └── timer/
│   │   │           └── timer.component.ts
│   │   │
│   │   ├── app.component.ts                # Root component
│   │   ├── app.config.ts                   # App configuration
│   │   └── app.routes.ts                   # Route definitions
│   │
│   ├── environments/
│   │   ├── environment.ts                  # Development config
│   │   └── environment.prod.ts             # Production config
│   │
│   ├── index.html                          # Main HTML
│   ├── main.ts                             # Bootstrap
│   └── styles.scss                         # Global styles
│
├── tailwind.config.js                      # TailwindCSS config
├── tsconfig.json                           # TypeScript config
├── angular.json                            # Angular CLI config
└── package.json                            # Dependencies
```

---

## 🏗 Architecture

### Standalone Components
All components use Angular's standalone architecture (no NgModules).

### Lazy Loading
Feature routes are lazy-loaded for optimal performance:
```typescript
loadComponent: () => import('./features/...').then(m => m.Component)
```

### Signal-Based State
Uses Angular signals for reactive state management:
```typescript
currentUser = signal<User | null>(null);
isAuthenticated = computed(() => !!this.currentUser());
```

### Service Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Components                            │
├─────────────────────────────────────────────────────────┤
│  AuthService  │  GameService  │  SocketService          │
├─────────────────────────────────────────────────────────┤
│              HttpClient       │    Socket.IO Client     │
├─────────────────────────────────────────────────────────┤
│                    Backend Server                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🧩 Components Specification

### Authentication Components

#### LoginComponent
| Property | Type | Description |
|----------|------|-------------|
| `loginForm` | `FormGroup` | Reactive form with email & password |
| `isLoading` | `Signal<boolean>` | Loading state |
| `error` | `Signal<string \| null>` | Error message |

**Features:**
- Email/password validation
- Error display
- Loading spinner
- Link to register page

#### RegisterComponent
| Property | Type | Description |
|----------|------|-------------|
| `registerForm` | `FormGroup` | Form with username, email, password, confirmPassword |
| `isLoading` | `Signal<boolean>` | Loading state |
| `error` | `Signal<string \| null>` | Error message |

**Validations:**
- Username: 3-50 characters
- Email: Valid email format
- Password: Minimum 6 characters
- Confirm Password: Must match password

---

### Lobby Components

#### HomeComponent
| Property | Type | Description |
|----------|------|-------------|
| `rooms` | `Signal<Room[]>` | List of active rooms |
| `isLoading` | `Signal<boolean>` | Loading state |
| `isCreating` | `Signal<boolean>` | Room creation state |

**Features:**
- Display active game rooms
- Create new room
- Join room by code
- Quick join (random available room)
- Refresh room list
- Game rules display

---

### Game Components

#### GameRoomComponent (Main Container)
| Property | Type | Description |
|----------|------|-------------|
| `players` | `Signal<Player[]>` | Current players |
| `gameActive` | `Signal<boolean>` | Is game in progress |
| `currentRound` | `Signal<number>` | Current round number |
| `currentDrawerId` | `Signal<string>` | ID of current drawer |
| `currentWord` | `Signal<string>` | Word (drawer only) |
| `wordHint` | `Signal<string>` | Hint for guessers |
| `roundDuration` | `Signal<number>` | Seconds per round |
| `scores` | `Signal<Record<string, number>>` | Player scores |
| `chatMessages` | `Signal<ChatMessage[]>` | Chat history |
| `gameResults` | `Signal<GameResults \| null>` | Final results |

**Computed Properties:**
- `isCurrentDrawer` - Is current user the drawer

#### DrawingCanvasComponent
| Input | Type | Description |
|-------|------|-------------|
| `isDrawer` | `boolean` | Enable drawing tools |

| Output | Type | Description |
|--------|------|-------------|
| `strokeEmitted` | `EventEmitter<DrawingStroke>` | New stroke drawn |
| `canvasCleared` | `EventEmitter<void>` | Canvas cleared |

**Drawing Tools:**
| Tool | Description |
|------|-------------|
| Colors | 10 preset colors (black, red, orange, yellow, green, cyan, blue, purple, pink, white) |
| Brush Sizes | 4px, 8px, 12px, 20px, 32px |
| Eraser | White color brush |
| Clear | Clear entire canvas |
| Undo | Remove last stroke |

**Canvas Specifications:**
- Dimensions: 800x600 pixels
- Background: White (#FFFFFF)
- Line Cap: Round
- Line Join: Round
- Touch support: Yes

#### ChatComponent
| Input | Type | Description |
|-------|------|-------------|
| `messages` | `ChatMessage[]` | Message list |
| `disabled` | `boolean` | Disable input (for drawer) |

| Output | Type | Description |
|--------|------|-------------|
| `messageSubmitted` | `EventEmitter<string>` | New message/guess |

**Features:**
- Auto-scroll to bottom
- Correct guess highlighting
- Disabled state for drawer

#### PlayerListComponent
| Input | Type | Description |
|-------|------|-------------|
| `players` | `Player[]` | Player list |
| `currentDrawerId` | `string` | Current drawer ID |
| `scores` | `Record<string, number>` | Score mapping |

**Display:**
- Sorted by score (descending)
- Medal icons for top 3
- Drawing indicator (✏️)
- Guessed indicator (✅)
- Online/offline status

#### TimerComponent
| Input | Type | Description |
|-------|------|-------------|
| `duration` | `number` | Total seconds |
| `startTime` | `number` | Start timestamp (ms) |

**Visual States:**
| Time Left | Color |
|-----------|-------|
| > 30s | Green |
| 10-30s | Yellow |
| < 10s | Red (pulsing) |

---

## ⚙️ Services Specification

### AuthService

**State:**
```typescript
currentUser: Signal<User | null>
isAuthenticated: Computed<boolean>
```

**Methods:**
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `register` | `RegisterData` | `Observable<AuthResponse>` | Create new user |
| `login` | `LoginCredentials` | `Observable<AuthResponse>` | Authenticate user |
| `logout` | - | `void` | Clear auth & redirect |
| `getToken` | - | `string \| null` | Get JWT from storage |
| `getRefreshToken` | - | `string \| null` | Get refresh token |

**Storage Keys:**
- `auth_token` - JWT access token
- `refresh_token` - Refresh token
- `user` - User object JSON

---

### GameService

**Methods:**
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `createRoom` | `settings?: Partial<RoomSettings>` | `Observable<{room: Room}>` | Create new room |
| `getActiveRooms` | - | `Observable<{rooms: Room[]}>` | List public rooms |
| `getRoomDetails` | `roomCode: string` | `Observable<{room: Room}>` | Get room info |

---

### SocketService

**Connection State:**
```typescript
isConnected: Signal<boolean>
```

**Methods (Emit):**
| Method | Parameters | Description |
|--------|------------|-------------|
| `connect` | - | Connect with auth token |
| `disconnect` | - | Close connection |
| `joinRoom` | `roomCode: string` | Join game room |
| `leaveRoom` | - | Leave current room |
| `setReady` | `isReady: boolean` | Toggle ready state |
| `sendDrawingStroke` | `DrawingStroke` | Send drawing data |
| `clearDrawing` | - | Clear canvas |
| `submitGuess` | `guess: string` | Submit word guess |
| `sendChatMessage` | `message: string` | Send chat message |

**Methods (Listen):**
| Method | Returns | Description |
|--------|---------|-------------|
| `getGameState` | `Observable<GameState>` | Room & game state |
| `getPlayers` | `Observable<Player[]>` | Player updates |
| `getChatMessages` | `Observable<ChatMessage[]>` | Chat history |
| `onPlayerJoined` | `Observable<{player}>` | Player join event |
| `onPlayerLeft` | `Observable<{playerId, playerName}>` | Player leave event |
| `onPlayerReady` | `Observable<{playerId, isReady}>` | Ready toggle |
| `onDrawingUpdate` | `Observable<DrawingStroke>` | Drawing data |
| `onDrawingCleared` | `Observable<void>` | Canvas cleared |
| `onRoundStart` | `Observable<RoundStartData>` | Round begins |
| `onRoundWord` | `Observable<{word}>` | Word for drawer |
| `onRoundEnd` | `Observable<RoundEndData>` | Round ends |
| `onGuessCorrect` | `Observable<GuessResult>` | Correct guess |
| `onGameEnd` | `Observable<GameResults>` | Game finished |
| `onError` | `Observable<{message}>` | Error events |

---

## 📊 Models & Interfaces

### Player
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
  socketId: string;
}
```

### Room
```typescript
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
  maxPlayers: number;        // 2-8
  roundTime: number;         // seconds (30-180)
  rounds: number;            // 1-10
  wordDifficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  allowHints: boolean;
}
```

### Game
```typescript
interface GameSession {
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

interface GameResults {
  gameId: string;
  roomCode: string;
  finalScores: Record<string, number>;
  winnerId: string;
  winnerName: string;
  rounds: number;
  duration: number;
}
```

### Drawing
```typescript
interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
  timestamp: number;
}
```

### Chat
```typescript
interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isCorrectGuess?: boolean;
}
```

### User & Auth
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
}
```

---

## 🛤 Routing

| Path | Component | Guard | Description |
|------|-----------|-------|-------------|
| `/` | HomeComponent | `authGuard` | Lobby/home page |
| `/login` | LoginComponent | `guestGuard` | Login page |
| `/register` | RegisterComponent | `guestGuard` | Registration page |
| `/room/:roomCode` | GameRoomComponent | `authGuard` | Game room |
| `**` | - | - | Redirect to `/` |

### Guards

**authGuard**: Redirects to `/login` if not authenticated
**guestGuard**: Redirects to `/` if already authenticated

---

## 📱 Socket Events

### Client → Server (Emit)

| Event | Payload | Description |
|-------|---------|-------------|
| `player:join` | `{ roomCode: string }` | Join a room |
| `player:ready` | `{ isReady: boolean }` | Toggle ready status |
| `player:leave` | - | Leave current room |
| `drawing:stroke` | `DrawingStroke` | Send drawing stroke |
| `drawing:clear` | - | Clear the canvas |
| `guess:submit` | `{ guess: string }` | Submit a guess |
| `chat:message` | `{ message: string }` | Send chat message |

### Server → Client (Listen)

| Event | Payload | Description |
|-------|---------|-------------|
| `game:state` | `{ room, game }` | Full game state |
| `player:joined` | `{ player }` | New player joined |
| `player:left` | `{ playerId, playerName }` | Player left |
| `player:ready` | `{ playerId, isReady }` | Ready status changed |
| `drawing:update` | `DrawingStroke` | Drawing data from drawer |
| `drawing:cleared` | - | Canvas was cleared |
| `round:start` | `{ round, drawerId, wordHint, duration }` | New round |
| `round:word` | `{ word }` | Word for drawer only |
| `round:end` | `{ word, scores, winners }` | Round finished |
| `guess:correct` | `{ playerId, playerName, score, position }` | Correct guess |
| `chat:message` | `ChatMessage` | Chat message received |
| `game:end` | `GameResults` | Game finished |
| `error` | `{ message }` | Error occurred |

---

## 🌐 REST API Integration

### Base URL
- Development: `http://localhost:3000/api/v1`
- Production: `https://api.guessdrawing.com/v1`

### Endpoints

#### Authentication
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/auth/register` | `{ username, email, password }` | `{ user, token, refreshToken }` |
| POST | `/auth/login` | `{ email, password }` | `{ user, token, refreshToken }` |

#### Games
| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| POST | `/games/create` | ✅ | `{ room }` |
| GET | `/games/active` | ❌ | `{ rooms }` |
| GET | `/games/:roomCode` | ❌ | `{ room }` |

### HTTP Interceptor
All requests automatically include:
```
Authorization: Bearer <token>
```

---

## 🔄 State Management

### Reactive Pattern
Uses Angular Signals + RxJS BehaviorSubjects:

```typescript
// Signals for component state
private currentUser = signal<User | null>(null);
readonly user = this.currentUser.asReadonly();
readonly isAuthenticated = computed(() => !!this.currentUser());

// BehaviorSubjects for socket streams
private gameState$ = new BehaviorSubject<GameState>({ room: null, game: null });
getGameState(): Observable<GameState> {
  return this.gameState$.asObservable();
}
```

### Local Storage
| Key | Content | Purpose |
|-----|---------|---------|
| `auth_token` | JWT string | API authentication |
| `refresh_token` | JWT string | Token refresh |
| `user` | User JSON | User data cache |

---

## 🎨 Styling

### TailwindCSS Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          500: '#8b5cf6',
          600: '#7c3aed',
          900: '#4c1d95',
        }
      },
      animation: {
        'bounce-in': 'bounce-in 0.4s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      }
    }
  }
}
```

### Color Scheme
| Usage | Color | Hex |
|-------|-------|-----|
| Primary | Purple | `#8b5cf6` |
| Primary Hover | Dark Purple | `#7c3aed` |
| Success | Green | `#22c55e` |
| Warning | Yellow | `#eab308` |
| Error | Red | `#ef4444` |
| Background | Gradient | Purple → Blue |

### Global Styles
- Custom scrollbars
- Focus outline styles
- Canvas cursor crosshair
- Inter font family

---

## ⚙️ Configuration

### Environment Files

**Development** (`environment.ts`):
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  wsUrl: 'http://localhost:3000',
};
```

**Production** (`environment.prod.ts`):
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.guessdrawing.com/v1',
  wsUrl: 'wss://ws.guessdrawing.com',
};
```

---

## 📦 Building & Deployment

### Development
```bash
npm start
# or
ng serve
```

### Production Build
```bash
npm run build
# Output: dist/guess-drawing-frontend/
```

### Build Stats (Production)
| Chunk | Size | Transfer |
|-------|------|----------|
| Main Bundle | ~290 KB | ~80 KB |
| Game Room (lazy) | ~70 KB | ~19 KB |
| Home (lazy) | ~8 KB | ~3 KB |
| Auth (lazy) | ~10 KB | ~3 KB |

### Deployment
1. Build: `npm run build`
2. Deploy `dist/guess-drawing-frontend/` to web server
3. Configure server for SPA routing (all routes → index.html)

**Nginx Example:**
```nginx
server {
    listen 80;
    root /var/www/guess-drawing-frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🎮 Game Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login/    │────▶│    Home/    │────▶│   Waiting   │
│  Register   │     │   Lobby     │     │    Room     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                           All players ready   │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Results   │◀────│   Round     │◀────│   Playing   │
│   Screen    │     │    End      │     │   (Draw/    │
└─────────────┘     └─────────────┘     │   Guess)    │
       │                   │            └─────────────┘
       │                   │                   │
       │            More rounds?               │
       │                   │                   │
       ▼                   ▼                   │
┌─────────────┐     ┌─────────────┐            │
│  Play Again │     │ Next Round  │◀───────────┘
└─────────────┘     └─────────────┘
```

### Scoring
- First correct guess: 100 points
- Subsequent guesses: Decreasing points based on position
- Drawer: Points for each correct guess

---

## 📄 License

MIT License

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request
- `player:ready` - Player ready status changed
- `drawing:update` - Receive drawing strokes
- `drawing:cleared` - Canvas was cleared
- `round:start` - New round started
- `round:word` - Word for drawer
- `round:end` - Round ended
- `guess:correct` - Someone guessed correctly
- `chat:message` - Chat message received
- `game:end` - Game finished

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests (if configured)
npm run e2e
```

## 📄 License

MIT
