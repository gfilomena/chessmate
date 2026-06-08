/**
 * Puzzle curriculum — 10 livelli sequenziali.
 *
 * Ogni livello ha 2 step. Ogni step definisce:
 *   fen          – posizione di partenza (FEN valido con entrambi i re)
 *   instruction  – testo mostrato all'utente
 *   hintFrom     – casella del pezzo da muovere (freccia hint)
 *   hintTo       – casella destinazione (freccia hint)
 *   correctMoves – mosse accettate in formato UCI (es. "e2e4")
 *   successText  – testo mostrato al successo dello step
 */

export interface PuzzleStep {
	fen:          string;
	instruction:  string;
	hintFrom:     string;
	hintTo:       string;
	correctMoves: string[];
	successText:  string;
}

export interface PuzzleLevel {
	id:         number;
	title:      string;
	subtitle:   string;
	icon:       string;
	difficulty: 1 | 2 | 3;
	steps:      PuzzleStep[];
}

export const PUZZLE_LEVELS: PuzzleLevel[] = [

	// ── 1: Pedone ──────────────────────────────────────────────────────────────
	{
		id: 1, title: 'Il pedone', subtitle: 'Avanza e cattura', icon: '♙', difficulty: 1,
		steps: [
			{
				fen:          'k7/8/8/8/8/8/4P3/7K w - - 0 1',
				instruction:  'Il pedone può avanzare di 1 o 2 caselle dalla posizione iniziale. Portalo in e4!',
				hintFrom:     'e2', hintTo: 'e4',
				correctMoves: ['e2e4', 'e2e3'],
				successText:  '✓ Esatto! Il pedone avanza in avanti.',
			},
			{
				fen:          'k7/8/4p3/3P4/8/8/8/7K w - - 0 1',
				instruction:  'Il pedone cattura in diagonale, un passo avanti. Cattura il pedone nero su e6!',
				hintFrom:     'd5', hintTo: 'e6',
				correctMoves: ['d5e6'],
				successText:  '✓ Perfetto! Il pedone cattura in diagonale.',
			},
		],
	},

	// ── 2: Torre ───────────────────────────────────────────────────────────────
	{
		id: 2, title: 'La torre', subtitle: 'Righe e colonne', icon: '♖', difficulty: 1,
		steps: [
			{
				fen:          '7k/8/8/8/8/8/1K6/r6R w - - 0 1',
				instruction:  'La torre scivola su tutta la riga o colonna. Cattura la torre nera su a1!',
				hintFrom:     'h1', hintTo: 'a1',
				correctMoves: ['h1a1'],
				successText:  '✓ Ottimo! La torre scivola lungo la riga.',
			},
			{
				fen:          '7k/3r4/8/8/8/8/8/3R3K w - - 0 1',
				instruction:  'La torre si muove anche in verticale. Cattura la torre nera su d7!',
				hintFrom:     'd1', hintTo: 'd7',
				correctMoves: ['d1d7'],
				successText:  '✓ Bravo! La torre scivola lungo la colonna.',
			},
		],
	},

	// ── 3: Alfiere ─────────────────────────────────────────────────────────────
	{
		id: 3, title: "L'alfiere", subtitle: 'Solo le diagonali', icon: '♗', difficulty: 1,
		steps: [
			{
				fen:          '7k/8/8/8/8/4b3/8/2B4K w - - 0 1',
				instruction:  "L'alfiere si muove solo in diagonale, di quante caselle vuole. Cattura l'alfiere nero su e3!",
				hintFrom:     'c1', hintTo: 'e3',
				correctMoves: ['c1e3'],
				successText:  '✓ Perfetto! La diagonale corta.',
			},
			{
				fen:          '7k/8/b7/8/8/8/8/5B1K w - - 0 1',
				instruction:  "Trova la lunga diagonale! L'alfiere può raggiungere caselle lontane. Cattura l'alfiere nero su a6.",
				hintFrom:     'f1', hintTo: 'a6',
				correctMoves: ['f1a6'],
				successText:  "✓ Eccellente! Diagonale lunga dominata.",
			},
		],
	},

	// ── 4: Cavallo ─────────────────────────────────────────────────────────────
	{
		id: 4, title: 'Il cavallo', subtitle: 'Il salto a L', icon: '♘', difficulty: 2,
		steps: [
			{
				fen:          '7k/8/8/8/8/8/8/1N5K w - - 0 1',
				instruction:  "Il cavallo si muove a forma di 'L': 2 caselle in una direzione poi 1 di lato (o viceversa). Portalo su c3!",
				hintFrom:     'b1', hintTo: 'c3',
				correctMoves: ['b1c3', 'b1a3', 'b1d2'],
				successText:  '✓ Il salto del cavallo!',
			},
			{
				fen:          '7k/8/4p3/8/3N4/8/8/7K w - - 0 1',
				instruction:  'Il cavallo è unico: salta sopra i pezzi! Cattura il pedone nero su e6.',
				hintFrom:     'd4', hintTo: 'e6',
				correctMoves: ['d4e6'],
				successText:  '✓ Il cavallo salta ostacoli!',
			},
		],
	},

	// ── 5: Regina ──────────────────────────────────────────────────────────────
	{
		id: 5, title: 'La regina', subtitle: 'Tutta la scacchiera', icon: '♕', difficulty: 2,
		steps: [
			{
				fen:          '7k/8/3p4/8/8/8/8/3Q3K w - - 0 1',
				instruction:  'La donna si muove come torre E alfiere insieme: righe, colonne e diagonali. Cattura il pedone su d6!',
				hintFrom:     'd1', hintTo: 'd6',
				correctMoves: ['d1d6'],
				successText:  '✓ La donna domina le colonne!',
			},
			{
				fen:          'r7/7k/8/8/8/8/7K/7Q w - - 0 1',
				instruction:  'Ora usa la diagonale! La donna raggiunge a8 in un solo colpo. Cattura la torre nera su a8.',
				hintFrom:     'h1', hintTo: 'a8',
				correctMoves: ['h1a8'],
				successText:  '✓ Diagonale letale della donna!',
			},
		],
	},

	// ── 6: Re ──────────────────────────────────────────────────────────────────
	{
		id: 6, title: 'Il re', subtitle: 'Un passo alla volta', icon: '♔', difficulty: 2,
		steps: [
			{
				fen:          '7k/8/8/8/4Kp2/8/8/8 w - - 0 1',
				instruction:  'Il re si muove di un solo passo in qualsiasi direzione. Cattura il pedone nero su f4!',
				hintFrom:     'e4', hintTo: 'f4',
				correctMoves: ['e4f4'],
				successText:  '✓ Il re cattura passo dopo passo!',
			},
			{
				fen:          '7k/8/8/8/8/8/1p6/K7 w - - 0 1',
				instruction:  'Il re può muoversi anche in diagonale. Cattura il pedone nero su b2!',
				hintFrom:     'a1', hintTo: 'b2',
				correctMoves: ['a1b2'],
				successText:  '✓ Ottimo! Il re cattura in diagonale.',
			},
		],
	},

	// ── 7: Cattura il pezzo indifeso ───────────────────────────────────────────
	{
		id: 7, title: 'Cattura!', subtitle: 'Pezzi indifesi', icon: '⚔️', difficulty: 2,
		steps: [
			{
				fen:          '7k/8/8/8/8/3n4/4P3/7K w - - 0 1',
				instruction:  'Il cavallo nero su d3 è indifeso! Catturalo con il pedone (i pedoni catturano in diagonale).',
				hintFrom:     'e2', hintTo: 'd3',
				correctMoves: ['e2d3'],
				successText:  '✓ Pezzo indifeso catturato!',
			},
			{
				fen:          '7k/3r4/8/8/8/8/8/3R3K w - - 0 1',
				instruction:  'La torre nera su d7 è senza protezione. Catturala con la tua torre!',
				hintFrom:     'd1', hintTo: 'd7',
				correctMoves: ['d1d7'],
				successText:  '✓ Materiale guadagnato!',
			},
		],
	},

	// ── 8: Evita la cattura ────────────────────────────────────────────────────
	{
		id: 8, title: 'Stai attento!', subtitle: 'Caselle sicure', icon: '🛡️', difficulty: 3,
		steps: [
			{
				fen:          'k7/8/8/8/3r4/8/4P3/7K w - - 0 1',
				instruction:  'Attenzione! La torre nera controlla e4 (colonna e, traversa 4). Se il pedone va su e4 viene catturato. Muovilo di una sola casella in sicurezza su e3!',
				hintFrom:     'e2', hintTo: 'e3',
				correctMoves: ['e2e3'],
				successText:  '✓ Bravo! Hai evitato la cattura.',
			},
			{
				fen:          'k7/8/8/8/7b/3N4/8/7K w - - 0 1',
				instruction:  "L'alfiere nero attacca f2 ed e1. Il cavallo deve muoversi in una casella sicura. Portalo su f4 (non su f2)!",
				hintFrom:     'd3', hintTo: 'f4',
				correctMoves: ['d3f4'],
				successText:  '✓ Casella sicura trovata!',
			},
		],
	},

	// ── 9: Dai scacco ──────────────────────────────────────────────────────────
	{
		id: 9, title: 'Scacco!', subtitle: 'Metti in pericolo il re', icon: '👑', difficulty: 3,
		steps: [
			{
				fen:          '4k3/8/8/8/8/8/8/R6K w - - 0 1',
				instruction:  "Dai scacco al re nero! La torre dà scacco muovendosi sulla stessa riga o colonna del re. Portala su a8 o e1.",
				hintFrom:     'a1', hintTo: 'a8',
				correctMoves: ['a1a8', 'a1e1'],
				successText:  '✓ Scacco! Il re è sotto attacco.',
			},
			{
				fen:          '7k/8/8/8/8/8/8/3Q3K w - - 0 1',
				instruction:  "La donna dà scacco muovendosi sulla stessa riga, colonna o diagonale del re. Trovala! (d8 o h5)",
				hintFrom:     'd1', hintTo: 'd8',
				correctMoves: ['d1d8', 'd1h5'],
				successText:  '✓ Scacco con la donna!',
			},
		],
	},

	// ── 10: Scacco matto ───────────────────────────────────────────────────────
	{
		id: 10, title: 'Scacco matto!', subtitle: 'La mossa finale', icon: '🏆', difficulty: 3,
		steps: [
			{
				fen:          '6k1/5ppp/8/8/8/8/5PPP/3R3K w - - 0 1',
				instruction:  'Il re nero è bloccato dai suoi stessi pedoni. C\'è UNA sola mossa per lo scacco matto. Trovala!',
				hintFrom:     'd1', hintTo: 'd8',
				correctMoves: ['d1d8'],
				successText:  '✓ SCACCO MATTO! La torre controlla tutta la traversa 8.',
			},
			{
				fen:          'k7/8/1R6/8/8/8/8/1R5K w - - 0 1',
				instruction:  'Matto a scala! Le due torri possono intrappolare il re nell\'angolo. Quale torre si muove su a1?',
				hintFrom:     'b1', hintTo: 'a1',
				correctMoves: ['b1a1', 'b6a6'],
				successText:  '✓ SCACCO MATTO! Magnifico! Hai completato tutti i livelli! 🎉',
			},
		],
	},
];

export function getPuzzleLevel(id: number): PuzzleLevel | undefined {
	return PUZZLE_LEVELS.find(l => l.id === id);
}

export const TOTAL_LEVELS = PUZZLE_LEVELS.length;
