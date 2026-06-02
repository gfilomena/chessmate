# Skill: deploy

Esegui il deploy dell'app chess-clone su Render e monitora finché la nuova versione è live.

## Procedura

### 1. Controlla lo stato git

```bash
git -C /Users/giuseppefilomena/projects/chess-clone status --short
git -C /Users/giuseppefilomena/projects/chess-clone diff --stat
```

Se ci sono modifiche non committate, esegui commit autonomo con messaggio descrittivo (segui le istruzioni globali per i commit). Non chiedere conferma per operazioni ordinarie.

### 2. Leggi la versione attuale in produzione

```bash
CURRENT=$(curl -s https://chess-clone-jh6s.onrender.com/_app/version.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null)
echo "Versione attuale: $CURRENT"
```

### 3. Push su GitHub (triggera auto-deploy Render)

```bash
git -C /Users/giuseppefilomena/projects/chess-clone push origin main
```

### 4. Monitora il deploy — poll ogni 20 secondi, max 10 minuti

```bash
CURRENT=$(curl -s https://chess-clone-jh6s.onrender.com/_app/version.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null)
ELAPSED=0
MAX=600
INTERVAL=20

echo "⏳ Deploy in corso… (versione attuale: $CURRENT)"

while [ $ELAPSED -lt $MAX ]; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
  NEW=$(curl -s https://chess-clone-jh6s.onrender.com/_app/version.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null)
  if [ -n "$NEW" ] && [ "$NEW" != "$CURRENT" ]; then
    DATE=$(python3 -c "import datetime; ts=int('$NEW')/1000; print(datetime.datetime.fromtimestamp(ts).strftime('%d/%m/%y %H:%M'))" 2>/dev/null)
    echo ""
    echo "✅ Deploy live — versione $NEW · $DATE"
    exit 0
  fi
  echo "   … ancora in build (${ELAPSED}s)"
done

echo ""
echo "⚠️  Timeout dopo ${MAX}s — verifica manualmente su https://dashboard.render.com"
```

### 5. Mostra commit deployato

```bash
git -C /Users/giuseppefilomena/projects/chess-clone log -1 --oneline
```

## Note

- Il progetto usa Render.com con Dockerfile multi-stage (SvelteKit + Go).
- Il build dura circa 3–6 minuti con cache Docker su Render.
- La versione è il timestamp del build SvelteKit — cambia ad ogni nuovo deploy.
- URL produzione: https://chess-clone-jh6s.onrender.com
- Se il push fallisce per divergenze, segnala e fermati — non usare --force su main.
