<script lang="ts">
	import { t } from '$lib/i18n';
	import SoundControl from '$lib/chess/SoundControl.svelte';
	import {
		BOARD_THEMES, boardTheme, setBoardTheme, type BoardThemeId,
		PIECE_SETS, pieceSet, setPieceSet, type PieceSet,
	} from '$lib/chess/boardSettings';
	import { initSounds } from '$lib/chess/sounds';
	import { onMount } from 'svelte';

	onMount(() => initSounds());

	// preview mini-board for board themes (4 squares: 2 light + 2 dark)
</script>

<svelte:head>
	<title>ChessMate — {$t.settings.title}</title>
</svelte:head>

<div class="settings-page">
	<h1 class="page-title">{$t.settings.title}</h1>

	<!-- ── Audio ─────────────────────────────────────────────── -->
	<section class="settings-section">
		<h2 class="section-title">{$t.settings.audio}</h2>
		<div class="section-body">
			<SoundControl />
		</div>
	</section>

	<!-- ── Board theme ───────────────────────────────────────── -->
	<section class="settings-section">
		<h2 class="section-title">{$t.settings.board}</h2>
		<div class="section-body">
			<div class="theme-grid">
				{#each BOARD_THEMES as theme}
					{@const active = $boardTheme === theme.id}
					<button
						class="theme-card"
						class:active
						onclick={() => setBoardTheme(theme.id)}
						title={theme.label}
						aria-pressed={active}
					>
						<!-- mini 4-square preview -->
						<div class="board-preview">
							{#if theme.texture}
								<div class="sq sq-light" style="background: url({theme.texture}) center/cover;"></div>
								<div class="sq sq-dark"  style="background: url({theme.texture}) 50% 50%/cover; filter: brightness(0.65);"></div>
								<div class="sq sq-dark"  style="background: url({theme.texture}) 50% 50%/cover; filter: brightness(0.65);"></div>
								<div class="sq sq-light" style="background: url({theme.texture}) center/cover;"></div>
							{:else}
								<div class="sq" style="background: {theme.previewLight};"></div>
								<div class="sq" style="background: {theme.previewDark};"></div>
								<div class="sq" style="background: {theme.previewDark};"></div>
								<div class="sq" style="background: {theme.previewLight};"></div>
							{/if}
						</div>
						<span class="theme-label">{theme.label}</span>
						{#if active}
							<span class="check-badge">✓</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Piece set ─────────────────────────────────────────── -->
	<section class="settings-section">
		<h2 class="section-title">{$t.settings.pieces}</h2>
		<div class="section-body">
			<div class="piece-grid">
				{#each PIECE_SETS as ps}
					{@const active = $pieceSet === ps.id}
					<button
						class="piece-card"
						class:active
						onclick={() => setPieceSet(ps.id)}
						title={ps.label}
						aria-pressed={active}
					>
						<div class="piece-preview">
							<img src={ps.preview} alt="King {ps.label}" />
						</div>
						<span class="piece-label">{ps.label}</span>
						{#if active}
							<span class="check-badge">✓</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</section>
</div>

<style>
	.settings-page {
		max-width: 680px;
		margin: 0 auto;
		padding: 2rem 1.25rem;
	}

	.page-title {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 2rem 0;
	}

	/* ── Section ────────────────────────────────────────────── */
	.settings-section {
		margin-bottom: 2.5rem;
	}

	.section-title {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		margin: 0 0 0.85rem 0;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border);
	}

	.section-body {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-start;
	}

	/* ── Board theme grid ───────────────────────────────────── */
	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
		width: 100%;
	}

	.theme-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		background: var(--bg-card);
		border: 2px solid var(--border);
		border-radius: 10px;
		padding: 0.7rem 0.5rem 0.6rem;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.theme-card:hover { border-color: var(--accent); }
	.theme-card.active {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.board-preview {
		width: 56px;
		height: 56px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.sq {
		width: 100%;
		height: 100%;
	}

	.theme-label {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-align: center;
	}
	.theme-card.active .theme-label { color: var(--accent); font-weight: 600; }

	/* ── Piece set grid ─────────────────────────────────────── */
	.piece-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0.75rem;
		width: 100%;
	}

	.piece-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		background: var(--bg-card);
		border: 2px solid var(--border);
		border-radius: 10px;
		padding: 0.9rem 0.5rem 0.6rem;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.piece-card:hover { border-color: var(--accent); }
	.piece-card.active {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
	}

	.piece-preview {
		width: 64px;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.piece-preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
	}

	.piece-label {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.piece-card.active .piece-label { color: var(--accent); font-weight: 600; }

	/* ── Check badge ────────────────────────────────────────── */
	.check-badge {
		position: absolute;
		top: 5px;
		right: 6px;
		font-size: 0.65rem;
		color: var(--accent);
		font-weight: 800;
	}
</style>
