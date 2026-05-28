package game

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"time"

	"chess-clone/backend/internal/db"

	"github.com/notnil/chess"
)

const disconnectTimeout = 60 * time.Second

type clientMessage struct {
	client *Client
	msg    InboundMsg
}

// Room gestisce una partita: stato, timer in-memory, messaggi
type Room struct {
	gameID string
	white  *Client
	black  *Client

	chess       *chess.Game
	timeControl int // secondi
	started     bool
	timer       timerState // in-memory, nessun Redis

	pg  *db.Postgres
	hub *Hub

	inbound            chan clientMessage
	clientDisconnected chan *Client

	whiteReconnectTimer *time.Timer
	blackReconnectTimer *time.Timer
}

func newRoom(gameID string, pg *db.Postgres, hub *Hub) *Room {
	return &Room{
		gameID:             gameID,
		chess:              chess.NewGame(),
		pg:                 pg,
		hub:                hub,
		inbound:            make(chan clientMessage, 32),
		clientDisconnected: make(chan *Client, 4),
	}
}

// Run è il loop principale della room (una goroutine per partita)
func (r *Room) Run() {
	defer r.hub.Remove(r.gameID)
	r.loadTimeControl()

	for {
		select {
		case cm := <-r.inbound:
			r.handleMessage(cm)
		case c := <-r.clientDisconnected:
			r.handleDisconnect(c)
		}
	}
}

// Join aggiunge un client alla room (white o black)
func (r *Room) Join(c *Client) error {
	switch c.Color {
	case "white":
		if r.white != nil && r.white.UserID != c.UserID {
			return fmt.Errorf("posto bianco già occupato")
		}
		if r.whiteReconnectTimer != nil {
			r.whiteReconnectTimer.Stop()
			r.whiteReconnectTimer = nil
			r.broadcast(OutboundMsg{Type: "opponent_reconnected"})
		}
		r.white = c
	case "black":
		if r.black != nil && r.black.UserID != c.UserID {
			return fmt.Errorf("posto nero già occupato")
		}
		if r.blackReconnectTimer != nil {
			r.blackReconnectTimer.Stop()
			r.blackReconnectTimer = nil
			r.broadcast(OutboundMsg{Type: "opponent_reconnected"})
		}
		r.black = c
	default:
		return fmt.Errorf("colore non valido: %s", c.Color)
	}

	if r.white != nil && r.black != nil && !r.started {
		r.startGame()
	}
	return nil
}

func (r *Room) startGame() {
	r.started = true
	r.timer = newTimerState(r.timeControl)

	ctx := context.Background()
	r.pg.Pool.Exec(ctx,
		`UPDATE games SET status = 'active', started_at = NOW() WHERE id = $1`,
		r.gameID,
	)

	fen := r.chess.Position().String()
	wMs, bMs := r.timer.currentTimes("white")

	r.white.Send(OutboundMsg{
		Type: "game_start",
		Payload: map[string]any{
			"fen": fen, "your_color": "white",
			"white_ms": wMs, "black_ms": bMs,
		},
	})
	r.black.Send(OutboundMsg{
		Type: "game_start",
		Payload: map[string]any{
			"fen": fen, "your_color": "black",
			"white_ms": wMs, "black_ms": bMs,
		},
	})
}

// ── Handler messaggi ───────────────────────────────────────────────────────

func (r *Room) handleMessage(cm clientMessage) {
	switch cm.msg.Type {
	case "move":
		var p MovePayload
		if err := json.Unmarshal(cm.msg.Payload, &p); err != nil {
			cm.client.Send(OutboundMsg{Type: "move_invalid", Payload: ErrorPayload{Reason: "payload non valido"}})
			return
		}
		r.handleMove(cm.client, p)
	case "resign":
		r.handleResign(cm.client)
	case "offer_draw":
		r.handleDrawOffer(cm.client)
	case "draw_response":
		var p DrawResponsePayload
		if err := json.Unmarshal(cm.msg.Payload, &p); err != nil {
			return
		}
		r.handleDrawResponse(cm.client, p.Accepted)
	}
}

func (r *Room) handleMove(c *Client, p MovePayload) {
	if !r.started {
		return
	}

	turn := r.chess.Position().Turn()
	if (turn == chess.White && c.Color != "white") ||
		(turn == chess.Black && c.Color != "black") {
		c.Send(OutboundMsg{Type: "move_invalid", Payload: ErrorPayload{Reason: "non è il tuo turno"}})
		return
	}

	uci := p.From + p.To
	if p.Promotion != "" {
		uci += p.Promotion
	}

	move, err := chess.UCINotation{}.Decode(r.chess.Position(), uci)
	if err != nil {
		c.Send(OutboundMsg{Type: "move_invalid", Payload: ErrorPayload{Reason: "mossa illegale"}})
		return
	}
	if err := r.chess.Move(move); err != nil {
		c.Send(OutboundMsg{Type: "move_invalid", Payload: ErrorPayload{Reason: "mossa non valida"}})
		return
	}

	// Aggiorna timer in-memory
	wMs, bMs, timedOut, loser := r.timer.recordMove(c.Color)
	if timedOut {
		winner := "black"
		if loser == "black" {
			winner = "white"
		}
		r.endGame(winner, "timeout")
		return
	}

	newFen := r.chess.Position().String()
	pgn := r.chess.String()
	turnStr := "w"
	if r.chess.Position().Turn() == chess.Black {
		turnStr = "b"
	}

	r.broadcast(OutboundMsg{
		Type: "move_made",
		Payload: MoveMadePayload{
			From: p.From, To: p.To,
			FEN: newFen, PGN: pgn,
			Turn:    turnStr,
			WhiteMs: wMs, BlackMs: bMs,
		},
	})

	ctx := context.Background()
	r.pg.Pool.Exec(ctx, `UPDATE games SET pgn = $1 WHERE id = $2`, pgn, r.gameID)

	r.checkOutcome()
}

func (r *Room) handleResign(c *Client) {
	winner := "black"
	if c.Color == "black" {
		winner = "white"
	}
	r.endGame(winner, "resigned")
}

func (r *Room) handleDrawOffer(c *Client) {
	if opp := r.opponent(c); opp != nil {
		opp.Send(OutboundMsg{Type: "draw_offered"})
	}
}

func (r *Room) handleDrawResponse(c *Client, accepted bool) {
	if accepted {
		r.endGame("draw", "draw_agreed")
	} else {
		if opp := r.opponent(c); opp != nil {
			opp.Send(OutboundMsg{Type: "draw_declined"})
		}
	}
}

func (r *Room) handleDisconnect(c *Client) {
	log.Printf("client disconnesso: %s (%s)", c.UserID, c.Color)

	if opp := r.opponent(c); opp != nil {
		opp.Send(OutboundMsg{
			Type:    "opponent_disconnected",
			Payload: DisconnectPayload{TimeoutSeconds: int(disconnectTimeout.Seconds())},
		})
	}

	if c.Color == "white" {
		r.white = nil
	} else {
		r.black = nil
	}

	color := c.Color
	timer := time.AfterFunc(disconnectTimeout, func() {
		if r.started && r.chess.Outcome() == chess.NoOutcome {
			winner := "black"
			if color == "black" {
				winner = "white"
			}
			r.endGame(winner, "abandoned")
		}
	})

	if c.Color == "white" {
		r.whiteReconnectTimer = timer
	} else {
		r.blackReconnectTimer = timer
	}
}

// ── Helpers ────────────────────────────────────────────────────────────────

func (r *Room) checkOutcome() {
	outcome := r.chess.Outcome()
	if outcome == chess.NoOutcome {
		return
	}
	r.endGame(outcomeToResult(outcome), methodToReason(r.chess.Method()))
}

func (r *Room) endGame(result, reason string) {
	pgn := r.chess.String()
	ctx := context.Background()

	r.pg.Pool.Exec(ctx,
		`UPDATE games SET status='finished', result=$1, finish_reason=$2,
		 finished_at=NOW(), pgn=$3 WHERE id=$4`,
		result, reason, pgn, r.gameID,
	)

	r.updateELO(result, ctx)

	r.broadcast(OutboundMsg{
		Type: "game_over",
		Payload: GameOverPayload{Result: result, Reason: reason, PGN: pgn},
	})

	if r.whiteReconnectTimer != nil {
		r.whiteReconnectTimer.Stop()
	}
	if r.blackReconnectTimer != nil {
		r.blackReconnectTimer.Stop()
	}

	log.Printf("partita %s terminata: %s per %s", r.gameID, result, reason)
}

func (r *Room) updateELO(result string, ctx context.Context) {
	var whiteElo, blackElo int
	var whiteID, blackID string

	err := r.pg.Pool.QueryRow(ctx,
		`SELECT g.white_id, g.black_id, u1.elo_rapid, u2.elo_rapid
		 FROM games g
		 JOIN users u1 ON u1.id = g.white_id
		 JOIN users u2 ON u2.id = g.black_id
		 WHERE g.id = $1`, r.gameID,
	).Scan(&whiteID, &blackID, &whiteElo, &blackElo)
	if err != nil {
		log.Printf("updateELO: errore lettura: %v", err)
		return
	}

	newWhiteElo, newBlackElo := calculateELO(whiteElo, blackElo, result)

	r.pg.Pool.Exec(ctx, `UPDATE users SET elo_rapid=$1 WHERE id=$2`, newWhiteElo, whiteID)
	r.pg.Pool.Exec(ctx, `UPDATE users SET elo_rapid=$1 WHERE id=$2`, newBlackElo, blackID)
	r.pg.Pool.Exec(ctx,
		`INSERT INTO elo_history (user_id, game_id, game_type, elo_before, elo_after)
		 VALUES ($1,$2,'rapid',$3,$4),($5,$2,'rapid',$6,$7)`,
		whiteID, r.gameID, whiteElo, newWhiteElo,
		blackID, blackElo, newBlackElo,
	)
}

func calculateELO(whiteElo, blackElo int, result string) (int, int) {
	const K = 32
	expected := func(a, b int) float64 {
		return 1.0 / (1.0 + math.Pow(10, float64(b-a)/400.0))
	}
	eW := expected(whiteElo, blackElo)
	eB := expected(blackElo, whiteElo)

	var sW, sB float64
	switch result {
	case "white":
		sW, sB = 1, 0
	case "black":
		sW, sB = 0, 1
	default:
		sW, sB = 0.5, 0.5
	}

	return whiteElo + int(K*(sW-eW)), blackElo + int(K*(sB-eB))
}

func (r *Room) broadcast(msg OutboundMsg) {
	if r.white != nil {
		r.white.Send(msg)
	}
	if r.black != nil {
		r.black.Send(msg)
	}
}

func (r *Room) opponent(c *Client) *Client {
	if c.Color == "white" {
		return r.black
	}
	return r.white
}

func (r *Room) loadTimeControl() {
	var tc int
	if err := r.pg.Pool.QueryRow(context.Background(),
		`SELECT time_control FROM games WHERE id = $1`, r.gameID,
	).Scan(&tc); err != nil {
		tc = 600
	}
	r.timeControl = tc
}

func methodToReason(m chess.Method) string {
	switch m {
	case chess.Checkmate:
		return "checkmate"
	case chess.Stalemate:
		return "stalemate"
	case chess.FiftyMoveRule:
		return "fifty_moves"
	case chess.ThreefoldRepetition:
		return "threefold"
	case chess.InsufficientMaterial:
		return "insufficient_material"
	default:
		return "unknown"
	}
}

func outcomeToResult(o chess.Outcome) string {
	switch o {
	case chess.WhiteWon:
		return "white"
	case chess.BlackWon:
		return "black"
	default:
		return "draw"
	}
}
