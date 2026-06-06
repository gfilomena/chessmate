#!/bin/bash
# Deploy bot calibration system to Railway

set -e

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                  🚀 DEPLOY BOT CALIBRATION TO RAILWAY                     ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check files exist
echo "📁 Verifying files..."
[ -f "opening.db" ] && echo "  ✅ opening.db" || echo "  ❌ opening.db missing"
[ -f "player_profiles.db" ] && echo "  ✅ player_profiles.db" || echo "  ⚠️  player_profiles.db (will be created on deploy)"
echo ""

# Ensure git is clean
echo "📋 Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo "  ⚠️  Uncommitted changes found"
    git status
    echo ""
    read -p "  Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Show deployment plan
echo "📊 Deployment Plan:"
echo "  1. Upload databases to Railway volume /data/"
echo "  2. Deploy backend with new API endpoints"
echo "  3. Frontend uses /api/player-profile and /api/opening"
echo "  4. Bot gameplay: Player Realistic → Opening DB → Stockfish"
echo ""

# Confirm
read -p "Ready to deploy? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo ""
echo "🔄 Starting deployment..."
echo ""

# Check railway login
if ! railway whoami > /dev/null 2>&1; then
    echo "❌ Not logged into Railway. Please run: railway login"
    exit 1
fi

echo "✅ Railway authenticated"
echo ""

# Upload databases
echo "📤 Uploading databases to Railway volume..."
railway volume up opening.db /data/opening.db
echo "  ✅ opening.db uploaded"

if [ -f "player_profiles.db" ]; then
    railway volume up player_profiles.db /data/player_profiles.db
    echo "  ✅ player_profiles.db uploaded"
fi

echo ""
echo "🚀 Deploying backend..."
railway deploy

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "📍 Your bot system is now live:"
echo "  • Opening Database API: /api/opening"
echo "  • Player Profiles API: /api/player-profile"
echo "  • Bot Game Page: /play/bot"
echo ""
echo "🎮 Bots available:"
echo "  • Matteo (400 ELO) - Beginner"
echo "  • Sofia (650 ELO) - Novice"
echo "  • Luca (900 ELO) - Intermediate"
echo "  • Giulia (1150 ELO) - Club"
echo "  • Marco (1400 ELO) - Advanced"
echo "  • Elena (1650 ELO) - Expert"
echo "  • Riccardo (1950 ELO) - Master"
echo "  • Magnus (2500 ELO) - Grandmaster"
echo ""
echo "📊 Check logs:"
echo "  railway logs -f | grep 'Opening DB\|Player Profiles'"
echo ""
echo "📈 Next steps:"
echo "  1. Test the bot game at /play/bot"
echo "  2. When ready, run Lichess download for realistic bots:"
echo "     python3 tools/download_lichess_games.py --output player_profiles.db"
echo "  3. Redeploy when data is ready"
echo ""
