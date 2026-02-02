import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  wsPort: parseInt(process.env.WS_PORT || '3001', 10),
  
  database: {
    host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432', 10),
    name: process.env.DATABASE_NAME || process.env.DB_NAME || 'guess_drawing',
    user: process.env.DATABASE_USER || process.env.DB_USER || 'user',
    password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
    ssl: process.env.DATABASE_SSL === 'true',
    url: process.env.DATABASE_URL || '',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  game: {
    maxPlayersPerRoom: parseInt(process.env.MAX_PLAYERS_PER_ROOM || '8', 10),
    defaultRoundTime: parseInt(process.env.DEFAULT_ROUND_TIME || '90', 10),
    defaultRounds: parseInt(process.env.DEFAULT_ROUNDS || '3', 10),
    roomTimeout: parseInt(process.env.ROOM_TIMEOUT || '7200000', 10),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    drawingLimit: parseInt(process.env.DRAWING_RATE_LIMIT || '60', 10),
    guessLimit: parseInt(process.env.GUESS_RATE_LIMIT || '5', 10),
    chatLimit: parseInt(process.env.CHAT_RATE_LIMIT || '5', 10),
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
