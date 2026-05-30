package api

import (
	"net"
	"strings"
	"sync"
	"time"
)

// ── Rate limiter per-IP ───────────────────────────────────────────────────────

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string][]time.Time
}

var regLimiter = &rateLimiter{entries: make(map[string][]time.Time)}

// Allow restituisce true se l'IP non ha superato il limite.
// window: intervallo di tempo; limit: max richieste in quel window.
func (rl *rateLimiter) Allow(ip string, limit int, window time.Duration) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-window)

	// Filtra le entry scadute
	fresh := rl.entries[ip][:0]
	for _, t := range rl.entries[ip] {
		if t.After(cutoff) {
			fresh = append(fresh, t)
		}
	}

	if len(fresh) >= limit {
		rl.entries[ip] = fresh
		return false
	}

	rl.entries[ip] = append(fresh, now)
	return true
}

// realIP estrae l'IP reale tenendo conto di X-Forwarded-For (reverse proxy).
func realIP(remoteAddr, forwarded string) string {
	if forwarded != "" {
		// Prende il primo IP della catena (client originale)
		parts := strings.Split(forwarded, ",")
		if ip := strings.TrimSpace(parts[0]); ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}

// ── MX check ──────────────────────────────────────────────────────────────────

// domainHasMX verifica che il dominio dell'email abbia almeno un record MX.
// Elimina domini inesistenti, typo e indirizzi ovviamente falsi.
func domainHasMX(email string) bool {
	parts := strings.Split(email, "@")
	if len(parts) != 2 || parts[1] == "" {
		return false
	}
	mx, err := net.LookupMX(parts[1])
	return err == nil && len(mx) > 0
}
