<script lang="ts">
	import { PIECE_SVG, type PieceCode } from './pieces';

	// board: Record<square, PieceCode>  es. { e1: 'wK', e8: 'bK', ... }
	let {
		board,
		onBoardChange,
		playerColor = 'white',
	}: {
		board: Record<string, string>;
		onBoardChange: (board: Record<string, string>) => void;
		playerColor?: 'white' | 'black';
	} = $props();

	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

	const ranks = $derived(playerColor === 'white' ? RANKS : [...RANKS].reverse());
	const files  = $derived(playerColor === 'white' ? FILES : [...FILES].reverse());

	let selectedSquare = $state<string | null>(null);
	let dragFrom       = $state<string | null>(null);
	let isDragging     = $state(false);
	let dragX          = $state(0);
	let dragY          = $state(0);
	let dragSvg        = $state<string | null>(null);
	let squareSize     = $state(60);
	let boardEl: HTMLElement | undefined;

	let ptrStartX = 0;
	let ptrStartY = 0;
	const DRAG_THRESHOLD = 8;

	function sq(f: string, r: number) { return `${f}${r}`; }
	function isLight(f: string, r: number) { return (FILES.indexOf(f) + r) % 2 === 1; }

	function handleSquareClick(square: string) {
		if (selectedSquare === square) {
			// Deselect
			selectedSquare = null;
			return;
		}
		if (selectedSquare !== null) {
			// Move piece from selectedSquare to square
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

	function removePiece(square: string) {
		const updated = { ...board };
		delete updated[square];
		onBoardChange(updated);
	}

	function onPtrDown(e: PointerEvent, square: string) {
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
					isDragging   = true;
					dragFrom     = square;
					selectedSquare = square;
				}
			}
		}

		function onPtrUp(ue: PointerEvent) {
			document.removeEventListener('pointermove', onPtrMove);
			document.removeEventListener('pointerup',   onPtrUp);

			if (isDragging) {
				const els = document.elementsFromPoint(ue.clientX, ue.clientY);
				const btn = els.find(el => el.hasAttribute('data-sq')) as HTMLElement | null;
				const to  = btn?.dataset.sq ?? null;

				isDragging     = false;
				dragSvg        = null;
				selectedSquare = null;
				document.body.style.cursor = '';

				if (to && dragFrom && to !== dragFrom) {
					const updated = { ...board };
					updated[to] = board[dragFrom];
					delete updated[dragFrom];
					dragFrom = null;
					onBoardChange(updated);
				} else {
					dragFrom = null;
				}
			} else {
				// Tap
				dragSvg = null;
				handleSquareClick(square);
			}
		}

		document.addEventListener('pointermove', onPtrMove);
		document.addEventListener('pointerup',   onPtrUp);
	}

	$effect(() => {
		document.body.style.cursor = isDragging ? 'grabbing' : '';
	});

	const PIECE_CODES: PieceCode[] = ['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'];
</script>

<div class="setup-board-wrap">
	<div class="board" bind:this={boardEl}>
		{#each ranks as rank}
			{#each files as file}
				{@const square = sq(file, rank)}
				{@const piece = board[square]}
				{@const light = isLight(file, rank)}
				{@const isSel = selectedSquare === square}
				<button
					class="sq"
					class:light
					class:dark={!light}
					class:selected={isSel}
					class:dragging-from={dragFrom === square}
					data-sq={square}
					onpointerdown={(e) => onPtrDown(e, square)}
					oncontextmenu={(e) => { e.preventDefault(); removePiece(square); }}
				>
					{#if file === files[0]}
						<span class="rank-label" class:light={!light}>{rank}</span>
					{/if}
					{#if rank === ranks[ranks.length - 1]}
						<span class="file-label" class:light={!light}>{file}</span>
					{/if}
					{#if piece && !(isDragging && dragFrom === square)}
						<div class="piece" class:selected-piece={isSel}>
							{@html PIECE_SVG[piece as PieceCode] ?? ''}
						</div>
					{/if}
				</button>
			{/each}
		{/each}
	</div>

	<!-- Ghost pezzo durante il drag -->
	{#if isDragging && dragSvg}
		<div
			class="drag-ghost"
			style="
				left: {dragX - squareSize / 2}px;
				top:  {dragY - squareSize / 2}px;
				width: {squareSize}px;
				height: {squareSize}px;
			"
		>
			{@html dragSvg}
		</div>
	{/if}
</div>

<style>
	.setup-board-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		user-select: none;
	}

	.board {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-template-rows: repeat(8, 1fr);
		border: 2px solid #5d4e37;
		border-radius: 4px;
		overflow: hidden;
	}

	.sq {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		border: none;
		padding: 0;
		cursor: pointer;
		outline: none;
		touch-action: none;
	}
	.sq.light   { background: #f0d9b5; }
	.sq.dark    { background: #b58863; }
	.sq.selected { outline: 3px solid rgba(255, 220, 0, 0.85); outline-offset: -3px; }
	.sq.dragging-from { opacity: 0.3; }

	.sq:hover { filter: brightness(1.08); }

	.piece {
		width: 85%;
		height: 85%;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.piece :global(svg) { width: 100%; height: 100%; }
	.piece.selected-piece { filter: drop-shadow(0 0 5px rgba(255,220,0,0.9)); }

	/* Labels */
	.rank-label, .file-label {
		position: absolute;
		font-size: clamp(0.4rem, 1.2vw, 0.65rem);
		font-weight: 700;
		pointer-events: none;
		line-height: 1;
		opacity: 0.75;
	}
	.rank-label { top: 2px; left: 3px; }
	.file-label { bottom: 2px; right: 3px; }
	.rank-label.light, .file-label.light { color: #b58863; }
	.rank-label:not(.light), .file-label:not(.light) { color: #f0d9b5; }

	/* Ghost */
	.drag-ghost {
		position: fixed;
		pointer-events: none;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		transform: scale(1.15);
	}
	.drag-ghost :global(svg) { width: 100%; height: 100%; }
</style>
