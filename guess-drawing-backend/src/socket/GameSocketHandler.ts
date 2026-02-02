import { Server, Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager';
import { GameService } from '../services/GameService';
import { DrawingService } from '../services/DrawingService';
import { Player } from '../types';
import { logger } from '../utils/logger';
import { verifyToken } from '../utils/jwt';
import { createRateLimiter } from '../utils/rateLimiter';

export class GameSocketHandler {
  private io: Server;
  private roomManager: RoomManager;
  private gameService: GameService;
  private drawingService: DrawingService;

  constructor(
    io: Server,
    roomManager: RoomManager,
    gameService: GameService,
    drawingService: DrawingService
  ) {
    this.io = io;
    this.roomManager = roomManager;
    this.gameService = gameService;
    this.drawingService = drawingService;
  }

  handleConnection(socket: Socket): void {
    // Authenticate socket
    const token = socket.handshake.auth.token;
    const user = verifyToken(token);

    if (!user) {
      logger.warn('Unauthenticated socket connection attempt');
      socket.disconnect();
      return;
    }

    socket.data.userId = user.userId;
    socket.data.username = user.username;

    logger.info(`User connected: ${user.username} (${socket.id})`);

    // Rate limiters
    const drawingLimiter = createRateLimiter(60, 1000); // 60/sec
    const guessLimiter = createRateLimiter(5, 1000); // 5/sec
    const chatLimiter = createRateLimiter(5, 1000); // 5/sec

    // Player joins room
    socket.on('player:join', async (data: { roomCode: string }) => {
      try {
        const player: Player = {
          id: socket.data.userId,
          name: socket.data.username,
          score: 0,
          isReady: false,
          isDrawing: false,
          hasGuessed: false,
          connectionStatus: 'connected',
          socketId: socket.id,
        };

        const room = this.roomManager.joinRoom(data.roomCode, player);
        socket.data.roomCode = data.roomCode;

        socket.join(data.roomCode);

        // Send current game state to new player
        const game = this.gameService.getGameByRoom(data.roomCode);
        socket.emit('game:state', {
          room,
          game,
        });

        // Notify others
        socket.to(data.roomCode).emit('player:joined', { player });

        logger.info(`${player.name} joined room ${data.roomCode}`);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
        logger.error('Error joining room:', error);
      }
    });

    // Player ready
    socket.on('player:ready', (data: { isReady: boolean }) => {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      this.roomManager.setPlayerReady(roomCode, socket.data.userId, data.isReady);

      this.io.to(roomCode).emit('player:ready', {
        playerId: socket.data.userId,
        isReady: data.isReady,
      });

      // Start game if all ready
      if (this.roomManager.allPlayersReady(roomCode)) {
        this.startGame(roomCode);
      }
    });

    // Drawing stroke
    socket.on('drawing:stroke', (data: any) => {
      if (!drawingLimiter()) {
        return; // Rate limited
      }

      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const game = this.gameService.getGameByRoom(roomCode);
      if (!game || game.currentDrawerId !== socket.data.userId) {
        return; // Not the drawer
      }

      const validatedStroke = this.drawingService.validateStroke(data);

      // Broadcast to others
      socket.to(roomCode).emit('drawing:update', validatedStroke);

      // Save to Redis
      this.drawingService.saveStroke(game.id, validatedStroke);
    });

    // Clear canvas
    socket.on('drawing:clear', () => {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const game = this.gameService.getGameByRoom(roomCode);
      if (!game || game.currentDrawerId !== socket.data.userId) {
        return;
      }

      this.io.to(roomCode).emit('drawing:cleared');
      this.drawingService.clearDrawing(game.id);
    });

    // Guess submission
    socket.on('guess:submit', async (data: { guess: string }) => {
      if (!guessLimiter()) return;

      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const game = this.gameService.getGameByRoom(roomCode);
      if (!game) return;

      const result = this.gameService.handleGuess(
        game.id,
        socket.data.userId,
        data.guess
      );

      if (result.isCorrect) {
        this.io.to(roomCode).emit('guess:correct', {
          playerId: socket.data.userId,
          playerName: socket.data.username,
          score: result.score,
          position: result.position,
        });

        // Check if round should end
        if (this.gameService.shouldEndRound(game.id)) {
          this.endRound(game.id, roomCode);
        }
      } else {
        // Broadcast as chat message
        this.io.to(roomCode).emit('chat:message', {
          playerId: socket.data.userId,
          playerName: socket.data.username,
          message: data.guess,
          timestamp: Date.now(),
        });
      }
    });

    // Chat message
    socket.on('chat:message', (data: { message: string }) => {
      if (!chatLimiter()) return;

      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      this.io.to(roomCode).emit('chat:message', {
        playerId: socket.data.userId,
        playerName: socket.data.username,
        message: data.message,
        timestamp: Date.now(),
      });
    });

    // Player leaves
    socket.on('player:leave', () => {
      this.handlePlayerLeave(socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
      this.handlePlayerLeave(socket);
    });
  }

  private async startGame(roomCode: string): Promise<void> {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    // Create game session
    const game = this.gameService.createGame(roomCode, room.players, {
      rounds: room.settings.rounds,
      roundTime: room.settings.roundTime,
    });

    room.status = 'playing';

    // Start first round
    await this.startRound(game.id, roomCode, room.settings.wordDifficulty);
  }

  private async startRound(gameId: string, roomCode: string, difficulty: string): Promise<void> {
    const roundData = await this.gameService.startRound(gameId, difficulty);
    const game = this.gameService.getGame(gameId);
    
    if (!game) return;

    // Clear previous drawing
    await this.drawingService.clearDrawing(gameId);

    // Notify all players
    this.io.to(roomCode).emit('round:start', {
      round: game.currentRound,
      drawerId: roundData.drawerId,
      wordHint: roundData.hint,
      duration: game.roundDuration,
    });

    // Send word only to drawer
    const drawer = game.players.find(p => p.id === roundData.drawerId);
    if (drawer) {
      this.io.to(drawer.socketId).emit('round:word', { word: roundData.word });
    }

    // Set timer for round end
    setTimeout(() => {
      this.endRound(gameId, roomCode);
    }, game.roundDuration * 1000);

    logger.info(`Round ${game.currentRound} started in room ${roomCode}`);
  }

  private async endRound(gameId: string, roomCode: string): Promise<void> {
    const result = this.gameService.endRound(gameId);
    const game = this.gameService.getGame(gameId);
    
    if (!game) return;

    this.io.to(roomCode).emit('round:end', {
      word: result.word,
      scores: result.scores,
      winners: Array.from(game.guessedPlayers),
    });

    if (result.isGameOver) {
      setTimeout(() => {
        this.endGame(gameId, roomCode);
      }, 3000);
    } else {
      // Start next round after delay
      setTimeout(() => {
        const room = this.roomManager.getRoom(roomCode);
        if (room) {
          this.startRound(gameId, roomCode, room.settings.wordDifficulty);
        }
      }, 5000);
    }
  }

  private endGame(gameId: string, roomCode: string): void {
    const results = this.gameService.getGameResults(gameId);

    this.io.to(roomCode).emit('game:end', results);

    // Clean up
    setTimeout(() => {
      this.gameService.deleteGame(gameId);
      this.drawingService.clearDrawing(gameId);
    }, 10000);

    logger.info(`Game ended in room ${roomCode}. Winner: ${results.winnerName}`);
  }

  private handlePlayerLeave(socket: Socket): void {
    const roomCode = socket.data.roomCode;
    const userId = socket.data.userId;

    if (roomCode && userId) {
      this.roomManager.leaveRoom(roomCode, userId);

      socket.to(roomCode).emit('player:left', {
        playerId: userId,
        playerName: socket.data.username,
      });

      logger.info(`${socket.data.username} left room ${roomCode}`);
    }
  }
}
