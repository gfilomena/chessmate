<script lang="ts">
	/**
	 * NavTimeline — barra di navigazione mosse riusabile.
	 *
	 * Usata in: game/[id], learn, analysis/[id]
	 *
	 * Props:
	 *   current    – indice corrente (0-based)
	 *   total      – numero totale di posizioni − 1
	 *   onFirst/Prev/Next/Last – callback navigazione
	 *   onGoto     – callback click sulla track (optional)
	 *   label      – testo alternativo al contatore (es. "Live")
	 *   showTrack  – mostra la barra progress cliccabile (default true)
	 */
	let {
		current   = 0,
		total     = 0,
		onFirst   = () => {},
		onPrev    = () => {},
		onNext    = () => {},
		onLast    = () => {},
		onGoto,
		label,
		showTrack = true,
	}: {
		current?:   number;
		total?:     number;
		onFirst?:   () => void;
		onPrev?:    () => void;
		onNext?:    () => void;
		onLast?:    () => void;
		onGoto?:    (idx: number) => void;
		label?:     string;
		showTrack?: boolean;
	} = $props();

	const pct          = $derived(total > 0 ? (current / total) * 100 : 0);
	const atStart      = $derived(current <= 0);
	const atEnd        = $derived(current >= total);
	const displayLabel = $derived(label ?? `${current} / ${total}`);
	const isLive       = $derived(label === 'Live');

	function handleTrackClick(e: MouseEvent) {
		if (!onGoto || total === 0) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const p    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		onGoto(Math.round(p * total));
	}

	function handleTrackKey(e: KeyboardEvent) {
		if (!onGoto || total === 0) return;
		if (e.key === 'ArrowRight') { e.preventDefault(); onGoto(Math.min(total, current + 1)); }
		if (e.key === 'ArrowLeft')  { e.preventDefault(); onGoto(Math.max(0, current - 1)); }
		if (e.key === 'Home')       { e.preventDefault(); onGoto(0); }
		if (e.key === 'End')        { e.preventDefault(); onGoto(total); }
	}
</script>

<div class="ntl" class:with-track={showTrack}>
	<button class="ntl-btn" onclick={onFirst} disabled={atStart} title="Prima mossa">⏮</button>
	<button class="ntl-btn" onclick={onPrev}  disabled={atStart} title="Mossa precedente">◀</button>

	{#if showTrack}
		<div class="ntl-track" onclick={handleTrackClick} onkeydown={handleTrackKey}
			role="slider" tabindex="0"
			aria-label="Naviga mosse"
			aria-valuenow={current} aria-valuemin={0} aria-valuemax={total}>
			<div class="ntl-fill"  style="width:{pct}%"></div>
			<div class="ntl-thumb" style="left:{pct}%"></div>
		</div>
	{/if}

	<span class="ntl-label" class:live={isLive}>{displayLabel}</span>

	<button class="ntl-btn" onclick={onNext} disabled={atEnd} title="Mossa successiva">▶</button>
	<button class="ntl-btn" onclick={onLast} disabled={atEnd} title="Ultima mossa">⏭</button>
</div>

<style>
	.ntl {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		width: 100%;
	}

	/* ── Buttons ── */
	.ntl-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		line-height: 1;
		flex-shrink: 0;
		transition: color 0.15s, background 0.1s;
	}
	.ntl-btn:hover:not(:disabled) {
		color: var(--text);
		background: rgba(255, 255, 255, 0.08);
	}
	.ntl-btn:disabled { opacity: 0.3; cursor: default; }

	/* ── Track ── */
	.ntl-track {
		flex: 1;
		height: 5px;
		background: var(--border);
		border-radius: 3px;
		cursor: pointer;
		position: relative;
		overflow: visible;
		min-width: 40px;
	}
	.ntl-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
		transition: width 0.12s ease;
		pointer-events: none;
	}
	.ntl-thumb {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--accent);
		border: 2px solid var(--bg-card, #312E2B);
		transition: left 0.12s ease;
		pointer-events: none;
	}

	/* ── Label / counter ── */
	.ntl-label {
		font-size: 0.72rem;
		font-family: monospace;
		color: var(--text-muted);
		min-width: 52px;
		text-align: center;
		flex-shrink: 0;
		white-space: nowrap;
	}
	.ntl-label.live {
		color: var(--accent);
		font-weight: 700;
		letter-spacing: 0.03em;
	}
</style>
