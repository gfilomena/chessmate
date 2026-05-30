<script lang="ts">
	import { Chess } from 'chess.js';
	import Board from '$lib/chess/Board.svelte';
	import { t } from '$lib/i18n';

	// ── Mode ─────────────────────────────────────────────────────────────────────
	type Mode = 'free' | 'pgn';
	let mode = $state<Mode>('free');

	// ── Free play ─────────────────────────────────────────────────────────────────
	// playerColor segue il turno → entrambi i colori sono mossi dalla stessa persona
	let chess      = $state(new Chess());
	let lastMoveFP = $state<{ from: string; to: string } | null>(null);

	const fpTurn  = $derived(chess.turn() === 'w' ? 'white' : 'black');
	const fpFen   = $derived(chess.fen());

	function handleFreeMove(from: string, to: string, promotion?: string) {
		try {
			chess.move({ from, to, promotion: (promotion ?? 'q') as any });
			chess      = chess; // trigger reactivity
			lastMoveFP = { from, to };
		} catch {}
	}

	function undoMove() {
		chess.undo();
		chess      = chess;
		lastMoveFP = null;
	}

	function resetBoard() {
		chess      = new Chess();
		lastMoveFP = null;
	}

	// ── PGN mode ──────────────────────────────────────────────────────────────────
	let pgnText    = $state('');
	let pgnError   = $state('');
	let pgnLoaded  = $state(false);

	interface PgnPos { fen: string; label: string; from: string; to: string }
	let positions  = $state<PgnPos[]>([]);
	let currentIdx = $state(0);

	const pgnFen      = $derived(positions[currentIdx]?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
	const pgnLastMove = $derived(currentIdx > 0 ? { from: positions[currentIdx].from, to: positions[currentIdx].to } : null);

	function loadPgn() {
		pgnError  = '';
		pgnLoaded = false;
		try {
			const temp = new Chess();
			temp.loadPgn(pgnText.trim());
			const history = temp.history({ verbose: true }) as any[];

			const pos: PgnPos[] = [{ fen: new Chess().fen(), label: 'Inizio', from: '', to: '' }];
			const replay = new Chess();
			for (let i = 0; i < history.length; i++) {
				const mv = history[i];
				replay.move(mv);
				const n = Math.floor(i / 2) + 1;
				pos.push({
					fen:   replay.fen(),
					label: i % 2 === 0 ? `${n}. ${mv.san}` : `${n}… ${mv.san}`,
					from:  mv.from,
					to:    mv.to,
				});
			}
			positions  = pos;
			currentIdx = 0;
			pgnLoaded  = true;
		} catch {
			pgnError = 'PGN non valido — controlla il formato e riprova.';
		}
	}

	function goFirst() { currentIdx = 0; }
	function goPrev()  { if (currentIdx > 0) currentIdx--; }
	function goNext()  { if (currentIdx < positions.length - 1) currentIdx++; }
	function goLast()  { currentIdx = positions.length - 1; }

	// Keyboard navigation (PGN mode)
	function handleKey(e: KeyboardEvent) {
		if (mode !== 'pgn') return;
		if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
		if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
		if (e.key === 'ArrowUp')    { e.preventDefault(); goFirst(); }
		if (e.key === 'ArrowDown')  { e.preventDefault(); goLast(); }
	}

	// Scroll move list to active item
	let moveListEl: HTMLElement | null = null;
	$effect(() => {
		if (!pgnLoaded || !moveListEl) return;
		const active = moveListEl.querySelector('.move-active');
		active?.scrollIntoView({ block: 'nearest' });
	});
</script>

<svelte:head>
	<title>Chess — {$t.nav.learn}</title>
</svelte:head>

<svelte:window onkeydown={handleKey} />

<div class="learn-page">

	<!-- ── Mode bar ─────────────────────────────────────────────────────── -->
	<div class="mode-bar">
		<div class="mode-tabs">
			<button class="mode-tab" class:active={mode === 'free'} onclick={() => mode = 'free'}>
				🎯 Libero
			</button>
			<button class="mode-tab" class:active={mode === 'pgn'} onclick={() => mode = 'pgn'}>
				📋 PGN
			</button>
		</div>
		<h1 class="page-title">📖 {$t.nav.learn}</h1>
	</div>

	<!-- ── Main layout ──────────────────────────────────────────────────── -->
	<div class="learn-layout">

		<!-- Board -->
		<div class="board-col">
			<div class="board-wrap">
				{#if mode === 'free'}
					<Board
						fen={fpFen}
						playerColor={fpTurn}
						isMyTurn={true}
						lastMove={lastMoveFP}
						onMove={handleFreeMove}
					/>
				{:else}
					<Board
						fen={pgnFen}
						playerColor="white"
						isMyTurn={false}
						lastMove={pgnLastMove}
						onMove={() => {}}
					/>
				{/if}
			</div>
		</div>

		<!-- Panel -->
		<div class="panel-col">

			<!-- ── FREE mode panel ─────────────────────────────── -->
			{#if mode === 'free'}
				<div class="panel-section">
					<div class="turn-indicator" class:black-turn={fpTurn === 'black'}>
						<span class="turn-dot"></span>
						<span>Turno: <strong>{fpTurn === 'white' ? '⬜ Bianco' : '⬛ Nero'}</strong></span>
					</div>
				</div>

				<div class="panel-section">
					<p class="panel-hint">
						Muovi i pezzi di entrambi i colori liberamente. La scacchiera segue le regole standard ma sei tu a controllare entrambe le parti.
					</p>
				</div>

				<div class="free-actions">
					<button class="action-btn" onclick={undoMove}
						disabled={chess.history().length === 0}>
						↩ Annulla
					</button>
					<button class="action-btn danger" onclick={resetBoard}>
						↺ Reimposta
					</button>
				</div>

				{#if chess.history().length > 0}
					<div class="panel-section moves-log">
						<p class="panel-label">Mosse</p>
						<div class="free-moves">
							{#each chess.history() as san, i}
								{#if i % 2 === 0}
									<span class="move-num">{Math.floor(i/2)+1}.</span>
								{/if}
								<span class="san-chip">{san}</span>
							{/each}
						</div>
					</div>
				{/if}

			<!-- ── PGN mode panel ──────────────────────────────── -->
			{:else}
				<div class="panel-section">
					<p class="panel-label">Importa PGN</p>
					<textarea
						class="pgn-textarea"
						bind:value={pgnText}
						placeholder="Incolla qui il PGN…
Es: 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"
						rows="5"
					></textarea>
					{#if pgnError}
						<p class="pgn-error">{pgnError}</p>
					{/if}
					<button class="action-btn full" onclick={loadPgn}
						disabled={!pgnText.trim()}>
						▶ Carica PGN
					</button>
				</div>

				{#if pgnLoaded}
					<!-- Navigation controls -->
					<div class="nav-controls">
						<button class="nav-btn" onclick={goFirst}  disabled={currentIdx === 0} title="Prima mossa">⏮</button>
						<button class="nav-btn" onclick={goPrev}   disabled={currentIdx === 0} title="← Precedente">◀</button>
						<span class="nav-pos">{currentIdx} / {positions.length - 1}</span>
						<button class="nav-btn" onclick={goNext}   disabled={currentIdx === positions.length - 1} title="Successiva →">▶</button>
						<button class="nav-btn" onclick={goLast}   disabled={currentIdx === positions.length - 1} title="Ultima mossa">⏭</button>
					</div>
					<p class="nav-hint">← → tasti freccia per navigare</p>

					<!-- Move list -->
					<div class="move-list" bind:this={moveListEl}>
						{#each positions as pos, i}
							{#if i === 0}
								<button
									class="move-chip"
									class:move-active={currentIdx === 0}
									onclick={() => currentIdx = 0}
								>Inizio</button>
							{:else if (i - 1) % 2 === 0}
								<span class="move-n">{Math.floor((i-1)/2)+1}.</span>
								<button
									class="move-chip"
									class:move-active={currentIdx === i}
									onclick={() => currentIdx = i}
								>{pos.label.split('. ')[1] ?? pos.label}</button>
							{:else}
								<button
									class="move-chip"
									class:move-active={currentIdx === i}
									onclick={() => currentIdx = i}
								>{pos.label.split('… ')[1] ?? pos.label}</button>
							{/if}
						{/each}
					</div>
				{/if}
			{/if}

		</div>
	</div>
</div>

<style>
	.learn-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 1rem 1.5rem 0.5rem;
		gap: 0.75rem;
		overflow: hidden;
	}

	/* ── Mode bar ── */
	.mode-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
	}
	.page-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-muted);
		margin-left: auto;
	}
	.mode-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.2rem;
	}
	.mode-tab {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.88rem;
		font-weight: 600;
		padding: 0.35rem 0.9rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.mode-tab:hover { color: var(--text); }
	.mode-tab.active {
		background: var(--accent);
		color: #000;
	}

	/* ── Layout ── */
	.learn-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 1.25rem;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Board col ── */
	.board-col {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}
	.board-wrap {
		width: 100%;
		max-width: min(calc(100vh - 200px), 100%);
		aspect-ratio: 1;
	}

	/* ── Panel col ── */
	.panel-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		overflow-y: auto;
		padding-right: 0.25rem;
	}
	.panel-section {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.panel-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		font-weight: 600;
	}
	.panel-hint {
		font-size: 0.82rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* ── Turn indicator ── */
	.turn-indicator {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
	}
	.turn-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #fff;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	.black-turn .turn-dot {
		background: #1a1a1a;
		border-color: var(--text-muted);
	}

	/* ── Action buttons ── */
	.free-actions {
		display: flex;
		gap: 0.5rem;
	}
	.action-btn {
		flex: 1;
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text);
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.action-btn:hover:not(:disabled) {
		border-color: var(--accent);
	}
	.action-btn:disabled { opacity: 0.4; cursor: default; }
	.action-btn.danger { border-color: var(--danger); color: var(--danger); }
	.action-btn.danger:hover:not(:disabled) { background: rgba(201,95,95,0.1); }
	.action-btn.full { width: 100%; }

	/* ── Moves log (free mode) ── */
	.moves-log { flex-shrink: 0; }
	.free-moves {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: baseline;
		max-height: 120px;
		overflow-y: auto;
	}
	.move-num {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-right: 0.1rem;
	}
	.san-chip {
		font-size: 0.82rem;
		font-family: monospace;
		color: var(--text);
		padding: 0.1rem 0.25rem;
		border-radius: 3px;
		background: rgba(255,255,255,0.05);
	}

	/* ── PGN textarea ── */
	.pgn-textarea {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text);
		padding: 0.6rem 0.75rem;
		font-size: 0.82rem;
		font-family: monospace;
		resize: vertical;
		outline: none;
		transition: border-color 0.2s;
		line-height: 1.5;
	}
	.pgn-textarea:focus { border-color: var(--accent); }
	.pgn-error {
		font-size: 0.8rem;
		color: var(--danger);
	}

	/* ── Navigation controls ── */
	.nav-controls {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.6rem 0.8rem;
	}
	.nav-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 1rem;
		cursor: pointer;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
		line-height: 1;
	}
	.nav-btn:hover:not(:disabled) { color: var(--text); background: rgba(255,255,255,0.07); }
	.nav-btn:disabled { opacity: 0.3; cursor: default; }
	.nav-pos {
		flex: 1;
		text-align: center;
		font-size: 0.8rem;
		color: var(--text-muted);
		font-family: monospace;
	}
	.nav-hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-align: center;
		opacity: 0.7;
	}

	/* ── Move list (PGN mode) ── */
	.move-list {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		align-items: baseline;
		overflow-y: auto;
		flex: 1;
		min-height: 80px;
	}
	.move-n {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-right: 0.1rem;
		flex-shrink: 0;
	}
	.move-chip {
		background: none;
		border: none;
		font-size: 0.82rem;
		font-family: monospace;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.15rem 0.3rem;
		border-radius: 4px;
		transition: background 0.12s, color 0.12s;
	}
	.move-chip:hover { background: rgba(255,255,255,0.07); color: var(--text); }
	.move-chip.move-active {
		background: var(--accent);
		color: #000;
		font-weight: 700;
	}

	/* ── Mobile ── */
	@media (max-width: 768px) {
		.learn-page {
			padding: 0.75rem 0.75rem 0.5rem;
			overflow-y: auto;
		}
		.learn-layout {
			grid-template-columns: 1fr;
			overflow: visible;
		}
		.board-wrap {
			max-width: min(calc(100vw - 1.5rem), 480px);
		}
		.board-col { justify-content: center; }
		.page-title { display: none; }
		.panel-col { overflow: visible; }
	}
</style>
