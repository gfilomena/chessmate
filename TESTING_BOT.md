# Testing Bot Gameplay

Comprehensive guide to testing the bot move selection system with opening database, random moves, and Stockfish calibration.

## Quick Test (5 minutes)

```bash
# 1. Build opening database (or use existing)
python tools/build_opening_db.py --input lichess.pgn.zst

# 2. Start backend with DB
cp opening.db backend/
cd backend && go run ./cmd/server

# 3. In another terminal, start frontend
cd frontend
npm run dev

# 4. Open browser
open http://localhost:5173/play/bot

# 5. Play a game vs any bot, observe:
#    - First 20 moves should feel "human-like"
#    - Weak bots (Matteo, Sofia) should make occasional blunders
#    - Strong bots (Marco+) should play consistently well
```

---

## Testing Strategy

### Level 1: Unit Tests (Backend)

**Test FEN normalization and API validation:**

```bash
cd backend
go test ./internal/api -v -run TestOpening

# Expected output:
# === RUN   TestNormFEN
# === RUN   TestNormFEN/full_FEN_with_move_counters
# --- PASS: TestNormFEN (0.02s)
# === RUN   TestHandleOpeningMissingParams
# --- PASS: TestHandleOpeningMissingParams (0.01s)
# === RUN   TestHandleOpeningNoDB
# --- PASS: TestHandleOpeningNoDB (0.03s)
# PASS    ok  github.com/chessmate/backend/internal/api   0.05s
```

**What's tested:**
- ✅ FEN normalization strips move counters correctly
- ✅ Parameter validation (fen required, band 1-6)
- ✅ Graceful fallback when DB unavailable
- ✅ Cache control headers

### Level 2: Integration Tests (API)

**Test opening database API without browser:**

```bash
# Start backend with test DB
cp opening.db backend/
cd backend && go run ./cmd/server &
sleep 2

# Query API directly
curl -s "http://localhost:8080/api/opening?fen=rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20e3&band=3" | jq .

# Expected: list of moves with weights
# {
#   "moves": [
#     {"uci": "e7e5", "weight": 0.45, "count": 1250},
#     {"uci": "d7d5", "weight": 0.30, "count": 830},
#     ...
#   ]
# }

# Kill background server
pkill -f "go run ./cmd/server"
```

**Test all ELO bands:**

```bash
for band in 1 2 3 4 5 6; do
  echo "=== Band $band ==="
  curl -s "http://localhost:8080/api/opening?fen=rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20e3&band=$band" | jq '.moves | length'
done

# Should return move counts for each band
```

### Level 3: E2E Tests (Browser)

**Test full bot gameplay with opening strategy:**

```bash
# Start both backend and frontend
cd chessmate
npm run dev &
cd backend && go run ./cmd/server &
sleep 3

# Run tests
cd frontend
npx playwright test tests/bot-opening-strategy.spec.ts --headed

# Headed mode shows browser, useful for visual verification
npx playwright test tests/bot-opening-strategy.spec.ts --headed --project chromium
```

**Test scenarios:**

```bash
# 1. Opening database usage
npx playwright test -g "uses opening database"

# 2. Random blunders
npx playwright test -g "weak bots"

# 3. UCI strength
npx playwright test -g "UCI_LimitStrength"

# 4. Band mapping
npx playwright test -g "ELO band"

# 5. Stockfish fallback
npx playwright test -g "fallback"

# All in parallel
npx playwright test tests/bot-opening-strategy.spec.ts
```

### Level 4: Manual Testing

**Play against each bot and observe behavior:**

```bash
# Start dev server
npm run dev

# Navigate to http://localhost:5173/play/bot

# For each bot, play 5-10 moves and note:
# ✓ Move quality in opening (moves 1-20)
# ✓ Presence of occasional blunders (weak bots)
# ✓ Consistent engine play (strong bots)
# ✓ Response to time constraints
```

**Observation checklist:**

| Bot | Test | Expected | ✓ |
|-----|------|----------|---|
| Matteo | First 20 moves | Often random, few coherent | ☐ |
| | Blunders | Frequent obvious mistakes | ☐ |
| | Response time | Very fast (80ms) | ☐ |
| Sofia | First 20 moves | Mix of real + random | ☐ |
| | Blunders | Occasional (~50%) | ☐ |
| | Response time | Fast (120ms) | ☐ |
| Luca | First 20 moves | Mostly real positions | ☐ |
| | Blunders | Rare (~20%) | ☐ |
| | Response time | Normal (200ms) | ☐ |
| Giulia | First 20 moves | All real positions | ☐ |
| | Blunders | Very rare (~5%) | ☐ |
| | Response time | Thoughtful (300ms) | ☐ |
| Marco | First 20 moves | All real positions | ☐ |
| | Moves 20+ | Consistent engine play | ☐ |
| | Blunders | Never | ☐ |
| | Response time | Deliberate (800ms) | ☐ |
| Elena | Strength | Noticeably better than Marco | ☐ |
| | Response time | Longer (1000ms) | ☐ |
| Riccardo | Strength | Master level difficulty | ☐ |
| Magnus | Strength | Nearly impossible to beat | ☐ |

---

## Test Coverage

### Backend (`backend/internal/api/opening_test.go`)

```go
TestNormFEN              // FEN normalization
TestHandleOpeningMissingParams  // Parameter validation
TestHandleOpeningNoDB    // Graceful degradation
```

**Coverage goal:** 100% of error paths

**Run with coverage:**
```bash
go test ./internal/api -cover -v
```

### Frontend (`frontend/tests/bot-opening-strategy.spec.ts`)

```typescript
"uses opening database for moves 1-20"           // Level 1
"weak bots make occasional random blunders"      // Level 2
"strong bots use UCI_LimitStrength"              // Level 3
"bots map to correct ELO bands"                  // Band mapping
"falls back to Stockfish when DB unavailable"    // Fallback
```

**Coverage goal:** All move selection paths

**Run with coverage report:**
```bash
npx playwright test --reporter=html
open playwright-report/index.html
```

---

## Performance Testing

### Query Performance

```bash
# Start server with profiling
cd backend
PPROF_PORT=6060 go run ./cmd/server &

# Simulate 100 opening queries
cd frontend
npm run dev &

# Use load testing tool
npx autocannon http://localhost:8080/api/opening?fen=...&band=1 -c 10 -d 10
```

**Expected metrics:**
- Latency: < 1ms (indexed query)
- Throughput: > 1000 queries/sec
- Cache hit rate: > 90%

### Memory Usage

```bash
# Monitor backend memory
cd backend
go build -o chess-server ./cmd/server
/usr/bin/time -v ./chess-server 2>&1 | grep -E "Maximum resident|Elapsed"

# Expected:
# - Without opening.db: ~10-20MB
# - With opening.db (mmap): ~50-100MB
```

### Database Integrity

```bash
# Verify SQLite index is valid
python3 << 'EOF'
import sqlite3

db = sqlite3.connect('opening.db')
cursor = db.cursor()

# Check index
cursor.execute("PRAGMA index_info(idx_fen_elo)")
print("Index columns:", cursor.fetchall())

# Check constraints
cursor.execute("PRAGMA table_info(opening_moves)")
print("\nTable schema:")
for row in cursor.fetchall():
    print(row)

# Check for duplicates
cursor.execute("""
    SELECT norm_fen, elo_band, uci, COUNT(*) as cnt
    FROM opening_moves
    GROUP BY norm_fen, elo_band, uci
    HAVING COUNT(*) > 1
""")
dups = cursor.fetchall()
print(f"\nDuplicates: {len(dups)}")

db.close()
EOF
```

---

## Debugging Tips

### Enable Logging

**Backend (opening API):**
```go
// In opening.go, add:
log.Printf("Opening query: fen=%s, band=%d", normFen, band)
```

**Frontend (bot logic):**
```typescript
// In +page.svelte, add:
console.log(`Level 1 (opening): ${moves.length} moves found`);
console.log(`Level 2 (random): ${Math.random() < selectedBot.randomChance ? 'triggered' : 'skipped'}`);
console.log(`Level 3 (stockfish): move=${uciMove}`);
```

### Check Opening DB Stats

```python
import sqlite3

db = sqlite3.connect('opening.db')
c = db.cursor()

# How many moves in band 3 (Giulia)?
c.execute("SELECT COUNT(*) FROM opening_moves WHERE elo_band=3")
print(f"Band 3 moves: {c.fetchone()[0]}")

# Most common move at starting position for band 1?
c.execute("""
    SELECT uci, cnt FROM opening_moves
    WHERE norm_fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    AND elo_band=1
    ORDER BY cnt DESC LIMIT 5
""")
print("\nMost played moves (Matteo/Sofia):")
for uci, cnt in c.fetchall():
    print(f"  {uci}: {cnt}")

db.close()
```

### Inspect Move Selection

**Add breakpoints in browser DevTools:**

1. Open DevTools (F12)
2. Go to Sources tab
3. Open `frontend/src/routes/play/bot/+page.svelte`
4. Set breakpoint at `triggerBotMove()`
5. Play a game and step through:
   ```typescript
   if (ply < 40) {
     const moves = await getOpeningMoves(curFen, band);  // Breakpoint here
   }
   ```

**In Network tab:**
- Watch `/api/opening` requests
- Check response time (should be <1ms)
- Verify moves returned

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Bot Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with: { go-version: '1.21' }
      - run: cd backend && go test ./internal/api -v

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '18' }
      - run: cd frontend && npm ci
      - run: npx playwright install
      - run: npm run dev &
      - run: cd backend && go run ./cmd/server &
      - run: sleep 3 && npx playwright test tests/bot-opening-strategy.spec.ts
```

---

## Test Data Management

### Use Minimal Opening DB for Tests

```bash
# Create small test database (first 10,000 games only)
python tools/build_opening_db.py \
  --input lichess_test_sample.pgn.zst \
  --output opening-test.db

# Use for tests
export OPENING_DB_PATH=./opening-test.db
npm run test
```

### Fixture Data

Pre-made FEN positions with known opening moves:

```typescript
const TEST_POSITIONS = {
  startPosition: {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expectedMoves: ['e2e4', 'd2d4', 'c2c4'],  // Common first moves
  },
  afterE4: {
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    expectedMoves: ['e7e5', 'c7c5', 'd7d5'],  // Black responses to e4
  },
};
```

---

## Regression Testing

After code changes, verify:

1. **No new API errors:**
   ```bash
   go test ./internal/api -v
   ```

2. **Bot moves still work:**
   ```bash
   npx playwright test tests/bot-opening-strategy.spec.ts -g "opening database"
   ```

3. **Performance not degraded:**
   ```bash
   # Compare query times before/after
   time curl "http://localhost:8080/api/opening?fen=...&band=3" > /dev/null
   ```

4. **Stockfish fallback still works:**
   ```bash
   # Rename opening.db and run game
   mv opening.db opening.db.bak
   npm run dev
   # Play a game — should work without errors
   mv opening.db.bak opening.db
   ```

---

## Troubleshooting Tests

### Tests Timeout

**Backend:**
```bash
# Increase test timeout
go test ./internal/api -timeout 30s
```

**Frontend:**
```bash
# Increase timeout in playwright.config.ts
timeout: 60 * 1000  // 60 seconds
```

### Tests Flaky

**Common causes:**
1. Network issues — add retry logic
2. Timing issues — increase delays
3. Opening DB missing — provide fallback

**Example fix:**
```typescript
test('bot plays opening moves', async ({ page }) => {
  test.slow();  // Mark as slow test
  
  await expect(page.locator('.move-chip')).toHaveCount(4, {
    timeout: 30_000  // Wait up to 30s
  });
});
```

### Database Locked

```bash
# If "database is locked" error:
# Kill any existing processes
pkill -9 chess-server
pkill -9 go

# Wait a moment
sleep 2

# Retry
go test ./internal/api
```

---

## Best Practices

1. **Always test with opening.db present**
   - Tests the primary path
   - Then test without it for fallback

2. **Use headed mode during development**
   ```bash
   npx playwright test --headed
   ```

3. **Run full test suite before pushing**
   ```bash
   make test  # Runs all tests
   ```

4. **Keep test data small**
   - Use test-specific opening DB
   - Faster iteration

5. **Document test assumptions**
   ```typescript
   // Tests assume:
   // - Backend running on localhost:8080
   // - opening.db present in ./opening.db
   // - Stockfish available in browser
   ```

---

## References

- Go Testing: https://golang.org/cmd/go/#hdr-Test_packages
- Playwright: https://playwright.dev/docs/intro
- SQLite: https://www.sqlite.org/cli.html
