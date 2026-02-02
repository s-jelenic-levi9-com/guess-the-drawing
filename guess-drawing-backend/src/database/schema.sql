-- Create users table
CREATE TABLE IF NOT EXISTS users (
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

-- Create game history table
CREATE TABLE IF NOT EXISTS game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(10) NOT NULL,
  winner_id UUID REFERENCES users(id),
  player_ids UUID[] NOT NULL,
  final_scores JSONB NOT NULL,
  rounds INT NOT NULL,
  duration INT NOT NULL,
  settings JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_game_history_winner ON game_history(winner_id);
CREATE INDEX idx_game_history_created ON game_history(created_at DESC);

-- Create user statistics table
CREATE TABLE IF NOT EXISTS user_stats (
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

-- Create drawings table (for replay feature)
CREATE TABLE IF NOT EXISTS drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES game_history(id) ON DELETE CASCADE,
  drawer_id UUID REFERENCES users(id),
  word VARCHAR(100) NOT NULL,
  drawing_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drawings_drawer ON drawings(drawer_id);
CREATE INDEX idx_drawings_game ON drawings(game_id);

-- Create words table
CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word VARCHAR(100) UNIQUE NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  category VARCHAR(50),
  language VARCHAR(10) DEFAULT 'en',
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_words_difficulty ON words(difficulty);
CREATE INDEX idx_words_category ON words(category);
CREATE INDEX idx_words_active ON words(is_active);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id);
