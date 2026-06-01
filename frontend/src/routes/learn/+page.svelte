<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chess }              from 'chess.js';
	import { browser }            from '$app/environment';
	import Board                  from '$lib/chess/Board.svelte';
	import NavTimeline            from '$lib/chess/NavTimeline.svelte';
	import SetupBoard             from '$lib/chess/SetupBoard.svelte';
	import { PIECE_SVG, type PieceCode } from '$lib/chess/pieces';
	import { StockfishEngine, evalToPercent, formatScore } from '$lib/chess/stockfish';
	import { OPENINGS, detectOpening, openingStartFen, nextTheoreticalMoves, type Opening } from '$lib/chess/openings';
	import { t } from '$lib/i18n';

	// ── Mode ─────────────────────────────────────────────────────────────────────
	type Mode = 'free-a' | 'setup' | 'pgn' | 'opening';
	let mode = $state<Mode>('free-a');

	// ── Engine ────────────────────────────────────────────────────────────────────
	let engine: StockfishEngine | null = null;
	let engineReady  = $state(false);
	let analyzing    = $state(false);
	let evalResult   = $state<{ score: number; isMate: boolean; mateIn: number | null; bestMove: string; pv: string[] } | null>(null);
	let bestArrow    = $state<{ from: string; to: string; color: string } | null>(null);
	let bestExplain  = $state('');
	let evalPct      = $derived(evalResult
		? (evalResult.isMate ? (evalResult.mateIn! > 0 ? 98 : 2) : 50 + 50 * Math.tanh(evalResult.score / 400))
		: 50);
	const evalText = $derived.by(() => {
		if (!evalResult) return '';
		if (evalResult.isMate) return `Matto in ${Math.abs(evalResult.mateIn!)}`;
		const p = evalResult.score / 100;
		if (Math.abs(p) < 0.3) return 'Posizione pari';
		return p > 0 ? 'Bianco in vantaggio' : 'Nero in vantaggio';
	});
	let evalScore = $derived(evalResult ? formatScore(evalResult as any) : '0.0');

	onMount(async () => {
		if (!browser) return;
		engine = new StockfishEngine();
		await engine.init();
		engineReady = true;
	});
	onDestroy(() => engine?.destroy());

	// ── Analisi posizione ─────────────────────────────────────────────────────────
	async function analyzePosition(fen: string) {
		if (!engine || !engineReady || analyzing) return;
		bestArrow   = null;
		bestExplain = '';
		analyzing   = true;
		try {
			const res = await engine.analyze(fen, 16);
			evalResult = res;
		} finally {
			analyzing = false;
		}
	}

	async function showBestMove(fen: string) {
		if (!engine || !engineReady || analyzing) return;
		bestArrow   = null;
		bestExplain = '';
		analyzing   = true;
		try {
			const res = await engine.analyze(fen, 16);
			evalResult = res;
			if (res.bestMove && res.bestMove !== '(none)') {
				const from = res.bestMove.slice(0, 2);
				const to   = res.bestMove.slice(2, 4);
				bestArrow   = { from, to, color: '#00bcd4' };
				bestExplain = explainMove(fen, res.bestMove);
			}
		} finally {
			analyzing = false;
		}
	}

	// Template-based explanation
	function explainMove(fen: string, uci: string): string {
		try {
			const from = uci.slice(0, 2);
			const to   = uci.slice(2, 4);
			const promo = uci[4] ?? 'q';

			const before = new Chess();
			before.load(fen);
			const piece   = before.get(from as any);
			const capture = before.get(to as any);

			const after = new Chess();
			after.load(fen);
			after.move({ from, to, promotion: promo as any });

			const isCheck   = after.isCheck();
			const isCapture = !!capture;

			const CENTER = ['e4','e5','d4','d5'];
			const EXTENDED = ['c3','c4','c5','c6','d3','d4','d5','d6','e3','e4','e5','e6','f3','f4','f5','f6'];
			const pieceIt: Record<string, string> = {
				k: 'il re', q: 'la donna', r: 'la torre', b: "l'alfiere", n: 'il cavallo', p: 'il pedone'
			};

			if (isCheck && isCapture) return `Cattura con scacco! Eccellente mossa tattica che guadagna materiale mettendo sotto pressione.`;
			if (isCheck)   return `Mette il re avversario sotto scacco, costringendolo a rispondere immediatamente.`;
			if (isCapture) return `Cattura ${pieceIt[capture.type] ?? 'un pezzo'} avversario, guadagnando materiale.`;
			if (uci.length === 5) return `Promozione del pedone a donna — vantaggio decisivo!`;
			if (piece?.type === 'p' && CENTER.includes(to)) return `Avanza il pedone al centro, assumendo il controllo delle caselle chiave.`;
			if (piece?.type === 'n' || piece?.type === 'b') {
				const isDevMove = from[1] === (piece.color === 'w' ? '1' : '8');
				if (isDevMove) return `Sviluppa ${pieceIt[piece.type]} migliorando la coordinazione dei pezzi e accelerando l'arrocco.`;
				return `Riposiziona ${pieceIt[piece.type]} in una casella più attiva.`;
			}
			if (piece?.type === 'k' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2)
				return `Arroca il re al sicuro dietro i pedoni, connettendo le torri.`;
			if (EXTENDED.includes(to)) return `Occupa il centro allargato, guadagnando spazio e mobilità.`;
			return `La mossa migliore in questa posizione secondo il motore Stockfish.`;
		} catch {
			return `La mossa migliore secondo il motore Stockfish.`;
		}
	}

	const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

	// Tipo condiviso per le entry della timeline
	interface MoveEntry { fen: string; from: string; to: string; san: string }
	const INIT_ENTRY: MoveEntry = { fen: INITIAL_FEN, from: '', to: '', san: '' };

	// ── Helper condiviso: applica una mossa su un FEN (turno libero) ──────────
	function applyMove(fen: string, from: string, to: string, promo?: string): MoveEntry | null {
		const c = new Chess();
		c.load(fen);
		try {
			const mv = c.move({ from, to, promotion: (promo ?? 'q') as any });
			return { fen: c.fen(), from, to, san: mv?.san ?? `${from}-${to}` };
		} catch {
			const piece = c.get(from as any);
			if (!piece) return null;
			const parts = fen.split(' ');
			parts[1] = piece.color;
			const tmp = new Chess();
			tmp.load(parts.join(' '));
			try {
				const mv = tmp.move({ from, to, promotion: (promo ?? 'q') as any });
				return { fen: tmp.fen(), from, to, san: mv?.san ?? `${from}-${to}` };
			} catch { return null; }
		}
	}

	// ════════════════════════════════════════════════════════════
	// MODALITÀ A — Libero (regole standard, turni liberi)
	// ════════════════════════════════════════════════════════════
	let historyA = $state<MoveEntry[]>([INIT_ENTRY]);
	let idxA     = $state(0);

	const fenA      = $derived(historyA[idxA].fen);
	const lastMoveA = $derived(idxA > 0 ? { from: historyA[idxA].from, to: historyA[idxA].to } : null);
	const turnA     = $derived(fenA.split(' ')[1] === 'w' ? 'white' : 'black');
	const sanHistA  = $derived(historyA.slice(1, idxA + 1).map(e => e.san));

	function handleFreeMove(from: string, to: string, promo?: string) {
		const entry = applyMove(fenA, from, to, promo);
		if (!entry) return;
		historyA   = [...historyA.slice(0, idxA + 1), entry];
		idxA       = historyA.length - 1;
		evalResult = null; bestArrow = null; bestExplain = '';
	}

	function navA(i: number) {
		idxA = Math.max(0, Math.min(i, historyA.length - 1));
		evalResult = null; bestArrow = null;
	}
	function undoA()   { navA(idxA - 1); }
	function resetA()  { historyA = [INIT_ENTRY]; idxA = 0; evalResult = null; bestArrow = null; bestExplain = ''; }

	// ════════════════════════════════════════════════════════════
	// MODALITÀ B — Setup (posizionamento libero senza regole)
	// ════════════════════════════════════════════════════════════
	const INITIAL_BOARD: Record<string, string> = {
		a1:'wR', b1:'wN', c1:'wB', d1:'wQ', e1:'wK', f1:'wB', g1:'wN', h1:'wR',
		a2:'wP', b2:'wP', c2:'wP', d2:'wP', e2:'wP', f2:'wP', g2:'wP', h2:'wP',
		a7:'bP', b7:'bP', c7:'bP', d7:'bP', e7:'bP', f7:'bP', g7:'bP', h7:'bP',
		a8:'bR', b8:'bN', c8:'bB', d8:'bQ', e8:'bK', f8:'bB', g8:'bN', h8:'bR',
	};

	let setupBoard    = $state<Record<string, string>>({ ...INITIAL_BOARD });
	let setupTurn     = $state<'w' | 'b'>('w');
	let selectedPiece = $state<string | null>(null); // pezzo selezionato dalla palette

	// Drag dalla palette verso la scacchiera
	let paletteDragging  = $state(false);
	let paletteDragPiece = $state<string | null>(null);
	let paletteDragX     = $state(0);
	let paletteDragY     = $state(0);

	function onPalettePointerDown(e: PointerEvent, code: string) {
		if (e.pointerType === 'touch') e.preventDefault();
		const startX = e.clientX;
		const startY = e.clientY;
		paletteDragPiece = code;
		paletteDragX     = e.clientX;
		paletteDragY     = e.clientY;

		function onMove(me: PointerEvent) {
			paletteDragX = me.clientX;
			paletteDragY = me.clientY;
			const dx = me.clientX - startX;
			const dy = me.clientY - startY;
			if (!paletteDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
				paletteDragging  = true;
				selectedPiece    = code;   // seleziona anche come pezzo attivo
				document.body.style.cursor = 'grabbing';
			}
		}

		function onUp(ue: PointerEvent) {
			document.removeEventListener('pointermove', onMove);
			document.removeEventListener('pointerup',   onUp);
			document.body.style.cursor = '';

			if (paletteDragging) {
				// Cerca la casella della scacchiera sotto il cursore
				const els = document.elementsFromPoint(ue.clientX, ue.clientY);
				const sqEl = els.find(el => el.hasAttribute('data-sq')) as HTMLElement | null;
				if (sqEl?.dataset.sq) {
					const updated = { ...setupBoard, [sqEl.dataset.sq]: code };
					onSetupBoardChange(updated);
					selectedPiece = null; // dopo drop, deseleziona
				}
				paletteDragging  = false;
				paletteDragPiece = null;
			} else {
				// Click semplice → seleziona/deseleziona
				selectedPiece = selectedPiece === code ? null : code;
				paletteDragPiece = null;
			}
		}

		document.addEventListener('pointermove', onMove);
		document.addEventListener('pointerup',   onUp);
	}

	// Palette per aggiungere pezzi
	const PALETTE_W: PieceCode[] = ['wK','wQ','wR','wB','wN','wP'];
	const PALETTE_B: PieceCode[] = ['bK','bQ','bR','bB','bN','bP'];

	function boardToFen(board: Record<string, string>, turn: 'w' | 'b'): string {
		const ranks = ['8','7','6','5','4','3','2','1'];
		const files  = ['a','b','c','d','e','f','g','h'];
		const pm: Record<string, string> = {
			wK:'K',wQ:'Q',wR:'R',wB:'B',wN:'N',wP:'P',
			bK:'k',bQ:'q',bR:'r',bB:'b',bN:'n',bP:'p',
		};
		let fen = '';
		for (const r of ranks) {
			let empty = 0;
			for (const f of files) {
				const p = board[f + r];
				if (p) { if (empty) { fen += empty; empty = 0; } fen += pm[p] ?? '?'; }
				else empty++;
			}
			if (empty) fen += empty;
			fen += '/';
		}
		return fen.slice(0, -1) + ` ${turn} - - 0 1`;
	}

	const setupFen = $derived(boardToFen(setupBoard, setupTurn));

	function onSetupBoardChange(b: Record<string, string>) {
		setupBoard  = b;
		evalResult  = null;
		bestArrow   = null;
		bestExplain = '';
	}

	function resetSetup() {
		setupBoard  = { ...INITIAL_BOARD };
		setupTurn   = 'w';
		evalResult  = null;
		bestArrow   = null;
		bestExplain = '';
	}

	function clearSetup() {
		// Lascia solo i re per mantenere un FEN valido
		setupBoard  = { e1: 'wK', e8: 'bK' };
		evalResult  = null;
		bestArrow   = null;
		bestExplain = '';
	}

	// ════════════════════════════════════════════════════════════
	// MODALITÀ PGN
	// ════════════════════════════════════════════════════════════
	let pgnText  = $state('');
	let pgnError = $state('');
	let pgnLoaded = $state(false);
	interface PgnPos { fen: string; label: string; from: string; to: string }
	let pgnPositions = $state<PgnPos[]>([]);
	let pgnIdx       = $state(0);

	const pgnLastMove = $derived(pgnIdx > 0
		? { from: pgnPositions[pgnIdx]?.from, to: pgnPositions[pgnIdx]?.to }
		: null);

	function loadPgn() {
		pgnError  = '';
		pgnLoaded = false;
		try {
			const temp = new Chess();
			temp.loadPgn(pgnText.trim());
			const history = temp.history({ verbose: true }) as any[];
			const pos: PgnPos[] = [{ fen: new Chess().fen(), label: 'Inizio', from: '', to: '' }];
			const replay = new Chess();
			for (let i = 0; i < history.length; i++) {
				const mv = history[i];
				replay.move(mv);
				const n = Math.floor(i / 2) + 1;
				pos.push({ fen: replay.fen(), label: i % 2 === 0 ? `${n}. ${mv.san}` : `${n}… ${mv.san}`, from: mv.from, to: mv.to });
			}
			pgnPositions = pos;
			pgnIdx       = 0;
			pgnLoaded    = true;
		} catch {
			pgnError = 'PGN non valido — controlla il formato e riprova.';
		}
	}

	function pgFirst() { pgnIdx = 0; }
	function pgPrev()  { if (pgnIdx > 0) pgnIdx--; }
	function pgNext()  { if (pgnIdx < pgnPositions.length - 1) pgnIdx++; }
	function pgLast()  { pgnIdx = pgnPositions.length - 1; }

	let moveListEl: HTMLElement | null = null;
	$effect(() => {
		if (!pgnLoaded || !moveListEl) return;
		const active = moveListEl.querySelector('.move-active');
		active?.scrollIntoView({ block: 'nearest' });
	});

	// ════════════════════════════════════════════════════════════
	// MODALITÀ APERTURA
	// ════════════════════════════════════════════════════════════
	let selectedOpening = $state<Opening | null>(null);
	let historyOp       = $state<MoveEntry[]>([INIT_ENTRY]);
	let idxOp           = $state(0);
	let detectedOpening = $state<Opening | null>(null);
	let theoryDeviation = $state(false);
	let theoryArrow     = $state<{ from: string; to: string; color: string } | null>(null);

	const fenOp      = $derived(historyOp[idxOp].fen);
	const lastMoveOp = $derived(idxOp > 0 ? { from: historyOp[idxOp].from, to: historyOp[idxOp].to } : null);
	const sanHistOp  = $derived(historyOp.slice(1, idxOp + 1).map(e => e.san));

	function _updateOpeningDetection(history: string[]) {
		detectedOpening = detectOpening(history);
		if (selectedOpening) {
			theoryDeviation = nextTheoreticalMoves(selectedOpening, history).length === 0 && history.length > 0;
		}
	}

	function selectOpening(op: Opening) {
		selectedOpening = op;
		historyOp       = [INIT_ENTRY];
		idxOp           = 0;
		detectedOpening = null;
		theoryDeviation = false;
		theoryArrow     = null;
		evalResult      = null;
		bestArrow       = null;
		bestExplain     = '';
	}

	function handleOpeningMove(from: string, to: string, promo?: string) {
		const entry = applyMove(fenOp, from, to, promo);
		if (!entry) return;
		historyOp  = [...historyOp.slice(0, idxOp + 1), entry];
		idxOp      = historyOp.length - 1;
		evalResult = null; bestArrow = null; bestExplain = ''; theoryArrow = null;
		_updateOpeningDetection(historyOp.slice(1).map(e => e.san));
	}

	function navOp(i: number) {
		idxOp = Math.max(0, Math.min(i, historyOp.length - 1));
		evalResult = null; bestArrow = null; theoryArrow = null;
		_updateOpeningDetection(historyOp.slice(1, idxOp + 1).map(e => e.san));
	}

	function resetOpening() {
		historyOp       = [INIT_ENTRY];
		idxOp           = 0;
		detectedOpening = null;
		theoryDeviation = false;
		theoryArrow     = null;
		evalResult      = null;
		bestArrow       = null;
		bestExplain     = '';
	}

	async function showTheoryMove() {
		if (!selectedOpening) return;
		const nextMoves = nextTheoreticalMoves(selectedOpening, sanHistOp);
		if (nextMoves.length === 0) { await showBestMove(fenOp); return; }
		try {
			const tmp = new Chess();
			tmp.load(fenOp);
			const mv = tmp.move(nextMoves[0]);
			if (mv) {
				theoryArrow = { from: mv.from, to: mv.to, color: '#4caf50' };
				bestExplain = `Mossa teorica: ${mv.san} — prosegui sulla linea principale della ${selectedOpening.nameIt}.`;
			}
		} catch { await showBestMove(fenOp); }
	}

	// ── FEN corrente per analisi (dichiarato dopo tutte le variabili) ────────────
	const currentFen = $derived(
		mode === 'free-a'  ? fenA :
		mode === 'setup'   ? setupFen :
		mode === 'pgn'     ? (pgnPositions[pgnIdx]?.fen ?? INITIAL_FEN) :
		mode === 'opening' ? fenOp : INITIAL_FEN
	);

	// ── Keyboard navigation (tutte le modalità con storia) ───────────────────────
	function handleKey(e: KeyboardEvent) {
		if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
		e.preventDefault();
		if (mode === 'pgn') {
			if (e.key === 'ArrowLeft')  pgPrev();
			if (e.key === 'ArrowRight') pgNext();
			if (e.key === 'ArrowUp')    pgFirst();
			if (e.key === 'ArrowDown')  pgLast();
		} else if (mode === 'free-a') {
			if (e.key === 'ArrowLeft')  navA(idxA - 1);
			if (e.key === 'ArrowRight') navA(idxA + 1);
			if (e.key === 'ArrowUp')    navA(0);
			if (e.key === 'ArrowDown')  navA(historyA.length - 1);
		} else if (mode === 'opening') {
			if (e.key === 'ArrowLeft')  navOp(idxOp - 1);
			if (e.key === 'ArrowRight') navOp(idxOp + 1);
			if (e.key === 'ArrowUp')    navOp(0);
			if (e.key === 'ArrowDown')  navOp(historyOp.length - 1);
		}
	}

	// ── Flip board ───────────────────────────────────────────────────────────────
	let flipped = $state(false);
	const boardColor = $derived<'white' | 'black'>(flipped ? 'black' : 'white');

	// ── NavTimeline: props derivati dal mode corrente ────────────────────────────
	const tlCurrent = $derived(
		mode === 'pgn'     ? pgnIdx :
		mode === 'opening' ? idxOp  : idxA
	);
	const tlTotal = $derived(
		mode === 'pgn'     ? pgnPositions.length - 1 :
		mode === 'opening' ? historyOp.length - 1    : historyA.length - 1
	);
	function tlFirst() {
		if (mode === 'pgn') pgFirst();
		else if (mode === 'opening') navOp(0);
		else navA(0);
	}
	function tlPrev() {
		if (mode === 'pgn') pgPrev();
		else if (mode === 'opening') navOp(idxOp - 1);
		else navA(idxA - 1);
	}
	function tlNext() {
		if (mode === 'pgn') pgNext();
		else if (mode === 'opening') navOp(idxOp + 1);
		else navA(idxA + 1);
	}
	function tlLast() {
		if (mode === 'pgn') pgLast();
		else if (mode === 'opening') navOp(historyOp.length - 1);
		else navA(historyA.length - 1);
	}
	function tlGoto(i: number) {
		if (mode === 'pgn') pgnIdx = i;
		else if (mode === 'opening') navOp(i);
		else navA(i);
	}
	function tlUndo() {
		if (mode === 'pgn') pgPrev();
		else if (mode === 'opening') navOp(idxOp - 1);
		else navA(idxA - 1);
	}
	function tlReset() {
		if (mode === 'pgn') { pgnIdx = 0; }
		else if (mode === 'opening') resetOpening();
		else resetA();
	}
	const tlCanUndo = $derived(
		mode === 'pgn'     ? pgnIdx > 0 :
		mode === 'opening' ? idxOp > 0  : idxA > 0
	);
	const tlCanReset = $derived(
		mode === 'pgn'     ? pgnPositions.length > 1 :
		mode === 'opening' ? idxOp > 0 || historyOp.length > 1 :
		historyA.length > 1
	);

	// ── Mode switch ───────────────────────────────────────────────────────────────
	function switchMode(m: Mode) {
		mode        = m;
		bestArrow   = null;
		bestExplain = '';
		evalResult  = null;
		theoryArrow = null;
		engine?.stop();
	}
</script>

<svelte:head>
	<title>Chess — {$t.nav.learn}</title>
</svelte:head>
<svelte:window onkeydown={handleKey} />

<div class="learn-page">

	<!-- ── Mode tabs ──────────────────────────────────────────────────────── -->
	<div class="mode-bar">
		<div class="mode-tabs">
			<button class="mode-tab" class:active={mode==='free-a'} onclick={() => switchMode('free-a')}>
				🎯 Libero
			</button>
			<button class="mode-tab" class:active={mode==='setup'} onclick={() => switchMode('setup')}>
				🔧 Setup
			</button>
			<button class="mode-tab" class:active={mode==='pgn'} onclick={() => switchMode('pgn')}>
				📋 PGN
			</button>
			<button class="mode-tab" class:active={mode==='opening'} onclick={() => switchMode('opening')}>
				📚 Apertura
			</button>
		</div>
		<button
			class="flip-btn"
			class:flipped
			onclick={() => flipped = !flipped}
			title="Ruota scacchiera"
		>⇅</button>

		<span class="engine-status" class:ready={engineReady}>
			{engineReady ? '⚙ Stockfish pronto' : '⚙ Caricamento motore…'}
		</span>
	</div>

	<!-- ── Main grid: eval + board + panel ────────────────────────────────── -->
	<div class="learn-layout">

		<!-- Eval bar (colonna sinistra, solo se c'è un risultato) -->
		<div class="eval-col">
			{#if mode !== 'pgn'}
				<div class="eval-bar-wrap" title="{evalScore} — {evalText}">
					<div class="eval-black" style="height:{100 - evalPct}%"></div>
					<div class="eval-white" style="height:{evalPct}%"></div>
					<!-- label al confine nero/bianco, colore contrastante -->
					<span class="eval-score-label"
						style="bottom:{evalPct}%; color:{evalPct > 50 ? '#1a1a1a' : '#f0f0f0'}">
						{evalScore}
					</span>
				</div>
			{/if}
		</div>

		<!-- Scacchiera -->
		<div class="board-col">
			<div class="board-wrap">
				{#if mode === 'free-a'}
					<Board
						fen={fenA}
						playerColor={boardColor}
						isMyTurn={true}
						freePlay={true}
						lastMove={lastMoveA}
						arrows={bestArrow ? [bestArrow] : []}
						onMove={handleFreeMove}
					/>
				{:else if mode === 'setup'}
					<SetupBoard
						board={setupBoard}
						activePalettePiece={selectedPiece}
						onBoardChange={onSetupBoardChange}
						onPiecePlaced={() => { /* mantieni selezionato per piazzamenti multipli */ }}
					/>
				{:else if mode === 'pgn'}
					<Board
						fen={pgnPositions[pgnIdx]?.fen ?? INITIAL_FEN}
						playerColor={boardColor}
						isMyTurn={false}
						lastMove={pgnLastMove as any}
						onMove={() => {}}
					/>
				{:else if mode === 'opening'}
					<Board
						fen={fenOp}
						playerColor={boardColor}
						isMyTurn={true}
						freePlay={true}
						lastMove={lastMoveOp}
						arrows={theoryArrow ? [theoryArrow] : (bestArrow ? [bestArrow] : [])}
						onMove={handleOpeningMove}
					/>
				{/if}
			</div>

		</div>

		<!-- Pannello laterale -->
		<div class="panel-col">

			<!-- Navigazione + azioni (tutte le modalità tranne Setup) -->
			{#if mode !== 'setup'}
				<div class="nav-row">
					<NavTimeline
						current={tlCurrent}
						total={tlTotal}
						showTrack={true}
						onFirst={tlFirst}
						onPrev={tlPrev}
						onNext={tlNext}
						onLast={tlLast}
						onGoto={tlGoto}
					/>
				</div>

				<div class="unified-actions">
					<button class="action-btn" onclick={tlUndo} disabled={!tlCanUndo}>
						↩ Annulla
					</button>
					<button class="action-btn danger" onclick={tlReset} disabled={!tlCanReset}>
						↺ Reset
					</button>
				</div>
			{/if}

			<!-- ── LIBERO A ─────────────────────────────────────── -->
			{#if mode === 'free-a'}
				<div class="panel-card">
					<div class="turn-row" class:black={turnA === 'black'}>
						<span class="turn-dot"></span>
						<span>Turno: <strong>{turnA === 'white' ? '⬜ Bianco' : '⬛ Nero'}</strong></span>
					</div>
					<p class="panel-hint">Muovi qualsiasi pezzo di entrambi i colori in qualsiasi ordine.</p>
				</div>

				<!-- Engine panel -->
				<div class="panel-card engine-card">
					{#if evalResult}
						<div class="eval-summary">
							<span class="eval-num" class:positive={evalResult.score > 0}>
								{evalScore}
							</span>
							<span class="eval-desc">{evalText}</span>
						</div>
					{/if}
					<button class="hint-btn" onclick={() => showBestMove(fenA)}
						disabled={!engineReady || analyzing}>
						{analyzing ? '⏳ Analisi…' : '💡 Miglior Mossa'}
					</button>
					{#if bestExplain}
						<div class="explain-box">
							<span class="explain-arrow">→</span>
							{bestExplain}
						</div>
					{/if}
					<button class="eval-btn" onclick={() => analyzePosition(fenA)}
						disabled={!engineReady || analyzing}>
						📊 Valuta posizione
					</button>
				</div>

				{#if sanHistA.length > 0}
					<div class="panel-card moves-log">
						<p class="panel-label">Mosse</p>
						<div class="free-moves">
							{#each sanHistA as san, i}
								{#if i % 2 === 0}<span class="move-num">{Math.floor(i/2)+1}.</span>{/if}
								<span class="san-chip">{san}</span>
							{/each}
						</div>
					</div>
				{/if}

			<!-- ── SETUP ──────────────────────────────────────────── -->
			{:else if mode === 'setup'}
				<div class="panel-card palette-card">
					<p class="panel-label">Palette pezzi</p>
					<p class="panel-hint">
						{#if selectedPiece}
							<strong style="color:var(--accent)">Pezzo selezionato — clicca una casella o trascinalo sulla scacchiera</strong>
						{:else}
							Clicca o trascina un pezzo sulla scacchiera. <br/>Tasto destro per rimuovere.
						{/if}
					</p>

					<!-- Pezzi bianchi -->
					<div class="palette-section">
						<span class="palette-color-label">⬜ Bianchi</span>
						<div class="palette-row">
							{#each PALETTE_W as code}
								<button
									class="palette-btn"
									class:active={selectedPiece === code}
									onpointerdown={(e) => onPalettePointerDown(e, code)}
									title={code}
								>
									{@html PIECE_SVG[code]}
								</button>
							{/each}
						</div>
					</div>

					<!-- Pezzi neri -->
					<div class="palette-section">
						<span class="palette-color-label">⬛ Neri</span>
						<div class="palette-row">
							{#each PALETTE_B as code}
								<button
									class="palette-btn"
									class:active={selectedPiece === code}
									onpointerdown={(e) => onPalettePointerDown(e, code)}
									title={code}
								>
									{@html PIECE_SVG[code]}
								</button>
							{/each}
						</div>
					</div>

					{#if selectedPiece}
						<button class="deselect-btn" onclick={() => selectedPiece = null}>
							✕ Deseleziona
						</button>
					{/if}

					<div class="setup-turn-row">
						<span class="palette-color-label" style="margin:0">Muove:</span>
						<label class="radio-opt">
							<input type="radio" bind:group={setupTurn} value="w" /> ⬜ Bianco
						</label>
						<label class="radio-opt">
							<input type="radio" bind:group={setupTurn} value="b" /> ⬛ Nero
						</label>
					</div>

					<div class="free-actions">
						<button class="action-btn" onclick={clearSetup}>🗑 Svuota</button>
						<button class="action-btn danger" onclick={resetSetup}>↺ Reset</button>
					</div>
				</div>

				<div class="panel-card engine-card">
					{#if evalResult}
						<div class="eval-summary">
							<span class="eval-num" class:positive={evalResult.score > 0}>{evalScore}</span>
							<span class="eval-desc">{evalText}</span>
						</div>
					{/if}
					<button class="hint-btn" onclick={() => showBestMove(setupFen)}
						disabled={!engineReady || analyzing}>
						{analyzing ? '⏳ Analisi…' : '💡 Miglior Mossa'}
					</button>
					{#if bestExplain}
						<div class="explain-box"><span class="explain-arrow">→</span>{bestExplain}</div>
					{/if}
					<button class="eval-btn" onclick={() => analyzePosition(setupFen)}
						disabled={!engineReady || analyzing}>
						📊 Valuta posizione
					</button>
				</div>

			<!-- ── PGN ────────────────────────────────────────────── -->
			{:else if mode === 'pgn'}
				<div class="panel-card">
					<p class="panel-label">Importa PGN</p>
					<textarea class="pgn-textarea" bind:value={pgnText}
						placeholder="Incolla qui il PGN…&#10;Es: 1. e4 e5 2. Nf3 Nc6 3. Bb5"
						rows="5"></textarea>
					{#if pgnError}<p class="pgn-error">{pgnError}</p>{/if}
					<button class="hint-btn" onclick={loadPgn} disabled={!pgnText.trim()}>
						▶ Carica PGN
					</button>
				</div>

				{#if pgnLoaded}
					<div class="panel-card">
						<div class="nav-controls">
							<button class="nav-btn" onclick={pgFirst}  disabled={pgnIdx===0}>⏮</button>
							<button class="nav-btn" onclick={pgPrev}   disabled={pgnIdx===0}>◀</button>
							<span class="nav-pos">{pgnIdx} / {pgnPositions.length-1}</span>
							<button class="nav-btn" onclick={pgNext}   disabled={pgnIdx===pgnPositions.length-1}>▶</button>
							<button class="nav-btn" onclick={pgLast}   disabled={pgnIdx===pgnPositions.length-1}>⏭</button>
						</div>
						<p class="nav-hint">← → tasti freccia</p>
					</div>

					<div class="move-list" bind:this={moveListEl}>
						{#each pgnPositions as pos, i}
							{#if i === 0}
								<button class="move-chip" class:move-active={pgnIdx===0}
									onclick={() => pgnIdx=0}>Inizio</button>
							{:else if (i-1)%2===0}
								<span class="move-n">{Math.floor((i-1)/2)+1}.</span>
								<button class="move-chip" class:move-active={pgnIdx===i}
									onclick={() => pgnIdx=i}>{pos.label.split('. ')[1]??pos.label}</button>
							{:else}
								<button class="move-chip" class:move-active={pgnIdx===i}
									onclick={() => pgnIdx=i}>{pos.label.split('… ')[1]??pos.label}</button>
							{/if}
						{/each}
					</div>
				{/if}

			<!-- ── APERTURA ───────────────────────────────────────── -->
			{:else if mode === 'opening'}
				<div class="panel-card">
					<p class="panel-label">Scegli apertura</p>
					<select class="opening-select" onchange={(e) => {
						const op = OPENINGS.find(o => o.eco + o.nameIt === (e.target as HTMLSelectElement).value);
						if (op) selectOpening(op);
					}}>
						<option value="">— Seleziona un'apertura —</option>
						{#each OPENINGS as op}
							<option value={op.eco + op.nameIt}>{op.eco} — {op.nameIt}</option>
						{/each}
					</select>
				</div>

				{#if selectedOpening}
					<div class="panel-card">
						<div class="opening-info">
							<p class="opening-name">{selectedOpening.nameIt}</p>
							<p class="opening-eco">{selectedOpening.eco}</p>
						</div>

						{#if detectedOpening}
							<div class="detected-badge">
								✓ Rilevata: <strong>{detectedOpening.nameIt}</strong>
							</div>
						{/if}

						{#if theoryDeviation}
							<div class="deviation-badge">
								⚠ Fuori dalla linea teorica
							</div>
						{/if}

						<button class="hint-btn" onclick={showTheoryMove}
							disabled={!engineReady || analyzing}>
							{analyzing ? '⏳ Analisi…' : '📚 Mossa Teorica / Migliore'}
						</button>

						{#if bestExplain || theoryArrow}
							<div class="explain-box">
								<span class="explain-arrow">→</span>
								{bestExplain || 'Freccia verde = mossa teorica consigliata.'}
							</div>
						{/if}
					</div>

					<div class="panel-card engine-card">
						{#if evalResult}
							<div class="eval-summary">
								<span class="eval-num" class:positive={evalResult.score > 0}>{evalScore}</span>
								<span class="eval-desc">{evalText}</span>
							</div>
						{/if}
						<button class="eval-btn" onclick={() => analyzePosition(fenOp)}
							disabled={!engineReady || analyzing}>
							📊 Valuta posizione
						</button>
					</div>

				{/if}
			{/if}

		</div><!-- /panel-col -->
	</div><!-- /learn-layout -->
</div>

<!-- Ghost globale per drag dalla palette -->
{#if paletteDragging && paletteDragPiece}
	<div
		class="palette-drag-ghost"
		style="left:{paletteDragX - 36}px; top:{paletteDragY - 36}px"
	>
		{@html PIECE_SVG[paletteDragPiece as PieceCode] ?? ''}
	</div>
{/if}

<style>
	/* ── Page ── */
	.learn-page {
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 0.75rem 1rem 0.5rem;
		gap: 0.6rem;
		overflow: hidden;
	}

	/* ── Mode bar ── */
	.mode-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}
	.mode-tabs {
		display: flex;
		gap: 0.2rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.2rem;
	}
	.mode-tab {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.3rem 0.8rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		white-space: nowrap;
	}
	.mode-tab:hover { color: var(--text); }
	.mode-tab.active { background: var(--accent); color: #000; }

	/* ── Flip button ── */
	.flip-btn {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 7px;
		color: var(--text-muted);
		font-size: 1.1rem;
		width: 34px; height: 34px;
		display: flex; align-items: center; justify-content: center;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s, transform 0.2s;
		flex-shrink: 0;
	}
	.flip-btn:hover { border-color: var(--accent); color: var(--text); }
	.flip-btn.flipped { transform: rotate(180deg); border-color: var(--accent); color: var(--accent); }

	.engine-status {
		font-size: 0.72rem;
		color: var(--text-muted);
		opacity: 0.6;
		margin-left: auto;
	}
	.engine-status.ready { color: var(--accent); opacity: 0.9; }

	/* ── Layout principale ── */
	.learn-layout {
		display: grid;
		grid-template-columns: 28px 1fr 270px;
		grid-template-rows: 1fr;   /* riga unica che occupa tutto lo spazio */
		gap: 0.75rem;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Eval bar ── */
	.eval-col {
		display: flex;
		align-items: stretch;
	}
	.eval-bar-wrap {
		width: 24px;
		height: 100%;
		border-radius: 6px;
		overflow: visible;   /* il label al confine non viene tagliato */
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		cursor: default;
		position: relative;
	}
	.eval-black { background: #1a1a1a; transition: height 0.4s ease; }
	.eval-white {
		background: #f0f0f0;
		transition: height 0.4s ease;
	}
	.eval-score-label {
		position: absolute;
		left: 50%;
		transform: translateX(-50%) translateY(50%);
		font-size: 0.52rem;
		font-weight: 800;
		font-family: monospace;
		writing-mode: vertical-rl;
		text-orientation: mixed;
		line-height: 1;
		pointer-events: none;
		transition: bottom 0.4s ease, color 0.3s;
		white-space: nowrap;
	}

	/* ── Board col ── */
	.board-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 0;
		height: 100%;   /* occupa tutta la riga del grid */
	}
	.board-wrap {
		/* Il div che avvolge <Board>: height-driven come il componente interno */
		height: 100%;
		width: auto;
		max-width: 100%;
		aspect-ratio: 1;
	}

	/* ── Panel col ── */
	.panel-col {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		overflow-y: auto;
		min-height: 0;
		padding-right: 0.15rem;
	}
	.nav-row {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.35rem 0.5rem;
		flex-shrink: 0;
	}
	.panel-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.85rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		flex-shrink: 0;
	}
	.panel-label {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 700;
	}
	.panel-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
	}

	/* ── Turn indicator ── */
	.turn-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	.turn-dot {
		width: 11px; height: 11px;
		border-radius: 50%;
		background: #f0f0f0;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	.turn-row.black .turn-dot { background: #1a1a1a; border-color: var(--text-muted); }

	/* ── Engine panel ── */
	.engine-card { gap: 0.65rem; }
	.eval-summary {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.eval-num {
		font-size: 1.3rem;
		font-weight: 800;
		font-family: monospace;
		color: var(--text-muted);
	}
	.eval-num.positive { color: var(--accent); }
	.eval-desc {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.hint-btn {
		background: var(--accent);
		color: #000;
		border: none;
		border-radius: 8px;
		padding: 0.55rem 0.8rem;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.hint-btn:hover:not(:disabled) { opacity: 0.88; }
	.hint-btn:disabled { opacity: 0.45; cursor: default; }
	.eval-btn {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text-muted);
		padding: 0.45rem 0.8rem;
		font-size: 0.8rem;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.eval-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
	.eval-btn:disabled { opacity: 0.4; cursor: default; }
	.explain-box {
		background: rgba(0,188,212,0.08);
		border: 1px solid rgba(0,188,212,0.3);
		border-radius: 7px;
		padding: 0.55rem 0.7rem;
		font-size: 0.78rem;
		color: var(--text);
		line-height: 1.5;
		display: flex;
		gap: 0.4rem;
	}
	.explain-arrow { color: #00bcd4; font-weight: 700; flex-shrink: 0; }

	/* ── Action buttons ── */
	.free-actions    { display: flex; gap: 0.4rem; flex-shrink: 0; }
	.unified-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
	.action-btn {
		flex: 1;
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
		padding: 0.5rem 0.5rem;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.action-btn:hover:not(:disabled) { border-color: var(--accent); }
	.action-btn:disabled { opacity: 0.4; cursor: default; }
	.action-btn.danger { border-color: var(--danger); color: var(--danger); }
	.action-btn.danger:hover:not(:disabled) { background: rgba(201,95,95,0.1); }

	/* ── Move log ── */
	.moves-log { overflow: hidden; }
	.free-moves {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		align-items: baseline;
		max-height: 100px;
		overflow-y: auto;
	}
	.move-num { font-size: 0.68rem; color: var(--text-muted); }
	.san-chip { font-size: 0.78rem; font-family: monospace; color: var(--text); padding: 0.1rem 0.2rem; border-radius: 3px; background: rgba(255,255,255,0.05); }

	/* ── Palette (Setup) ── */
	.palette-card { gap: 0.7rem; }
	.palette-section { display: flex; flex-direction: column; gap: 0.35rem; }
	.palette-color-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		font-weight: 600;
	}
	.palette-row { display: flex; gap: 0.3rem; flex-wrap: wrap; }
	.palette-btn {
		width: 48px; height: 48px;
		background: var(--bg-input);
		border: 2px solid var(--border);
		border-radius: 8px;
		cursor: grab;
		display: flex; align-items: center; justify-content: center;
		padding: 3px;
		transition: border-color 0.15s, background 0.15s, transform 0.1s;
		touch-action: none;
	}
	.palette-btn :global(svg) { width: 38px; height: 38px; pointer-events: none; }
	.palette-btn:hover { border-color: var(--accent); transform: scale(1.08); }
	.palette-btn.active {
		border-color: var(--accent);
		background: rgba(129,182,76,0.18);
		box-shadow: 0 0 0 3px rgba(129,182,76,0.25);
		transform: scale(1.05);
	}
	.palette-btn:active { cursor: grabbing; }
	.deselect-btn {
		align-self: flex-start;
		background: none;
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.75rem;
		padding: 0.25rem 0.6rem;
		border-radius: 5px;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.deselect-btn:hover { border-color: var(--accent); color: var(--text); }
	.setup-turn-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
	.radio-opt { font-size: 0.82rem; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 0.25rem; }
	.radio-opt input { accent-color: var(--accent); }

	/* Ghost drag globale dalla palette */
	:global(.palette-drag-ghost) {
		position: fixed;
		width: 72px; height: 72px;
		pointer-events: none;
		z-index: 10000;
		filter: drop-shadow(0 6px 16px rgba(0,0,0,0.55));
		transform: scale(1.2);
	}
	:global(.palette-drag-ghost) :global(svg) { width: 100%; height: 100%; }

	/* ── PGN ── */
	.pgn-textarea {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		padding: 0.5rem 0.6rem;
		font-size: 0.78rem;
		font-family: monospace;
		resize: none;
		outline: none;
		line-height: 1.5;
		transition: border-color 0.2s;
	}
	.pgn-textarea:focus { border-color: var(--accent); }
	.pgn-error { font-size: 0.75rem; color: var(--danger); }
	.nav-controls { display: flex; align-items: center; gap: 0.3rem; }
	.nav-btn {
		background: none; border: none; color: var(--text-muted); font-size: 1rem;
		cursor: pointer; padding: 0.2rem 0.3rem; border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}
	.nav-btn:hover:not(:disabled) { color: var(--text); background: rgba(255,255,255,0.07); }
	.nav-btn:disabled { opacity: 0.3; cursor: default; }
	.nav-pos { flex: 1; text-align: center; font-size: 0.75rem; color: var(--text-muted); font-family: monospace; }
	.nav-hint { font-size: 0.68rem; color: var(--text-muted); text-align: center; opacity: 0.6; }
	.move-list {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.65rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		align-items: baseline;
		overflow-y: auto;
		flex: 1;
		min-height: 60px;
	}
	.move-n { font-size: 0.68rem; color: var(--text-muted); flex-shrink: 0; }
	.move-chip {
		background: none; border: none; font-size: 0.78rem; font-family: monospace;
		color: var(--text-muted); cursor: pointer; padding: 0.12rem 0.28rem; border-radius: 4px;
		transition: background 0.12s, color 0.12s;
	}
	.move-chip:hover { background: rgba(255,255,255,0.07); color: var(--text); }
	.move-chip.move-active { background: var(--accent); color: #000; font-weight: 700; }

	/* ── Opening ── */
	.opening-select {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 7px;
		color: var(--text);
		padding: 0.5rem 0.6rem;
		font-size: 0.82rem;
		outline: none;
		cursor: pointer;
		transition: border-color 0.2s;
	}
	.opening-select:focus { border-color: var(--accent); }
	.opening-info { display: flex; justify-content: space-between; align-items: baseline; }
	.opening-name { font-size: 0.9rem; font-weight: 700; }
	.opening-eco { font-size: 0.72rem; color: var(--text-muted); font-family: monospace; }
	.detected-badge {
		background: rgba(129,182,76,0.12);
		border: 1px solid rgba(129,182,76,0.4);
		border-radius: 6px;
		padding: 0.35rem 0.6rem;
		font-size: 0.75rem;
		color: var(--accent);
	}
	.deviation-badge {
		background: rgba(255,152,0,0.1);
		border: 1px solid rgba(255,152,0,0.4);
		border-radius: 6px;
		padding: 0.35rem 0.6rem;
		font-size: 0.75rem;
		color: #ff9800;
	}

	/* ── Mobile ── */
	@media (max-width: 768px) {
		.learn-page { padding: 0.5rem 0.5rem 0.25rem; overflow-y: auto; }
		.learn-layout { grid-template-columns: 20px 1fr; grid-template-rows: auto auto; overflow: visible; }
		.panel-col { grid-column: 1 / -1; overflow: visible; }
		.board-wrap { max-width: min(calc(100vw - 1.5rem), 480px); }
		.mode-tab { font-size: 0.72rem; padding: 0.25rem 0.55rem; }
		.engine-status { display: none; }
	}
</style>
