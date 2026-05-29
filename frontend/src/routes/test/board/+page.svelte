<!--
  Test harness for Board.svelte — Playwright E2E tests.
  Renders the board in isolation, without auth or backend.

  URL params:
    ?fen=<FEN>        — starting position (default: standard opening)
    ?color=black      — play as black (default: white)
    ?turn=0           — isMyTurn=false (default: true)
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Chess } from 'chess.js';
	import Board from '$lib/chess/Board.svelte';

	// FEN position
	const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	// Near-promotion position: white pawn on e7, black king on h8, white king on a1
	const PROMO_FEN = '7k/4P3/8/8/8/8/8/K7 w - - 0 1';

	let fen         = $state(START);
	let playerColor = $state<'white' | 'black'>('white');
	let isMyTurn    = $state(true);
	let moveLog     = $state<string[]>([]);
	let lastMoveHL  = $state<{ from: string; to: string } | null>(null);

	onMount(() => {
		// Dismiss cookie banner so it doesn't overlap the board
		localStorage.setItem('cookie_consent', 'essential');

		const p = new URLSearchParams(location.search);
		if (p.has('fen'))           fen         = decodeURIComponent(p.get('fen')!);
		if (p.get('color') === 'black') playerColor = 'black';
		if (p.get('turn')  === '0') isMyTurn    = false;

		// Signal to Playwright that client-side hydration is complete
		// and the board's pointer-event handlers are attached.
		document.body.setAttribute('data-hydrated', 'true');
	});

	function handleMove(from: string, to: string, promotion?: string) {
		const game = new Chess();
		try { game.load(fen); } catch { return; }

		const result = game.move({ from, to, promotion: (promotion ?? undefined) as any });
		if (!result) return;

		const notation = promotion ? `${from}-${to}=${promotion}` : `${from}-${to}`;
		moveLog    = [...moveLog, notation];
		lastMoveHL = { from, to };
		fen        = game.fen();

		// Keep isMyTurn true AND flip playerColor so tests can chain
		// moves for both sides without reloading the page.
		const newTurn = game.turn(); // 'w' or 'b'
		playerColor = newTurn === 'w' ? 'white' : 'black';
	}

	// Convenience: reset to a specific preset
	function loadPreset(preset: 'start' | 'promo') {
		fen      = preset === 'promo' ? PROMO_FEN : START;
		moveLog  = [];
		lastMoveHL = null;
	}
</script>

<svelte:head>
	<title>Board test harness</title>
</svelte:head>

<div class="harness">

	<!-- Board -->
	<div class="board-wrap">
		<Board
			{fen}
			{playerColor}
			{isMyTurn}
			lastMove={lastMoveHL}
			onMove={handleMove}
		/>
	</div>

	<!-- Test output — Playwright reads these -->
	<aside class="info">
		<div class="info-row">
			<span class="label">Last move</span>
			<code data-testid="last-move">{moveLog.at(-1) ?? '—'}</code>
		</div>

		<div class="info-row">
			<span class="label">Move count</span>
			<code data-testid="move-count">{moveLog.length}</code>
		</div>

		<div class="info-row">
			<span class="label">FEN</span>
			<code data-testid="fen" class="fen">{fen}</code>
		</div>

		<div class="info-row">
			<span class="label">Log</span>
			<code data-testid="move-log">{moveLog.join(' ')}</code>
		</div>

		<!-- Quick-reset buttons for manual inspection -->
		<div class="presets">
			<button onclick={() => loadPreset('start')}>↺ Start</button>
			<button onclick={() => loadPreset('promo')}>Promotion test</button>
		</div>
	</aside>

</div>

<style>
	:global(body) { background: #312E2B; }

	.harness {
		display: flex;
		gap: 2rem;
		align-items: flex-start;
		padding: 2rem;
		min-height: 100vh;
	}

	.board-wrap {
		width: min(480px, 90vw);
	}

	.info {
		background: #262421;
		border: 1px solid #3D3B38;
		border-radius: 8px;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 240px;
		font-size: 0.85rem;
		color: #9E9D9A;
	}

	.info-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6E6D6A;
	}

	code {
		font-family: monospace;
		color: #81B64C;
		word-break: break-all;
	}

	.fen { font-size: 0.72rem; }

	.presets {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}
	.presets button {
		background: #3D3B38;
		border: 1px solid #5A5855;
		color: #E2E0D5;
		border-radius: 5px;
		padding: 0.3rem 0.7rem;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.presets button:hover { background: #4A4845; }

	@media (max-width: 600px) {
		.harness { flex-direction: column; padding: 1rem; }
		.board-wrap { width: 100%; }
	}
</style>
