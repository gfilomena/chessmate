#!/usr/bin/env python3
"""
analyze_lichess_games.py — Analizza partite scaricate con Stockfish.

Prende le partite dal DB di download e:
1. Estrae ogni posizione
2. Chiede a Stockfish: qual è la mossa migliore?
3. Classifica la mossa giocata (best, excellent, good, inaccuracy, mistake, blunder)
4. Salva statistiche di movimento per ogni ELO band

Usa multiprocessing per analizzare in parallelo.

Usage:
    pip install stockfish python-chess
    python analyze_lichess_games.py --input games.db --output player_profiles.db
"""

import argparse
import sqlite3
import sys
import os
import logging
from typing import Optional, Tuple, Dict
from concurrent.futures import ProcessPoolExecutor
import chess
import chess.pgn
from io import StringIO
import time

try:
    from stockfish import Stockfish
except ImportError:
    print("Installa: pip install stockfish python-chess")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

STOCKFISH_DEPTH = 20  # Profondità analisi (20 = buon compromesso velocità/accuratezza)
BATCH_SIZE = 50       # Salva ogni N posizioni
WORKERS = 4           # Processi paralleli


# ── Helpers ────────────────────────────────────────────────────────────────────

def _hash_position(fen: str) -> int:
    """Crea hash stabile dalla posizione."""
    return hash(fen.split(' ')[0])  # Solo position part, ignora mosse/turn


def _classify_move(eval_delta: int) -> str:
    """Classifica una mossa dal delta di valutazione."""
    if eval_delta >= 300:
        return 'blunder'
    elif eval_delta >= 100:
        return 'mistake'
    elif eval_delta >= 60:
        return 'inaccuracy'
    elif eval_delta >= 25:
        return 'good'
    elif eval_delta >= 5:
        return 'excellent'
    else:
        return 'best'


def analyze_game(pgn_str: str, elo_band: int, game_id: str) -> list:
    """
    Analizza una singola partita.
    Ritorna lista di (position_hash, elo_band, move_uci, best_move, delta, classification)
    """
    moves_data = []

    try:
        game = chess.pgn.loads(pgn_str)
        board = chess.Board()

        sf = Stockfish(depth=STOCKFISH_DEPTH)

        for move in game.mainline_moves():
            fen = board.fen()
            position_hash = _hash_position(fen)

            # Valuta posizione prima della mossa
            sf.set_fen_position(fen)
            eval_before = sf.get_evaluation()

            if eval_before is None or eval_before.get('type') != 'cp':
                eval_before_cp = 0
            else:
                eval_before_cp = eval_before['value']

            # Qual è la mossa migliore?
            best_move = sf.get_best_move()

            # Esegui la mossa giocata
            sf.make_moves_from_current_position([move.uci()])

            # Valuta posizione dopo la mossa
            eval_after = sf.get_evaluation()
            if eval_after is None or eval_after.get('type') != 'cp':
                eval_after_cp = 0
            else:
                eval_after_cp = eval_after['value']

            # Calcola delta (da prospettiva di chi muove)
            is_white_turn = fen.split(' ')[1] == 'w'
            if is_white_turn:
                eval_delta = eval_before_cp - eval_after_cp  # Bianco vuole score alto
            else:
                eval_delta = eval_after_cp - eval_before_cp  # Nero vuole score basso

            eval_delta = max(0, eval_delta)  # Non negativo

            classification = _classify_move(eval_delta)

            moves_data.append({
                'position_hash': position_hash,
                'elo_band': elo_band,
                'move_uci': move.uci(),
                'best_move_uci': best_move,
                'eval_before': eval_before_cp,
                'eval_after': eval_after_cp,
                'eval_delta': eval_delta,
                'classification': classification,
            })

            board.push(move)

    except Exception as e:
        logger.warning(f"Errore analisi partita {game_id}: {e}")

    return moves_data


# ── Database ───────────────────────────────────────────────────────────────────

def save_moves(db_path: str, moves_data: list):
    """Salva mosse analizzate nel database."""
    if not moves_data:
        return

    conn = sqlite3.connect(db_path)

    for m in moves_data:
        conn.execute("""
            INSERT OR IGNORE INTO analyzed_moves
            (position_hash, elo_band, move_uci, best_move_uci, eval_before, eval_after, eval_delta, classification)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(position_hash, elo_band, move_uci) DO
            UPDATE SET frequency = frequency + 1
        """, (
            m['position_hash'],
            m['elo_band'],
            m['move_uci'],
            m['best_move_uci'],
            m['eval_before'],
            m['eval_after'],
            m['eval_delta'],
            m['classification'],
        ))

    conn.commit()
    conn.close()


def compute_profiles(db_path: str):
    """Calcola profili di movimento per ogni ELO band."""
    conn = sqlite3.connect(db_path)

    for band in range(1, 7):
        # Conta mosse per classificazione
        counts = {}
        total = 0

        for classification in ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']:
            count = conn.execute(
                "SELECT SUM(frequency) FROM analyzed_moves WHERE elo_band = ? AND classification = ?",
                (band, classification)
            ).fetchone()[0] or 0

            counts[classification] = count
            total += count

        if total == 0:
            logger.warning(f"Band {band}: nessuna mossa analizzata")
            continue

        # Calcola percentuali
        best_pct = counts['best'] / total * 100
        excellent_pct = counts['excellent'] / total * 100
        good_pct = counts['good'] / total * 100
        inaccuracy_pct = counts['inaccuracy'] / total * 100
        mistake_pct = counts['mistake'] / total * 100
        blunder_pct = counts['blunder'] / total * 100

        logger.info(
            f"Band {band}: best={best_pct:.1f}%, excellent={excellent_pct:.1f}%, "
            f"good={good_pct:.1f}%, inaccuracy={inaccuracy_pct:.1f}%, "
            f"mistake={mistake_pct:.1f}%, blunder={blunder_pct:.1f}%"
        )

        # Salva profilo
        conn.execute("""
            INSERT OR REPLACE INTO move_profiles
            (elo_band, best_pct, excellent_pct, good_pct, inaccuracy_pct, mistake_pct, blunder_pct)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (band, best_pct, excellent_pct, good_pct, inaccuracy_pct, mistake_pct, blunder_pct))

    conn.commit()
    conn.close()


# ── Main ───────────────────────────────────────────────────────────────────────

def analyze_all(db_path: str):
    """Analizza tutte le partite nel database."""
    conn = sqlite3.connect(db_path)

    # Conta partite già analizzate
    already_analyzed = conn.execute(
        "SELECT COUNT(DISTINCT game_id) FROM game_downloads gd "
        "WHERE EXISTS (SELECT 1 FROM analyzed_moves WHERE game_id = gd.id)"
    ).fetchone()[0]

    total_games = conn.execute("SELECT COUNT(*) FROM game_downloads").fetchone()[0]

    logger.info(f"Partite da analizzare: {total_games - already_analyzed}/{total_games}")

    # Prendi partite non analizzate
    games = conn.execute("""
        SELECT id, elo_band, pgn FROM game_downloads
        WHERE id NOT IN (
            SELECT DISTINCT game_id FROM analyzed_moves
        )
        ORDER BY elo_band, id
    """).fetchall()

    conn.close()

    if not games:
        logger.info("✅ Tutte le partite già analizzate!")
        return

    # Analizza in parallelo
    logger.info(f"Analisi con {WORKERS} worker paralleli...")

    moves_batch = []
    processed = 0

    with ProcessPoolExecutor(max_workers=WORKERS) as executor:
        futures = {}

        for game_id, elo_band, pgn_str in games:
            future = executor.submit(analyze_game, pgn_str, elo_band, game_id)
            futures[future] = (game_id, elo_band)

        for i, future in enumerate(futures):
            try:
                moves_data = future.result(timeout=60)
                moves_batch.extend(moves_data)

                processed += 1

                if processed % 100 == 0:
                    save_moves(db_path, moves_batch)
                    logger.info(f"Analizzate {processed}/{len(games)} partite ({processed*100//len(games)}%)")
                    moves_batch = []

            except Exception as e:
                game_id, elo_band = futures[future]
                logger.error(f"Errore analisi partita {game_id}: {e}")

    # Salva batch finale
    if moves_batch:
        save_moves(db_path, moves_batch)

    logger.info(f"✅ Analisi completata: {processed} partite")

    # Calcola profili
    logger.info("Calcolo profili di movimento...")
    compute_profiles(db_path)

    logger.info("✅ Profili calcolati!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analizza partite con Stockfish")
    parser.add_argument(
        "--db",
        default="player_profiles.db",
        help="Path database con partite scaricate"
    )
    args = parser.parse_args()

    logger.info(f"Lichess Game Analyzer")
    logger.info(f"Database: {args.db}")
    logger.info(f"Stockfish depth: {STOCKFISH_DEPTH}")
    logger.info(f"Workers: {WORKERS}")

    try:
        analyze_all(args.db)
    except KeyboardInterrupt:
        logger.info("\n⚠️ Analisi interrotta")
        sys.exit(0)
