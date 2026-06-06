#!/usr/bin/env python3
"""
build_opening_db.py — Costruisce il database delle aperture da file Lichess PGN.

Usage:
    pip install python-chess zstandard
    python build_opening_db.py --input lichess_db_standard_rated_2024-01.pgn.zst --output opening.db

Il file PGN.zst si scarica da: https://database.lichess.org/
Consigliato: scarica 1 mese recente (sezione "Standard" → rated).

Output: opening.db (SQLite, ~200-600MB dopo filtro)
"""

import argparse
import sqlite3
import sys
import os
import zstandard as zstd
import chess
import chess.pgn
import io
import time

# ── Configurazione ────────────────────────────────────────────────────────────

MAX_PLY    = 40       # analizza solo i primi 20 mosse (40 half-moves)
MIN_COUNT  = 5        # ignora mosse giocate meno di 5 volte in una fascia ELO
BATCH_SIZE = 50_000   # commit ogni N mosse
LOG_EVERY  = 25_000   # stampa progresso ogni N partite

# Fasce ELO: band → (min_elo_incluso, max_elo_escluso)
ELO_BANDS = {
    1: (0,    700),   # Matteo/Sofia
    2: (700,  1000),  # Luca
    3: (1000, 1300),  # Giulia
    4: (1300, 1600),  # Marco
    5: (1600, 1900),  # Elena
    6: (1900, 9999),  # Riccardo/Magnus
}

def elo_to_band(elo: int) -> int | None:
    for band, (lo, hi) in ELO_BANDS.items():
        if lo <= elo < hi:
            return band
    return None

def norm_fen(board: chess.Board) -> str:
    """FEN normalizzato: solo le prime 4 componenti (posizione, turno, arrocco, en passant).
    Ignora i contatori di mosse — compatibile con normFEN() in opening.go."""
    fen = board.fen()
    return " ".join(fen.split()[:4])

# ── Schema SQLite ─────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS opening_moves (
    norm_fen TEXT    NOT NULL,   -- FEN normalizzato (posizione + turno + arrocco + en passant)
    elo_band INTEGER NOT NULL,   -- fascia ELO (1-6)
    uci      TEXT    NOT NULL,   -- mossa in formato UCI es. "e2e4"
    cnt      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (norm_fen, elo_band, uci)
);
CREATE INDEX IF NOT EXISTS idx_fen_elo ON opening_moves(norm_fen, elo_band);
"""

UPSERT = """
INSERT INTO opening_moves(norm_fen, elo_band, uci, cnt)
VALUES (?, ?, ?, 1)
ON CONFLICT(norm_fen, elo_band, uci) DO UPDATE SET cnt = cnt + 1;
"""

CLEANUP = "DELETE FROM opening_moves WHERE cnt < ?;"

# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_elo(game, color: str) -> int | None:
    key = "WhiteElo" if color == "white" else "BlackElo"
    try:
        return int(game.headers.get(key, "?"))
    except ValueError:
        return None

def process_file(pgn_path: str, db_path: str):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-131072")  # 128MB cache
    conn.executescript(SCHEMA)
    conn.commit()

    # Apri il file (supporta .zst e .pgn normale)
    if pgn_path.endswith(".zst"):
        dctx   = zstd.ZstdDecompressor()
        raw    = open(pgn_path, "rb")
        stream = dctx.stream_reader(raw)
        pgn_io = io.TextIOWrapper(stream, encoding="utf-8", errors="replace")
    else:
        pgn_io = open(pgn_path, encoding="utf-8", errors="replace")

    games_ok    = 0
    games_skip  = 0
    moves_total = 0
    batch       = []
    t0          = time.time()

    try:
        while True:
            game = chess.pgn.read_game(pgn_io)
            if game is None:
                break

            white_elo = parse_elo(game, "white")
            black_elo = parse_elo(game, "black")
            if white_elo is None or black_elo is None:
                games_skip += 1
                continue

            board = game.board()
            ply   = 0

            for move in game.mainline_moves():
                if ply >= MAX_PLY:
                    break

                mover_elo = white_elo if board.turn == chess.WHITE else black_elo
                band = elo_to_band(mover_elo)

                if band is not None:
                    pos = norm_fen(board)
                    uci = move.uci()
                    batch.append((pos, band, uci))
                    moves_total += 1

                board.push(move)
                ply += 1

            games_ok += 1

            if len(batch) >= BATCH_SIZE:
                conn.executemany(UPSERT, batch)
                conn.commit()
                batch = []

            if games_ok % LOG_EVERY == 0:
                elapsed = time.time() - t0
                rate    = games_ok / elapsed
                size_mb = os.path.getsize(db_path) / 1024 / 1024
                print(f"  {games_ok:>8,} partite | {moves_total:>12,} mosse | "
                      f"{rate:>6.0f} partite/sec | DB: {size_mb:.0f}MB")

    except KeyboardInterrupt:
        print("\nInterrotto — salvo quello che ho...")

    finally:
        if batch:
            conn.executemany(UPSERT, batch)
            conn.commit()

    elapsed = time.time() - t0
    print(f"\nCompletato in {elapsed/60:.1f} minuti")
    print(f"  Partite: {games_ok:,} elaborate, {games_skip:,} saltate")
    print(f"  Mosse:   {moves_total:,}")

    print(f"\nPulizia righe cnt < {MIN_COUNT}...")
    before = conn.execute("SELECT COUNT(*) FROM opening_moves").fetchone()[0]
    conn.execute(CLEANUP, (MIN_COUNT,))
    conn.commit()
    after = conn.execute("SELECT COUNT(*) FROM opening_moves").fetchone()[0]
    print(f"  Rimosse: {before - after:,} | Rimaste: {after:,}")

    print("\nRighe per fascia ELO:")
    labels = {1:"400-700", 2:"700-1000", 3:"1000-1300", 4:"1300-1600", 5:"1600-1900", 6:"1900+"}
    for row in conn.execute("SELECT elo_band, COUNT(*), SUM(cnt) FROM opening_moves GROUP BY elo_band ORDER BY elo_band"):
        print(f"  Band {row[0]} ({labels[row[0]]}): {row[1]:,} posizioni, {row[2]:,} mosse totali")

    conn.execute("ANALYZE")
    conn.close()

    size_mb = os.path.getsize(db_path) / 1024 / 1024
    print(f"\n✅ opening.db pronto: {db_path} ({size_mb:.1f} MB)")
    print(f"   Carica su Railway Volume: /data/opening.db")

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",  required=True, help="File .pgn o .pgn.zst Lichess")
    parser.add_argument("--output", default="opening.db", help="Path output SQLite")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Errore: file non trovato: {args.input}")
        sys.exit(1)

    print(f"Input:  {args.input} ({os.path.getsize(args.input)/1024/1024:.0f} MB)")
    print(f"Output: {args.output}")
    print(f"Prime {MAX_PLY//2} mosse, min {MIN_COUNT} occorrenze\n")

    process_file(args.input, args.output)
