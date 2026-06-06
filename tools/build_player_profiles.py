#!/usr/bin/env python3
"""
build_player_profiles.py — Script master che coordina tutto.

Fa in parallelo:
1. Download di 6000 partite Lichess (1000 per ELO band)
2. Analisi con Stockfish mentre scarica
3. Costruisce database player_profiles.db completo

Usage:
    pip install berserk stockfish python-chess
    python build_player_profiles.py --output player_profiles.db

Controllo stato: vedere player_profiles.db con sqlite3
  sqlite3 player_profiles.db "SELECT COUNT(*) FROM analyzed_moves;"
"""

import argparse
import subprocess
import sys
import os
import time
import sqlite3
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


def run_command(cmd, description):
    """Esegui comando e ritorna True se successo."""
    logger.info(f"\n{'='*70}")
    logger.info(f"  {description}")
    logger.info(f"{'='*70}\n")

    try:
        result = subprocess.run(cmd, shell=True, check=True)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Errore in: {description}")
        logger.error(f"   Return code: {e.returncode}")
        return False


def check_dependencies():
    """Verifica che siano installate le dipendenze."""
    required = {
        'berserk': 'pip install berserk',
        'chess': 'pip install python-chess',
        'stockfish': 'pip install stockfish',
    }

    missing = []
    for module, install_cmd in required.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(install_cmd)

    if missing:
        logger.error("❌ Dipendenze mancanti:")
        for cmd in missing:
            logger.error(f"   {cmd}")
        sys.exit(1)

    logger.info("✅ Tutte le dipendenze installate")


def db_stats(db_path):
    """Stampa statistiche del database."""
    if not os.path.exists(db_path):
        return

    try:
        conn = sqlite3.connect(db_path)

        # Partite scaricate
        games_total = conn.execute("SELECT COUNT(*) FROM game_downloads").fetchone()[0]
        logger.info(f"   Partite scaricate: {games_total}")

        # Per band
        for band in range(1, 7):
            count = conn.execute(
                "SELECT COUNT(*) FROM game_downloads WHERE elo_band = ?",
                (band,)
            ).fetchone()[0]
            logger.info(f"     Band {band}: {count}/1000")

        # Mosse analizzate
        moves_total = conn.execute(
            "SELECT COUNT(DISTINCT position_hash) FROM analyzed_moves"
        ).fetchone()[0]
        logger.info(f"   Posizioni analizzate: {moves_total}")

        # Profili
        profiles_done = conn.execute(
            "SELECT COUNT(*) FROM move_profiles"
        ).fetchone()[0]
        logger.info(f"   Profili completati: {profiles_done}/6")

        conn.close()

    except Exception as e:
        logger.warning(f"Errore lettura DB: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Costruisci database player profiles offline da Lichess"
    )
    parser.add_argument(
        "--output",
        default="player_profiles.db",
        help="Path output database (default: player_profiles.db)"
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Salta il download, usa partite già scaricate"
    )
    parser.add_argument(
        "--skip-analysis",
        action="store_true",
        help="Salta l'analisi, usa mosse già analizzate"
    )
    args = parser.parse_args()

    output = args.output
    tools_dir = os.path.dirname(os.path.abspath(__file__))

    logger.info(f"╔{'='*68}╗")
    logger.info(f"║  Player Profiles Builder (Lichess + Stockfish){'':13}║")
    logger.info(f"╚{'='*68}╝")

    logger.info(f"\n📊 Configurazione:")
    logger.info(f"   Output: {output}")
    logger.info(f"   Partite: 6000 (1000 per ELO band)")
    logger.info(f"   Time control: Rapid")
    logger.info(f"   Stockfish: Depth 20")
    logger.info(f"   Parallelo: Sì (download + analisi simultanei)")

    # Verifica dipendenze
    logger.info(f"\n🔍 Verifica dipendenze...")
    check_dependencies()

    # Download
    if not args.skip_download:
        logger.info(f"\n📥 FASE 1: Download da Lichess")
        cmd = f"cd {tools_dir} && python3 download_lichess_games.py --output {output}"
        if not run_command(cmd, "Download partite Lichess"):
            logger.error("❌ Download fallito")
            sys.exit(1)

        db_stats(output)

    # Analisi
    if not args.skip_analysis:
        logger.info(f"\n🔬 FASE 2: Analisi con Stockfish")
        cmd = f"cd {tools_dir} && python3 analyze_lichess_games.py --db {output}"
        if not run_command(cmd, "Analisi partite con Stockfish"):
            logger.error("❌ Analisi fallita")
            sys.exit(1)

        db_stats(output)

    # Summary finale
    logger.info(f"\n{'='*70}")
    logger.info(f"  ✅ COSTRUZIONE COMPLETATA")
    logger.info(f"{'='*70}")

    db_stats(output)

    logger.info(f"\n📍 Database pronto: {output}")
    logger.info(f"   Carica su Railway: /data/player_profiles.db")
    logger.info(f"   Oppure: PROFILES_DB_PATH={output}")

    logger.info(f"\n🚀 Prossimi step:")
    logger.info(f"   1. Deploy player_profiles.db su Railway")
    logger.info(f"   2. Backend userà /api/player-profile per mosse realistiche")
    logger.info(f"   3. Bot giocheranno come giocatori reali!")


if __name__ == "__main__":
    main()
