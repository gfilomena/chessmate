/**
 * Calcola i pezzi catturati da ogni lato a partire da una stringa FEN.
 * Confronta i pezzi sul board con la posizione iniziale standard.
 */

const INITIAL: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUES:  Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER = ['q', 'r', 'b', 'n', 'p'] as const; // dall'alto valore al basso

// Unicode chess pieces
const SYM: Record<string, string> = {
	wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
	bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

export interface CapturedInfo {
	/** Pezzi catturati DA bianco (simboli neri fuori dal board) */
	byWhite: string[];
	/** Pezzi catturati DA nero (simboli bianchi fuori dal board) */
	byBlack: string[];
	/** Vantaggio materiale in punti: positivo = bianco avanti */
	advantage: number;
}

export function computeCaptured(fen: string): CapturedInfo {
	const board = fen.split(' ')[0];

	// Conta pezzi vivi sul board
	const alive: Record<string, number> = {};
	for (const ch of board) {
		if (/[pnbrqPNBRQ]/.test(ch)) alive[ch] = (alive[ch] ?? 0) + 1;
	}

	const byWhite: string[] = [];
	const byBlack: string[] = [];
	let advantage = 0;

	for (const p of ORDER) {
		const initial = INITIAL[p];
		const blackAlive = alive[p]   ?? 0; // pezzi neri vivi
		const whiteAlive = alive[p.toUpperCase()] ?? 0; // pezzi bianchi vivi

		const blackLost = Math.max(0, initial - blackAlive); // presi da bianco
		const whiteLost = Math.max(0, initial - whiteAlive); // presi da nero

		for (let i = 0; i < blackLost; i++) byWhite.push(SYM[`b${p}`]);
		for (let i = 0; i < whiteLost; i++) byBlack.push(SYM[`w${p}`]);

		advantage += (whiteAlive - blackAlive) * VALUES[p];
	}

	return { byWhite, byBlack, advantage };
}
