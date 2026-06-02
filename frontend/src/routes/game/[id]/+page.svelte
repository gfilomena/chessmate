<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { Chess } from 'chess.js';
	import Board       from '$lib/chess/Board.svelte';
	import NavTimeline from '$lib/chess/NavTimeline.svelte';
	import ChessPageLayout from '$lib/chess/ChessPageLayout.svelte';
	import Timer from '$lib/chess/Timer.svelte';
	import { gameState, resetGame } from '$lib/stores/game';
	import { connectToGame, sendMove, sendResign, sendOfferDraw, sendDrawResponse, sendFlag, disconnect } from '$lib/ws/socket';
	import { user } from '$lib/stores/auth';
	import { initSounds, playSound, type SoundName } from '$lib/chess/sounds';
	import SoundControl from '$lib/chess/SoundControl.svelte';
	import { computeCaptured } from '$lib/chess/captured';
	import { t } from '$lib/i18n';
	import { get } from 'svelte/store';

	const gameId = $page.params.id!;

	let panelOpen = $state(false);

	// ── Move navigation ─────────────────────────────────────────────
	interface HistoryEntry {
		fen: string;
		move: { from: string; to: string } | null;
		sound: SoundName | null;
		san:   string | null;
	}

	function buildHistory(pgn: string): HistoryEntry[] {
		const entries: HistoryEntry[] = [{ fen: new Chess().fen(), move: null, sound: null, san: null }];
		if (!pgn) return entries;
		try {
			const temp = new Chess();
			temp.loadPgn(pgn);
			const moves = temp.history({ verbose: true }) as any[];
			const replay = new Chess();
			for (const mv of moves) {
				replay.move(mv.san);
				const inCheck   = replay.inCheck();
				const isCapture = mv.flags.includes('c') || mv.flags.includes('e');
				const sound: SoundName = inCheck ? 'check' : isCapture ? 'capture' : 'move';
				entries.push({ fen: replay.fen(), move: { from: mv.from, to: mv.to }, sound, san: mv.san });
			}
		} catch {}
		return entries;
	}

	let viewIndex = $state<number | null>(null); // null = live
	let stripEl   = $state<HTMLElement | null>(null);

	const history = $derived(buildHistory($gameState.pgn));

	const displayFen = $derived(
		viewIndex === null ? $gameState.fen : (history[viewIndex]?.fen ?? $gameState.fen)
	);

	const isReviewing     = $derived(viewIndex !== null);
	const atStart         = $derived(viewIndex === 0);
	const atEnd           = $derived(viewIndex === null);
	const timelinePercent = $derived(
		history.length <= 1 || viewIndex === null
			? 100
			: Math.round((viewIndex / (history.length - 1)) * 100)
	);

	const navLabel = $derived(
		viewIndex === null
			? 'Live'
			: `${viewIndex} / ${history.length - 1}`
	);

	function playNavSound(idx: number) {
		const s = history[idx]?.sound;
		if (s) playSound(s);
	}

	function navTo(idx: number) {
		if (idx <= 0)                   { viewIndex = 0; }
		else if (idx >= history.length - 1) { viewIndex = null; }
		else { viewIndex = idx; playNavSound(idx); }
	}
	function navFirst() { viewIndex = 0; }
	function navPrev() {
		const idx = viewIndex ?? history.length - 1;
		if (idx > 0) { viewIndex = idx - 1; playNavSound(idx - 1); }
	}
	function navNext() {
		if (viewIndex === null) return;
		if (viewIndex < history.length - 1) { viewIndex++; playNavSound(viewIndex); }
		else viewIndex = null;
	}
	function navLast() { viewIndex = null; }

	// Auto-scroll strip al chip attivo
	$effect(() => {
		const idx = viewIndex ?? history.length - 1;
		if (!stripEl) return;
		(stripEl.children[idx] as HTMLElement | undefined)
			?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
	});

	// Se l'avversario muove mentre si è in revisione → torna a live
	let prevHistLen = 0;
	$effect(() => {
		const len = history.length;
		if (len > prevHistLen && prevHistLen > 0 && isReviewing) viewIndex = null;
		prevHistLen = len;
	});

	// ───────────────────────────────────────────────────────────────

	onMount(() => {
		initSounds();
		resetGame();
		connectToGame(gameId);
	});

	onDestroy(() => {
		disconnect();
	});

	// Auto-apri il pannello quando arriva un'offerta di patta
	$effect(() => {
		if ($gameState.drawOffered) panelOpen = true;
	});

	const isMyTurn = $derived(
		($gameState.status === 'active') &&
		(($gameState.playerColor === 'white' && $gameState.turn === 'w') ||
		 ($gameState.playerColor === 'black' && $gameState.turn === 'b'))
	);

	// In modalità revisione il board non accetta mosse
	const canMove = $derived(!isReviewing && isMyTurn);

	// ── Pezzi catturati ─────────────────────────────────────────────
	const captured   = $derived(computeCaptured(displayFen));
	const myCaptured = $derived($gameState.playerColor === 'white' ? captured.byWhite : captured.byBlack);
	const oppCaptured= $derived($gameState.playerColor === 'white' ? captured.byBlack : captured.byWhite);
	const myAdv      = $derived($gameState.playerColor === 'white' ? captured.advantage : -captured.advantage);
	const oppAdv     = $derived(-myAdv);

	const isWhiteActive = $derived($gameState.status === 'active' && $gameState.turn === 'w');
	const isBlackActive = $derived($gameState.status === 'active' && $gameState.turn === 'b');

	let lastMove = $state<{ from: string; to: string } | null>(null);

	// Evidenzia la mossa corrente nella navigazione storica
	const displayLastMove = $derived(
		viewIndex === null ? lastMove : (history[viewIndex]?.move ?? null)
	);

	function handleMove(from: string, to: string, promotion?: string) {
		lastMove = { from, to };
		sendMove(from, to, promotion);
	}

	function handleResign() {
		if (confirm(get(t).game.resign_confirm)) {
			sendResign();
		}
	}

	function handleDrawOffer() {
		sendOfferDraw();
	}

	function handleDrawResponse(accepted: boolean) {
		sendDrawResponse(accepted);
		gameState.update(s => ({ ...s, drawOffered: false }));
	}

	const gameResultText = $derived((() => {
		const result = $gameState.result;
		const reason = $gameState.finishReason;
		if (!result) return '';
		const who = result === 'draw' ? $t.result.draw :
			result === $gameState.playerColor ? $t.game.i_win : $t.game.i_lose;
		const why = ($t.game.reasons as any)[reason ?? ''] ?? reason ?? '';
		return why ? `${who} — ${why}` : who;
	})());
</script>

<svelte:head>
	<title>Partita — Chess</title>
</svelte:head>

<ChessPageLayout
	bind:panelOpen
	panelTitle={$t.common.moves_actions_title}
	panelToggleLabel={$gameState.drawOffered ? $t.game.draw_offer_panel : $t.common.moves_actions}
>

	{#snippet topPlayer()}
		<div class="player-row">
			<div class="player-info">
				<span class="player-name">
					{$gameState.playerColor === 'white' ? $t.game.black : $t.game.white}
				</span>
				<div class="captured-row">
					{#each oppCaptured as p}<span class="cap-piece">{p}</span>{/each}
					{#if oppAdv > 0}<span class="cap-adv">+{oppAdv}</span>{/if}
				</div>
			</div>
			<Timer
				ms={$gameState.playerColor === 'white' ? $gameState.blackMs : $gameState.whiteMs}
				isActive={$gameState.playerColor === 'white' ? isBlackActive : isWhiteActive}
			/>
		</div>
		<!-- Striscia mosse (mobile) -->
		<div class="mobile-moves-strip" bind:this={stripEl}>
			{#each history as entry, i}
				{@const isActive = (viewIndex ?? history.length - 1) === i}
				<button class="move-chip" class:active={isActive} class:start-chip={i === 0} onclick={() => navTo(i)}>
					{#if i === 0}◆{:else if i % 2 === 1}{Math.ceil(i / 2)}.{entry.san}{:else}{entry.san}{/if}
				</button>
			{/each}
		</div>
	{/snippet}

	{#snippet board()}
		{#if $gameState.status === 'waiting'}
			<div class="overlay"><p>{$t.game.waiting_opponent}</p></div>
		{/if}
		{#if $gameState.status === 'finished' && !isReviewing}
			<div class="overlay finished">
				<p class="result-text">{gameResultText}</p>
				<div class="overlay-btns">
					<a href="/" class="btn btn-primary">{$t.game.new_game}</a>
					<a href="/analysis/{gameId}?autoReview=1" class="btn btn-google">{$t.game.review}</a>
				</div>
			</div>
		{/if}
		<Board
			fen={displayFen}
			playerColor={$gameState.playerColor}
			isMyTurn={canMove}
			lastMove={displayLastMove}
			onMove={handleMove}
		/>
	{/snippet}

	{#snippet bottomPlayer()}
		<!-- Nav timeline (mobile) -->
		<div class="mobile-nav-bar">
			<NavTimeline
				current={Math.max(0, viewIndex ?? history.length - 1)}
				total={Math.max(0, history.length - 1)}
				label={navLabel}
				showTrack={true}
				onFirst={navFirst} onPrev={navPrev} onNext={navNext} onLast={navLast} onGoto={navTo}
			/>
		</div>
		<div class="player-row">
			<div class="player-info">
				<span class="player-name">{$user?.username ?? 'Tu'}</span>
				<span class="player-elo">{$user?.elo_rapid ?? ''}</span>
				<div class="captured-row">
					{#each myCaptured as p}<span class="cap-piece">{p}</span>{/each}
					{#if myAdv > 0}<span class="cap-adv">+{myAdv}</span>{/if}
				</div>
			</div>
			<Timer
				ms={$gameState.playerColor === 'white' ? $gameState.whiteMs : $gameState.blackMs}
				isActive={$gameState.playerColor === 'white' ? isWhiteActive : isBlackActive}
				onFlag={sendFlag}
			/>
		</div>
	{/snippet}

	{#snippet panel()}
		{#if $gameState.drawOffered}
			<div class="draw-offer">
				<p>{$t.game.draw_offered}</p>
				<div style="display:flex;gap:0.5rem;margin-top:0.5rem">
					<button class="btn btn-primary" style="flex:1" onclick={() => handleDrawResponse(true)}>{$t.game.accept}</button>
					<button class="btn btn-google" style="flex:1" onclick={() => handleDrawResponse(false)}>{$t.game.decline}</button>
				</div>
			</div>
		{/if}

		<div class="moves-panel">
			<h3>{$t.common.moves}</h3>
			<div class="pgn-text">{$gameState.pgn || '—'}</div>
		</div>

		{#if $gameState.status === 'active'}
			<div class="actions">
				<button class="btn btn-google" onclick={handleDrawOffer} style="width:100%">{$t.game.offer_draw}</button>
				<button class="btn" style="background:var(--danger);color:#fff;width:100%" onclick={handleResign}>{$t.game.resign}</button>
			</div>
		{/if}

		<div class="nav-row" class:reviewing={isReviewing}>
			<NavTimeline
				current={Math.max(0, viewIndex ?? history.length - 1)}
				total={Math.max(0, history.length - 1)}
				label={navLabel} showTrack={false}
				onFirst={navFirst} onPrev={navPrev} onNext={navNext} onLast={navLast} onGoto={navTo}
			/>
		</div>

		<div class="status-badge" class:active={$gameState.status === 'active'}>
			{#if $gameState.status === 'waiting'}{$t.game.status_waiting}
			{:else if $gameState.status === 'active'}{isMyTurn ? $t.game.your_turn : $t.game.wait}
			{:else if $gameState.status === 'finished'}{$t.game.status_finished}
			{/if}
		</div>

		<SoundControl />
	{/snippet}

</ChessPageLayout>

<style>
	/* ── Player rows ── */
	.player-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.player-info { display: flex; flex-direction: column; }
	.player-name { font-weight: 600; font-size: 1rem; }
	.player-elo  { font-size: 0.8rem; color: var(--text-muted); }
	.captured-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.04rem;
		margin-top: 0.12rem;
		min-height: 1.3rem;
	}
	.cap-piece { font-size: 1.25rem; line-height: 1; opacity: 0.85; }
	.cap-adv   { font-size: 0.85rem; font-weight: 700; color: var(--accent); margin-left: 0.3rem; }

	/* ── Overlay (waiting / finished) ── */
	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(0,0,0,0.65);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 5;
		border-radius: 4px;
		font-size: 1.2rem;
	}
	.result-text { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
	.overlay-btns {
		display: flex; flex-direction: column; gap: 0.6rem;
		margin-top: 1.2rem; min-width: 180px;
	}
	.overlay-btns .btn { text-align: center; }

	/* ── Panel content ── */
	.moves-panel {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.moves-panel h3 {
		margin-bottom: 0.75rem;
		color: var(--text-muted);
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.pgn-text { font-size: 0.85rem; line-height: 1.6; color: var(--text); word-break: break-all; }
	.actions  { display: flex; flex-direction: column; gap: 0.5rem; }
	.draw-offer {
		background: var(--bg-card);
		border: 1px solid var(--accent);
		border-radius: 8px;
		padding: 1rem;
		font-size: 0.9rem;
	}
	.status-badge {
		text-align: center; padding: 0.5rem; border-radius: 8px;
		font-size: 0.9rem; background: var(--bg-card);
		border: 1px solid var(--border); color: var(--text-muted);
	}
	.status-badge.active { border-color: var(--accent); color: var(--accent); }
	.nav-row {
		display: flex; align-items: center; gap: 0.25rem;
		background: var(--bg-card); border: 1px solid var(--border);
		border-radius: 8px; padding: 0.3rem 0.4rem; transition: border-color 0.2s;
	}
	.nav-row.reviewing { border-color: var(--accent); }

	/* ── Mobile moves strip & nav bar (nascosti su desktop) ── */
	.mobile-moves-strip { display: none; }
	.mobile-nav-bar     { display: none; }

	@media (max-width: 768px) {
		.mobile-moves-strip {
			display: flex;
			overflow-x: auto; overflow-y: hidden;
			gap: 0.2rem; padding: 0.3rem 0.4rem;
			background: var(--bg-card); border: 1px solid var(--border);
			border-radius: 8px; scrollbar-width: none;
			width: min(calc(100vw - 1rem), calc(100dvh - 238px));
			-webkit-overflow-scrolling: touch; flex-shrink: 0;
		}
		.mobile-moves-strip::-webkit-scrollbar { display: none; }
		.move-chip {
			flex-shrink: 0; background: none; border: 1px solid transparent;
			border-radius: 4px; color: var(--text-muted); font-size: 0.65rem;
			font-family: monospace; padding: 0.18rem 0.32rem; cursor: pointer;
			white-space: nowrap; line-height: 1.4;
			transition: background 0.1s, color 0.1s, border-color 0.1s;
		}
		.move-chip:hover:not(.active) { background: rgba(255,255,255,0.06); color: var(--text); }
		.move-chip.active { background: var(--accent); border-color: var(--accent); color: #000; font-weight: 700; }
		.move-chip.start-chip { color: var(--accent); font-size: 0.55rem; }

		.mobile-nav-bar {
			display: flex; align-items: center; gap: 0.3rem;
			width: min(calc(100vw - 1rem), calc(100dvh - 238px));
			background: var(--bg-card); border: 1px solid var(--border);
			border-radius: 8px; padding: 0.4rem 0.5rem; flex-shrink: 0;
		}
		/* Nascondi nav-row nel pannello su mobile */
		:global(.cpl-panel) .nav-row { display: none; }
		.moves-panel { flex: none; max-height: 220px; }
	}
</style>
