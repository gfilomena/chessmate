package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

// ── Opening DB ────────────────────────────────────────────────────────────────

var (
	openingDB   *sql.DB
	openingOnce sync.Once
)

func getOpeningDB() *sql.DB {
	openingOnce.Do(func() {
		paths := []string{
			os.Getenv("OPENING_DB_PATH"),
			"opening.db",
			filepath.Join(os.Getenv("HOME"), "opening.db"),
			"/data/opening.db", // Railway volume mount
		}
		for _, p := range paths {
			if p == "" {
				continue
			}
			if _, err := os.Stat(p); err == nil {
				db, err := sql.Open("sqlite", p+"?mode=ro&cache=shared&_journal_mode=WAL")
				if err != nil {
					log.Printf("opening.db: errore apertura %s: %v", p, err)
					continue
				}
				db.SetMaxOpenConns(8)
				openingDB = db
				log.Printf("Opening DB caricato: %s", p)
				return
			}
		}
		log.Println("Opening DB non trovato — bot useranno fallback Stockfish")
	})
	return openingDB
}

// normFEN riduce il FEN alle prime 4 componenti (posizione, turno, arrocco, en passant)
// ignorando i contatori di mosse che cambiano ad ogni mossa ma non cambiano la posizione.
func normFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 4 {
		return strings.Join(parts[:4], " ")
	}
	return fen
}

// ── Handler ───────────────────────────────────────────────────────────────────

type OpeningMove struct {
	UCI    string  `json:"uci"`
	Weight float64 `json:"weight"`
	Count  int     `json:"count"`
}

type OpeningResponse struct {
	Moves []OpeningMove `json:"moves"`
}

// GET /api/opening?fen=<FEN>&band=<1-6>
//
// fen:  posizione FEN corrente (prime 4 componenti usate)
// band: fascia ELO (1=400-700, 2=700-1000, 3=1000-1300, 4=1300-1600, 5=1600-1900, 6=1900+)
//
// Response: { moves: [{uci, weight, count}] }
// Se non ci sono dati → { moves: [] } (frontend usa fallback Stockfish)
func HandleOpening(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")

	db := getOpeningDB()
	if db == nil {
		json.NewEncoder(w).Encode(OpeningResponse{Moves: []OpeningMove{}})
		return
	}

	fen     := r.URL.Query().Get("fen")
	bandStr := r.URL.Query().Get("band")

	if fen == "" {
		http.Error(w, "fen richiesto", http.StatusBadRequest)
		return
	}
	band, err := strconv.Atoi(bandStr)
	if err != nil || band < 1 || band > 6 {
		http.Error(w, "band non valido (1-6)", http.StatusBadRequest)
		return
	}

	normFen := normFEN(fen)

	rows, err := db.QueryContext(r.Context(),
		`SELECT uci, cnt FROM opening_moves
		 WHERE norm_fen = ? AND elo_band = ?
		 ORDER BY cnt DESC
		 LIMIT 20`,
		normFen, band,
	)
	if err != nil {
		log.Printf("opening query error: %v", err)
		json.NewEncoder(w).Encode(OpeningResponse{Moves: []OpeningMove{}})
		return
	}
	defer rows.Close()

	var moves []OpeningMove
	total := 0
	for rows.Next() {
		var m OpeningMove
		if err := rows.Scan(&m.UCI, &m.Count); err != nil {
			continue
		}
		total += m.Count
		moves = append(moves, m)
	}

	if total > 0 {
		for i := range moves {
			moves[i].Weight = float64(moves[i].Count) / float64(total)
		}
	}

	if moves == nil {
		moves = []OpeningMove{}
	}

	json.NewEncoder(w).Encode(OpeningResponse{Moves: moves})
}
