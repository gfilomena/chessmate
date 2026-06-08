#!/usr/bin/env node
/**
 * Fetches real chess puzzles from Lichess API for each level.
 *
 * Usage:
 *   node frontend/scripts/fetch_puzzles.mjs > frontend/src/lib/chess/puzzles.ts
 *
 * Requires chess.js (already in project dependencies).
 */

import { Chess } from 'chess.js';

// ── Level definitions ──────────────────────────────────────────────────────
const LEVEL_CONFIGS = [
  { id: 1,  title: 'Matto in Uno',        subtitle: 'Trova il colpo finale',           icon: '☠️', difficulty: 1, theme: 'mateIn1',         count: 4 },
  { id: 2,  title: 'Cattura!',            subtitle: 'Il pezzo è indifeso',             icon: '🎯', difficulty: 1, theme: 'hangingPiece',    count: 4 },
  { id: 3,  title: 'La Forchetta',        subtitle: 'Attacca due pezzi insieme',        icon: '🍴', difficulty: 1, theme: 'fork',            count: 4 },
  { id: 4,  title: "L'Inchiodatura",      subtitle: 'Blocca il pezzo avversario',       icon: '📌', difficulty: 2, theme: 'pin',             count: 4 },
  { id: 5,  title: 'Lo Spiedino',         subtitle: 'Attacca attraverso il pezzo',      icon: '🗡', difficulty: 2, theme: 'skewer',          count: 4 },
  { id: 6,  title: 'Attacco di Scoperta', subtitle: 'Svela un attacco nascosto',         icon: '👁', difficulty: 2, theme: 'discoveredAttack', count: 4 },
  { id: 7,  title: 'Doppio Scacco',       subtitle: 'Colpisci con due pezzi',           icon: '⚡', difficulty: 2, theme: 'doubleCheck',     count: 4 },
  { id: 8,  title: 'Matto in Due',        subtitle: 'Forza il matto in due mosse',      icon: '♛', difficulty: 3, theme: 'mateIn2',         count: 4 },
  { id: 9,  title: 'Il Sacrificio',       subtitle: 'Sacrifica per vincere',             icon: '💎', difficulty: 3, theme: 'sacrifice',       count: 4 },
  { id: 10, title: 'Maestro',             subtitle: 'La prova finale',                  icon: '🏆', difficulty: 3, theme: 'crushing',        count: 4 },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Play all SAN moves in a space-separated PGN string and return the final FEN.
 */
function fenFromPgn(pgn) {
  const chess = new Chess();
  const tokens = pgn.trim().split(/\s+/);
  for (const tok of tokens) {
    try { chess.move(tok); } catch { /* skip non-move tokens */ }
  }
  return chess.fen();
}

/** 'w' or 'b' → 'white' | 'black' */
function colorFromFen(fen) {
  return fen.split(' ')[1] === 'w' ? 'white' : 'black';
}

// ── Fetch loop ─────────────────────────────────────────────────────────────
async function fetchPuzzlesForLevel(cfg) {
  const results = [];
  const seen = new Set();
  let attempts = 0;

  while (results.length < cfg.count && attempts < 50) {
    attempts++;
    try {
      const res = await fetch(
        `https://lichess.org/api/puzzle/next?angle=${cfg.theme}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) { await sleep(600); continue; }

      const data = await res.json();
      const { puzzle, game } = data;
      if (!puzzle || !game) continue;
      if (seen.has(puzzle.id)) { await sleep(200); continue; }
      seen.add(puzzle.id);

      // Build FEN shown to player (position AFTER opponent's last move)
      // puzzle.fen is present on some responses; otherwise compute from PGN.
      const fen = puzzle.fen ?? fenFromPgn(game.pgn);

      // Filter out noise themes
      const SKIP = new Set(['oneMove', 'short', 'long', 'opening', 'middlegame', 'endgame']);
      const themes = (puzzle.themes ?? []).filter(t => !SKIP.has(t));

      results.push({
        id:       puzzle.id,
        fen,
        solution: puzzle.solution,   // UCI alternating: [player, opp, player, ...]
        themes,
        rating:   puzzle.rating,
      });

      process.stderr.write(
        `  L${cfg.id}: ${puzzle.id} rating=${puzzle.rating} moves=${puzzle.solution.length} ✓\n`
      );
    } catch (e) {
      process.stderr.write(`  Error: ${e.message}\n`);
    }

    await sleep(350); // ~3 req/s — polite to Lichess
  }

  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const levels = [];

  for (const cfg of LEVEL_CONFIGS) {
    process.stderr.write(`\n▶ Level ${cfg.id} — ${cfg.title} (${cfg.theme})\n`);
    const puzzles = await fetchPuzzlesForLevel(cfg);
    levels.push({ ...cfg, puzzles });
  }

  // ── Output TypeScript ──────────────────────────────────────────────────
  const ts = `/**
 * Puzzle curriculum — 10 livelli sequenziali.
 * Puzzles reali da Lichess Open Puzzle Database (https://database.lichess.org/).
 *
 * Ogni livello contiene ${LEVEL_CONFIGS[0].count} puzzle del tema corrispondente.
 * In ogni puzzle \`solution\` = mosse UCI alternate giocatore/avversario/giocatore...
 *
 * Generato automaticamente con:
 *   node frontend/scripts/fetch_puzzles.mjs > frontend/src/lib/chess/puzzles.ts
 */

export interface LichessPuzzle {
    /** ID Lichess del puzzle */
    id:       string;
    /** FEN della posizione mostrata al giocatore (dopo l'ultima mossa avversaria) */
    fen:      string;
    /** Mosse UCI alternanti: [mossa_giocatore, risposta_avversario, mossa_giocatore, ...] */
    solution: string[];
    themes:   string[];
    rating:   number;
}

export interface PuzzleLevel {
    id:         number;
    title:      string;
    subtitle:   string;
    icon:       string;
    difficulty: 1 | 2 | 3;
    theme:      string;
    puzzles:    LichessPuzzle[];
}

export const PUZZLE_LEVELS: PuzzleLevel[] = ${JSON.stringify(levels, null, 2)};

export function getPuzzleLevel(id: number): PuzzleLevel | undefined {
    return PUZZLE_LEVELS.find(l => l.id === id);
}

export const TOTAL_LEVELS = PUZZLE_LEVELS.length;
`;

  process.stdout.write(ts);
  process.stderr.write(`\n✓ Done — ${levels.length} levels, ${levels.reduce((a,l) => a + l.puzzles.length, 0)} puzzles total.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
