<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Apre/chiude il pannello laterale su mobile */
		panelOpen?: boolean;
		/** Titolo pannello mobile */
		panelTitle?: string;
		/** Label bottone toggle pannello (mobile) */
		panelToggleLabel?: string;
		/** Eval bar a sinistra della scacchiera (opzionale — solo learn) */
		evalBar?: Snippet;
		/** Riga giocatore superiore (avversario) */
		topPlayer?: Snippet;
		/** Corpo scacchiera */
		board: Snippet;
		/** Riga giocatore inferiore (utente) */
		bottomPlayer?: Snippet;
		/** Contenuto pannello destro */
		panel: Snippet;
	}

	let {
		panelOpen    = $bindable(false),
		panelTitle   = 'Mosse e azioni',
		panelToggleLabel,
		evalBar,
		topPlayer,
		board,
		bottomPlayer,
		panel,
	}: Props = $props();

	const toggleLabel = $derived(panelToggleLabel ?? panelTitle);
</script>

<!-- Backdrop mobile -->
<div
	class="cpl-backdrop"
	class:open={panelOpen}
	onclick={() => panelOpen = false}
	aria-hidden="true"
></div>

<div class="cpl-layout" class:has-eval={!!evalBar}>

	<!-- ── Eval bar (opzionale) ──────────────────────────────────── -->
	{#if evalBar}
		<div class="cpl-eval">
			{@render evalBar()}
		</div>
	{/if}

	<!-- ── Board column ──────────────────────────────────────────── -->
	<div class="cpl-board-col">

		{#if topPlayer}
			<div class="cpl-player-area">
				{@render topPlayer()}
			</div>
		{/if}

		<div class="cpl-board-container">
			{@render board()}
		</div>

		{#if bottomPlayer}
			<div class="cpl-player-area">
				{@render bottomPlayer()}
			</div>
		{/if}

		<!-- Toggle pannello (solo mobile) -->
		<button
			class="cpl-panel-toggle"
			onclick={() => panelOpen = !panelOpen}
		>
			{panelOpen ? 'Chiudi ✕' : toggleLabel}
		</button>
	</div>

	<!-- ── Panel column ──────────────────────────────────────────── -->
	<div class="cpl-panel" class:open={panelOpen}>
		<!-- Handle mobile -->
		<div class="cpl-handle"></div>
		<!-- Header mobile -->
		<div class="cpl-panel-header">
			<span>{panelTitle}</span>
			<button class="cpl-panel-close" onclick={() => panelOpen = false}>✕</button>
		</div>
		<!-- Contenuto -->
		{@render panel()}
	</div>

</div>

<style>
	/* ── Layout principale ── */
	.cpl-layout {
		display: flex;
		gap: clamp(0.75rem, 1.5vw, 1.5rem);
		padding: clamp(0.25rem, 0.4dvh, 0.6rem) clamp(0.75rem, 1.5vw, 1.5rem);
		height: 100%;
		overflow: hidden;
		align-items: center;
		justify-content: center;
	}

	/* ── Eval col ── */
	.cpl-eval {
		width: 28px;
		flex-shrink: 0;
		align-self: stretch;
		display: flex;
		align-items: stretch;
	}

	/* ── Board col ── */
	.cpl-board-col {
		display: flex;
		flex-direction: column;
		gap: clamp(0.2rem, 0.4dvh, 0.4rem);
		align-self: stretch;
		min-height: 0;
	}

	.cpl-player-area {
		flex-shrink: 0;
	}

	.cpl-board-container {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* ── Panel col ── */
	.cpl-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 260px;
		flex-shrink: 0;
		height: 100%;
		justify-content: center;
		overflow-y: auto;
		padding-right: 0.1rem;
	}

	/* ── Mobile: toggle button (nascosto su desktop) ── */
	.cpl-panel-toggle { display: none; }

	/* ── Mobile: backdrop (nascosto su desktop) ── */
	.cpl-backdrop { display: none; }

	/* ── Mobile: handle e header (nascosti su desktop) ── */
	.cpl-handle      { display: none; }
	.cpl-panel-header { display: none; }
	.cpl-panel-close  { display: none; }

	/* ════════════════════════════════════════════════════════
	   MOBILE (≤ 768px)
	════════════════════════════════════════════════════════ */
	@media (max-width: 768px) {
		.cpl-layout {
			flex-direction: column;
			padding: 0.4rem 0.5rem 0.5rem;
			gap: 0.35rem;
			align-items: center;
		}

		.cpl-eval { display: none; /* su mobile la eval bar è nascosta */ }

		.cpl-board-col {
			width: 100%;
			align-items: center;
			gap: 0.4rem;
		}

		.cpl-player-area {
			width: min(calc(100vw - 1rem), calc(100dvh - 220px));
		}

		/* Toggle pannello — visibile su mobile */
		.cpl-panel-toggle {
			display: flex;
			align-items: center;
			justify-content: center;
			width: min(calc(100vw - 1rem), calc(100dvh - 220px));
			padding: 0.5rem 1rem;
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: 8px;
			color: var(--text);
			font-size: 0.88rem;
			cursor: pointer;
			font-weight: 500;
			transition: border-color 0.15s;
		}
		.cpl-panel-toggle:hover { border-color: var(--accent); }

		/* Backdrop */
		.cpl-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0,0,0,0.45);
			z-index: 40;
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.25s ease;
		}
		.cpl-backdrop.open {
			opacity: 1;
			pointer-events: auto;
		}

		/* Panel → bottom sheet */
		.cpl-panel {
			position: fixed;
			bottom: 0; left: 0; right: 0;
			width: 100% !important;
			max-height: 72vh;
			height: auto;
			background: var(--bg-card);
			border-top: 2px solid var(--border);
			border-radius: 16px 16px 0 0;
			padding: 0 1rem 2rem;
			z-index: 50;
			overflow-y: auto;
			transform: translateY(100%);
			transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			justify-content: flex-start;
		}
		.cpl-panel.open {
			transform: translateY(0);
		}

		/* Handle visivo */
		.cpl-handle {
			display: block;
			width: 36px;
			height: 4px;
			background: var(--border);
			border-radius: 2px;
			margin: 0.8rem auto 0.4rem;
			flex-shrink: 0;
		}

		/* Header pannello */
		.cpl-panel-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0.5rem 0 0.65rem;
			position: sticky;
			top: 0;
			background: var(--bg-card);
			z-index: 1;
			border-bottom: 1px solid var(--border);
			flex-shrink: 0;
		}
		.cpl-panel-header span {
			font-weight: 600;
			font-size: 0.9rem;
			color: var(--text-muted);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}
		.cpl-panel-close {
			display: flex;
			align-items: center;
			justify-content: center;
			background: none;
			border: none;
			color: var(--text-muted);
			font-size: 1.1rem;
			cursor: pointer;
			padding: 0.25rem;
			line-height: 1;
			transition: color 0.15s;
		}
		.cpl-panel-close:hover { color: var(--text); }
	}
</style>
