<script lang="ts">
	import { PIECE_SVG, type PieceCode } from './pieces';

	let {
		board,
		onBoardChange,
		activePalettePiece = null,   // pezzo selezionato dalla palette (es. 'wQ')
		onPiecePlaced = () => {},     // callback dopo aver piazzato dalla palette
		playerColor = 'white',
	}: {
		board: Record<string, string>;
		onBoardChange: (board: Record<string, string>) => void;
		activePalettePiece?: string | null;
		onPiecePlaced?: () => void;
		playerColor?: 'white' | 'black';
	} = $props();

	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

	const ranks = $derived(playerColor === 'white' ? RANKS : [...RANKS].reverse());
	const files  = $derived(playerColor === 'white' ? FILES : [...FILES].reverse());

	// ── stato drag interno (board → board) ─────────────────────────────
	let selectedSquare = $state<string | null>(null);
	let dragFrom       = $state<string | null>(null);
	let isDragging     = $state(false);
	let dragX          = $state(0);
	let dragY          = $state(0);
	let dragSvg        = $state<string | null>(null);
	let squareSize     = $state(60);
	let hoveredSquare  = $state<string | null>(null);
	let boardEl: HTMLElement | undefined;

	let ptrStartX = 0;
	let ptrStartY = 0;
	const DRAG_THRESHOLD = 8;

	function sq(f: string, r: number) { return `${f}${r}`; }
	function isLight(f: string, r: number) { return (FILES.indexOf(f) + r) % 2 === 1; }

	// ── Piazza un pezzo dalla palette su una casella ────────────────────
	function placePaletteOnSquare(square: string) {
		if (!activePalettePiece) return;
		const updated = { ...board, [square]: activePalettePiece };
		onBoardChange(updated);
		onPiecePlaced();
	}

	// ── Rimuovi pezzo (tasto destro) ────────────────────────────────────
	function removePiece(square: string) {
		const updated = { ...board };
		delete updated[square];
		onBoardChange(updated);
	}

	// ── Gestione click semplice (senza drag) ────────────────────────────
	function handleTap(square: string) {
		// Priorità alla palette
		if (activePalettePiece) {
			placePaletteOnSquare(square);
			return;
		}

		if (selectedSquare === square) {
			selectedSquare = null;
			return;
		}
		if (selectedSquare !== null) {
			// Sposta pezzo da selectedSquare a square
			const updated = { ...board };
			updated[square] = board[selectedSquare];
			delete updated[selectedSquare];
			selectedSquare = null;
			onBoardChange(updated);
			return;
		}
		if (board[square]) {
			selectedSquare = square;
		}
	}

	// ── Pointer handler (drag board → board) ────────────────────────────
	function onPtrDown(e: PointerEvent, square: string) {
		// Se palette attiva → registra solo per il tap, non per il drag
		if (activePalettePiece) {
			if (e.pointerType === 'touch') e.preventDefault();
			function onUp() {
				document.removeEventListener('pointerup', onUp);
				placePaletteOnSquare(square);
			}
			document.addEventListener('pointerup', onUp);
			return;
		}

		if (!board[square]) return;
		if (e.pointerType === 'touch') e.preventDefault();

		ptrStartX = e.clientX;
		ptrStartY = e.clientY;
		dragX     = e.clientX;
		dragY     = e.clientY;
		dragSvg   = PIECE_SVG[board[square] as PieceCode] ?? null;
		if (boardEl) squareSize = boardEl.getBoundingClientRect().width / 8;

		function onPtrMove(me: PointerEvent) {
			dragX = me.clientX;
			dragY = me.clientY;

			if (!isDragging && dragSvg) {
				const dx = me.clientX - ptrStartX;
				const dy = me.clientY - ptrStartY;
				if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
					isDragging     = true;
					dragFrom       = square;
					selectedSquare = square;
				}
			}

			// Aggiorna hoveredSquare durante il drag
			if (isDragging) {
				const els = document.elementsFromPoint(me.clientX, me.clientY);
				const btn = els.find(el => el.hasAttribute('data-sq')) as HTMLElement | null;
				hoveredSquare = btn?.dataset.sq ?? null;
			}
		}

		function onPtrUp(ue: PointerEvent) {
			document.removeEventListener('pointermove', onPtrMove);
			document.removeEventListener('pointerup',   onPtrUp);
			hoveredSquare = null;

			if (isDragging) {
				const els = document.elementsFromPoint(ue.clientX, ue.clientY);
				const btn = els.find(el => el.hasAttribute('data-sq')) as HTMLElement | null;
				const to  = btn?.dataset.sq ?? null;

				isDragging     = false;
				dragSvg        = null;
				selectedSquare = null;
				document.body.style.cursor = '';

				if (to && dragFrom) {
					const updated = { ...board };
					updated[to] = board[dragFrom];
					delete updated[dragFrom];
					dragFrom = null;
					onBoardChange(updated);
				} else {
					dragFrom = null;
				}
			} else {
				dragSvg = null;
				handleTap(square);
			}
		}

		document.addEventListener('pointermove', onPtrMove);
		document.addEventListener('pointerup',   onPtrUp);
	}

	$effect(() => {
		document.body.style.cursor = isDragging ? 'grabbing' : '';
	});
</script>

<div class="setup-board-wrap">
	<div
		class="board"
		class:palette-active={!!activePalettePiece}
		bind:this={boardEl}
	>
		{#each ranks as rank}
			{#each files as file}
				{@const square = sq(file, rank)}
				{@const piece  = board[square]}
				{@const light  = isLight(file, rank)}
				{@const isSel  = selectedSquare === square}
				{@const isHov  = hoveredSquare === square}
				<button
					class="sq"
					class:light
					class:dark={!light}
					class:selected={isSel}
					class:dragging-from={dragFrom === square && isDragging}
					class:drop-target={isHov && isDragging}
					class:palette-hover={!!activePalettePiece}
					data-sq={square}
					onpointerdown={(e) => onPtrDown(e, square)}
					oncontextmenu={(e) => { e.preventDefault(); removePiece(square); }}
				>
					{#if file === files[0]}
						<span class="rank-label" class:on-dark={!light}>{rank}</span>
					{/if}
					{#if rank === ranks[ranks.length - 1]}
						<span class="file-label" class:on-dark={!light}>{file}</span>
					{/if}

					{#if piece && !(isDragging && dragFrom === square)}
						<div class="piece" class:sel={isSel}>
							{@html PIECE_SVG[piece as PieceCode] ?? ''}
						</div>
					{/if}

					<!-- Anteprima pezzo palette quando la casella è in hover -->
					{#if activePalettePiece && !piece}
						<div class="palette-preview">
							{@html PIECE_SVG[activePalettePiece as PieceCode] ?? ''}
						</div>
					{/if}
				</button>
			{/each}
		{/each}
	</div>

	<!-- Ghost durante drag board→board -->
	{#if isDragging && dragSvg}
		<div
			class="drag-ghost"
			style="left:{dragX - squareSize/2}px; top:{dragY - squareSize/2}px; width:{squareSize}px; height:{squareSize}px"
		>
			{@html dragSvg}
		</div>
	{/if}
</div>

<style>
	.setup-board-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		user-select: none;
	}

	.board {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-template-rows: repeat(8, 1fr);
		border: 3px solid #1a1714;
		border-radius: 4px;
		overflow: hidden;
	}

	.sq {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		padding: 0;
		cursor: pointer;
		outline: none;
		touch-action: none;
		transition: filter 0.1s;
	}
	.sq.light { background: #f0d9b5; }
	.sq.dark  { background: #b58863; }

	.sq.selected       { outline: 3px solid rgba(255,220,0,0.9); outline-offset: -3px; }
	.sq.dragging-from  { opacity: 0.25; }
	.sq.drop-target    { outline: 3px solid rgba(100,220,100,0.9); outline-offset: -3px; }
	.sq.palette-hover:hover { filter: brightness(1.15); cursor: copy; }
	.sq:not(.palette-hover):hover { filter: brightness(1.07); }

	/* Pezzi */
	.piece {
		width: 86%; height: 86%;
		display: flex; align-items: center; justify-content: center;
		pointer-events: none;
	}
	.piece :global(svg) { width: 100%; height: 100%; }
	.piece.sel { filter: drop-shadow(0 0 6px rgba(255,220,0,0.95)); }

	/* Anteprima pezzo palette sulle caselle vuote */
	.palette-preview {
		width: 86%; height: 86%;
		display: flex; align-items: center; justify-content: center;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.1s;
	}
	.palette-preview :global(svg) { width: 100%; height: 100%; }
	.sq.palette-hover:hover .palette-preview { opacity: 0.45; }

	/* Coordinate */
	.rank-label, .file-label {
		position: absolute;
		font-size: clamp(0.38rem, 1.1vw, 0.6rem);
		font-weight: 700;
		pointer-events: none;
		line-height: 1;
		opacity: 0.7;
		color: #b58863;
	}
	.rank-label.on-dark, .file-label.on-dark { color: #f0d9b5; }
	.rank-label { top: 2px; left: 3px; }
	.file-label { bottom: 2px; right: 3px; }

	/* Ghost drag */
	.drag-ghost {
		position: fixed;
		pointer-events: none;
		z-index: 9999;
		display: flex; align-items: center; justify-content: center;
		transform: scale(1.18);
		filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
	}
	.drag-ghost :global(svg) { width: 100%; height: 100%; }
</style>
