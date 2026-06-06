# Opening Database Setup Guide

Quick reference for building and deploying the opening database.

## Quick Start (5 steps)

### 1. Download Lichess Data

```bash
# Go to https://database.lichess.org/
# Download "Standard Rated" (latest month)
# File: lichess_db_standard_rated_YYYY-MM.pgn.zst (~15-30GB)

cd chessmate
```

### 2. Install Dependencies

```bash
pip install python-chess zstandard
```

### 3. Build Database

```bash
python tools/build_opening_db.py \
  --input lichess_db_standard_rated_2024-01.pgn.zst \
  --output opening.db

# Output:
#   Completato in 45.2 minuti
#   Partite: 1,234,567 elaborate
#   Mosse:   12,345,678
#   ✅ opening.db pronto: opening.db (356.1 MB)
```

### 4. Test Locally

```bash
# Start backend with local opening.db
cp opening.db backend/
cd backend && go run ./cmd/server

# In another terminal, test the API:
curl "http://localhost:8080/api/opening?fen=rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20e3&band=3"

# Should return:
# {"moves":[{"uci":"e5","weight":0.45,"count":1250},...]}
```

### 5. Deploy to Production (Railway)

```bash
# Upload to Railway volume
railway volume up opening.db /data/opening.db

# Or use Railway CLI:
railway variables set OPENING_DB_PATH=/data/opening.db

# Redeploy server
railway deploy

# Verify
railway logs -f | grep "Opening DB"
# Expected: "Opening DB caricato: /data/opening.db"
```

---

## Detailed Instructions

### System Requirements

- **Disk**: 30GB free (for PGN compressed + uncompressed + DB)
- **RAM**: 4GB minimum, 8GB+ recommended
- **Python**: 3.8+
- **Time**: 30-120 minutes (depends on dataset size and CPU)

### Step 1: Download Lichess PGN

```bash
# Download latest month (recommended)
wget https://database.lichess.org/lichess_db_standard_rated_2024-01.pgn.zst

# Or use browser: https://database.lichess.org/
```

**Which file to choose?**
- **Standard Rated**: Most balanced, recommended ✅
- Standard Blitz: Faster games, less data
- Standard Bullet: Too fast, unreliable data
- Antichess, Atomic, etc: Variants, not used

### Step 2: Build Database

```bash
cd chessmate
pip install python-chess zstandard

# Minimal (first 1000 games, for testing)
python tools/build_opening_db.py \
  --input lichess_db_standard_rated_2024-01.pgn.zst \
  --output opening-test.db

# Full (takes 30-120 min)
python tools/build_opening_db.py \
  --input lichess_db_standard_rated_2024-01.pgn.zst \
  --output opening.db
```

**Progress output:**
```
Input:  lichess_db_standard_rated_2024-01.pgn.zst (25000 MB)
Output: opening.db
Prime 20 mosse, min 5 occorrenze

    125,000 partite | 1,250,000 mosse | 835 partite/sec | DB: 25.0MB
    250,000 partite | 2,500,000 mosse | 833 partite/sec | DB: 52.0MB
    375,000 partite | 3,750,000 mosse | 832 partite/sec | DB: 78.0MB
   1,234,567 partite | 12,345,678 mosse | 830 partite/sec | DB: 356.1MB

Completato in 45.2 minuti
  Partite: 1,234,567 elaborate, 0 saltate
  Mosse:   12,345,678

Pulizia righe cnt < 5...
  Rimosse: 234,567 | Rimaste: 2,345,678

Righe per fascia ELO:
  Band 1 (0-700):     123,456 posizioni, 1,234,567 mosse totali
  Band 2 (700-1000):  234,567 posizioni, 2,345,678 mosse totali
  Band 3 (1000-1300): 345,678 posizioni, 3,456,789 mosse totali
  Band 4 (1300-1600): 456,789 posizioni, 4,567,890 mosse totali
  Band 5 (1600-1900): 567,890 posizioni, 5,678,901 mosse totali
  Band 6 (1900+):     678,901 posizioni, 6,789,012 mosse totali

✅ opening.db pronto: opening.db (356.1 MB)
   Carica su Railway Volume: /data/opening.db
```

### Step 3: Local Testing

```bash
# Copy to backend directory
cp opening.db backend/

# Run server
cd backend
go run ./cmd/server

# In another terminal, test API
curl "http://localhost:8080/api/opening?fen=rnbqkbnr%2Fpppppppp%2F8%2F8%2F4P3%2F8%2FPPPP1PPP%2FRNBQKBNR%20b%20KQkq%20e3&band=1"

# Expected 200 OK with moves
```

### Step 4: Deploy to Railway

**Option A: Using Railway CLI**

```bash
railway login
railway link chessmate

# Upload file to volume
railway volume up opening.db /data/opening.db

# Verify upload
railway ssh
ls -lh /data/opening.db
exit

# Deploy
railway deploy
```

**Option B: Using Railway Dashboard**

1. Go to https://railway.app/project/[PROJECT_ID]
2. Select Volume storage
3. Upload `opening.db` to `/data/opening.db`
4. Redeploy service

**Option C: Set as Environment Variable**

```bash
railway variables set OPENING_DB_PATH=/data/opening.db
railway deploy
```

### Step 5: Verify Deployment

```bash
# Check logs
railway logs -f | head -20

# Look for:
# ✅ "Opening DB caricato: /data/opening.db"
# ❌ "Opening DB non trovato — bot useranno fallback Stockfish"

# Test API on production
curl "https://chess.example.com/api/opening?fen=rnbqkbnr%2F...&band=3"
```

---

## Customization

### Tune Database Building

Edit `tools/build_opening_db.py`:

```python
# Include moves beyond move 20 (default: 40 half-moves ≈ 20 moves)
MAX_PLY = 60  # 30 moves

# Keep moves played ≥ 3 times instead of 5
MIN_COUNT = 3

# Larger batch size = faster but more RAM
BATCH_SIZE = 100_000  # default: 50_000
```

Then rebuild:
```bash
python tools/build_opening_db.py --input lichess_db_*.pgn.zst
```

### Filter by ELO Range

Modify `ELO_BANDS` in `build_opening_db.py` to focus on specific skill levels:

```python
# Keep only 1000-1400 (club level)
ELO_BANDS = {
    1: (1000, 1400),
}

# Or split by finer bands
ELO_BANDS = {
    1: (1000, 1100),
    2: (1100, 1200),
    3: (1200, 1300),
    4: (1300, 1400),
}
```

Then update bot tier boundaries in frontend:

```typescript
// frontend/src/routes/play/bot/+page.svelte
if (elo < 1100)  return 1;
if (elo < 1200)  return 2;
if (elo < 1300)  return 3;
if (elo < 1400)  return 4;
return 5;
```

---

## Troubleshooting

### Build Hangs or Crashes

**Memory issues?**
```bash
# Reduce batch size
python tools/build_opening_db.py --input input.pgn.zst \
  --output opening.db
# Then in script, set BATCH_SIZE = 10_000
```

**Disk space?**
```bash
# Check available space
df -h

# Use different drive
python tools/build_opening_db.py --input /input/lichess.pgn.zst \
  --output /path/with/more/space/opening.db
```

### Opening.db Not Found in Production

**Check locations (in order):**
```bash
railway ssh

# 1. Environment variable
echo $OPENING_DB_PATH

# 2. Current directory
ls -la opening.db

# 3. Home directory
ls -la ~/opening.db

# 4. Railway volume
ls -la /data/opening.db

# If missing, upload it
exit
railway volume up opening.db /data/opening.db
railway deploy
```

### API Returns Empty Moves

This is **expected if opening.db not available** — bots fall back to Stockfish.

To verify:
```bash
railway logs | grep -i "opening"

# Should see either:
# ✅ "Opening DB caricato: /data/opening.db"  (DB loaded)
# ℹ️  "Opening DB non trovato..."              (Using fallback)
```

If seeing fallback, redeploy with DB.

### Database Size Too Large

If `/data/opening.db` > 1GB:

**Option 1: Reduce games processed**
```bash
# Extract first N games only
head -c 5GB lichess_db_*.pgn.zst > partial.pgn.zst
python tools/build_opening_db.py --input partial.pgn.zst
```

**Option 2: Increase MIN_COUNT threshold**
```python
MIN_COUNT = 10  # Was: 5
# More aggressive pruning = smaller DB, fewer positions
```

**Option 3: Reduce MAX_PLY**
```python
MAX_PLY = 20  # Was: 40 (10 moves instead of 20)
```

---

## Updates & Maintenance

### Monthly Update (Recommended)

```bash
# 1. Download latest month
wget https://database.lichess.org/lichess_db_standard_rated_2024-02.pgn.zst

# 2. Rebuild
python tools/build_opening_db.py \
  --input lichess_db_standard_rated_2024-02.pgn.zst \
  --output opening.db

# 3. Deploy
railway volume up opening.db /data/opening.db
railway deploy
```

### Check Database Integrity

```bash
python3 << 'EOF'
import sqlite3

db = sqlite3.connect('opening.db')
cursor = db.cursor()

# Count positions
cursor.execute("SELECT COUNT(*) FROM opening_moves")
positions = cursor.fetchone()[0]
print(f"Positions: {positions:,}")

# Count by band
for band in range(1, 7):
    cursor.execute("SELECT COUNT(*) FROM opening_moves WHERE elo_band = ?", (band,))
    count = cursor.fetchone()[0]
    print(f"  Band {band}: {count:,}")

db.close()
EOF
```

---

## References

- **Lichess Database API**: https://database.lichess.org/
- **python-chess docs**: https://python-chess.readthedocs.io/
- **Railway Docs**: https://docs.railway.app/
