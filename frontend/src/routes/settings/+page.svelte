<script lang="ts">
	import { t, lang, setLang, LANGS } from '$lib/i18n';
	import {
		BOARD_THEMES, boardTheme, setBoardTheme,
		PIECE_SETS, pieceSet, setPieceSet,
	} from '$lib/chess/boardSettings';
	import {
		soundTheme, soundVolume, soundMuted,
		THEME_KEYS, themeLabel, setTheme, setVolume, toggleMute,
		playSound, type SoundTheme,
	} from '$lib/chess/sounds';
	import { initSounds } from '$lib/chess/sounds';
	import { onMount } from 'svelte';

	onMount(() => initSounds());

	function handleThemeChange(e: Event) {
		const v = (e.target as HTMLSelectElement).value as SoundTheme;
		setTheme(v);
		setTimeout(() => playSound('move'), 50);
	}

	function handleVolumeChange(e: Event) {
		setVolume(parseFloat((e.target as HTMLInputElement).value));
	}
</script>

<svelte:head>
	<title>ChessMate — {$t.settings.title}</title>
</svelte:head>

<div class="settings-page">
	<h1 class="page-title">{$t.settings.title}</h1>

	<!-- ── Lingua ─────────────────────────────────────────────── -->
	<section class="settings-section">
		<h2 class="section-title">{$t.settings.language}</h2>
		<div class="lang-row">
			{#each LANGS as l}
				<button
					class="lang-btn"
					class:active={$lang === l.code}
					onclick={() => setLang(l.code)}
					aria-pressed={$lang === l.code}
				>
					<span class="lang-flag">{l.flag}</span>
					<span class="lang-label">{l.label}</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- ── Audio ─────────────────────────────────────────────── -->
	<section class="settings-section">
		<h2 class="section-title">{$t.settings.audio}</h2>
		<div class="audio-block">

			<!-- Mute toggle -->
			<button
				class="mute-row"
				class:muted={$soundMuted}
				onclick={toggleMute}
				aria-pressed={$soundMuted}
			>
				<span class="mute-icon">
					{#if $soundMuted}
						<!-- muted -->
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
							<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
						</svg>
					{:else if $soundVolume < 0.01}
						<!-- volume 0 -->
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
						</svg>
					{:else if $soundVolume < 0.5}
						<!-- volume low -->
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
							<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
						</svg>
					{:else}
						<!-- volume high -->
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
							<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
							<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
						</svg>
					{/if}
				</span>
				<span class="mute-label">{$soundMuted ? $t.settings.muted : $t.settings.unmuted}</span>
				<span class="mute-toggle-pill" class:off={$soundMuted}></span>
			</button>

			<!-- Volume slider -->
			<div class="audio-row">
				<span class="audio-row-label">{$t.settings.volume}</span>
				<div class="slider-wrap">
					<input
						type="range"
						min="0" max="1" step="0.05"
						value={$soundVolume}
						class="vol-slider"
						class:disabled={$soundMuted}
						oninput={handleVolumeChange}
						disabled={$soundMuted}
						aria-label="Volume"
					/>
					<span class="vol-pct">{Math.round($soundVolume * 100)}%</span>
				</div>
			</div>

			<!-- Theme select -->
			<div class="audio-row">
				<span class="audio-row-label">{$t.settings.theme}</span>
				<select
					class="theme-select"
					value={$soundTheme}
					onchange={handleThemeChange}
					disabled={$soundMuted}
					class:disabled={$soundMuted}
					aria-label="Tema audio"
				>
					{#each THEME_KEYS as key}
						<option value={key}>{themeLabel(key)}</option>
					{/each}
				</select>
			</div>

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
						{#if active}<span class="check-badge">✓</span>{/if}
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
						{#if active}<span class="check-badge">✓</span>{/if}
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

	/* ── Lingua ─────────────────────────────────────────────── */
	.lang-row {
		display: flex;
		gap: 0.75rem;
	}

	.lang-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55rem;
		padding: 1.1rem 0.75rem;
		background: var(--bg-card);
		border: 2px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
	}
	.lang-btn:hover { border-color: var(--accent); }
	.lang-btn.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.lang-flag  { font-size: 2.2rem; line-height: 1; }
	.lang-label { font-size: 0.95rem; font-weight: 600; color: var(--text); }
	.lang-btn.active .lang-label { color: var(--accent); }

	/* ── Audio block ─────────────────────────────────────────── */
	.audio-block {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	/* Mute toggle row */
	.mute-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 1rem 1.25rem;
		background: var(--bg-card);
		border: 2px solid var(--border);
		border-radius: 12px;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		color: var(--text);
	}
	.mute-row:hover { border-color: var(--accent); }
	.mute-row.muted {
		border-color: var(--danger, #e05050);
		color: var(--danger, #e05050);
	}

	.mute-icon { display: flex; align-items: center; flex-shrink: 0; }
	.mute-label { flex: 1; font-size: 1.05rem; font-weight: 600; text-align: left; }

	/* Toggle pill */
	.mute-toggle-pill {
		width: 48px;
		height: 26px;
		border-radius: 13px;
		background: var(--accent);
		position: relative;
		flex-shrink: 0;
		transition: background 0.2s;
	}
	.mute-toggle-pill::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 24px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		transition: left 0.2s;
	}
	.mute-toggle-pill.off {
		background: var(--border);
	}
	.mute-toggle-pill.off::after {
		left: 4px;
	}

	/* Volume + Theme rows */
	.audio-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 1.25rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.audio-row-label {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-muted);
		min-width: 56px;
		flex-shrink: 0;
	}

	/* Volume slider */
	.slider-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.vol-slider {
		flex: 1;
		height: 8px;
		appearance: none;
		-webkit-appearance: none;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			var(--accent) 0%,
			var(--accent) calc(var(--pct, 0%) ),
			var(--border) calc(var(--pct, 0%) ),
			var(--border) 100%
		);
		outline: none;
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.vol-slider::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent);
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(0,0,0,0.4);
		transition: transform 0.1s;
	}
	.vol-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
	.vol-slider::-moz-range-thumb {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent);
		border: none;
		cursor: pointer;
	}
	.vol-slider.disabled { opacity: 0.3; cursor: default; }

	.vol-pct {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-muted);
		min-width: 38px;
		text-align: right;
	}

	/* Theme select */
	.theme-select {
		flex: 1;
		background: var(--bg-input, var(--bg));
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text);
		font-size: 1rem;
		padding: 0.55rem 0.75rem;
		cursor: pointer;
		outline: none;
		transition: border-color 0.15s;
	}
	.theme-select:focus { border-color: var(--accent); }
	.theme-select.disabled { opacity: 0.35; cursor: default; }

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
	.sq { width: 100%; height: 100%; }

	.theme-label { font-size: 0.72rem; color: var(--text-muted); text-align: center; }
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

	.piece-label { font-size: 0.72rem; color: var(--text-muted); }
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

	/* ── Mobile ─────────────────────────────────────────────── */
	@media (max-width: 480px) {
		.lang-btn { padding: 0.85rem 0.5rem; }
		.lang-flag { font-size: 1.8rem; }
		.lang-label { font-size: 0.82rem; }
		.mute-row { padding: 0.85rem 1rem; }
		.audio-row { padding: 0.7rem 1rem; }
	}
</style>
