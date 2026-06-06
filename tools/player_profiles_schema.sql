-- ── Player Profiles Database Schema ──────────────────────────────────────
-- Memorizza mosse reali da giocatori Lichess per imitare stili di gioco

CREATE TABLE IF NOT EXISTS game_downloads (
    id INTEGER PRIMARY KEY,
    elo_band INTEGER NOT NULL,
    game_id TEXT NOT NULL UNIQUE,
    white_elo INTEGER,
    black_elo INTEGER,
    result TEXT,
    pgn TEXT NOT NULL,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analyzed_moves (
    id INTEGER PRIMARY KEY,
    position_hash TEXT NOT NULL,
    elo_band INTEGER NOT NULL,
    move_uci TEXT NOT NULL,
    best_move_uci TEXT,
    eval_before INTEGER,
    eval_after INTEGER,
    eval_delta INTEGER,
    classification TEXT,  -- 'blunder', 'mistake', 'inaccuracy', 'good', 'excellent', 'best'
    frequency INTEGER DEFAULT 1,
    UNIQUE(position_hash, elo_band, move_uci)
);

CREATE TABLE IF NOT EXISTS move_profiles (
    elo_band INTEGER PRIMARY KEY,
    best_pct REAL,         -- % mosse best move
    excellent_pct REAL,    -- % mosse excellent (delta < 5 cp)
    good_pct REAL,         -- % mosse good (delta < 25 cp)
    inaccuracy_pct REAL,   -- % inaccuracies (delta < 60 cp)
    mistake_pct REAL,      -- % mistakes (delta < 300 cp)
    blunder_pct REAL       -- % blunders (delta >= 300 cp)
);

CREATE TABLE IF NOT EXISTS position_stats (
    position_hash TEXT PRIMARY KEY,
    elo_band INTEGER,
    total_games INTEGER,
    move_count INTEGER,
    UNIQUE(position_hash, elo_band)
);

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_analyzed_position_band
    ON analyzed_moves(position_hash, elo_band);
CREATE INDEX IF NOT EXISTS idx_analyzed_classification
    ON analyzed_moves(classification);
CREATE INDEX IF NOT EXISTS idx_game_downloads_band
    ON game_downloads(elo_band);
CREATE INDEX IF NOT EXISTS idx_position_stats_band
    ON position_stats(elo_band);

-- Metadata
CREATE TABLE IF NOT EXISTS sync_status (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO sync_status (key, value) VALUES
    ('version', '1.0'),
    ('last_updated', ''),
    ('total_games_analyzed', '0'),
    ('total_positions', '0');
