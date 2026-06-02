<script lang="ts">
	import {
		soundTheme, soundVolume, soundMuted,
		THEME_KEYS, themeLabel, setTheme, setVolume, toggleMute,
		playSound, type SoundTheme
	} from './sounds';

	// Preview di un suono quando si cambia tema
	function handleThemeChange(e: Event) {
		const t = (e.target as HTMLSelectElement).value as SoundTheme;
		setTheme(t);
		setTimeout(() => playSound('move'), 50);
	}

	function handleMuteToggle() {
		toggleMute();
	}

	function handleVolumeChange(e: Event) {
		setVolume(parseFloat((e.target as HTMLInputElement).value));
	}
</script>

<div class="sound-ctrl">
	<!-- Mute toggle -->
	<button
		class="mute-btn"
		class:muted={$soundMuted}
		onclick={handleMuteToggle}
		title={$soundMuted ? 'Attiva audio' : 'Disattiva audio'}
		aria-label={$soundMuted ? 'Attiva audio' : 'Disattiva audio'}
	>
		{#if $soundMuted}
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
				<line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
			</svg>
		{:else if $soundVolume < 0.01}
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
			</svg>
		{:else if $soundVolume < 0.5}
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
				<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
			</svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
				<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
				<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
			</svg>
		{/if}
	</button>

	<!-- Volume slider -->
	<input
		type="range"
		min="0" max="1" step="0.05"
		value={$soundVolume}
		class="vol-slider"
		class:disabled={$soundMuted}
		oninput={handleVolumeChange}
		disabled={$soundMuted}
		aria-label="Volume"
		title="Volume"
	/>

	<!-- Theme selector -->
	<select
		class="theme-select"
		value={$soundTheme}
		onchange={handleThemeChange}
		aria-label="Tema audio"
		title="Tema audio"
	>
		{#each THEME_KEYS as key}
			<option value={key}>{themeLabel(key)}</option>
		{/each}
	</select>
</div>

<style>
	.sound-ctrl {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.6rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		flex-shrink: 0;
	}

	.mute-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.15rem;
		display: flex;
		align-items: center;
		border-radius: 4px;
		transition: color 0.15s;
		flex-shrink: 0;
	}
	.mute-btn:hover { color: var(--text); }
	.mute-btn.muted { color: var(--danger); }

	.vol-slider {
		width: 72px;
		height: 4px;
		accent-color: var(--accent);
		cursor: pointer;
		flex-shrink: 0;
	}
	.vol-slider.disabled { opacity: 0.35; cursor: default; }

	.theme-select {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 5px;
		color: var(--text);
		font-size: 0.72rem;
		padding: 0.2rem 0.35rem;
		cursor: pointer;
		outline: none;
		transition: border-color 0.15s;
	}
	.theme-select:focus { border-color: var(--accent); }
</style>
