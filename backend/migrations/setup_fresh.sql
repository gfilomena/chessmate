-- ============================================================
-- setup_fresh.sql
-- Schema completo per database nuovo (chessmate).
-- Eseguire UNA SOLA VOLTA dopo aver creato il database Render.
-- Include tutto: schema base + migrazioni + bootstrap.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(30) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id     VARCHAR(255) UNIQUE,
    avatar_url    VARCHAR(500),
    elo_rapid     INTEGER NOT NULL DEFAULT 100,
    elo_blitz     INTEGER NOT NULL DEFAULT 100,
    elo_bullet    INTEGER NOT NULL DEFAULT 100,
    is_banned     BOOLEAN DEFAULT FALSE,
    is_verified   BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bot user fisso (UUID nil) — usato nelle partite vs Stockfish
INSERT INTO users (id, username, email, elo_rapid, elo_blitz, elo_bullet)
VALUES ('00000000-0000-0000-0000-000000000000', '(bot)', 'bot@chess.internal', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE game_status AS ENUM ('waiting', 'active', 'paused', 'finished');
CREATE TYPE game_result AS ENUM ('white', 'black', 'draw', 'abandoned');
CREATE TYPE finish_reason AS ENUM (
    'checkmate',
    'timeout',
    'timeout_vs_insufficient_material',
    'resigned',
    'stalemate',
    'fifty_moves',
    'threefold',
    'abandoned',
    'draw_agreed'
);

-- ── Games ─────────────────────────────────────────────────────
CREATE TABLE games (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    white_id      UUID NOT NULL REFERENCES users(id),
    black_id      UUID NOT NULL REFERENCES users(id),
    status        game_status NOT NULL DEFAULT 'waiting',
    result        game_result,
    finish_reason finish_reason,
    time_control  INTEGER NOT NULL DEFAULT 600,
    increment     INTEGER NOT NULL DEFAULT 0,
    pgn           TEXT NOT NULL DEFAULT '',
    started_at    TIMESTAMP,
    finished_at   TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_games_white_id ON games(white_id);
CREATE INDEX idx_games_black_id ON games(black_id);
CREATE INDEX idx_games_status   ON games(status);

-- ── ELO history ───────────────────────────────────────────────
CREATE TABLE elo_history (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id),
    game_id    UUID NOT NULL REFERENCES games(id),
    game_type  VARCHAR(10) NOT NULL DEFAULT 'rapid',
    elo_before INTEGER NOT NULL,
    elo_after  INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_elo_history_user_id ON elo_history(user_id);

-- ── Email verifications ───────────────────────────────────────
CREATE TABLE email_verifications (
    token      TEXT        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
