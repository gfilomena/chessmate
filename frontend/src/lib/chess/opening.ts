/**
 * Opening API client.
 *
 * Chiama /api/opening per ottenere le mosse reali giocate da umani
 * a una certa fascia ELO (dati da database Lichess).
 */

// ── Fascia ELO → band ────────────────────────────────────────────────────────

export function eloBand(elo: number): number {
	if (elo < 700)  return 1;
	if (elo < 1000) return 2;
	if (elo < 1300) return 3;
	if (elo < 1600) return 4;
	if (elo < 1900) return 5;
	return 6;
}

// ── Tipi ─────────────────────────────────────────────────────────────────────

export interface OpeningMove {
	uci:    string;
	weight: number;
	count:  number;
}

// ── API call ─────────────────────────────────────────────────────────────────

/**
 * Ottieni le mosse di apertura reali per una posizione e fascia ELO.
 * Ritorna [] se nessun dato disponibile → usa fallback Stockfish.
 * Timeout 1.5s per non bloccare il bot.
 */
export async function getOpeningMoves(fen: string, band: number): Promise<OpeningMove[]> {
	try {
		const url = `/api/opening?fen=${encodeURIComponent(fen)}&band=${band}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
		if (!res.ok) return [];
		const data = await res.json();
		return data.moves ?? [];
	} catch {
		return [];
	}
}

/**
 * Seleziona una mossa pesata sulla frequenza reale.
 * Mosse più comuni vengono scelte più spesso (sampling proporzionale).
 */
export function sampleMove(moves: OpeningMove[]): string | null {
	if (!moves.length) return null;
	const r = Math.random();
	let cumulative = 0;
	for (const m of moves) {
		cumulative += m.weight;
		if (r <= cumulative) return m.uci;
	}
	return moves[moves.length - 1].uci;
}
