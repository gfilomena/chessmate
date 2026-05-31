import { Chess } from 'chess.js';

export interface Opening {
	eco:    string;
	name:   string;   // nome EN
	nameIt: string;   // nome IT
	pgn:    string;   // mosse SAN (es. "1. e4 e5 2. Nf3 Nc6 3. Bb5")
}

// Database ECO delle aperture più popolari
export const OPENINGS: Opening[] = [
	// ── e4 openings ────────────────────────────────────────────
	{ eco: 'B20', name: 'Sicilian Defense',        nameIt: 'Difesa Siciliana',          pgn: '1. e4 c5' },
	{ eco: 'B60', name: 'Sicilian Najdorf',         nameIt: 'Siciliana Najdorf',          pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6' },
	{ eco: 'B40', name: 'Sicilian Scheveningen',    nameIt: 'Siciliana Scheveningen',     pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6' },
	{ eco: 'C60', name: 'Ruy Lopez',               nameIt: 'Spagnola (Ruy Lopez)',       pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5' },
	{ eco: 'C65', name: 'Ruy Lopez Berlin',         nameIt: 'Spagnola Berlino',          pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6' },
	{ eco: 'C50', name: 'Italian Game',            nameIt: 'Apertura Italiana',         pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4' },
	{ eco: 'C54', name: 'Giuoco Piano',            nameIt: 'Giuoco Piano',              pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5' },
	{ eco: 'C20', name: "King's Gambit",           nameIt: 'Gambetto del Re',           pgn: '1. e4 e5 2. f4' },
	{ eco: 'C10', name: 'French Defense',          nameIt: 'Difesa Francese',           pgn: '1. e4 e6' },
	{ eco: 'C11', name: 'French Steinitz',         nameIt: 'Francese Steinitz',         pgn: '1. e4 e6 2. d4 d5 3. Nc3 Nf6' },
	{ eco: 'B10', name: 'Caro-Kann Defense',       nameIt: 'Difesa Caro-Kann',          pgn: '1. e4 c6' },
	{ eco: 'B13', name: 'Caro-Kann Exchange',      nameIt: 'Caro-Kann Variante Scambio',pgn: '1. e4 c6 2. d4 d5 3. exd5 cxd5' },
	{ eco: 'C00', name: 'Scandinavian Defense',    nameIt: 'Difesa Scandinava',         pgn: '1. e4 d5' },
	{ eco: 'C40', name: "Petrov's Defense",        nameIt: 'Difesa Petroff',            pgn: '1. e4 e5 2. Nf3 Nf6' },
	{ eco: 'B07', name: 'Pirc Defense',            nameIt: 'Difesa Pirc',               pgn: '1. e4 d6 2. d4 Nf6' },
	// ── d4 openings ────────────────────────────────────────────
	{ eco: 'D00', name: "Queen's Pawn",            nameIt: 'Pedone di Donna',           pgn: '1. d4 d5' },
	{ eco: 'D06', name: "Queen's Gambit",          nameIt: 'Gambetto di Donna',         pgn: '1. d4 d5 2. c4' },
	{ eco: 'D30', name: "Queen's Gambit Declined", nameIt: 'Gambetto di Donna Declinato',pgn: '1. d4 d5 2. c4 e6' },
	{ eco: 'D20', name: "Queen's Gambit Accepted", nameIt: 'Gambetto di Donna Accettato',pgn: '1. d4 d5 2. c4 dxc4' },
	{ eco: 'E61', name: "King's Indian Defense",   nameIt: 'Difesa Indiano del Re',     pgn: '1. d4 Nf6 2. c4 g6' },
	{ eco: 'E62', name: "King's Indian Classical", nameIt: 'Indiana del Re Classica',   pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3' },
	{ eco: 'E40', name: 'Nimzo-Indian Defense',    nameIt: 'Difesa Nimzo-Indiana',      pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4' },
	{ eco: 'E20', name: 'Nimzo-Indian 4. a3',     nameIt: 'Nimzo-Indiana 4. a3 (Saemisch)',pgn: '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. a3' },
	{ eco: 'A50', name: 'Grünfeld Defense',        nameIt: 'Difesa Grünfeld',           pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 d5' },
	{ eco: 'A41', name: "Colle System",            nameIt: 'Sistema Colle',             pgn: '1. d4 d5 2. Nf3 Nf6 3. e3' },
	// ── Flank openings ─────────────────────────────────────────
	{ eco: 'A04', name: "Réti Opening",            nameIt: 'Apertura Réti',             pgn: '1. Nf3' },
	{ eco: 'A10', name: 'English Opening',         nameIt: 'Apertura Inglese',          pgn: '1. c4' },
	{ eco: 'A00', name: "Bird's Opening",          nameIt: "Apertura Bird",             pgn: '1. f4' },
	{ eco: 'A00', name: 'London System',           nameIt: 'Sistema Londra',            pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4' },
];

// Converte una stringa SAN "1. e4 e5 2. Nf3" in array di mosse ["e4","e5","Nf3"]
function pgnToMoves(pgn: string): string[] {
	return pgn.replace(/\d+\./g, '').trim().split(/\s+/).filter(Boolean);
}

// Carica le mosse dell'apertura in un'istanza chess e restituisce la storia
function openingMoves(opening: Opening): string[] {
	try {
		const c = new Chess();
		c.loadPgn(opening.pgn);
		return c.history();
	} catch {
		return [];
	}
}

// Rileva l'apertura corrente basandosi sulla storia delle mosse
// Restituisce l'apertura più specifica che corrisponde al prefisso della storia
export function detectOpening(history: string[]): Opening | null {
	let best: Opening | null = null;
	let bestLen = 0;

	for (const opening of OPENINGS) {
		const opMoves = openingMoves(opening);
		const len = opMoves.length;
		if (len === 0 || len > history.length) continue;

		// Verifica che i primi `len` movimenti della partita corrispondano all'apertura
		const matches = opMoves.every((m, i) => m === history[i]);
		if (matches && len > bestLen) {
			best    = opening;
			bestLen = len;
		}
	}
	return best;
}

// Restituisce il FEN della posizione iniziale dell'apertura
export function openingStartFen(opening: Opening): string {
	try {
		const c = new Chess();
		c.loadPgn(opening.pgn);
		return c.fen();
	} catch {
		return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	}
}

// Restituisce le mosse della prossima variante teorica dopo la posizione corrente
export function nextTheoreticalMoves(opening: Opening, currentHistory: string[]): string[] {
	const opMoves = openingMoves(opening);
	return opMoves.slice(currentHistory.length);
}
