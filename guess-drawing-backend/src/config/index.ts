import dotenv from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

dotenv.config();

// Secrets Manager client (lazy initialized)
let secretsClient: SecretsManagerClient | null = null;
let cachedSecrets: Record<string, any> = {};

function getSecretsClient(): SecretsManagerClient {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'eu-west-1' });
  }
  return secretsClient;
}

export async function getSecret(secretName: string): Promise<Record<string, any>> {
  // Return cached secret if available
  if (cachedSecrets[secretName]) {
    return cachedSecrets[secretName];
  }

  try {
    const client = getSecretsClient();
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response.SecretString) {
      const secret = JSON.parse(response.SecretString);
      cachedSecrets[secretName] = secret;
      console.log(`✅ Loaded secret: ${secretName}`);
      return secret;
    }
    throw new Error(`Secret ${secretName} has no SecretString`);
  } catch (error) {
    console.warn(`⚠️  Failed to load secret ${secretName}:`, (error as Error).message);
    return {};
  }
}

export async function initializeSecrets(): Promise<void> {
  // Skip if using local environment variables only
  if (process.env.NODE_ENV === 'development' && !process.env.USE_SECRETS_MANAGER) {
    console.log('⏭️  Skipping Secrets Manager (development mode)');
    return;
  }

  try {
    console.log('📦 Loading secrets from AWS Secrets Manager...');

    const [dbSecret, jwtSecret, redisSecret] = await Promise.all([
      getSecret('guess-drawing/db'),
      getSecret('guess-drawing/jwt'),
      getSecret('guess-drawing/redis'),
    ]);

    // Merge secrets
    if (Object.keys(dbSecret).length > 0) {
      cachedSecrets['db'] = dbSecret;
    }
    if (Object.keys(jwtSecret).length > 0) {
      cachedSecrets['jwt'] = jwtSecret;
    }
    if (Object.keys(redisSecret).length > 0) {
      cachedSecrets['redis'] = redisSecret;
    }

    console.log('✅ All secrets loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load secrets:', error);
    // Don't throw - allow app to start with env vars as fallback
  }
}

// Helper to get values from secrets or env vars
function getConfigValue(secretKey: string, secretName: string, envKey: string, defaultValue: string | number = ''): string | number {
  // Try secrets first
  if (cachedSecrets[secretName] && cachedSecrets[secretName][secretKey]) {
    return cachedSecrets[secretName][secretKey];
  }
  // Fall back to environment variable
  return process.env[envKey] || defaultValue;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  wsPort: parseInt(process.env.WS_PORT || '3001', 10),

  database: {
    host: () => String(getConfigValue('host', 'db', 'DATABASE_HOST', process.env.DB_HOST || 'localhost')),
    port: () => parseInt(String(getConfigValue('port', 'db', 'DATABASE_PORT', process.env.DB_PORT || '5432')), 10),
    name: () => String(getConfigValue('dbname', 'db', 'DATABASE_NAME', process.env.DB_NAME || 'guess_drawing')),
    user: () => String(getConfigValue('username', 'db', 'DATABASE_USER', process.env.DB_USER || 'user')),
    password: () => String(getConfigValue('password', 'db', 'DATABASE_PASSWORD', process.env.DB_PASSWORD || 'password')),
    ssl: process.env.DATABASE_SSL === 'true',
    url: process.env.DATABASE_URL || '',
  },

  redis: {
    host: () => String(getConfigValue('host', 'redis', 'REDIS_HOST', 'localhost')),
    port: () => parseInt(String(getConfigValue('port', 'redis', 'REDIS_PORT', '6379')), 10),
    password: () => {
      const pwd = getConfigValue('password', 'redis', 'REDIS_PASSWORD', '');
      return pwd ? String(pwd) : undefined;
    },
  },

  jwt: {
    secret: () => String(getConfigValue('JWT_SECRET', 'jwt', 'JWT_SECRET', 'change-this-secret')),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: () => String(getConfigValue('JWT_REFRESH_SECRET', 'jwt', 'JWT_REFRESH_SECRET', 'change-this-refresh-secret')),
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
