<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Chess } from 'chess.js';
	import { API_URL as API } from '$lib/config';
	import { getPuzzleLevel, PUZZLE_LEVELS } from '$lib/chess/puzzles';
	import Board from '$lib/chess/Board.svelte';

	// ── Level & puzzle data ───────────────────────────────────────────────────
	const levelId   = $derived(parseInt(($page.params as Record<string,string>)['level'] ?? '1', 10));
	const levelData = $derived(getPuzzleLevel(levelId));

	// ── State ─────────────────────────────────────────────────────────────────
	let puzzleIndex   = $state(0);   // which puzzle in level.puzzles[]
	let moveIndex     = $state(0);   // index into puzzle.solution[] (next expected move)
	let chess         = $state(new Chess());
	let currentFen    = $state('');
	let boardKey      = $state(0);   // force Board remount on reset
	let lastMove      = $state<{ from: string; to: string } | null>(null);
	let levelComplete = $state(false);

	type Feedback = 'idle' | 'correct' | 'wrong';
	let feedback    : Feedback = $state('idle');
	let hintVisible = $state(false);

	// Derived puzzle shortcut
	const currentPuzzle = $derived(levelData?.puzzles[puzzleIndex]);

	// ── Init puzzle when index or level changes ───────────────────────────────
	function initPuzzle(fen: string) {
		chess       = new Chess(fen);
		currentFen  = fen;
		moveIndex   = 0;
		hintVisible = false;
		lastMove    = null;
	}

	// Reset ALL state when levelId changes (SvelteKit reuses component for same route)
	$effect(() => {
		const _id = levelId;
		untrack(() => {
			puzzleIndex   = 0;
			levelComplete = false;
			feedback      = 'idle';
			boardKey     += 1;
			if (levelData?.puzzles[0]) initPuzzle(levelData.puzzles[0].fen);
		});
	});

	// Init when puzzleIndex changes within the same level
	$effect(() => {
		const _pi = puzzleIndex;
		untrack(() => {
			if (currentPuzzle) initPuzzle(currentPuzzle.fen);
			boardKey += 1;
			feedback  = 'idle';
		});
	});

	// ── Redirect if level doesn't exist ──────────────────────────────────────
	$effect(() => { if (!levelData) goto('/puzzles'); });

	// ── Player color — derived from FEN ──────────────────────────────────────
	const playerColor = $derived<'white' | 'black'>(
		currentFen.split(' ')[1] === 'w' ? 'white' : 'black'
	);

	// ── Hint arrow ────────────────────────────────────────────────────────────
	const hintArrow = $derived(() => {
		if (!hintVisible || !currentPuzzle) return [];
		const move = currentPuzzle.solution[moveIndex];
		if (!move || move.length < 4) return [];
		return [{ from: move.slice(0, 2), to: move.slice(2, 4), color: 'rgba(80,160,255,0.85)' }];
	});

	// ── Handle move from Board ────────────────────────────────────────────────
	function handleMove(from: string, to: string, promo?: string) {
		if (!currentPuzzle || levelComplete || feedback === 'correct') return;

		const uci = from + to + (promo ?? '');
		const expected = currentPuzzle.solution[moveIndex];

		if (uci === expected || uci === expected?.slice(0, 4)) {
			// ✓ Correct player move — apply it
			chess.move({ from, to, promotion: promo ?? 'q' });
			currentFen = chess.fen();
			lastMove   = { from, to };
			moveIndex++;

			const remaining = currentPuzzle.solution.length - moveIndex;

			if (remaining === 0) {
				// All moves done → puzzle solved
				onPuzzleSolved();
			} else {
				// Auto-play opponent's response after 500 ms
				feedback = 'correct';
				setTimeout(() => {
					const oppMove = currentPuzzle.solution[moveIndex];
					if (!oppMove) return;
					const oppFrom = oppMove.slice(0, 2);
					const oppTo   = oppMove.slice(2, 4);
					chess.move({ from: oppFrom, to: oppTo, promotion: oppMove[4] ?? 'q' });
					currentFen = chess.fen();
					lastMove   = { from: oppFrom, to: oppTo };
					moveIndex++;
					boardKey++;   // re-render board with new FEN
					feedback = 'idle';
					if (remaining - 1 === 0) onPuzzleSolved();
				}, 500);
			}
		} else {
			// ✗ Wrong move — flash, then reset to puzzle start
			feedback = 'wrong';
			setTimeout(() => {
				if (currentPuzzle) initPuzzle(currentPuzzle.fen);
				boardKey++;
				feedback = 'idle';
			}, 900);
		}
	}

	// ── Puzzle solved ─────────────────────────────────────────────────────────
	function onPuzzleSolved() {
		const next = puzzleIndex + 1;
		if (levelData && next < levelData.puzzles.length) {
			feedback = 'correct';
			setTimeout(() => {
				puzzleIndex = next;  // $effect will init next puzzle
			}, 1200);
		} else {
			levelComplete = true;
			markLevelComplete();
		}
	}

	// ── Mark level complete on backend ────────────────────────────────────────
	async function markLevelComplete() {
		try {
			await fetch(`${API}/api/puzzles/${levelId}/complete`, {
				method: 'POST', credentials: 'include',
			});
		} catch { /* offline — progress just won't persist */ }
	}

	// ── Navigation ────────────────────────────────────────────────────────────
	function goBack() { goto('/puzzles'); }
	function goNext() {
		const next = PUZZLE_LEVELS.find(l => l.id === levelId + 1);
		goto(next ? `/puzzles/${next.id}` : '/puzzles');
	}
	function restart() {
		if (currentPuzzle) initPuzzle(currentPuzzle.fen);
		boardKey++;
		feedback = 'idle';
	}
	function showHint() { hintVisible = true; }

	// ── Progress dots ─────────────────────────────────────────────────────────
	// move progress within current puzzle (player moves only = even indices)
	const playerMoves   = $derived(currentPuzzle ? Math.ceil(currentPuzzle.solution.length / 2) : 0);
	const playerDone    = $derived(Math.floor(moveIndex / 2));

	// Lichess URL for current puzzle
	const lichessUrl = $derived(currentPuzzle ? `https://lichess.org/training/${currentPuzzle.id}` : '#');
</script>

<svelte:head>
	{#if levelData}
		<title>Puzzle — {levelData.title}</title>
	{:else}
		<title>Puzzle</title>
	{/if}
</svelte:head>

{#if levelData && currentPuzzle}
<div class="puzzle-page">

	<!-- Top bar -->
	<div class="top-bar">
		<button class="btn-ghost btn-sm btn-back" onclick={goBack}>← Percorso</button>

		<div class="level-badge">
			<span>{levelData.icon}</span>
			<span class="level-title">{levelData.title}</span>
		</div>

		<!-- Puzzle dots: one per puzzle in the level -->
		<div class="puzzle-dots">
			{#each levelData.puzzles as _, i}
				<span class="pdot"
					class:pdot-done={levelComplete || i < puzzleIndex}
					class:pdot-active={i === puzzleIndex && !levelComplete}
				></span>
			{/each}
		</div>
	</div>

	<!-- Main content -->
	<div class="content">

		<!-- Board column -->
		<div class="board-col">
			{#if levelComplete}
				<div class="complete-splash">
					<div class="complete-icon">🏆</div>
					<h2 class="complete-title">Livello completato!</h2>
					<p class="complete-sub">Hai risolto tutti i puzzle di <strong>{levelData.title}</strong>.</p>
					<div class="complete-actions">
						<button class="btn-primary" onclick={goNext}>
							{levelId < PUZZLE_LEVELS.length ? 'Livello successivo →' : '→ Torna al percorso'}
						</button>
						<button class="btn-ghost btn-sm" onclick={goBack}>Percorso</button>
					</div>
				</div>
			{:else}
				{#key boardKey}
					<Board
						fen={currentFen}
						{playerColor}
						{lastMove}
						isMyTurn={feedback !== 'correct'}
						freePlay={false}
						onMove={handleMove}
						arrows={hintVisible && currentPuzzle
							? (() => {
									const m = currentPuzzle.solution[moveIndex];
									return m && m.length >= 4
										? [{ from: m.slice(0,2), to: m.slice(2,4), color: 'rgba(80,160,255,0.85)' }]
										: [];
								})()
							: []}
					/>
				{/key}

				<!-- Feedback bar -->
				{#if feedback === 'wrong'}
					<div class="feedback-bar feedback-wrong">✗ Mossa sbagliata — riprova!</div>
				{:else if feedback === 'correct'}
					<div class="feedback-bar feedback-correct">✓ Corretto! Continua...</div>
				{/if}
			{/if}
		</div>

		<!-- Info column -->
		{#if !levelComplete}
		<div class="info-col">

			<!-- Instruction card -->
			<div class="instruction-card">
				<div class="instruction-header">
					<span class="instr-label">Puzzle {puzzleIndex + 1} / {levelData.puzzles.length}</span>
					<span class="instr-rating">⭐ {currentPuzzle.rating}</span>
				</div>
				<p class="instruction-text">
					{#if currentPuzzle.themes.includes('mateIn1')}
						Scacco matto in una mossa. Trova il colpo finale!
					{:else if currentPuzzle.themes.includes('mateIn2')}
						Scacco matto in due mosse. Calcola la sequenza!
					{:else if currentPuzzle.themes.includes('hangingPiece')}
						Un pezzo avversario è indifeso. Catturalo!
					{:else if currentPuzzle.themes.includes('fork')}
						Trova la forchetta — attacca due pezzi con una sola mossa!
					{:else if currentPuzzle.themes.includes('pin')}
						Inchioda un pezzo avversario al suo re o ad un pezzo più prezioso!
					{:else if currentPuzzle.themes.includes('skewer')}
						Attacca un pezzo di valore che, spostandosi, ne espone un altro!
					{:else if currentPuzzle.themes.includes('discoveredAttack') || currentPuzzle.themes.includes('discoveredCheck')}
						Muovi un pezzo per rivelare un attacco del pezzo dietro di esso!
					{:else if currentPuzzle.themes.includes('doubleCheck')}
						Dai scacco con due pezzi contemporaneamente!
					{:else if currentPuzzle.themes.includes('sacrifice')}
						Sacrifica materiale per ottenere un vantaggio decisivo!
					{:else}
						Trova la migliore sequenza di mosse!
					{/if}
				</p>

				<!-- Move progress within puzzle -->
				{#if playerMoves > 1}
					<div class="move-progress">
						{#each Array(playerMoves) as _, i}
							<span class="mpip" class:mpip-done={i < playerDone} class:mpip-active={i === playerDone}></span>
						{/each}
						<span class="mpip-label">{playerDone}/{playerMoves} mosse</span>
					</div>
				{/if}

				<!-- Themes -->
				{#if currentPuzzle.themes.length > 0}
					<div class="theme-tags">
						{#each currentPuzzle.themes.slice(0, 3) as theme}
							<span class="tag">{theme}</span>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="action-row">
				{#if !hintVisible}
					<button class="btn-hint" onclick={showHint}>💡 Suggerimento</button>
				{:else}
					<span class="hint-active">💡 Segui la freccia blu</span>
				{/if}
				<button class="btn-ghost btn-sm" onclick={restart} title="Ricomincia questo puzzle">↺</button>
				<a class="btn-ghost btn-sm" href={lichessUrl} target="_blank" rel="noopener" title="Vedi su Lichess">🔗</a>
			</div>

			<!-- Puzzle list for this level -->
			<div class="puzzle-list">
				{#each levelData.puzzles as pz, i}
					<div class="pz-row"
						class:pz-done={levelComplete || i < puzzleIndex}
						class:pz-active={i === puzzleIndex}
					>
						<span class="pz-num">{levelComplete || i < puzzleIndex ? '✓' : i + 1}</span>
						<div class="pz-info">
							<span class="pz-id">#{pz.id}</span>
							<span class="pz-moves">{Math.ceil(pz.solution.length / 2)} {Math.ceil(pz.solution.length / 2) === 1 ? 'mossa' : 'mosse'}</span>
						</div>
						<span class="pz-rating">{pz.rating}</span>
					</div>
				{/each}
			</div>

		</div>
		{/if}

	</div>
</div>
{/if}

<style>
	.puzzle-page {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* ── Top bar ─────────────────────────────────────────────── */
	.top-bar {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.55rem 1.25rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.btn-back { white-space: nowrap; }
	.level-badge {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 700;
		font-size: 0.88rem;
		color: var(--text);
	}
	.level-title { }

	/* Puzzle progress dots */
	.puzzle-dots { margin-left: auto; display: flex; gap: 0.45rem; }
	.pdot {
		width: 9px; height: 9px; border-radius: 50%;
		background: var(--border);
		transition: background 0.2s;
	}
	.pdot-done   { background: var(--accent); }
	.pdot-active {
		background: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
		animation: pulse-dot 2s ease-in-out infinite;
	}
	@keyframes pulse-dot {
		0%,100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
		50%      { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 10%, transparent); }
	}

	/* ── Layout ──────────────────────────────────────────────── */
	.content {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 1.5rem;
		padding: 1.25rem;
		overflow: hidden;
	}

	/* ── Board column ─────────────────────────────────────────── */
	.board-col {
		position: relative;
		flex-shrink: 0;
		width: min(calc(100vh - 120px), calc(100% - 280px));
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* ── Feedback bar ─────────────────────────────────────────── */
	.feedback-bar {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		text-align: center;
		animation: slide-up 0.18s ease;
	}
	@keyframes slide-up { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
	.feedback-correct { background: color-mix(in srgb, #22c55e 18%, transparent); color: #22c55e; border: 1px solid #22c55e55; }
	.feedback-wrong   { background: color-mix(in srgb, #ef4444 18%, transparent); color: #ef4444; border: 1px solid #ef444455; }

	/* ── Complete splash ──────────────────────────────────────── */
	.complete-splash {
		width: 100%; aspect-ratio: 1;
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		gap: 1rem;
		background: var(--bg-card);
		border-radius: 12px; border: 1px solid var(--border);
		text-align: center; padding: 2rem;
	}
	.complete-icon  { font-size: 3.5rem; }
	.complete-title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin: 0; }
	.complete-sub   { font-size: 0.88rem; color: var(--text-muted); margin: 0; max-width: 280px; }
	.complete-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem; }

	/* ── Info column ─────────────────────────────────────────── */
	.info-col {
		flex: 1;
		display: flex; flex-direction: column; gap: 1rem;
		min-width: 0; overflow-y: auto;
		max-height: calc(100vh - 130px);
	}

	/* Instruction card */
	.instruction-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1rem 1.1rem;
		display: flex; flex-direction: column; gap: 0.65rem;
	}
	.instruction-header {
		display: flex; align-items: center; justify-content: space-between;
	}
	.instr-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent);
		font-weight: 700;
	}
	.instr-rating { font-size: 0.72rem; color: var(--text-muted); }
	.instruction-text {
		font-size: 0.9rem; color: var(--text); line-height: 1.5; margin: 0;
	}

	/* Move progress pips */
	.move-progress {
		display: flex; align-items: center; gap: 0.4rem;
	}
	.mpip {
		width: 8px; height: 8px; border-radius: 50%;
		background: var(--border); flex-shrink: 0;
	}
	.mpip-done   { background: var(--accent); }
	.mpip-active { background: var(--accent); opacity: 0.5; }
	.mpip-label  { font-size: 0.68rem; color: var(--text-muted); margin-left: 0.2rem; }

	/* Theme tags */
	.theme-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.tag {
		font-size: 0.65rem;
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
		border-radius: 4px;
		padding: 0.15rem 0.45rem;
		font-weight: 600;
	}

	/* ── Actions ─────────────────────────────────────────────── */
	.action-row {
		display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
	}
	.btn-hint {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		color: var(--accent);
		padding: 0.38rem 0.8rem;
		border-radius: 6px; font-size: 0.82rem; font-weight: 600;
		cursor: pointer; transition: background 0.15s;
	}
	.btn-hint:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
	.hint-active { font-size: 0.82rem; color: var(--accent); font-weight: 600; }

	/* ── Puzzle list ─────────────────────────────────────────── */
	.puzzle-list { display: flex; flex-direction: column; gap: 0.4rem; }
	.pz-row {
		display: flex; align-items: center; gap: 0.6rem;
		padding: 0.45rem 0.75rem;
		border-radius: 8px;
		background: var(--bg-card); border: 1px solid var(--border);
		opacity: 0.45; transition: opacity 0.2s, border-color 0.2s;
	}
	.pz-row.pz-active { opacity: 1; border-color: var(--accent); }
	.pz-row.pz-done   { opacity: 0.65; }
	.pz-num  { font-size: 0.72rem; font-weight: 700; color: var(--accent); width: 18px; text-align: center; flex-shrink: 0; }
	.pz-info { flex: 1; display: flex; flex-direction: column; gap: 0.05rem; }
	.pz-id   { font-size: 0.72rem; color: var(--text-muted); font-family: monospace; }
	.pz-moves{ font-size: 0.68rem; color: var(--text-muted); }
	.pz-rating { font-size: 0.72rem; color: var(--text-muted); }

	/* ── Buttons ─────────────────────────────────────────────── */
	.btn-primary {
		background: var(--accent); color: #000; border: none;
		padding: 0.65rem 1.3rem; border-radius: 8px;
		font-weight: 700; font-size: 0.9rem;
		cursor: pointer; transition: opacity 0.15s;
	}
	.btn-primary:hover { opacity: 0.88; }
	.btn-ghost {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 0.55rem 1rem; border-radius: 8px;
		font-size: 0.85rem; cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		text-decoration: none; display: inline-flex; align-items: center;
	}
	.btn-ghost:hover { border-color: var(--text-muted); color: var(--text); }
	.btn-sm { padding: 0.35rem 0.7rem; font-size: 0.78rem; }

	/* ── Mobile ─────────────────────────────────────────────── */
	@media (max-width: 768px) {
		.content {
			flex-direction: column;
			overflow-y: auto; overflow-x: hidden;
			align-items: stretch; padding: 0.75rem; gap: 1rem;
		}
		.board-col { width: 100%; }
		.info-col  { max-height: none; overflow-y: visible; }
		.complete-splash { aspect-ratio: unset; padding: 2rem 1.5rem; min-height: 260px; }
	}
</style>
