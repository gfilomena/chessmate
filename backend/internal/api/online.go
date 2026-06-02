package api

import (
	"context"
	"net/http"
	"sync"
	"time"

	"chessmate/backend/internal/db"
)

const onlineWindow = 45 * time.Second

type onlineEntry struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	EloRapid int    `json:"elo_rapid"`
	lastSeen time.Time
}

// OnlineHandler traccia la presenza utenti in memoria
type OnlineHandler struct {
	pg    *db.Postgres
	mu    sync.RWMutex
	users map[string]onlineEntry
}

func NewOnlineHandler(pg *db.Postgres) *OnlineHandler {
	h := &OnlineHandler{
		pg:    pg,
		users: make(map[string]onlineEntry),
	}
	go h.cleanup()
	return h
}

// cleanup rimuove gli utenti inattivi ogni 30 secondi
func (h *OnlineHandler) cleanup() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-onlineWindow)
		h.mu.Lock()
		for id, e := range h.users {
			if e.lastSeen.Before(cutoff) {
				delete(h.users, id)
			}
		}
		h.mu.Unlock()
	}
}

func (h *OnlineHandler) setOnline(ctx context.Context, userID string) {
	var info onlineEntry
	if err := h.pg.Pool.QueryRow(ctx,
		`SELECT id, username, elo_rapid FROM users WHERE id = $1`, userID,
	).Scan(&info.ID, &info.Username, &info.EloRapid); err != nil {
		return
	}
	info.lastSeen = time.Now()
	h.mu.Lock()
	h.users[userID] = info
	h.mu.Unlock()
}

// POST /api/users/heartbeat
func (h *OnlineHandler) Heartbeat(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromCookie(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Non autenticato")
		return
	}
	h.setOnline(r.Context(), userID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GET /api/users/online
func (h *OnlineHandler) GetOnlineUsers(w http.ResponseWriter, r *http.Request) {
	myID, err := getUserIDFromCookie(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Non autenticato")
		return
	}

	// Auto-heartbeat: registra il chiamante
	h.setOnline(r.Context(), myID)

	cutoff := time.Now().Add(-onlineWindow)

	type UserOnline struct {
		ID       string `json:"id"`
		Username string `json:"username"`
		EloRapid int    `json:"elo_rapid"`
	}

	h.mu.RLock()
	users := make([]UserOnline, 0)
	for uid, e := range h.users {
		if uid == myID || e.lastSeen.Before(cutoff) {
			continue
		}
		users = append(users, UserOnline{ID: e.ID, Username: e.Username, EloRapid: e.EloRapid})
	}
	h.mu.RUnlock()

	writeJSON(w, http.StatusOK, users)
}
