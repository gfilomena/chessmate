package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNormFEN(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		expect string
	}{
		{
			name:   "full FEN with move counters",
			input:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
			expect: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
		},
		{
			name:   "standard starting position",
			input:  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
			expect: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		},
		{
			name:   "en passant available",
			input:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
			expect: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
		},
		{
			name:   "limited castling rights",
			input:  "r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w Kq - 1 2",
			expect: "r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w Kq -",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normFEN(tt.input)
			if result != tt.expect {
				t.Errorf("normFEN(%q) = %q, want %q", tt.input, result, tt.expect)
			}
		})
	}
}

func TestHandleOpeningMissingParams(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		expectCode int
		expectErr  bool
	}{
		{
			name:       "missing fen",
			query:      "?band=1",
			expectCode: http.StatusBadRequest,
			expectErr:  true,
		},
		{
			name:       "missing band",
			query:      "?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201",
			expectCode: http.StatusBadRequest,
			expectErr:  true,
		},
		{
			name:       "invalid band (0)",
			query:      "?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&band=0",
			expectCode: http.StatusBadRequest,
			expectErr:  true,
		},
		{
			name:       "invalid band (7)",
			query:      "?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&band=7",
			expectCode: http.StatusBadRequest,
			expectErr:  true,
		},
		{
			name:       "band not a number",
			query:      "?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&band=abc",
			expectCode: http.StatusBadRequest,
			expectErr:  true,
		},
		{
			name:       "valid params returns 200",
			query:      "?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&band=3",
			expectCode: http.StatusOK,
			expectErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/opening"+tt.query, nil)
			w := httptest.NewRecorder()
			HandleOpening(w, req)

			if w.Code != tt.expectCode {
				t.Errorf("HandleOpening(%s) status = %d, want %d", tt.query, w.Code, tt.expectCode)
			}

			// Verify content type is always JSON
			if ct := w.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
		})
	}
}

func TestHandleOpeningNoDB(t *testing.T) {
	// When opening.db is not available, should return empty moves
	req := httptest.NewRequest(
		"GET",
		"/api/opening?fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR%20w%20KQkq%20-%200%201&band=1",
		nil,
	)
	w := httptest.NewRecorder()
	HandleOpening(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("HandleOpening status = %d, want %d", w.Code, http.StatusOK)
	}

	// Verify response structure
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}

	// Verify cache control header
	if cc := w.Header().Get("Cache-Control"); cc == "" {
		t.Error("Cache-Control header missing")
	}
}
