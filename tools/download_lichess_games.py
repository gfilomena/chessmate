#!/usr/bin/env python3
"""
download_lichess_games.py — Scarica 1000 partite Rapid per ogni fascia ELO da Lichess.

Usa l'API pubblica di Lichess senza autenticazione.
Scarica partite con ELO-matching per ogni band.

Usage:
    pip install berserk python-chess
    python download_lichess_games.py --output games.db

Download continua in background, mostra progresso ogni 100 partite.
"""

import argparse
import sqlite3
import sys
import os
import time
from typing import Iterator, Dict, Tuple
import logging

try:
    import requests
    import chess.pgn
except ImportError:
    print("Installa dipendenze: pip install requests python-chess")
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────────

ELO_BANDS = {
    1: (400, 699),      # Matteo, Sofia
    2: (700, 999),      # Luca
    3: (1000, 1299),    # Giulia
    4: (1300, 1599),    # Marco
    5: (1600, 1899),    # Elena
    6: (1900, 2800),    # Riccardo, Magnus
}

GAMES_PER_BAND = 1000
PERF_TYPE = "rapid"    # 'blitz', 'rapid', 'classical'

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
    Scarica partite da Lichess usando l'API pubblica.
    Ritorna PGN strings uno alla volta.

    Usa l'endpoint Lichess /api/games/search per cercare partite con:
    - Rapid time control
    - Valutazioni in una fascia ELO specifica
    """
    url = "https://lichess.org/api/games/search"

    downloaded = 0
    page = 1
    max_pages = 20  # Limite per evitare infinite loop

    try:
        while downloaded < count and page <= max_pages:
            params = {
                'perf': PERF_TYPE,
                'status': 'mate,draw,outoftime',  # Solo partite finite
                'minRating': min_elo,
                'maxRating': max_elo,
                'moves': 'true',  # Includi mosse
                'opening': 'true',  # Includi aperture
                'sort': 'rating',
                'order': 'desc',
                'max': 300,  # Lichess API max per pagina
                'page': page,
            }

            headers = {
                'User-Agent': 'ChessBot/1.0 (Educational)'
            }

            try:
                response = requests.get(url, params=params, headers=headers, timeout=10)
                response.raise_for_status()
                data = response.json()

                games = data.get('games', [])
                if not games:
                    logger.warning(f"Band {band}: nessuna partita nella pagina {page}")
                    break

                for game in games:
                    if downloaded >= count:
                        break

                    # Estrai PGN da game.pgn
                    pgn_str = game.get('pgn')
                    if pgn_str:
                        downloaded += 1
                        yield pgn_str

                        if downloaded % 100 == 0:
                            white_elo = game.get('players', {}).get('white', {}).get('rating')
                            black_elo = game.get('players', {}).get('black', {}).get('rating')
                            logger.info(
                                f"Band {band}: {downloaded}/{count} partite scaricate "
                                f"(ELO: {white_elo} vs {black_elo})"
                            )

                page += 1
                time.sleep(0.5)  # Rate limiting

            except requests.RequestException as e:
                logger.error(f"Band {band}: errore HTTP pagina {page}: {e}")
                break

    except Exception as e:
        logger.error(f"Band {band}: errore download: {e}")

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
                game = chess.pgn.loads(pgn_str)

                game_id = game.headers.get('Site', '').split('/')[-1]
                white_elo = int(game.headers.get('WhiteElo', 0))
                black_elo = int(game.headers.get('BlackElo', 0))
                result = game.headers.get('Result', '*')

                # Salva nel DB
                conn.execute("""
                    INSERT OR IGNORE INTO game_downloads
                    (elo_band, game_id, white_elo, black_elo, result, pgn)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (band, game_id, white_elo, black_elo, result, pgn_str))

                downloaded += 1

                if downloaded % 100 == 0:
                    conn.commit()
                    logger.info(f"Band {band}: salvate {games_in_db + downloaded} partite")

                if downloaded >= remaining:
                    break

            except Exception as e:
                logger.warning(f"Band {band}: errore parsing PGN: {e}")
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
