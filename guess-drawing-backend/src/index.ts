import express, { Application, Request, Response } from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import { config, initializeSecrets } from './config';
import { RoomManager } from './services/RoomManager';
import { GameService } from './services/GameService';
import { DrawingService } from './services/DrawingService';
import { WordService } from './services/WordService';
import { UserService } from './services/UserService';
import { GameSocketHandler } from './socket/GameSocketHandler';
import { logger } from './utils/logger';
import authRoutes from './routes/auth';
import gamesRoutes from './routes/games';

const app: Application = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize services (all in-memory, no databases required)
const roomManager = new RoomManager();
const wordService = new WordService();
const gameService = new GameService(wordService);
const drawingService = new DrawingService();
const userService = new UserService();

// Make services available to routes
app.set('roomManager', roomManager);
app.set('gameService', gameService);
app.set('userService', userService);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/games', gamesRoutes);

// Socket.IO connection handling
const gameSocketHandler = new GameSocketHandler(
  io,
  roomManager,
  gameService,
  drawingService
);

io.on('connection', (socket: Socket) => {
  gameSocketHandler.handleConnection(socket);
});

// Start server with secrets initialization
async function startServer() {
  try {
    // Initialize secrets from AWS Secrets Manager (with fallback to env vars)
    await initializeSecrets();

    httpServer.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`🎮 WebSocket server ready`);
      logger.info(`📝 Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();

export { app, io };
