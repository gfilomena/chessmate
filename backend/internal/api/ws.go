package api

import (
	"log"
	"net/http"

	"chess-clone/backend/internal/db"
	"chess-clone/backend/internal/game"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type WSHandler struct {
	hub *game.Hub
	pg  *db.Postgres
}

func NewWSHandler(hub *game.Hub, pg *db.Postgres) *WSHandler {
	return &WSHandler{hub: hub, pg: pg}
}

// GET /ws/game/{gameID}
func (h *WSHandler) HandleGameWS(w http.ResponseWriter, r *http.Request) {
	gameID := r.PathValue("gameID")
	if gameID == "" {
		http.Error(w, "gameID mancante", http.StatusBadRequest)
		return
	}

	userID, err := getUserIDFromCookie(r)
	if err != nil {
		http.Error(w, "non autenticato", http.StatusUnauthorized)
		return
	}

	var whiteID, blackID string
	err = h.pg.Pool.QueryRow(r.Context(),
		`SELECT white_id, black_id FROM games WHERE id = $1 AND status != 'finished'`,
		gameID,
	).Scan(&whiteID, &blackID)
	if err != nil {
		http.Error(w, "partita non trovata", http.StatusNotFound)
		return
	}

	var color string
	switch userID {
	case whiteID:
		color = "white"
	case blackID:
		color = "black"
	default:
		http.Error(w, "non sei in questa partita", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}

	room := h.hub.GetOrCreate(gameID)
	client := game.NewClient(userID, color, conn, room)

	if err := room.Join(client); err != nil {
		log.Printf("join error: %v", err)
		conn.Close()
		return
	}

	go client.WritePump()
	go client.ReadPump()

	log.Printf("client connesso: %s come %s alla partita %s", userID, color, gameID)
}
