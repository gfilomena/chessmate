<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';
	import { API_URL as API } from '$lib/config';
	import { PUZZLE_LEVELS, TOTAL_LEVELS } from '$lib/chess/puzzles';

	// ── Progress ────────────────────────────────────────────────────────────────
	let completed = $state<Set<number>>(new Set());
	let loading   = $state(true);

	onMount(async () => {
		try {
			const res = await fetch(`${API}/api/puzzles/progress`, { credentials: 'include' });
			if (res.ok) {
				const data = await res.json();
				completed = new Set<number>(data.completed ?? []);
			}
		} catch { /* offline/no-op */ }
		loading = false;
	});

	// ── Helpers ─────────────────────────────────────────────────────────────────
	function isCompleted(id: number) { return completed.has(id); }
	function isUnlocked(id: number)  { return id === 1 || completed.has(id - 1); }
	function isCurrent(id: number)   { return isUnlocked(id) && !isCompleted(id); }

	function handleClick(id: number) {
		if (isUnlocked(id)) goto(`/puzzles/${id}`);
	}

	// Posizione zigzag: dispari = sinistra, pari = destra
	function nodeLeft(id: number): boolean { return id % 2 !== 0; }

	const DIFF_STARS: Record<number, string> = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐' };

	// Totale completati
	const completedCount = $derived(completed.size);
</script>

<svelte:head>
	<title>Chess — Puzzle</title>
</svelte:head>

<div class="puzzles-page">
	<div class="puzzles-inner">

		<!-- Header -->
		<div class="path-header">
			<h1 class="path-title">🧩 Percorso Puzzle</h1>
			<p class="path-sub">Impara gli scacchi passo dopo passo — da principiante a tattico.</p>
			{#if !loading}
				<div class="progress-bar-wrap">
					<div class="progress-bar-fill" style="width:{(completedCount / TOTAL_LEVELS) * 100}%"></div>
				</div>
				<p class="progress-label">{completedCount} / {TOTAL_LEVELS} livelli completati</p>
			{/if}
		</div>

		{#if loading}
			<div class="loading-dots">
				<span></span><span></span><span></span>
			</div>
		{:else}
			<!-- Percorso zigzag -->
			<div class="path-track">
				{#each PUZZLE_LEVELS as level}
					{@const done   = isCompleted(level.id)}
					{@const unlock = isUnlocked(level.id)}
					{@const curr   = isCurrent(level.id)}
					{@const left   = nodeLeft(level.id)}

					<div class="path-row" class:left class:right={!left}>
						<button
							class="node"
							class:done
							class:current={curr}
							class:locked={!unlock}
							onclick={() => handleClick(level.id)}
							disabled={!unlock}
							aria-label="{level.title} — {unlock ? (done ? 'completato' : 'gioca') : 'bloccato'}"
						>
							{#if done}
								<span class="node-icon">✓</span>
							{:else if !unlock}
								<span class="node-icon">🔒</span>
							{:else}
								<span class="node-icon">{level.icon}</span>
							{/if}
							<span class="node-num">{level.id}</span>
						</button>

						<div class="node-label" class:label-left={!left} class:label-right={left}>
							<span class="node-title">{level.title}</span>
							<span class="node-sub">{level.subtitle}</span>
							<span class="node-diff">{DIFF_STARS[level.difficulty]}</span>
						</div>
					</div>

					<!-- Connettore tra nodi (non dopo l'ultimo) -->
					{#if level.id < TOTAL_LEVELS}
						<div class="connector" class:connector-left={left} class:connector-right={!left}>
							<svg viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
								{#if left}
									<!-- curva verso destra -->
									<path d="M 10 0 Q 50 20 50 40" stroke="currentColor" stroke-width="3" stroke-dasharray="6 4"/>
								{:else}
									<!-- curva verso sinistra -->
									<path d="M 50 0 Q 10 20 10 40" stroke="currentColor" stroke-width="3" stroke-dasharray="6 4"/>
								{/if}
							</svg>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

	</div>
</div>

<style>
	.puzzles-page {
		height: 100%;
		overflow-y: auto;
	}

	.puzzles-inner {
		max-width: 480px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	/* ── Header ─────────────────────────────────────────────── */
	.path-header {
		text-align: center;
		margin-bottom: 2rem;
	}
	.path-title {
		font-size: 1.6rem;
		font-weight: 800;
		color: var(--text);
		margin: 0 0 0.4rem;
	}
	.path-sub {
		font-size: 0.88rem;
		color: var(--text-muted);
		margin: 0 0 1rem;
	}

	/* Progress bar */
	.progress-bar-wrap {
		height: 8px;
		background: var(--border);
		border-radius: 4px;
		overflow: hidden;
		margin: 0 auto 0.35rem;
		max-width: 300px;
	}
	.progress-bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 4px;
		transition: width 0.6s ease;
	}
	.progress-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* ── Loading ─────────────────────────────────────────────── */
	.loading-dots {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		margin: 4rem 0;
	}
	.loading-dots span {
		width: 10px; height: 10px;
		border-radius: 50%;
		background: var(--accent);
		animation: dot-pulse 1.2s ease-in-out infinite;
	}
	.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
	.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
	@keyframes dot-pulse { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }

	/* ── Percorso ────────────────────────────────────────────── */
	.path-track {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}

	/* Riga nodo: contiene il cerchio e l'etichetta */
	.path-row {
		display: flex;
		align-items: center;
		gap: 1.2rem;
	}
	.path-row.left  { flex-direction: row;         justify-content: flex-start; padding-left: 1rem; }
	.path-row.right { flex-direction: row-reverse;  justify-content: flex-start; padding-right: 1rem; }

	/* ── Nodo cerchio ───────────────────────────────────────── */
	.node {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		border: 3px solid var(--border);
		background: var(--bg-card);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		flex-shrink: 0;
		transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
		position: relative;
	}
	.node:hover:not(:disabled) {
		transform: scale(1.08);
		box-shadow: 0 4px 16px rgba(0,0,0,0.35);
	}
	.node:disabled { cursor: default; }

	/* Completato */
	.node.done {
		background: var(--accent);
		border-color: var(--accent);
	}
	.node.done .node-icon { color: #000; font-size: 1.5rem; }
	.node.done .node-num  { color: rgba(0,0,0,0.6); }

	/* Corrente (prossimo da giocare) */
	.node.current {
		border-color: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
		animation: pulse-node 2s ease-in-out infinite;
	}
	.node.current .node-icon { color: var(--accent); }
	@keyframes pulse-node {
		0%,100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent); }
		50%      { box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 10%, transparent); }
	}

	/* Bloccato */
	.node.locked {
		opacity: 0.38;
	}

	.node-icon { font-size: 1.4rem; line-height: 1; }
	.node-num  { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.03em; }

	/* ── Etichetta accanto al nodo ────────────────────────────── */
	.node-label {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.label-right { align-items: flex-start; text-align: left; }
	.label-left  { align-items: flex-end;   text-align: right; }
	.node-title { font-size: 0.92rem; font-weight: 700; color: var(--text); }
	.node-sub   { font-size: 0.72rem; color: var(--text-muted); }
	.node-diff  { font-size: 0.68rem; }

	/* ── Connettore SVG ──────────────────────────────────────── */
	.connector {
		height: 40px;
		color: var(--border);
		padding: 0 1rem;
	}
	.connector svg { width: 60px; height: 40px; }
	.connector-left  { display: flex; justify-content: flex-start; padding-left: 2.6rem; }
	.connector-right { display: flex; justify-content: flex-end;   padding-right: 2.6rem; }

	/* ── Mobile ─────────────────────────────────────────────── */
	@media (max-width: 480px) {
		.puzzles-inner { padding: 1.5rem 1rem 3rem; }
		.node { width: 60px; height: 60px; }
		.node-icon { font-size: 1.2rem; }
		.node-title { font-size: 0.82rem; }
	}
</style>
