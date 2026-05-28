package api

import (
	"fmt"
	"net/http"
	"time"

	"chess-clone/backend/internal/db"
	"chess-clone/backend/internal/matchmaking"
)

type MatchmakingHandler struct {
	pg *db.Postgres
	mm *matchmaking.Matchmaker
}

func NewMatchmakingHandler(pg *db.Postgres, mm *matchmaking.Matchmaker) *MatchmakingHandler {
	return &MatchmakingHandler{pg: pg, mm: mm}
}

// POST /api/matchmaking/join
func (h *MatchmakingHandler) Join(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromCookie(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Non autenticato")
		return
	}

	var elo int
	if err := h.pg.Pool.QueryRow(r.Context(),
		`SELECT elo_rapid FROM users WHERE id = $1`, userID,
	).Scan(&elo); err != nil {
		writeError(w, http.StatusInternalServerError, "SERVER_ERROR", "Errore interno")
		return
	}

	h.mm.Join(userID, elo)
	writeJSON(w, http.StatusOK, map[string]string{"status": "in_queue"})
}

// DELETE /api/matchmaking/leave
func (h *MatchmakingHandler) Leave(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromCookie(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Non autenticato")
		return
	}
	h.mm.Leave(userID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "left"})
}

// GET /api/matchmaking/status
func (h *MatchmakingHandler) Status(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromCookie(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Non autenticato")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"in_queue": h.mm.IsInQueue(userID)})
}

// GET /api/matchmaking/stream — SSE: notifica quando il match è pronto
func (h *MatchmakingHandler) Stream(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromCookie(r)
	if err != nil {
		http.Error(w, "non autenticato", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming non supportato", http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "event: connected\ndata: {}\n\n")
	flusher.Flush()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	pingTicker := time.NewTicker(15 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case <-r.Context().Done():
			h.mm.Leave(userID)
			return

		case <-ticker.C:
			if gameID, found := h.mm.GetMatch(userID); found {
				fmt.Fprintf(w, "event: matched\ndata: {\"game_id\":\"%s\"}\n\n", gameID)
				flusher.Flush()
				return
			}

		case <-pingTicker.C:
			fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		}
	}
}
