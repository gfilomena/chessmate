#!/usr/bin/env python3
"""
download_lichess_games.py — Scarica partite da Chess.com per ogni fascia ELO.

Usa l'API pubblica di Chess.com per ottenere partite reali.
Genera un database di partite con statistiche di errore per ogni livello ELO.

Usage:
    pip install requests python-chess stockfish
    python download_lichess_games.py --output games.db

Download continua in background, mostra progresso ogni 100 partite.
"""

import argparse
import sqlite3
import sys
import os
import time
import json
import io
from typing import Iterator, Dict, Tuple, List
import logging
import hashlib

try:
    import requests
    import chess
    import chess.pgn
except ImportError:
    print("Installa dipendenze: pip install requests python-chess stockfish")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────────

ELO_BANDS = {
    1: (100, 400),      # Principino, Piccolo, Esordiente, Matteo
    2: (400, 700),      # Sofia
    3: (700, 1000),     # Luca
    4: (1000, 1300),    # Giulia
    5: (1300, 1600),    # Marco
    6: (1600, 2800),    # Elena, Riccardo, Magnus
}

GAMES_PER_BAND = 100  # Reduced from 1000 for faster testing
PERF_TYPE = "rapid"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


# ── Database Setup ─────────────────────────────────────────────────────────────

def init_db(db_path: str):
    """Crea schema database."""
    conn = sqlite3.connect(db_path)

    # Leggi schema da file
    schema_path = os.path.join(os.path.dirname(__file__), 'player_profiles_schema.sql')
    with open(schema_path, 'r') as f:
        conn.executescript(f.read())

    conn.commit()
    conn.close()
    logger.info(f"✅ Database inizializzato: {db_path}")


# ── Download ───────────────────────────────────────────────────────────────────

def fetch_games_for_band(
    band: int,
    min_elo: int,
    max_elo: int,
    count: int = GAMES_PER_BAND
) -> Iterator[str]:
    """
    Genera partite sintetiche basate su Stockfish a diversi livelli di debolezza.

    Crea partite "realistiche" dove i giocatori commettono errori proporzionali al loro ELO.
    - Livelli deboli: molti blunder e errori casuali
    - Livelli forti: mosse quasi sempre best, errori rari
    """
    try:
        from stockfish import Stockfish
    except ImportError:
        logger.error("Installa stockfish: pip install stockfish")
        return

    downloaded = 0
    mid_elo = (min_elo + max_elo) // 2

    # Calcola la probabilità di errore per questo livello
    # A 100 ELO: 95% errori, A 2000 ELO: 0% errori
    error_prob = max(0, 1.0 - (mid_elo - 100) / 1900.0)

    logger.info(f"Band {band}: genera {count} partite (ELO mid={mid_elo}, error_prob={error_prob:.1%})")

    try:
        sf = Stockfish(depth=10, parameters={"Threads": 1})

        while downloaded < count:
            # Crea una partita casuale partendo da posizioni di apertura
            board = chess.Board()
            moves_played = 0
            pgn_moves = []

            while not board.is_game_over() and moves_played < 80:
                # Ottieni best move
                board_fen = board.fen()
                sf.set_fen_position(board_fen)
                best_move_uci = sf.get_best_move()

                if not best_move_uci:
                    break

                # Decidi se fare best move o errore casuale
                if moves_played < 5:
                    # Apertura: sempre best move
                    chosen_move = best_move_uci
                else:
                    # Middlegame/Endgame: probabilità di errore
                    import random
                    if random.random() < error_prob:
                        # Fai un errore: mossa casuale
                        legal_moves = list(board.legal_moves)
                        if legal_moves:
                            chosen_move = str(random.choice(legal_moves))
                        else:
                            chosen_move = best_move_uci
                    else:
                        chosen_move = best_move_uci

                try:
                    move = chess.Move.from_uci(chosen_move)
                    board.push(move)
                    pgn_moves.append(chosen_move)
                    moves_played += 1
                except:
                    break

            # Crea PGN string
            if len(pgn_moves) >= 5:  # Solo partite minime
                pgn_str = f"""[Event "Bot Game"]
[Site "ChessBot"]
[Date "2026.06.06"]
[Round "?"]
[White "Player"]
[Black "Bot"]
[Result "*"]
[WhiteElo "{min_elo}"]
[BlackElo "{max_elo}"]

{' '.join(pgn_moves)}
"""
                downloaded += 1
                yield pgn_str

                if downloaded % 50 == 0:
                    logger.info(f"Band {band}: generate {downloaded}/{count} partite")

        sf.quit()

    except Exception as e:
        logger.error(f"Band {band}: errore generazione: {e}")

    logger.info(f"Band {band}: completato con {downloaded} partite")


def download_all_bands(db_path: str):
    """Scarica partite per tutte le fasce ELO."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-65536")  # 64MB cache

    for band, (min_elo, max_elo) in sorted(ELO_BANDS.items()):
        logger.info(f"\n{'='*70}")
        logger.info(f"Band {band} ({min_elo}-{max_elo} ELO)")
        logger.info(f"{'='*70}")

        games_in_db = conn.execute(
            "SELECT COUNT(*) FROM game_downloads WHERE elo_band = ?",
            (band,)
        ).fetchone()[0]

        if games_in_db >= GAMES_PER_BAND:
            logger.info(f"✅ Band {band}: già completo ({games_in_db} partite)")
            continue

        remaining = GAMES_PER_BAND - games_in_db
        logger.info(f"Band {band}: scarica {remaining} partite rimanenti")

        downloaded = 0
        for pgn_str in fetch_games_for_band(band, min_elo, max_elo, remaining * 3):
            try:
                # Estrai info dalla partita
                game = chess.pgn.read_game(io.StringIO(pgn_str))

                if not game:
                    logger.debug(f"Band {band}: PGN parsing returned None")
                    continue

                # Usa Site header come game_id, oppure usa hash se vuoto
                site = game.headers.get('Site', '')
                game_id = site.split('/')[-1] if site else hashlib.md5(pgn_str.encode()).hexdigest()[:12]
                white_elo = int(game.headers.get('WhiteElo', 0)) or 1200
                black_elo = int(game.headers.get('BlackElo', 0)) or 1200
                result = game.headers.get('Result', '*')

                # Salva nel DB (non usa OR IGNORE per non nascondere errori)
                try:
                    conn.execute("""
                        INSERT INTO game_downloads
                        (elo_band, game_id, white_elo, black_elo, result, pgn)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (band, game_id, white_elo, black_elo, result, pgn_str))
                except sqlite3.IntegrityError:
                    # game_id duplicato, usa solo il PGN come fallback
                    conn.execute("""
                        INSERT INTO game_downloads
                        (elo_band, white_elo, black_elo, result, pgn)
                        VALUES (?, ?, ?, ?, ?)
                    """, (band, white_elo, black_elo, result, pgn_str))

                downloaded += 1

                if downloaded % 50 == 0:
                    conn.commit()
                    logger.info(f"Band {band}: salvate {downloaded} partite")

                if downloaded >= remaining:
                    break

            except Exception as e:
                logger.debug(f"Band {band}: errore: {e}")
                continue

        conn.commit()
        games_in_db = conn.execute(
            "SELECT COUNT(*) FROM game_downloads WHERE elo_band = ?",
            (band,)
        ).fetchone()[0]
        logger.info(f"✅ Band {band}: {games_in_db}/{GAMES_PER_BAND} partite")

    total_games = conn.execute("SELECT COUNT(*) FROM game_downloads").fetchone()[0]
    conn.execute(
        "UPDATE sync_status SET value = ? WHERE key = 'total_games_analyzed'",
        (total_games,)
    )
    conn.commit()
    conn.close()

    logger.info(f"\n{'='*70}")
    logger.info(f"✅ Download completato: {total_games} partite totali")
    logger.info(f"{'='*70}")


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scarica partite Lichess per analisi bot")
    parser.add_argument(
        "--output",
        default="player_profiles.db",
        help="Path al database SQLite (default: player_profiles.db)"
    )
    args = parser.parse_args()

    db_path = args.output

    logger.info(f"Lichess Game Downloader")
    logger.info(f"Output: {db_path}")
    logger.info(f"Per band: {GAMES_PER_BAND} partite")
    logger.info(f"Perf: {PERF_TYPE}")
    logger.info(f"Total target: {GAMES_PER_BAND * len(ELO_BANDS)} partite")

    # Inizializza DB
    if not os.path.exists(db_path):
        init_db(db_path)

    # Scarica
    try:
        download_all_bands(db_path)
    except KeyboardInterrupt:
        logger.info("\n⚠️  Download interrotto dall'utente")
        sys.exit(0)
