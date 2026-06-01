<script lang="ts">
	import { Chess } from 'chess.js';
	import { PIECE_SVG, type PieceCode } from './pieces';

	let {
		fen,
		playerColor,
		isMyTurn,
		lastMove,
		onMove,
		arrows = [],
		squareBadge = null,
		freePlay = false   // ignora il turno: entrambi i colori sono mossi liberamente
	}: {
		fen: string;
		playerColor: 'white' | 'black';
		isMyTurn: boolean;
		lastMove: { from: string; to: string } | null;
		onMove: (from: string, to: string, promotion?: string) => void;
		arrows?: { from: string; to: string; color?: string }[];
		squareBadge?: { square: string; symbol: string; color: string } | null;
		freePlay?: boolean;
	} = $props();

	// ── Arrow helpers ──────────────────────────────────────────────
	const FILES_STR = 'abcdefgh';

	function squareCenter(sq: string): { x: number; y: number } {
		const fi   = FILES_STR.indexOf(sq[0]);
		const rank = parseInt(sq[1]);
		if (playerColor === 'white') {
			return { x: fi + 0.5, y: 8.5 - rank };
		} else {
			return { x: 7.5 - fi, y: rank - 0.5 };
		}
	}

	interface ArrowGeom {
		x1: number; y1: number;   // shaft start
		bx: number; by: number;   // arrowhead base
		tx: number; ty: number;   // arrowhead tip
		lx: number; ly: number;   // left wing
		rx: number; ry: number;   // right wing
	}

	function computeArrow(from: string, to: string): ArrowGeom | null {
		if (from.length < 2 || to.length < 2) return null;
		const P1 = squareCenter(from);
		const P2 = squareCenter(to);
		const dx = P2.x - P1.x, dy = P2.y - P1.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len < 0.01) return null;
		const ux = dx / len, uy = dy / len;
		const px = -uy,       py =  ux;   // perpendicular unit vector

		const startOff  = 0.28;
		const headLen   = 0.38;
		const headWidth = 0.22;
		const tipOff    = 0.22;

		const x1 = P1.x + ux * startOff;
		const y1 = P1.y + uy * startOff;
		const tx = P2.x - ux * tipOff;
		const ty = P2.y - uy * tipOff;
		const bx = tx - ux * headLen;
		const by = ty - uy * headLen;
		return {
			x1, y1, tx, ty, bx, by,
			lx: bx + px * headWidth, ly: by + py * headWidth,
			rx: bx - px * headWidth, ry: by - py * headWidth,
		};
	}

	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

	// ── Reactive state ─────────────────────────────────────────────
	let selectedSquare   = $state<string | null>(null);
	let legalTargets     = $state<string[]>([]);
	let promotionPending = $state<{ from: string; to: string } | null>(null);

	// Drag state (left-click)
	let isDragActive = $state(false);
	let dragFrom     = $state<string | null>(null);
	let dragSvg      = $state<string | null>(null);
	let dragX        = $state(0);
	let dragY        = $state(0);
	let squareSize   = $state(60);

	// ── Right-click arrow drawing (chess.com style) ────────────────
	let drawnArrows   = $state<{ from: string; to: string }[]>([]);
	let highlighted   = $state<string[]>([]); // caselle evidenziate (right-click senza drag)
	let arrowDragFrom = $state<string | null>(null);  // quadrato di partenza dell'arrow drag
	let arrowPreview  = $state<{ from: string; to: string } | null>(null); // freccia in costruzione

	// Tutte le frecce da renderizzare: prop + disegnate utente + preview
	const allArrows = $derived([
		...arrows,
		...drawnArrows.map(a => ({ ...a, color: 'rgba(235, 97, 0, 0.82)' })),
		...(arrowPreview ? [{ ...arrowPreview, color: 'rgba(235, 97, 0, 0.5)' }] : []),
	]);

	function squareFromPoint(x: number, y: number): string | null {
		if (!boardEl) return null;
		const els = document.elementsFromPoint(x, y);
		const btn = els.find(el => el.hasAttribute('data-sq')) as HTMLElement | null;
		return btn?.dataset.sq ?? null;
	}

	function startArrowDrag(fromSq: string) {
		arrowDragFrom = fromSq;
		arrowPreview  = null;
	}

	function updateArrowPreview(toSq: string | null) {
		if (!arrowDragFrom) return;
		arrowPreview = toSq && toSq !== arrowDragFrom ? { from: arrowDragFrom, to: toSq } : null;
	}

	function finishArrowDrag(toSq: string | null) {
		if (!arrowDragFrom) return;
		if (!toSq || toSq === arrowDragFrom) {
			// Click destro senza drag → evidenzia casella (toggle)
			highlighted = highlighted.includes(arrowDragFrom)
				? highlighted.filter(s => s !== arrowDragFrom)
				: [...highlighted, arrowDragFrom];
		} else {
			// Toggle freccia: se esiste già la rimuove, altrimenti la aggiunge
			const key = `${arrowDragFrom}-${toSq}`;
			const exists = drawnArrows.some(a => `${a.from}-${a.to}` === key);
			drawnArrows = exists
				? drawnArrows.filter(a => `${a.from}-${a.to}` !== key)
				: [...drawnArrows, { from: arrowDragFrom, to: toSq }];
		}
		arrowDragFrom = null;
		arrowPreview  = null;
	}

	function clearUserMarkings() {
		drawnArrows   = [];
		highlighted   = [];
		arrowDragFrom = null;
		arrowPreview  = null;
	}

	// Non-reactive internal tracking
	let boardEl: HTMLElement | undefined;
	let ptrDownSquare: string | null = null;
	let ptrStartX = 0;
	let ptrStartY = 0;

	// Higher threshold on touch devices to avoid accidental drags on taps
	const DRAG_THRESHOLD = 8; // px before entering drag mode

	// ── Chess engine ───────────────────────────────────────────────
	const chess = $derived.by(() => {
		const c = new Chess();
		try { c.load(fen); } catch {}
		return c;
	});

	const ranks    = $derived(playerColor === 'white' ? RANKS : [...RANKS].reverse());
	const files    = $derived(playerColor === 'white' ? FILES : [...FILES].reverse());
	const leftFile  = $derived(files[0]);
	const botRank   = $derived(ranks[ranks.length - 1]);

	function sq(f: string, r: number) { return `${f}${r}`; }

	function pieceSvg(square: string): string | null {
		const p = chess.get(square as any);
		if (!p) return null;
		return PIECE_SVG[`${p.color}${p.type.toUpperCase()}` as PieceCode] ?? null;
	}

	function isLight(f: string, r: number) { return (FILES.indexOf(f) + r) % 2 === 1; }
	function isSel(s: string)    { return selectedSquare === s; }
	function isLegal(s: string)  { return legalTargets.includes(s); }
	function isLast(s: string)   { return lastMove?.from === s || lastMove?.to === s; }

	// ── Helper: legal targets per un pezzo (gestisce freePlay) ───
	// In freePlay, se il pezzo è del colore "sbagliato" creiamo un'istanza
	// chess con il turno invertito per calcolare le mosse legali.
	function computeLegalTargets(square: string): string[] {
		const piece = chess.get(square as any);
		if (!piece) return [];

		// Normale: usa l'istanza corrente
		let targets = chess.moves({ square: square as any, verbose: true }).map((m: any) => m.to);
		if (targets.length > 0 || !freePlay) return targets;

		// freePlay: il pezzo è del colore "non di turno" → invertiamo il turno nel FEN
		try {
			const parts = chess.fen().split(' ');
			parts[1] = piece.color;             // setta il turno al colore del pezzo
			const temp = new Chess();
			temp.load(parts.join(' '));
			targets = temp.moves({ square: square as any, verbose: true }).map((m: any) => m.to);
		} catch {}
		return targets;
	}

	// ── Tap (click-to-move) ───────────────────────────────────────
	// Called from onPtrUp on pure taps — works for both mouse and touch.
	// No synthetic `click` event is used, avoiding Android timing issues.
	function handleTap(square: string) {
		if (!isMyTurn) return;

		if (selectedSquare === null) {
			const piece = chess.get(square as any);
			const myColor = playerColor === 'white' ? 'w' : 'b';
			// freePlay: qualsiasi pezzo è selezionabile; normale: solo il proprio
			if (!piece || (!freePlay && piece.color !== myColor)) return;
			selectedSquare = square;
			legalTargets   = computeLegalTargets(square);
		} else {
			if (legalTargets.includes(square)) {
				tryMove(selectedSquare, square);
			}
			selectedSquare = null;
			legalTargets   = [];
		}
	}

	// ── Unified pointer handler (drag + tap, desktop + Android) ───
	function onPtrDown(e: PointerEvent, square: string, svg: string | null) {
		if (!isMyTurn) return;

		// ① For touch pointers: prevent the browser from hijacking the gesture
		//    for scroll/zoom and from generating delayed synthetic click events.
		//    Do NOT call preventDefault() for mouse — it would suppress the
		//    `click` event that Playwright relies on during automated testing.
		if (e.pointerType === 'touch') e.preventDefault();

		const piece   = chess.get(square as any);
		const myColor = playerColor === 'white' ? 'w' : 'b';
		// freePlay: qualsiasi pezzo è draggabile; normale: solo il proprio
		const isOwn   = !!(piece && (freePlay || piece.color === myColor));

		// Record tap origin
		ptrDownSquare = square;
		ptrStartX     = e.clientX;
		ptrStartY     = e.clientY;
		dragX         = e.clientX;
		dragY         = e.clientY;

		// Prepare ghost only for own/free pieces (drag candidates)
		if (isOwn && svg) {
			dragSvg = svg;
			if (boardEl) squareSize = boardEl.getBoundingClientRect().width / 8;
		}

		function onPtrMove(me: PointerEvent) {
			dragX = me.clientX;
			dragY = me.clientY;

			// Only enter drag mode if there's an own piece to drag
			if (!isDragActive && dragSvg) {
				const dx = me.clientX - ptrStartX;
				const dy = me.clientY - ptrStartY;
				if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
					isDragActive   = true;
					dragFrom       = ptrDownSquare;
					selectedSquare = ptrDownSquare;
					legalTargets   = computeLegalTargets(ptrDownSquare!);
				}
			}
		}

		function onPtrUp(ue: PointerEvent) {
			document.removeEventListener('pointermove', onPtrMove);
			document.removeEventListener('pointerup',   onPtrUp);
			document.removeEventListener('pointercancel', onPtrCancel);

			if (isDragActive) {
				const from    = dragFrom!;
				const targets = [...legalTargets];

				isDragActive   = false;
				dragFrom       = null;
				dragSvg        = null;
				selectedSquare = null;
				legalTargets   = [];
				ptrDownSquare  = null;
				document.body.style.cursor = '';

				// elementsFromPoint ignores the ghost (pointer-events:none)
				// and finds the actual board square under the finger/cursor.
				const els = document.elementsFromPoint(ue.clientX, ue.clientY);
				const btn = els.find(el => el.hasAttribute('data-sq')) as HTMLElement | null;
				const to  = btn?.dataset.sq ?? null;

				if (to && targets.includes(to)) tryMove(from, to);
			} else {
				// Pure tap: no drag occurred → treat as click-to-move
				const tapSq = ptrDownSquare;
				dragSvg       = null;
				ptrDownSquare = null;
				if (tapSq) handleTap(tapSq);
			}
		}

		// Cancel (e.g. Android system gesture intercepted the touch)
		function onPtrCancel() {
			document.removeEventListener('pointermove', onPtrMove);
			document.removeEventListener('pointerup',   onPtrUp);
			document.removeEventListener('pointercancel', onPtrCancel);
			isDragActive   = false;
			dragFrom       = null;
			dragSvg        = null;
			selectedSquare = null;
			legalTargets   = [];
			ptrDownSquare  = null;
			document.body.style.cursor = '';
		}

		document.addEventListener('pointermove',  onPtrMove);
		document.addEventListener('pointerup',    onPtrUp);
		document.addEventListener('pointercancel', onPtrCancel);
	}

	// Update cursor globally while dragging
	$effect(() => {
		document.body.style.cursor = isDragActive ? 'grabbing' : '';
	});

	// ── Right-click mouse events per arrow drawing ─────────────────
	function onBoardMouseDown(e: MouseEvent) {
		if (e.button !== 2) return; // solo tasto destro
		e.preventDefault();
		const sq = squareFromPoint(e.clientX, e.clientY);
		if (sq) startArrowDrag(sq);
	}

	function onBoardMouseMove(e: MouseEvent) {
		if (!arrowDragFrom) return;
		const sq = squareFromPoint(e.clientX, e.clientY);
		updateArrowPreview(sq);
	}

	function onBoardMouseUp(e: MouseEvent) {
		if (e.button !== 2) return;
		const sq = squareFromPoint(e.clientX, e.clientY);
		finishArrowDrag(sq);
	}

	// ── Shared move logic ──────────────────────────────────────────
	function tryMove(from: string, to: string) {
		const piece = chess.get(from as any);
		const isPromo =
			piece?.type === 'p' &&
			((playerColor === 'white' && to[1] === '8') ||
			 (playerColor === 'black' && to[1] === '1'));
		if (isPromo) {
			promotionPending = { from, to };
		} else {
			onMove(from, to);
		}
	}

	// ── Promotion ──────────────────────────────────────────────────
	function choosePromotion(code: PieceCode) {
		if (!promotionPending) return;
		onMove(promotionPending.from, promotionPending.to, code[1].toLowerCase());
		promotionPending = null;
	}

	const promoPieces: PieceCode[] = $derived(
		playerColor === 'white' ? ['wQ', 'wR', 'wB', 'wN'] : ['bQ', 'bR', 'bB', 'bN']
	);
</script>

<!-- ── Board shell ─────────────────────────────────────────────── -->
<div class="board-wrap">

	<!-- Promotion modal -->
	{#if promotionPending}
		<div class="promo-overlay">
			<div class="promo-modal">
				<p class="promo-label">Promozione pedone</p>
				<div class="promo-choices">
					{#each promoPieces as code}
						<button class="promo-btn" onclick={() => choosePromotion(code)}>
							{@html PIECE_SVG[code]}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- 8×8 grid -->
	<div class="board" bind:this={boardEl}
		onmousedown={onBoardMouseDown}
		onmousemove={onBoardMouseMove}
		onmouseup={onBoardMouseUp}
		oncontextmenu={(e) => e.preventDefault()}
	>
		{#each ranks as rank}
			{#each files as file}
				{@const square   = sq(file, rank)}
				{@const svg      = pieceSvg(square)}
				{@const legal    = isLegal(square)}
				{@const hasPiece = svg !== null}
				{@const light    = isLight(file, rank)}
				{@const isDragSrc = dragFrom === square}
				{@const isHighlighted = highlighted.includes(square)}
				<button
					data-sq={square}
					class="square"
					class:light
					class:dark={!light}
					class:selected={isSel(square)}
					class:last-move={isLast(square)}
					class:highlighted={isHighlighted}
					onpointerdown={(e) => { if (e.button === 0) { clearUserMarkings(); onPtrDown(e, square, svg); } }}
					aria-label={square}
				>
					<!-- Inside-board coordinate labels (chess.com style) -->
					{#if file === leftFile}
						<span class="coord rank-coord"
							class:on-light={light} class:on-dark={!light}>{rank}</span>
					{/if}
					{#if rank === botRank}
						<span class="coord file-coord"
							class:on-light={light} class:on-dark={!light}>{file}</span>
					{/if}

					<!-- Piece — faded at the drag origin -->
					{#if svg}
						<span class="piece" class:is-drag-src={isDragSrc}>{@html svg}</span>
					{/if}

					<!-- Move classification badge (top-right corner) -->
					{#if squareBadge && square === squareBadge.square && svg && squareBadge.symbol}
						<span class="sq-badge" style="--badge-bg:{squareBadge.color}">
							{squareBadge.symbol}
						</span>
					{/if}

					<!-- Legal-move dot (empty target) -->
					{#if legal && !hasPiece}
						<span class="dot"></span>
					{/if}

					<!-- Capture ring (occupied target) -->
					{#if legal && hasPiece}
						<span class="ring"></span>
					{/if}
				</button>
			{/each}
		{/each}
	</div>

	<!-- Arrow overlay — dentro board-wrap, sopra i pezzi -->
	{#if allArrows.length > 0}
		<svg class="arrows-layer" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
			{#each allArrows as arrow}
				{@const a = computeArrow(arrow.from, arrow.to)}
				{#if a}
					{@const col = arrow.color ?? 'rgba(100,190,100,0.88)'}
					<line
						x1={a.x1} y1={a.y1} x2={a.bx} y2={a.by}
						stroke={col} stroke-width="0.13" stroke-linecap="round"
					/>
					<polygon
						points="{a.lx},{a.ly} {a.tx},{a.ty} {a.rx},{a.ry}"
						fill={col}
					/>
				{/if}
			{/each}
		</svg>
	{/if}
</div>

<!-- Floating drag ghost — viewport-fixed, follows cursor -->
{#if isDragActive && dragSvg !== null}
	<div
		class="drag-ghost"
		style="left:{dragX}px; top:{dragY}px; width:{squareSize * 1.1}px; height:{squareSize * 1.1}px;"
	>
		{@html dragSvg}
	</div>
{/if}

<style>
	/* ── Board wrapper ──────────────────────────────────────────── */
	.board-wrap {
		position: relative;
		/* Height-driven: si adatta all'altezza del contenitore padre,
		   la larghezza segue dall'aspect-ratio (quadrato).
		   max-width: 100% impedisce di sforare in orizzontale. */
		height: 100%;
		width: auto;
		max-width: 100%;
		aspect-ratio: 1 / 1;
	}

	@media (max-width: 768px) {
		.board-wrap {
			/* Mobile: la colonna è verticale, quindi width-driven */
			height: auto;
			width: min(calc(100vw - 1rem), calc(100dvh - 52px - 186px));
		}
	}

	/* ── 8×8 grid ───────────────────────────────────────────────── */
	.board {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-template-rows:    repeat(8, 1fr);
		border: 3px solid #1a1714;
		border-radius: 2px;
		overflow: hidden;
		box-shadow: 0 6px 24px rgba(0,0,0,0.6);
		user-select: none;
		touch-action: none; /* prevent scroll during touch-drag */
	}

	/* ── Square ──────────────────────────────────────────────────── */
	.square {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1 / 1;
		border: none;
		cursor: grab;
		padding: 0;
		/* Critical for Android: prevents browser from stealing touch
		   events for scrolling/zooming while interacting with the board */
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
		-webkit-touch-callout: none;
	}
	.square:active { cursor: grabbing; }

	.light { background: #F0D9B5; }
	.dark  { background: #B58863; }

	.light.selected  { background: #F6F669; }
	.dark.selected   { background: #BACA2B; }

	.light.last-move { background: #CDD26A; }
	.dark.last-move  { background: #AAA23A; }

	.light.highlighted { background: rgba(235, 97, 0, 0.5); }
	.dark.highlighted  { background: rgba(235, 97, 0, 0.65); }

	/* ── Coordinate labels (inside board) ───────────────────────── */
	.coord {
		position: absolute;
		font-size: clamp(8px, 1.2vw, 11px);
		font-weight: 700;
		line-height: 1;
		pointer-events: none;
		user-select: none;
	}
	.rank-coord { top: 2px;    left: 3px;  }
	.file-coord { bottom: 2px; right: 3px; }
	.on-light   { color: #B58863; }
	.on-dark    { color: #F0D9B5; }

	/* ── Piece ───────────────────────────────────────────────────── */
	.piece {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 90%;
		height: 90%;
		pointer-events: none;
		user-select: none;
		filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
		transition: opacity 0.05s;
	}
	/* Fade the origin square while dragging */
	.piece.is-drag-src { opacity: 0.15; }

	.piece :global(svg) { width: 100%; height: 100%; }

	/* ── Legal-move indicators ───────────────────────────────────── */
	.dot {
		position: absolute;
		width: 32%;
		height: 32%;
		border-radius: 50%;
		background: rgba(0,0,0,0.2);
		pointer-events: none;
	}
	.ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		box-shadow: inset 0 0 0 6px rgba(0,0,0,0.2);
		pointer-events: none;
	}

	/* ── Floating drag ghost ─────────────────────────────────────── */
	.drag-ghost {
		position: fixed;
		pointer-events: none;  /* transparent to hit-testing */
		z-index: 9999;
		/* Centre the piece on the cursor, slight scale-up */
		transform: translate(-50%, -50%) scale(1.1);
		filter: drop-shadow(0 6px 14px rgba(0,0,0,0.55));
	}
	.drag-ghost :global(svg) {
		width: 100%;
		height: 100%;
	}

	/* ── Move classification badge ──────────────────────────────── */
	.sq-badge {
		position: absolute;
		top: 4%;
		right: 4%;
		width: 36%;
		height: 36%;
		border-radius: 50%;
		background: var(--badge-bg, #888);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: clamp(9px, 2.4vw, 14px);
		font-weight: 900;
		color: #fff;
		z-index: 6;
		pointer-events: none;
		line-height: 1;
		box-shadow: 0 2px 6px rgba(0,0,0,0.65), 0 0 0 2px rgba(255,255,255,0.4);
		letter-spacing: -0.05em;
	}

	/* ── Arrow overlay ──────────────────────────────────────────── */
	.arrows-layer {
		position: absolute;
		inset: 3px;          /* compensa il border: 3px della .board */
		pointer-events: none;
		z-index: 10;
		overflow: visible;   /* frecce possono sforare leggermente il bordo */
	}

	/* ── Promotion overlay ───────────────────────────────────────── */
	.promo-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0,0,0,0.62);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 20;
		border-radius: 2px;
	}
	.promo-modal {
		background: #262421;
		border: 2px solid #81B64C;
		border-radius: 8px;
		padding: 1.1rem 1.4rem;
		text-align: center;
		box-shadow: 0 8px 32px rgba(0,0,0,0.7);
	}
	.promo-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #9E9D9A;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 0.7rem;
	}
	.promo-choices { display: flex; gap: 0.4rem; }
	.promo-btn {
		width: 52px; height: 52px;
		display: flex; align-items: center; justify-content: center;
		background: #3D3B38;
		border: 2px solid #3D3B38;
		border-radius: 6px;
		cursor: pointer; padding: 4px;
		transition: border-color 0.15s;
	}
	.promo-btn:hover { border-color: #81B64C; }
	.promo-btn :global(svg) { width: 40px; height: 40px; }
</style>
