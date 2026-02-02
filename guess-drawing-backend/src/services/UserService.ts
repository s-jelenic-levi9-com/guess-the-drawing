import bcrypt from 'bcrypt';
import { User, UserStats } from '../types';
import { v4 as uuidv4 } from 'uuid';

// In-memory user storage
const users = new Map<string, User>();
const userStats = new Map<string, UserStats>();

export class UserService {
  async create(username: string, email: string, password: string): Promise<User> {
    // Check if email already exists
    for (const user of users.values()) {
      if (user.email === email) {
        throw new Error('Email already registered');
      }
      if (user.username === username) {
        throw new Error('Username already taken');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    
    const user: User = {
      id,
      username,
      email,
      passwordHash,
      createdAt: new Date(),
      isActive: true,
    };

    users.set(id, user);

    // Initialize stats
    userStats.set(id, {
      userId: id,
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      wordsGuessed: 0,
      wordsDrawn: 0,
      averageGuessTime: 0,
    });

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return users.get(id) || null;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = users.get(id);
    if (user) {
      user.lastLogin = new Date();
    }
  }

  getStats(userId: string): UserStats | null {
    return userStats.get(userId) || null;
  }

  updateStats(userId: string, updates: Partial<UserStats>): void {
    const stats = userStats.get(userId);
    if (stats) {
      Object.assign(stats, updates);
    }
  }
}
