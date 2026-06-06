#!/bin/bash
# Monitor the player_profiles.db build progress

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          🔄 PLAYER PROFILES BUILD MONITOR                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if build is running
if pgrep -f "build_player_profiles.py" > /dev/null; then
    echo "✅ Build in progress..."
else
    echo "⚠️  Build not running (may have finished)"
fi

echo ""
echo "📊 Log updates:"
tail -20 build.log

echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "📈 Database stats:"
if [ -f player_profiles.db ]; then
    echo "   Games downloaded:"
    sqlite3 player_profiles.db "SELECT elo_band, COUNT(*) as count FROM game_downloads GROUP BY elo_band ORDER BY elo_band;" 2>/dev/null || echo "   (no games yet)"

    echo ""
    echo "   Moves analyzed:"
    sqlite3 player_profiles.db "SELECT COUNT(*) as total FROM analyzed_moves;" 2>/dev/null || echo "   (no moves yet)"

    echo ""
    echo "   Unique positions:"
    sqlite3 player_profiles.db "SELECT COUNT(DISTINCT position_hash) FROM analyzed_moves;" 2>/dev/null || echo "   (no positions)"

    echo ""
    echo "   Move profiles complete:"
    sqlite3 player_profiles.db "SELECT COUNT(*) FROM move_profiles;" 2>/dev/null || echo "   (not yet)"
else
    echo "   Database not yet created"
fi

echo ""
echo "────────────────────────────────────────────────────────────────"
echo ""
echo "💡 Next steps:"
echo "   • Watch full log:  tail -f build.log"
echo "   • Real-time stats: watch -n 5 'sqlite3 player_profiles.db \"SELECT COUNT(*) FROM analyzed_moves;\"'"
echo "   • When done: Deploy to Railway"
echo ""
