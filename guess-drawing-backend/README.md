# Guess Drawing Backend

Real-time multiplayer drawing game backend with Socket.IO and PostgreSQL.

## Features

- ✅ Real-time WebSocket communication with Socket.IO
- ✅ Room management and game session handling
- ✅ JWT authentication
- ✅ PostgreSQL for persistent data
- ✅ Redis for game state and caching
- ✅ Comprehensive game logic with scoring
- ✅ Rate limiting and security
- ✅ TypeScript for type safety

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

## Local Setup (macOS)

### 1. Install Dependencies

Install PostgreSQL and Redis via Homebrew:
```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
```

### 2. Install Node Dependencies
```bash
npm install
```

### 3. Configuration

Copy `.env.example` to `.env` and update with your settings:
```bash
cp .env.example .env
```

### 4. Database Setup

Create database and run migrations:
```bash
createdb guess_drawing
psql -d guess_drawing -f src/database/schema.sql
psql -d guess_drawing -f src/database/seeds.sql
```

### 5. Run the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## AWS Deployment

For production deployment on AWS EC2 with RDS and ElastiCache, see [DEPLOYMENT.md](../DEPLOYMENT.md) in the root directory.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user

### Games
- `POST /api/v1/games/create` - Create game room (requires auth)
- `GET /api/v1/games/active` - Get active rooms
- `GET /api/v1/games/:roomCode` - Get room details

### Health
- `GET /health` - Health check

## WebSocket Events

### Client → Server
- `player:join` - Join game room
- `player:ready` - Mark player as ready
- `drawing:stroke` - Send drawing stroke
- `drawing:clear` - Clear canvas
- `guess:submit` - Submit word guess
- `chat:message` - Send chat message
- `player:leave` - Leave room

### Server → Client
- `game:state` - Full game state
- `player:joined` - Player joined notification
- `player:left` - Player left notification
- `player:ready` - Player ready status
- `round:start` - Round started
- `round:word` - Word for drawer (private)
- `round:end` - Round ended
- `game:end` - Game finished
- `drawing:update` - Drawing stroke update
- `drawing:cleared` - Canvas cleared
- `guess:correct` - Correct guess notification
- `chat:message` - Chat message
- `error` - Error message

## Project Structure

```
src/
├── config/           # Configuration
├── database/         # Database connection and migrations
├── middleware/       # Express middleware
├── repositories/     # Data access layer
├── routes/          # REST API routes
├── services/        # Business logic
│   ├── GameService.ts
│   ├── RoomManager.ts
│   ├── DrawingService.ts
│   └── WordService.ts
├── socket/          # WebSocket handlers
│   └── GameSocketHandler.ts
├── types/           # TypeScript interfaces
├── utils/           # Utilities
└── index.ts         # Entry point
```

## Architecture

- **Express** for REST API
- **Socket.IO** for real-time communication
- **PostgreSQL** for users, game history, stats
- **Redis** for active game sessions and caching
- **JWT** for authentication

## Game Flow

1. Player creates/joins room
2. Players mark themselves as ready
3. Game starts when all players ready
4. Each round:
   - One player draws
   - Others guess the word
   - Points awarded based on speed
5. Game ends after all rounds
6. Winner declared

## Security

- JWT token authentication for WebSocket
- Rate limiting on drawing, guessing, and chat
- Input validation and sanitization
- Password hashing with bcrypt
- CORS configuration

## Testing

```bash
npm test
```

## License

MIT
