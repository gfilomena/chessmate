package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

// ── Player Profiles Database ───────────────────────────────────────────────────

var (
	profilesDB   *sql.DB
	profilesOnce sync.Once
)

func getProfilesDB() *sql.DB {
	profilesOnce.Do(func() {
		paths := []string{
			os.Getenv("PROFILES_DB_PATH"),
			"player_profiles.db",
			filepath.Join(os.Getenv("HOME"), "player_profiles.db"),
			"/data/player_profiles.db",
		}
		for _, p := range paths {
			if p == "" {
				continue
			}
			if _, err := os.Stat(p); err == nil {
				db, err := sql.Open("sqlite", p+"?mode=ro&cache=shared&_journal_mode=WAL")
				if err != nil {
					log.Printf("profiles.db: errore apertura %s: %v", p, err)
					continue
				}
				db.SetMaxOpenConns(8)
				profilesDB = db
				log.Printf("Player Profiles DB caricato: %s", p)
				return
			}
		}
		log.Println("Player Profiles DB non trovato — bot useranno fallback Stockfish")
	})
	return profilesDB
}

// ── Types ──────────────────────────────────────────────────────────────────────

type MoveOption struct {
	UCI            string  `json:"uci"`
	Classification string  `json:"classification"`
	Probability    float64 `json:"probability"`
	EvalDelta      int     `json:"eval_delta"`
	Frequency      int     `json:"frequency"`
}

type PlayerProfileResponse struct {
	Moves        []MoveOption `json:"moves"`
	BotProfile   *BotProfile  `json:"bot_profile,omitempty"`
	Source       string       `json:"source"` // 'database', 'stockfish_profile'
	Elo          int          `json:"elo"`
}

type BotProfile struct {
	BestPct        float64 `json:"best_pct"`
	ExcellentPct   float64 `json:"excellent_pct"`
	GoodPct        float64 `json:"good_pct"`
	InaccuracyPct  float64 `json:"inaccuracy_pct"`
	MistakePct     float64 `json:"mistake_pct"`
	BlunderPct     float64 `json:"blunder_pct"`
}

// ── ELO Band Mapping ───────────────────────────────────────────────────────────

func eloBandFromElo(elo int) int {
	if elo < 700 {
		return 1
	}
	if elo < 1000 {
		return 2
	}
	if elo < 1300 {
		return 3
	}
	if elo < 1600 {
		return 4
	}
	if elo < 1900 {
		return 5
	}
	return 6
}

// ── API Handler ────────────────────────────────────────────────────────────────

// GET /api/player-profile?fen=<FEN>&elo=<ELO>
//
// Ritorna mosse realistiche per un giocatore a quel livello ELO.
// Se la posizione è nel database player_profiles, usa i dati reali.
// Altrimenti, torna un profilo di errore calibrato per quel livello.
func HandlePlayerProfile(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")

	// Valida parametri
	fen := r.URL.Query().Get("fen")
	eloStr := r.URL.Query().Get("elo")

	if fen == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "fen richiesto"})
		return
	}

	elo, err := strconv.Atoi(eloStr)
	if err != nil || elo < 0 || elo > 3000 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "elo non valido"})
		return
	}

	band := eloBandFromElo(elo)

	db := getProfilesDB()
	if db == nil {
		// DB non disponibile - return profilo calcolato
		resp := PlayerProfileResponse{
			Moves:  []MoveOption{},
			Elo:    elo,
			Source: "none",
		}
		json.NewEncoder(w).Encode(resp)
		return
	}

	// Cerca mosse per questa posizione e ELO band
	normFen := normFEN(fen)
	posHash := hashPosition(normFen)

	moves, err := queryMovesForPosition(db, posHash, band)
	if err != nil {
		log.Printf("profiles query error: %v", err)
		json.NewEncoder(w).Encode(PlayerProfileResponse{Moves: []MoveOption{}, Elo: elo})
		return
	}

	// Se trovate mosse - ritorna direttamente
	if len(moves) > 0 {
		json.NewEncoder(w).Encode(PlayerProfileResponse{
			Moves:  moves,
			Elo:    elo,
			Source: "database",
		})
		return
	}

	// Se non trovate - ritorna profilo di errore per il livello
	profile, err := getProfileForBand(db, band)
	if err != nil || profile == nil {
		json.NewEncoder(w).Encode(PlayerProfileResponse{Moves: []MoveOption{}, Elo: elo})
		return
	}

	json.NewEncoder(w).Encode(PlayerProfileResponse{
		Moves:      []MoveOption{},
		BotProfile: profile,
		Elo:        elo,
		Source:     "stockfish_profile",
	})
}

// ── Database Queries ───────────────────────────────────────────────────────────

func hashPosition(fen string) int64 {
	// Hash stabile dalla posizione (ignora move counters)
	h := int64(0)
	for i, c := range fen {
		h = h*31 + int64(c) + int64(i)
	}
	return h
}

func queryMovesForPosition(db *sql.DB, posHash int64, band int) ([]MoveOption, error) {
	rows, err := db.QueryContext(
		nil,
		`SELECT move_uci, classification, eval_delta, frequency
		 FROM analyzed_moves
		 WHERE position_hash = ? AND elo_band = ?
		 ORDER BY frequency DESC
		 LIMIT 10`,
		posHash, band,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var moves []MoveOption
	totalFreq := 0

	for rows.Next() {
		var m MoveOption
		if err := rows.Scan(&m.UCI, &m.Classification, &m.EvalDelta, &m.Frequency); err != nil {
			continue
		}
		totalFreq += m.Frequency
		moves = append(moves, m)
	}

	// Normalizza frequenze a probabilità
	if totalFreq > 0 {
		for i := range moves {
			moves[i].Probability = float64(moves[i].Frequency) / float64(totalFreq)
		}
	}

	return moves, nil
}

func getProfileForBand(db *sql.DB, band int) (*BotProfile, error) {
	var profile BotProfile

	err := db.QueryRow(
		`SELECT best_pct, excellent_pct, good_pct, inaccuracy_pct, mistake_pct, blunder_pct
		 FROM move_profiles
		 WHERE elo_band = ?`,
		band,
	).Scan(
		&profile.BestPct,
		&profile.ExcellentPct,
		&profile.GoodPct,
		&profile.InaccuracyPct,
		&profile.MistakePct,
		&profile.BlunderPct,
	)

	if err != nil {
		return nil, err
	}

	return &profile, nil
}

// ── Move Generation from Profile ───────────────────────────────────────────────

// GenerateMoveFromProfile genera una mossa classificata in base al profilo.
// Usato quando: non abbiamo dati reali, ma sappiamo come gioca questo livello.
//
// Esempio: Se il profilo dice "70% best move, 20% buone, 10% errori",
// generiamo un numero casuale e scegliamo una mossa di quella categoria.
func GenerateMoveFromProfile(
	profile *BotProfile,
	bestMove string,
	otherMoves []string,
) string {
	if profile == nil {
		if bestMove != "" {
			return bestMove
		}
		if len(otherMoves) > 0 {
			return otherMoves[rand.Intn(len(otherMoves))]
		}
		return ""
	}

	// Genera numero 0-100
	roll := rand.Float64() * 100

	// Decidi classificazione della mossa
	var targetClassification string
	cumulative := 0.0

	classifications := []struct {
		name string
		pct  float64
	}{
		{"best", profile.BestPct},
		{"excellent", profile.ExcellentPct},
		{"good", profile.GoodPct},
		{"inaccuracy", profile.InaccuracyPct},
		{"mistake", profile.MistakePct},
		{"blunder", profile.BlunderPct},
	}

	for _, c := range classifications {
		cumulative += c.pct
		if roll <= cumulative {
			targetClassification = c.name
			break
		}
	}

	// Se dovrebbe giocare best move
	if targetClassification == "best" && bestMove != "" {
		return bestMove
	}

	// Altrimenti gioca una mossa "peggiore" casuale
	// In realtà, dovremmo avere eval_delta per questa posizione
	// Per ora, restituiamo una mossa casuale non-best
	if len(otherMoves) > 0 {
		return otherMoves[rand.Intn(len(otherMoves))]
	}

	return bestMove
}

// ── Helpers ────────────────────────────────────────────────────────────────────

func normFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 4 {
		return strings.Join(parts[:4], " ")
	}
	return fen
}
