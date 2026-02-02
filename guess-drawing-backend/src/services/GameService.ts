import { GameSession, Player } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { WordService } from './WordService';

export class GameService {
  private games = new Map<string, GameSession>();
  private roomToGame = new Map<string, string>();
  private wordService: WordService;

  constructor(wordService: WordService) {
    this.wordService = wordService;
  }

  createGame(roomCode: string, players: Player[], settings: { rounds: number; roundTime: number }): GameSession {
    const gameId = uuidv4();
    
    const game: GameSession = {
      id: gameId,
      roomCode,
      players: players.map(p => ({ ...p, score: 0, hasGuessed: false })),
      currentDrawerId: players[0].id,
      currentWord: '',
      currentRound: 0,
      maxRounds: settings.rounds,
      roundStartTime: 0,
      roundDuration: settings.roundTime,
      scores: {},
      guessedPlayers: new Set(),
      status: 'playing',
    };

    // Initialize scores
    players.forEach(p => {
      game.scores[p.id] = 0;
    });

    this.games.set(gameId, game);
    this.roomToGame.set(roomCode, gameId);

    return game;
  }

  getGame(gameId: string): GameSession | undefined {
    return this.games.get(gameId);
  }

  getGameByRoom(roomCode: string): GameSession | undefined {
    const gameId = this.roomToGame.get(roomCode);
    return gameId ? this.games.get(gameId) : undefined;
  }

  async startRound(gameId: string, difficulty: string): Promise<{ word: string; hint: string; drawerId: string }> {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    game.currentRound++;
    game.guessedPlayers.clear();
    game.roundStartTime = Date.now();

    // Select next drawer
    const currentDrawerIndex = game.players.findIndex(p => p.id === game.currentDrawerId);
    const nextDrawerIndex = (currentDrawerIndex + 1) % game.players.length;
    game.currentDrawerId = game.players[nextDrawerIndex].id;

    // Select word
    const word = await this.wordService.getRandomWord(difficulty);
    game.currentWord = word.word;

    // Update player states
    game.players.forEach(p => {
      p.isDrawing = p.id === game.currentDrawerId;
      p.hasGuessed = false;
    });

    return {
      word: word.word,
      hint: this.createHint(word.word),
      drawerId: game.currentDrawerId,
    };
  }

  handleGuess(gameId: string, playerId: string, guess: string): { isCorrect: boolean; score?: number; position?: number } {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    // Validation
    if (game.guessedPlayers.has(playerId)) {
      return { isCorrect: false };
    }
    
    if (playerId === game.currentDrawerId) {
      return { isCorrect: false };
    }

    const isCorrect = this.isCorrectGuess(guess, game.currentWord);

    if (isCorrect) {
      game.guessedPlayers.add(playerId);
      
      const score = this.calculateScore(game);
      game.scores[playerId] = (game.scores[playerId] || 0) + score;

      // Update player state
      const player = game.players.find(p => p.id === playerId);
      if (player) {
        player.hasGuessed = true;
        player.score = game.scores[playerId];
      }

      return {
        isCorrect: true,
        score,
        position: game.guessedPlayers.size,
      };
    }

    return { isCorrect: false };
  }

  endRound(gameId: string): { word: string; scores: Record<string, number>; isGameOver: boolean } {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const isGameOver = game.currentRound >= game.maxRounds;
    
    if (isGameOver) {
      game.status = 'finished';
    }

    return {
      word: game.currentWord,
      scores: { ...game.scores },
      isGameOver,
    };
  }

  getGameResults(gameId: string): {
    finalScores: Record<string, number>;
    winner: string;
    winnerName: string;
  } {
    const game = this.games.get(gameId);
    if (!game) throw new Error('Game not found');

    const sortedScores = Object.entries(game.scores).sort((a, b) => b[1] - a[1]);
    const winnerId = sortedScores[0][0];
    const winner = game.players.find(p => p.id === winnerId);

    return {
      finalScores: { ...game.scores },
      winner: winnerId,
      winnerName: winner?.name || 'Unknown',
    };
  }

  shouldEndRound(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    // End if all non-drawers have guessed
    const nonDrawers = game.players.filter(p => p.id !== game.currentDrawerId);
    return game.guessedPlayers.size === nonDrawers.length;
  }

  deleteGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      this.roomToGame.delete(game.roomCode);
      this.games.delete(gameId);
    }
  }

  private isCorrectGuess(guess: string, word: string): boolean {
    const normalized = guess.toLowerCase().trim();
    const target = word.toLowerCase();

    // Exact match
    if (normalized === target) return true;

    // Fuzzy match for longer words (Levenshtein distance <= 1)
    if (word.length > 5 && this.levenshteinDistance(normalized, target) <= 1) {
      return true;
    }

    return false;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateScore(game: GameSession): number {
    const timeElapsed = Date.now() - game.roundStartTime;
    const timeRemaining = game.roundDuration * 1000 - timeElapsed;
    const timeBonus = Math.max(0, (timeRemaining / (game.roundDuration * 1000)) * 100);

    const basePoints = 100;
    const position = game.guessedPlayers.size;
    const positionMultiplier = 1 + (1 / Math.max(position, 1));

    return Math.floor((basePoints + timeBonus) * positionMultiplier);
  }

  private createHint(word: string): string {
    return word.split('').map((char, index) => {
      if (char === ' ') return ' ';
      // Reveal first letter
      if (index === 0) return char;
      return '_';
    }).join(' ');
  }
}
