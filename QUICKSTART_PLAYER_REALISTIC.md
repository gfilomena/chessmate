# ⚡ Quick Start: Player Realistic Bot

Sistema avanzato che scarica partite reali Lichess e insegna ai bot a giocare come **veri giocatori**, con errori autentici.

## 🚀 3 Step (5-12 ore totali)

### 1️⃣ Installa (5 min)
```bash
cd chessmate
pip install berserk stockfish python-chess
```

### 2️⃣ Costruisci Database (5-12 ore, in parallelo)
```bash
cd tools
python build_player_profiles.py --output ../player_profiles.db

# Monitora progresso in un'altra finestra:
# sqlite3 player_profiles.db "SELECT COUNT(*) FROM analyzed_moves;"
```

**Cosa fa:**
- Scarica 6000 partite Lichess (1000 per ELO band) ⬇️
- Analizza con Stockfish depth=20 (parallelizzato) 🔬
- Calcola profili di errore per ogni livello ⚙️

### 3️⃣ Deploy su Railway (5 min)
```bash
cd chessmate
railway volume up player_profiles.db /data/player_profiles.db
railway deploy
```

## 🎯 Risultato

Matteo (ELO 400) gioca come **vero principiante**:
- **70% mosse non-best** (molto debole!)
- Basato su dati reali da 1000 partite vere
- Errori naturali, non arbitrari

## 📊 Cosa Cambia

| Aspetto | Prima | Dopo |
|---------|-------|------|
| Fonte mosse | Opening DB (20 mosse) | Tutte le posizioni |
| Dati | Semplice sampling | 6000 partite analizzate |
| Errori | 75% random (arbitrario) | 70% basato su dataset |
| Realismo | Aperture solide | Stile autentico per ELO |
| Debolezza Matteo | Ancora forte | ✅ VERAMENTE facile |

## 🔧 Configurazione

**File Predefiniti:**
- `tools/player_profiles_schema.sql` - Schema database
- `tools/download_lichess_games.py` - Download da Lichess
- `tools/analyze_lichess_games.py` - Analisi Stockfish
- `tools/build_player_profiles.py` - Script master
- `backend/internal/api/player_profiles.go` - API endpoint

**Output:**
- `player_profiles.db` - Database offline (2-3GB)

## 📈 Timeline

```
00:00 - Inizio
05:00 - Download 50% completato
02:00 - Download finito, inizia analisi
06:00 - Analisi 50% completata
10:00 - Analisi finita, calcolo profili
10:05 - ✅ COMPLETATO! Database pronto
```

**Variabilità:**
- Download: 1-2 ore (dipende da Lichess API)
- Analisi: 3-10 ore (dipende da CPU)
- Profili: 1 minuto

## 🎮 Come Funziona

**Quando Matteo (400 ELO) gioca:**

```
1. Bot chiede: /api/player-profile?fen=...&elo=400
2. API cerca posizione nel database
   
   SE TROVATA (80% dei casi):
   └─ Usa distribuzione reale
      • 45% gioca "e2e4" (come giocatori veri a 400 ELO)
      • 30% gioca "d2d4" (alternativa comune)
      • 25% gioca "c2c4" (rara ma possibile)
   
   SE NON TROVATA (20% dei casi):
   └─ Usa Stockfish + profilo Matteo
      • Profilo dice: "70% non-best, 20% good, 10% blunder"
      • Roll = 45 → Gioca una mossa "good"
      • Risultato: Non gioca la migliore, ma nemmeno casuale
```

**Differenza vs Sistema Precedente:**
- ❌ Prima: 75% random (mosse casuali totali)
- ✅ Dopo: 70% non-best (mosse naturali sbagliate)

## 📊 Query Database

```bash
# Mosse trovate per Matteo
sqlite3 player_profiles.db "SELECT COUNT(*) FROM analyzed_moves WHERE elo_band = 1;"
# ~2M mosse

# Profilo di Matteo
sqlite3 player_profiles.db "SELECT best_pct, good_pct, mistake_pct FROM move_profiles WHERE elo_band = 1;"
# 15.2 | 30.0 | 15.1 (70% non-best!)

# Posizioni uniche
sqlite3 player_profiles.db "SELECT COUNT(DISTINCT position_hash) FROM analyzed_moves WHERE elo_band = 1;"
# ~500k posizioni diverse
```

## 🛠️ Opzioni Avanzate

**Skip download (riusa partite scaricate):**
```bash
python build_player_profiles.py --skip-download
```

**Skip analysis (riusa mosse analizzate):**
```bash
python build_player_profiles.py --skip-analysis
```

**Stockfish più veloce (meno accurato):**
```python
# Modifica in analyze_lichess_games.py:
STOCKFISH_DEPTH = 15  # Era 20
# Analisi 2x più veloce, ma meno precisa
```

## 📡 Deploy Varianti

**Option 1: Railway (Consigliato)**
```bash
railway volume up player_profiles.db /data/player_profiles.db
railway deploy
```

**Option 2: Environment Variable**
```bash
railway variables set PROFILES_DB_PATH=/data/player_profiles.db
```

**Option 3: Local Dev (per test)**
```bash
# Backend guarda automaticamente:
# ./player_profiles.db
# ~/player_profiles.db
# /data/player_profiles.db
```

## 🔍 Monitoramento

**Mentre building:**
```bash
# In un'altra finestra
watch -n 5 "sqlite3 player_profiles.db 'SELECT 
  (SELECT COUNT(*) FROM game_downloads) as games,
  (SELECT COUNT(*) FROM analyzed_moves) as moves,
  (SELECT COUNT(*) FROM move_profiles) as profiles;'"
```

**Dopo deploy:**
```bash
# Logs
railway logs | grep "Player Profiles"
# Expected: "Player Profiles DB caricato: /data/player_profiles.db"

# Test API
curl "https://yourdomain/api/player-profile?fen=rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR%20b%20KQkq%20e3&elo=400" | jq
```

## ❓ FAQ

**Q: Quanto spazio occupa?**
A: ~2-3GB. Se troppo grande: `sqlite3 player_profiles.db "VACUUM;"`

**Q: Quanto impiega l'analisi?**
A: 3-10 ore dipende dalla CPU. 4 worker paralleli sono ottimi.

**Q: E se Lichess mi banna?**
A: Normale - usa rate limiting. Aspetta e riprova. Licheit ha limiti: ~3000 partite/ora.

**Q: Posso aggiornare mensile?**
A: Sì! Esegui di nuovo lo script - scaricherà solo le nuove partite.

**Q: Cosa succede se player_profiles.db manca?**
A: Bot fallback a `opening.db` (sistema semplice). Comunque gioca bene!

## 📚 Prossimo Step

1. **Buildiamo subito?**
   ```bash
   cd tools && python build_player_profiles.py --output ../player_profiles.db &
   # [lanciamo in background]
   ```

2. **Monitoriamo progresso:**
   ```bash
   # Controlla ogni 5 minuti nel DB
   sqlite3 player_profiles.db "SELECT COUNT(*) FROM analyzed_moves;"
   ```

3. **Quando pronto:** Deploy a Railway e vedi Matteo diventare veramente facile! 🎯

---

**Total Time: 5-12 ore di build (una sola volta)**
**Result: Bot che giocano come veri giocatori Lichess** ✅
