<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { API_URL as API } from '$lib/config';
	import { getPuzzleLevel, PUZZLE_LEVELS } from '$lib/chess/puzzles';
	import Board from '$lib/chess/Board.svelte';

	// ── Level data ────────────────────────────────────────────────────────────────
	const levelId   = $derived(parseInt($page.params.level, 10));
	const levelData = $derived(getPuzzleLevel(levelId));

	// ── Step state ─────────────────────────────────────────────────────────────
	let stepIndex  = $state(0);
	let boardKey   = $state(0);   // increment to force Board re-mount on wrong move
	let feedback   = $state<'idle' | 'correct' | 'wrong' | 'complete'>('idle');
	let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	const currentStep = $derived(levelData?.steps[stepIndex]);

	// ── Navigation guard — redirect if level doesn't exist ─────────────────────
	$effect(() => {
		if (!levelData) goto('/puzzles');
	});

	// ── Handle move from Board ─────────────────────────────────────────────────
	function handleMove(from: string, to: string, _promo?: string) {
		if (!currentStep || feedback === 'correct' || feedback === 'complete') return;

		const uci = `${from}${to}`;
		const isCorrect = currentStep.correctMoves.includes(uci);

		if (isCorrect) {
			feedback = 'correct';
			if (feedbackTimeout) clearTimeout(feedbackTimeout);
			feedbackTimeout = setTimeout(() => {
				advanceStep();
			}, 1400);
		} else {
			// Wrong move — flash error then reset board
			feedback = 'wrong';
			if (feedbackTimeout) clearTimeout(feedbackTimeout);
			feedbackTimeout = setTimeout(() => {
				boardKey++;          // force Board remount → position resets to FEN
				feedback = 'idle';
			}, 900);
		}
	}

	// ── Advance to next step or complete ──────────────────────────────────────
	async function advanceStep() {
		if (!levelData) return;

		const nextIdx = stepIndex + 1;

		if (nextIdx < levelData.steps.length) {
			stepIndex = nextIdx;
			boardKey++;
			feedback = 'idle';
		} else {
			// Level complete
			feedback = 'complete';
			await markComplete();
		}
	}

	// ── POST completion to backend ─────────────────────────────────────────────
	async function markComplete() {
		try {
			await fetch(`${API}/api/puzzles/${levelId}/complete`, {
				method: 'POST',
				credentials: 'include',
			});
		} catch { /* ignore — progress just won't persist */ }
	}

	// ── Navigation ────────────────────────────────────────────────────────────
	function goBack()    { goto('/puzzles'); }
	function goNext()    {
		const next = PUZZLE_LEVELS.find(l => l.id === levelId + 1);
		if (next) goto(`/puzzles/${next.id}`);
		else goto('/puzzles');
	}

	// ── Restart current step ──────────────────────────────────────────────────
	function restart() {
		stepIndex = 0;
		boardKey++;
		feedback = 'idle';
	}

	// ── Show hint once ────────────────────────────────────────────────────────
	let hintVisible = $state(false);
	function showHint() { hintVisible = true; }
	// Reset hint when step changes
	$effect(() => {
		stepIndex;
		hintVisible = false;
	});
</script>

<svelte:head>
	{#if levelData}
		<title>Puzzle — {levelData.title}</title>
	{:else}
		<title>Puzzle</title>
	{/if}
</svelte:head>

{#if levelData && currentStep}
<div class="puzzle-page">

	<!-- Top bar -->
	<div class="top-bar">
		<button class="btn-ghost btn-back" onclick={goBack}>← Percorso</button>
		<div class="level-badge">
			<span class="level-icon">{levelData.icon}</span>
			<span class="level-title">{levelData.title}</span>
		</div>
		<div class="step-dots">
			{#each levelData.steps as _, i}
				<span
					class="step-dot"
					class:done={i < stepIndex}
					class:active={i === stepIndex && feedback !== 'complete'}
				></span>
			{/each}
		</div>
	</div>

	<!-- Content area -->
	<div class="content">

		<!-- Board column -->
		<div class="board-col">
			{#if feedback === 'complete'}
				<!-- Level complete splash -->
				<div class="complete-splash">
					<div class="complete-icon">🏆</div>
					<h2 class="complete-title">Livello completato!</h2>
					<p class="complete-sub">{levelData.steps[levelData.steps.length - 1].successText}</p>
					<div class="complete-actions">
						<button class="btn-primary" onclick={goNext}>
							{levelId < PUZZLE_LEVELS.length ? 'Livello successivo →' : 'Torna al percorso'}
						</button>
						<button class="btn-ghost" onclick={goBack}>Percorso</button>
					</div>
				</div>
			{:else}
				{#key boardKey}
					<Board
						fen={currentStep.fen}
						playerColor="white"
						isMyTurn={true}
						freePlay={false}
						onMove={handleMove}
						arrows={hintVisible ? [{ from: currentStep.hintFrom, to: currentStep.hintTo, color: 'rgba(80,160,255,0.85)' }] : []}
					/>
				{/key}

				<!-- Feedback overlay on wrong move -->
				{#if feedback === 'wrong'}
					<div class="feedback-bar feedback-wrong">✗ Mossa non corretta — riprova!</div>
				{:else if feedback === 'correct'}
					<div class="feedback-bar feedback-correct">{currentStep.successText}</div>
				{/if}
			{/if}
		</div>

		<!-- Info column -->
		{#if feedback !== 'complete'}
		<div class="info-col">
			<div class="instruction-card">
				<p class="instruction-label">Mossa {stepIndex + 1} di {levelData.steps.length}</p>
				<p class="instruction-text">{currentStep.instruction}</p>
			</div>

			<div class="action-row">
				{#if !hintVisible}
					<button class="btn-hint" onclick={showHint}>💡 Suggerimento</button>
				{:else}
					<span class="hint-active">💡 Guarda la freccia blu sulla scacchiera</span>
				{/if}
				<button class="btn-ghost btn-sm" onclick={restart} title="Ricomincia dal primo step">↺ Ricomincia</button>
			</div>

			<!-- Steps mini-progress -->
			<div class="steps-list">
				{#each levelData.steps as step, i}
					<div class="step-row" class:step-done={i < stepIndex} class:step-active={i === stepIndex}>
						<span class="step-num">{i < stepIndex ? '✓' : i + 1}</span>
						<span class="step-text">{step.instruction.slice(0, 60)}{step.instruction.length > 60 ? '…' : ''}</span>
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
		padding: 0;
	}

	/* ── Top bar ─────────────────────────────────────────────── */
	.top-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 1.25rem;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.btn-back {
		font-size: 0.82rem;
		white-space: nowrap;
	}
	.level-badge {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 700;
		color: var(--text);
		font-size: 0.92rem;
	}
	.level-icon { font-size: 1.1rem; }
	.level-title { }
	.step-dots {
		margin-left: auto;
		display: flex;
		gap: 0.4rem;
	}
	.step-dot {
		width: 10px; height: 10px;
		border-radius: 50%;
		background: var(--border);
		transition: background 0.2s;
	}
	.step-dot.done   { background: var(--accent); }
	.step-dot.active { background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent); }

	/* ── Content layout ──────────────────────────────────────── */
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
		padding: 0.55rem 1rem;
		border-radius: 8px;
		font-size: 0.88rem;
		font-weight: 600;
		text-align: center;
		animation: slide-up 0.18s ease;
	}
	@keyframes slide-up { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
	.feedback-correct { background: color-mix(in srgb, #22c55e 18%, transparent); color: #22c55e; border: 1px solid #22c55e55; }
	.feedback-wrong   { background: color-mix(in srgb, #ef4444 18%, transparent); color: #ef4444; border: 1px solid #ef444455; }

	/* ── Complete splash ──────────────────────────────────────── */
	.complete-splash {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		background: var(--bg-card);
		border-radius: 12px;
		border: 1px solid var(--border);
		text-align: center;
		padding: 2rem;
	}
	.complete-icon  { font-size: 3.5rem; }
	.complete-title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin: 0; }
	.complete-sub   { font-size: 0.88rem; color: var(--text-muted); margin: 0; max-width: 280px; }
	.complete-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem; }

	/* ── Info column ─────────────────────────────────────────── */
	.info-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		overflow-y: auto;
		max-height: calc(100vh - 130px);
	}

	.instruction-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1rem 1.1rem;
	}
	.instruction-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent);
		font-weight: 700;
		margin: 0 0 0.4rem;
	}
	.instruction-text {
		font-size: 0.92rem;
		color: var(--text);
		line-height: 1.5;
		margin: 0;
	}

	/* ── Hint & actions ──────────────────────────────────────── */
	.action-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.btn-hint {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		color: var(--accent);
		padding: 0.4rem 0.85rem;
		border-radius: 6px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-hint:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
	.hint-active {
		font-size: 0.82rem;
		color: var(--accent);
		font-weight: 600;
	}

	/* ── Steps list ──────────────────────────────────────────── */
	.steps-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.step-row {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		opacity: 0.5;
		transition: opacity 0.2s;
	}
	.step-row.step-active { opacity: 1; border-color: var(--accent); }
	.step-row.step-done   { opacity: 0.7; }
	.step-num  {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--accent);
		flex-shrink: 0;
		width: 18px;
		text-align: center;
		padding-top: 1px;
	}
	.step-text { font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; }
	.step-row.step-active .step-text { color: var(--text); }

	/* ── Buttons ─────────────────────────────────────────────── */
	.btn-primary {
		background: var(--accent);
		color: #000;
		border: none;
		padding: 0.65rem 1.3rem;
		border-radius: 8px;
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.btn-primary:hover { opacity: 0.88; }
	.btn-ghost {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 0.55rem 1rem;
		border-radius: 8px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.btn-ghost:hover { border-color: var(--text-muted); color: var(--text); }
	.btn-sm { padding: 0.35rem 0.7rem; font-size: 0.78rem; }

	/* ── Mobile ─────────────────────────────────────────────── */
	@media (max-width: 768px) {
		.content {
			flex-direction: column;
			overflow-y: auto;
			overflow-x: hidden;
			align-items: stretch;
			padding: 0.75rem;
			gap: 1rem;
		}
		.board-col {
			width: 100%;
		}
		.info-col {
			max-height: none;
			overflow-y: visible;
		}
		.complete-splash {
			aspect-ratio: unset;
			padding: 2.5rem 1.5rem;
			min-height: 280px;
		}
	}
</style>
