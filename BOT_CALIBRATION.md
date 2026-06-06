# Bot Calibration System

Complete guide to the 3-tier bot move selection strategy using real Lichess data, random moves, and Stockfish engine analysis.

## Overview

The bot system uses a **cascading strategy** to select moves, combining real human gameplay with controlled randomness and engine analysis:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOT MOVE SELECTION                            │
├─────────────────────────────────────────────────────────────────┤
│ Level 1: Opening Database (Ply 0-39, ~20 moves)                 │
│   ↓ Real human moves from Lichess dataset, filtered by ELO band  │
│   └─ If found: Use weighted sample, otherwise fall through       │
│                                                                   │
│ Level 2: Random Moves (Weak bots only, ELO < 1320)              │
│   ↓ Probability: randomChance (0.75 → 0.00)                     │
│   └─ If triggered: Play random legal move, otherwise fall through│
│                                                                   │
│ Level 3: Stockfish (Always available)                           │
│   ↓ Weak bots: movetime only (50-300ms)                         │
│   ↓ Strong bots: UCI_LimitStrength + movetime (800-1500ms)      │
│   └─ Final fallback, always produces a move                      │
└─────────────────────────────────────────────────────────────────┘
```

## Bot Roster

| Bot | ELO | Band | Strength | randomChance | movetime | useElo | Style |
|-----|-----|------|----------|--------------|----------|--------|-------|
| **Matteo** | 400 | 1 | ★☆☆☆☆ | 75% | 80ms | ❌ | Blunders often |
| **Sofia** | 650 | 1 | ★★☆☆☆ | 50% | 120ms | ❌ | Occasional blunders |
| **Luca** | 900 | 2 | ★★☆☆☆ | 20% | 200ms | ❌ | Rare blunders |
| **Giulia** | 1150 | 3 | ★★★☆☆ | 5% | 300ms | ❌ | Very solid |
| **Marco** | 1400 | 4 | ★★★☆☆ | 0% | 800ms | ✅ | Consistent engine |
| **Elena** | 1650 | 5 | ★★★★☆ | 0% | 1000ms | ✅ | Strong |
| **Riccardo** | 1950 | 6 | ★★★★☆ | 0% | 1200ms | ✅ | Master |
| **Magnus** | 2500 | 7 | ★★★★★ | 0% | 1500ms | ✅ | Grandmaster |

### ELO Band Definitions

The system groups bots into 6 ELO bands for opening database queries:

| Band | Range | Players |
|------|-------|---------|
| 1 | 0-700 | Matteo, Sofia |
| 2 | 700-1000 | Luca |
| 3 | 1000-1300 | Giulia |
| 4 | 1300-1600 | Marco |
| 5 | 1600-1900 | Elena |
| 6 | 1900+ | Riccardo, Magnus |

## Setup & Deployment

### 1. Build Opening Database Locally

```bash
cd chessmate
pip install python-chess zstandard
python tools/build_opening_db.py \
  --input lichess_db_standard_rated_2024-01.pgn.zst \
  --output opening.db
```

**Download Lichess PGN:**
- Visit https://database.lichess.org/
- Download **Standard Rated** (latest month recommended)
- File format: `lichess_db_standard_rated_YYYY-MM.pgn.zst`
- Size: ~15-30GB compressed, ~200-600MB after processing

**Processing takes:**
- 30-90 minutes depending on month and system
- Expect output: 200-600MB SQLite file
- Progress printed every 25,000 games

### 2. Deploy to Railway Volume

```bash
# 1. Upload opening.db to Railway volume
railway volume up opening.db /data/opening.db

# 2. Verify it's in place
railway ssh
ls -lh /data/opening.db

# 3. Restart service
railway deploy
```

The server will auto-detect `/data/opening.db` on startup:
```
Opening DB caricato: /data/opening.db
```

### 3. Fallback Paths

If `/data/opening.db` not found, server tries:
1. `OPENING_DB_PATH` environment variable
2. `./opening.db` (current dir)
3. `~/opening.db` (home dir)
4. `/data/opening.db` (Railway volume)

If none found: bots fall back to pure Stockfish (all levels)

## Configuration

### Environment Variables

```bash
# Optional: explicit path to opening.db
OPENING_DB_PATH=/path/to/opening.db
```

### Build Options

Adjust these in `tools/build_opening_db.py`:

```python
MAX_PLY    = 40       # Analyze first 20 moves (40 half-moves)
MIN_COUNT  = 5        # Ignore moves played <5 times in ELO band
BATCH_SIZE = 50_000   # Commit frequency (larger = faster, more RAM)
```

## API Endpoint

### GET /api/opening

Returns real human moves for a position + ELO band.

**Parameters:**
- `fen` (required): Current position FEN (any format)
- `band` (required): ELO band 1-6

**Response:**
```json
{
  "moves": [
    { "uci": "e2e4", "weight": 0.45, "count": 1250 },
    { "uci": "d2d4", "weight": 0.32, "count": 880 },
    { "uci": "c2c4", "weight": 0.23, "count": 630 }
  ]
}
```

- `uci`: Move in UCI format (e.g., "e2e4")
- `weight`: Proportion (0-1) relative to all moves in this position
- `count`: Total times played in this position + ELO band

**Errors:**
- `400 Bad Request`: Missing/invalid `fen` or `band`
- `200 OK` with empty moves: Opening.db unavailable (falls back to Stockfish)

**Example:**
```bash
curl "http://localhost:8080/api/opening?fen=rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20e3&band=3"
```

## Testing

### Backend Tests

```bash
cd backend
go test ./internal/api -v -run TestOpening
```

Tests cover:
- FEN normalization (stripping move counters)
- Parameter validation
- Cache control headers
- Graceful degradation when DB unavailable

### Frontend E2E Tests

```bash
cd frontend
# Full suite
npx playwright test tests/bot-opening-strategy.spec.ts

# Single test
npx playwright test tests/bot-opening-strategy.spec.ts -g "uses opening database"

# Headed (see browser)
npx playwright test tests/bot-opening-strategy.spec.ts --headed --workers=1
```

**Test scenarios:**
1. **Opening Database Usage**: Verifies moves 1-20 come from real data
2. **Random Blunders**: Weak bots occasionally make random moves
3. **UCI_LimitStrength**: Strong bots use native ELO calibration
4. **ELO Band Mapping**: Correct band assignment for each bot
5. **Stockfish Fallback**: Works when opening DB unavailable

### Running All Tests

```bash
# Backend + Frontend
make test

# Just bot tests
make test-bot
```

## Architecture

### Files

```
chessmate/
├── backend/
│   ├── internal/api/
│   │   ├── opening.go          # API endpoint & DB management
│   │   ├── opening_test.go     # Backend tests
│   │   └── router.go           # Register GET /api/opening
│   └── go.mod                  # modernc.org/sqlite (pure Go)
│
├── frontend/
│   ├── src/lib/chess/
│   │   ├── opening.ts          # API client + eloBand mapping
│   │   └── stockfish.ts        # getBotMove with ELO calibration
│   ├── src/routes/play/bot/
│   │   └── +page.svelte        # 3-tier move selection logic
│   └── tests/
│       ├── bot-opening-strategy.spec.ts  # E2E tests
│       └── bot-game.spec.ts              # Multiplayer tests
│
└── tools/
    └── build_opening_db.py     # Lichess PGN → SQLite
```

### Data Flow

**During Bot Move:**

```
triggerBotMove() [+page.svelte]
  ↓
  Check ply < 40 (opening phase)?
  ├─ YES → getOpeningMoves(fen, band) [opening.ts]
  │         ↓
  │         GET /api/opening [opening.go]
  │         ↓
  │         SQLite query: SELECT uci, cnt WHERE norm_fen=? AND elo_band=?
  │         ↓
  │         Return weighted moves
  │
  ├─ Move found? Use sampleMove() (weighted random)
  │
  └─ NO move → Check randomChance?
              ├─ YES (weak bot) → Pick random legal move
              │
              └─ NO → getBotMove(fen, elo, movetime, useElo)
                      ↓
                      Stockfish analysis
                      ↓
                      Return best move
```

### Database Schema

```sql
CREATE TABLE opening_moves (
    norm_fen TEXT NOT NULL,      -- FEN without move counters
    elo_band INTEGER NOT NULL,   -- Band 1-6
    uci TEXT NOT NULL,           -- Move: "e2e4"
    cnt INTEGER NOT NULL,        -- Frequency in dataset
    PRIMARY KEY (norm_fen, elo_band, uci)
);

CREATE INDEX idx_fen_elo ON opening_moves(norm_fen, elo_band);
```

**Statistics (typical month of Lichess games):**
- Total games processed: ~100,000+
- Moves stored: 500,000 - 2,000,000
- Database size: 200-600MB
- Avg queries/game: 5-10
- Query latency: <1ms (indexed)

## Tuning & Calibration

### Adjusting Difficulty

**For weaker bots (add mistakes):**
```typescript
{ id: 'matteo', elo: 400, randomChance: 0.75, ... }  // Increase randomChance
```

**For stronger bots (add depth):**
```typescript
{ id: 'riccardo', elo: 1950, movetime: 1500, useElo: true, ... }  // Increase movetime
```

### Monitoring Difficulty

Track win rates in production:
```
Player win % vs bot:
- Matteo:   75-85% (should be high)
- Sofia:    60-70%
- Luca:     40-50%
- Giulia:   30-40%
- Marco:    20-30%
- Elena:    10-20%
- Riccardo: <5%
- Magnus:   <1%
```

If win rates are off, adjust `movetime` or `randomChance`.

### Updating Opening Data

To use newer Lichess data:

```bash
# 1. Download latest month
wget https://database.lichess.org/lichess_db_standard_rated_2024-06.pgn.zst

# 2. Rebuild database (same command as setup)
python tools/build_opening_db.py --input lichess_db_standard_rated_2024-06.pgn.zst

# 3. Redeploy to Railway
railway volume up opening.db /data/opening.db
railway deploy
```

Can be done monthly without code changes.

## Troubleshooting

### "Opening DB non trovato" (Not Found)

Bot still works but uses pure Stockfish. To fix:
1. Verify `opening.db` exists on Railway volume: `railway ssh && ls -la /data/`
2. Check server logs: `railway logs -f`
3. Verify path in `opening.go` matches actual location

### Query Timeout / Slow Bots

Opening API has 1.5s timeout. If bots slow:
1. Check Railway CPU/Memory: `railway logs --resource`
2. Reduce `MAX_PLY` in `build_opening_db.py` to skip deep positions
3. Add `PRAGMA cache_size` to opening.go for larger cache

### Inconsistent Bot Strength

Check `movetime` values match your Stockfish version:
- Newer Stockfish (15+): May need higher `movetime`
- Older Stockfish (12-): May need lower `movetime`

Test with: `./stockfish << EOF` and `perft 5` on sample positions.

## Performance Metrics

Typical stats with modern Lichess dataset:

| Metric | Value |
|--------|-------|
| Database size | 250-600MB |
| Build time | 30-120 min |
| Avg query time | 0.5-1ms |
| Queries/game | 5-10 |
| Cache hit ratio | 85-95% |
| Opening phase coverage | 95%+ (moves 1-20) |
| Fallback frequency | <5% (all-in opening) |

## References

- **Lichess Database**: https://database.lichess.org/
- **Stockfish Documentation**: https://github.com/official-stockfish/Stockfish/wiki
- **UCI Protocol**: http://wbec-ridderkerk.nl/html/UCIProtocol.html
- **Python-chess**: https://python-chess.readthedocs.io/

## Future Improvements

1. **Cache opening DB in memory** - Fast queries but requires 500MB+ RAM
2. **Endgame tablebases** - Add 6-piece EGTB for ply > 50
3. **Learning system** - Track player mistakes and adjust difficulty
4. **Multi-variant support** - Bullet/Blitz dataset variants
5. **A/B testing** - Compare bot difficulties with production metrics
