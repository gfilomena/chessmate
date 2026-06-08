package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"chessmate/backend/internal/db"
)

type PuzzlesHandler struct {
	pg *db.Postgres
}

func NewPuzzlesHandler(pg *db.Postgres) *PuzzlesHandler {
	return &PuzzlesHandler{pg: pg}
}

// GET /api/puzzles/progress
// Restituisce i livelli completati dall'utente corrente.
func (h *PuzzlesHandler) GetProgress(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromCookie(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Non autenticato")
		return
	}

	rows, err := h.pg.Pool.Query(r.Context(), `
		SELECT level FROM puzzle_progress
		WHERE user_id = $1
		ORDER BY level ASC
	`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SERVER_ERROR", "Errore interno")
		return
	}
	defer rows.Close()

	completed := []int{}
	for rows.Next() {
		var level int
		if err := rows.Scan(&level); err == nil {
			completed = append(completed, level)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"completed": completed})
}

// POST /api/puzzles/{level}/complete
// Segna un livello come completato (idempotente).
func (h *PuzzlesHandler) MarkComplete(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromCookie(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Non autenticato")
		return
	}

	levelStr := r.PathValue("level")
	level, err := strconv.Atoi(levelStr)
	if err != nil || level < 1 || level > 10 {
		writeError(w, http.StatusBadRequest, "INVALID_LEVEL", "Livello non valido (1-10)")
		return
	}

	_, err = h.pg.Pool.Exec(r.Context(), `
		INSERT INTO puzzle_progress (user_id, level)
		VALUES ($1, $2)
		ON CONFLICT (user_id, level) DO NOTHING
	`, userID, level)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SERVER_ERROR", "Errore interno")
		return
	}

	// Restituisce la lista aggiornata
	rows, err := h.pg.Pool.Query(r.Context(), `
		SELECT level FROM puzzle_progress
		WHERE user_id = $1
		ORDER BY level ASC
	`, userID)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"completed": []int{level}})
		return
	}
	defer rows.Close()

	completed := []int{}
	for rows.Next() {
		var l int
		if err := rows.Scan(&l); err == nil {
			completed = append(completed, l)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"completed": completed})
}

// Silences unused import warning in case json is needed elsewhere.
var _ = json.Marshal
