-- ============================================================
-- 002_elo_system.sql
-- Sistema ELO proporzionale (stile chess.com)
--   • ELO di partenza: 100
--   • Floor: 100 (non si scende mai sotto)
--   • K dinamico gestito nel codice Go
-- ============================================================

-- Cambia il valore di default
ALTER TABLE users ALTER COLUMN elo_rapid  SET DEFAULT 100;
ALTER TABLE users ALTER COLUMN elo_blitz  SET DEFAULT 100;
ALTER TABLE users ALTER COLUMN elo_bullet SET DEFAULT 100;

-- Reset utenti esistenti (provvisori a 1200 di default)
UPDATE users SET elo_rapid = 100, elo_blitz = 100, elo_bullet = 100;

-- Svuota la history ELO precedente (incompatibile con il nuovo sistema)
TRUNCATE TABLE elo_history;
