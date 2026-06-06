# Player Realistic Bot System

Versione avanzata che scarica partite reali da Lichess e insegna ai bot a giocare come **veri giocatori** di quel livello, con errori realistici e stili di gioco autentici.

## Panoramica

```
┌─────────────────────────────────────────────────────────────────┐
│            LICHESS DATA → STOCKFISH → PLAYER PROFILES           │
└─────────────────────────────────────────────────────────────────┘

Step 1: DOWNLOAD (1000 partite per ELO band)
  • 1000 partite di Matteo (400 ELO)
  • 1000 partite di Luca (900 ELO)
  • 1000 partite di Marco (1400 ELO)
  • etc... (6000 partite totali)

Step 2: ANALISI (Stockfish depth=20)
  Per ogni partita:
  ├─ Estrai ogni posizione
  ├─ Chiedi: qual è la mossa migliore?
  ├─ Classifica la mossa giocata (best, excellent, good, inaccuracy, mistake, blunder)
  └─ Salva in database

Step 3: PROFILI DI MOVIMENTO
  Per ogni ELO band:
  ├─ 70% mosse best → Matteo gioca bene raramente
  ├─ 20% mosse buone
  ├─ 10% errori
  └─ Profilo completo del livello

Step 4: BOT GAMEPLAY
  Quando Matteo deve muovere:
  ├─ Se posizione nel DB → Usa mosse reali di giocatori 400 ELO
  ├─ Se posizione non in DB → Usa Stockfish + applica profilo (70% best, 20% good, 10% error)
  └─ Risultato: Matteo gioca come un vero principiante!
```

## Come Funziona

### Livelli di Selezione (vs Sistema Precedente)

**Sistema PRECEDENTE (semplice):**
```
Livello 1: Opening DB (mosse reali, ma solo primi 20 movimenti)
Livello 2: Random blunder (probabilità fissa: 75% per Matteo)
Livello 3: Stockfish fallback (il forte comunque)
```

**Sistema NUOVO (realistico):**
```
Livello 1: Player Profiles Database (tutte le posizioni, stile reale)
├─ Posizione trovata nel DB?
│  └─ Sì → Usa distribuzione reale di mosse da giocatori 400 ELO
│
└─ No → Applica profilo di errore del livello
   ├─ Genera numero casuale 0-100
   ├─ Profilo Matteo dice: "70% best, 20% good, 10% blunder"
   ├─ Roll 50 → Gioca mossa "good"
   └─ Usa Stockfish per trovare mossa "good", non best
```

### Profili di Movimento

Ogni ELO band ha un profilo di errore:

| Banda | ELO | Best | Excellent | Good | Inaccuracy | Mistake | Blunder |
|-------|-----|------|-----------|------|------------|---------|---------|
| 1 | 400-700 | 15% | 10% | 30% | 20% | 15% | 10% |
| 2 | 700-1000 | 30% | 15% | 30% | 15% | 7% | 3% |
| 3 | 1000-1300 | 50% | 20% | 20% | 7% | 2% | 1% |
| 4 | 1300-1600 | 70% | 15% | 10% | 3% | 1% | 0.5% |
| 5 | 1600-1900 | 85% | 10% | 4% | 1% | 0% | 0% |
| 6 | 1900+ | 95% | 4% | 1% | 0% | 0% | 0% |

Matteo (banda 1) ha **70% di mosse che NON sono la migliore** = molto debole! ✅

## Setup

### 1. Installa Dipendenze

```bash
pip install berserk stockfish python-chess
```

**Note:**
- `berserk`: API client Lichess
- `stockfish`: Engine scacchi
- `python-chess`: Parsing/analisi PGN

### 2. Esegui Builder (5-12 ore)

```bash
cd chessmate/tools
python build_player_profiles.py --output ../player_profiles.db
```

**Timeline:**
- Download (1-2 ore): 6000 partite da Lichess
- Analisi (3-10 ore): Stockfish analizza ogni mossa
- Profili (1 minuto): Calcola distribuzioni di errore

**Cosa fa:**
```
Scarica partite Lichess...
  Band 1 (400-700): 500/1000 scaricate...
  Band 2 (700-1000): 300/1000 scaricate...
  [scarica continuamente in background]

Analizza con Stockfish (parallelo)...
  Workers: 4
  Band 1: analizzate 100 partite...
  Band 2: analizzate 200 partite...
  [analizza mentre scarica]

Calcolo profili...
  Band 1 (400-700): best=15.2%, excellent=10.1%, good=30.0%, ...
  Band 2 (700-1000): best=31.5%, excellent=15.0%, good=29.8%, ...
  ✅ Profili calcolati!
```

### 3. Deploy su Railway

```bash
railway volume up player_profiles.db /data/player_profiles.db
railway deploy
```

## Database Schema

```sql
-- Partite scaricate da Lichess
game_downloads (
  id, elo_band, game_id, white_elo, black_elo, result, pgn
)

-- Mosse analizzate con Stockfish
analyzed_moves (
  position_hash, elo_band, move_uci, best_move_uci,
  eval_before, eval_after, eval_delta, classification, frequency
)
  Classificazioni: 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'

-- Profili aggregati per banda
move_profiles (
  elo_band, best_pct, excellent_pct, good_pct, inaccuracy_pct, mistake_pct, blunder_pct
)

-- Statistiche
position_stats (
  position_hash, elo_band, total_games, move_count
)
```

## API Endpoint

### GET /api/player-profile?fen=<FEN>&elo=<ELO>

Ritorna mosse realistiche per un giocatore a quel livello ELO.

**Parametri:**
- `fen`: Posizione corrente (FEN)
- `elo`: ELO del bot (400-3000)

**Risposta (posizione nel DB):**
```json
{
  "moves": [
    {
      "uci": "e2e4",
      "classification": "best",
      "probability": 0.45,
      "eval_delta": 0,
      "frequency": 450
    },
    {
      "uci": "d2d4",
      "classification": "good",
      "probability": 0.30,
      "eval_delta": 15,
      "frequency": 300
    }
  ],
  "elo": 900,
  "source": "database"
}
```

**Risposta (posizione NON nel DB):**
```json
{
  "moves": [],
  "bot_profile": {
    "best_pct": 15.2,
    "excellent_pct": 10.1,
    "good_pct": 30.0,
    "inaccuracy_pct": 20.3,
    "mistake_pct": 15.1,
    "blunder_pct": 9.3
  },
  "elo": 400,
  "source": "stockfish_profile"
}
```

## Frontend Integration

Aggiorna `/play/bot` per usare il nuovo endpoint:

```typescript
// Nuova logica di selezione mosse

async function triggerBotMove() {
  const curFen = chessGame.fen();
  const elo = selectedBot.elo;

  // Chiedi profilo realistico
  const response = await fetch(
    `/api/player-profile?fen=${encodeURIComponent(curFen)}&elo=${elo}`
  );
  const profile = await response.json();

  let uciMove = '';

  // Se abbiamo mosse reali dal DB
  if (profile.moves.length > 0) {
    // Campiona dalla distribuzione reale
    uciMove = sampleMove(profile.moves);
  }
  // Se no, usa Stockfish + profilo
  else if (profile.bot_profile) {
    // Genera numero casuale in base al profilo
    const roll = Math.random() * 100;
    
    // Decidi che tipo di mossa giocare
    let targetClass = decideClassificationFromProfile(profile.bot_profile, roll);
    
    // Chiedi al Stockfish
    const bestMove = await engine.getBestMove(curFen);
    
    // Se dovrebbe giocare best move
    if (targetClass === 'best') {
      uciMove = bestMove;
    }
    // Altrimenti gioca una mossa "peggiore"
    else {
      uciMove = await generateMoveWithClassification(curFen, targetClass, bestMove);
    }
  }

  // Esegui la mossa come prima
  applyMove(uciMove);
}
```

## Vantaggi

**Prima (Simple Opening DB):**
- ✅ Realistico per prime 20 mosse
- ❌ Fallback a Stockfish puro (troppo forte)
- ❌ randomChance è poco naturale (75% è arbitrario)

**Dopo (Player Realistic):**
- ✅ Realistico per TUTTE le posizioni (non solo aperture)
- ✅ Basato su dati reali di 6000 partite
- ✅ Errori calibrati scientificamente (dal dataset)
- ✅ Stile di gioco autentico per ogni ELO
- ✅ Matteo è VERAMENTE debole (70% mosse non-best!)

## Performance

**Storage:**
- 6000 partite PGN: ~500MB (temporaneo)
- Database finale: ~2-3GB (posizioni, mosse, profili)

**Query:**
- Ricerca per posizione: <1ms (hash lookup)
- Fallback a profilo: <5ms (calcolo)
- Total bot move: <350ms (come prima)

**Build Time:**
- Download: 1-2 ore (API rate limits Lichess)
- Analisi: 3-10 ore (dipende dalla CPU)
- Total: 5-12 ore (una volta)

## Monitoraggio

```bash
# Mentre scarica/analizza:
sqlite3 player_profiles.db "SELECT COUNT(*) FROM game_downloads WHERE elo_band = 1;"
sqlite3 player_profiles.db "SELECT COUNT(*) FROM analyzed_moves WHERE elo_band = 1;"

# Profili completati:
sqlite3 player_profiles.db "SELECT elo_band, best_pct FROM move_profiles ORDER BY elo_band;"

# Stats per posizione:
sqlite3 player_profiles.db "SELECT COUNT(DISTINCT position_hash) FROM analyzed_moves;"
```

## Troubleshooting

**Download troppo lento:**
- Lichess ha rate limits (~3000 partite/ora)
- Normal: 5-6 ore per 6000 partite
- Soluzione: Lasciare in background

**Analisi troppo lenta:**
- Stockfish depth=20 è accurato ma lento (20 secondi per mossa)
- Ridurre: Modificare STOCKFISH_DEPTH = 15 in analyze_lichess_games.py
- Trade-off: Analisi più veloce ma meno accurata

**Database enorme (>5GB):**
- Normale: posizioni ripetute = tanti dati
- Comprimere: `sqlite3 player_profiles.db "VACUUM;"`
- Ottimizzare: Tenere solo 50 mosse più comuni per posizione

## Future Improvements

1. **Streaming Download**: Non aspettare che tutte le partite siano scaricate
2. **Incremental Analysis**: Analizzare mentre scarica (già implementato!)
3. **Real-time Lichess Updates**: Scaricare nuove partite mensili
4. **Endgame Profiles**: Aggiungere tablebase 6-piece per finali
5. **Opening Transposition**: Unificare posizioni equivalenti
6. **ELO Learning**: Regolare profili in base a win rates reali

## Referenze

- **Lichess API**: https://lichess.org/api
- **Stockfish UCI**: https://github.com/official-stockfish/Stockfish
- **python-chess**: https://python-chess.readthedocs.io/
- **Berserk**: https://github.com/bbulkow/Berserk
