CREATE TABLE IF NOT EXISTS videos (
  _id TEXT PRIMARY KEY,
  id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  sentiment_score INTEGER,
  summary TEXT,
  tags TEXT,
  structured TEXT,
  weight REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_date ON videos(date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment ON videos(sentiment_score);
