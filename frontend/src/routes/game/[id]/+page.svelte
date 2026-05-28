<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import Board from '$lib/chess/Board.svelte';
	import Timer from '$lib/chess/Timer.svelte';
	import { gameState, resetGame } from '$lib/stores/game';
	import { connectToGame, sendMove, sendResign, sendOfferDraw, sendDrawResponse, disconnect } from '$lib/ws/socket';
	import { user } from '$lib/stores/auth';
	import { initSounds, toggleMute, cycleTheme, soundTheme, themeLabel } from '$lib/chess/sounds';

	const gameId = $page.params.id!;

	let muted = $state(false);
	let panelOpen = $state(false);
	const currentTheme = $derived($soundTheme);

	onMount(() => {
		initSounds();
		resetGame();
		connectToGame(gameId);
	});

	function handleToggleMute() {
		muted = toggleMute();
	}

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

	const isWhiteActive = $derived($gameState.status === 'active' && $gameState.turn === 'w');
	const isBlackActive = $derived($gameState.status === 'active' && $gameState.turn === 'b');

	let lastMove = $state<{ from: string; to: string } | null>(null);

	function handleMove(from: string, to: string, promotion?: string) {
		lastMove = { from, to };
		sendMove(from, to, promotion);
	}

	function handleResign() {
		if (confirm('Sei sicuro di voler abbandonare?')) {
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

	function resultText(result: string | null, reason: string | null): string {
		if (!result) return '';
		const who = result === 'draw' ? 'Patta' :
			result === $gameState.playerColor ? 'Hai vinto!' : 'Hai perso';
		const why: Record<string, string> = {
			checkmate: 'scacco matto',
			timeout: 'tempo scaduto',
			resigned: 'abbandono',
			stalemate: 'stallo',
			fifty_moves: 'regola 50 mosse',
			threefold: 'ripetizione',
			abandoned: 'abbandono avversario',
			draw_agreed: 'patta concordata'
		};
		return `${who} — ${why[reason ?? ''] ?? reason}`;
	}
</script>

<svelte:head>
	<title>Partita — Chess Clone</title>
</svelte:head>

<div class="game-layout">

	<!-- Colonna sinistra: info avversario + scacchiera + info giocatore -->
	<div class="board-col">

		<!-- Avversario (in alto) -->
		<div class="player-row opponent">
			<div class="player-info">
				<span class="player-name">
					{$gameState.playerColor === 'white' ? 'Nero' : 'Bianco'}
				</span>
			</div>
			<Timer
				ms={$gameState.playerColor === 'white' ? $gameState.blackMs : $gameState.whiteMs}
				isActive={$gameState.playerColor === 'white' ? isBlackActive : isWhiteActive}
			/>
		</div>

		<!-- Scacchiera -->
		<div class="board-container">
			{#if $gameState.status === 'waiting'}
				<div class="overlay">
					<p>In attesa dell'avversario...</p>
				</div>
			{/if}

			{#if $gameState.status === 'finished'}
				<div class="overlay finished">
					<p class="result-text">{resultText($gameState.result, $gameState.finishReason)}</p>
					<a href="/" class="btn btn-primary" style="width:auto;margin-top:1rem">Nuova partita</a>
				</div>
			{/if}

			<Board
				fen={$gameState.fen}
				playerColor={$gameState.playerColor}
				{isMyTurn}
				{lastMove}
				onMove={handleMove}
			/>
		</div>

		<!-- Giocatore (in basso) -->
		<div class="player-row self">
			<div class="player-info">
				<span class="player-name">{$user?.username ?? 'Tu'}</span>
				<span class="player-elo">{$user?.elo_rapid ?? ''}</span>
			</div>
			<Timer
				ms={$gameState.playerColor === 'white' ? $gameState.whiteMs : $gameState.blackMs}
				isActive={$gameState.playerColor === 'white' ? isWhiteActive : isBlackActive}
			/>
		</div>

		<!-- Pulsante toggle pannello (solo mobile) -->
		<button class="panel-toggle" onclick={() => panelOpen = !panelOpen}>
			{#if $gameState.drawOffered}
				🤝 Offerta patta!
			{:else if panelOpen}
				✕ Chiudi
			{:else}
				📋 Mosse & Azioni
			{/if}
		</button>
	</div>

	<!-- Backdrop pannello (mobile) -->
	<div
		class="panel-backdrop"
		class:panel-open={panelOpen}
		onclick={() => panelOpen = false}
		aria-hidden="true"
	></div>

	<!-- Colonna destra: mosse + azioni -->
	<div class="side-col" class:panel-open={panelOpen}>

		<!-- Handle + header (solo mobile) -->
		<div class="panel-drag-handle"></div>
		<div class="panel-header">
			<span>Mosse & Azioni</span>
			<button class="panel-close" onclick={() => panelOpen = false}>✕</button>
		</div>

		<!-- Offerta patta ricevuta -->
		{#if $gameState.drawOffered}
			<div class="draw-offer">
				<p>L'avversario offre patta</p>
				<div style="display:flex;gap:0.5rem;margin-top:0.5rem">
					<button class="btn btn-primary" style="flex:1" onclick={() => handleDrawResponse(true)}>
						Accetta
					</button>
					<button class="btn btn-google" style="flex:1" onclick={() => handleDrawResponse(false)}>
						Rifiuta
					</button>
				</div>
			</div>
		{/if}

		<!-- Lista mosse (PGN semplificato) -->
		<div class="moves-panel">
			<h3>Mosse</h3>
			<div class="pgn-text">
				{$gameState.pgn || '—'}
			</div>
		</div>

		<!-- Azioni -->
		{#if $gameState.status === 'active'}
			<div class="actions">
				<button class="btn btn-google" onclick={handleDrawOffer} style="width:100%">
					Offri patta
				</button>
				<button class="btn" style="background:var(--danger);color:#fff;width:100%" onclick={handleResign}>
					Abbandona
				</button>
			</div>
		{/if}

		<!-- Audio controls -->
		<div class="audio-row">
			<button class="mute-btn" onclick={handleToggleMute} title={muted ? 'Attiva audio' : 'Disattiva audio'}>
				{muted ? '🔇' : '🔊'}
			</button>
			<button class="theme-btn" onclick={() => cycleTheme()} title="Cambia tema sonoro">
				{themeLabel(currentTheme)}
			</button>
		</div>

		<!-- Status partita -->
		<div class="status-badge" class:active={$gameState.status === 'active'}>
			{#if $gameState.status === 'waiting'}
				⏳ In attesa...
			{:else if $gameState.status === 'active'}
				{isMyTurn ? '🟢 Tocca a te' : '⏳ Aspetta...'}
			{:else if $gameState.status === 'finished'}
				🏁 Partita terminata
			{/if}
		</div>
	</div>
</div>

<style>
	.game-layout {
		display: flex;
		gap: 2rem;
		padding: 1.5rem 2rem;
		min-height: 100vh;
		align-items: flex-start;
		justify-content: center;
	}

	.board-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.player-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.player-info {
		display: flex;
		flex-direction: column;
	}

	.player-name {
		font-weight: 600;
		font-size: 1rem;
	}

	.player-elo {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.board-container {
		position: relative;
	}

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

	.result-text {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--accent);
	}

	/* ── Panel toggle (default: nascosto, visibile solo mobile) ── */
	.panel-toggle {
		display: none;
	}

	/* ── Backdrop pannello mobile ── */
	.panel-backdrop {
		display: none;
	}

	/* ── Side column ── */
	.side-col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 240px;
		padding-top: 3rem;
	}

	/* ── Panel handle + header (nascosti su desktop) ── */
	.panel-drag-handle { display: none; }
	.panel-header      { display: none; }
	.panel-close       { display: none; }

	.moves-panel {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
		flex: 1;
	}

	.moves-panel h3 {
		margin-bottom: 0.75rem;
		color: var(--text-muted);
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.pgn-text {
		font-size: 0.85rem;
		line-height: 1.6;
		color: var(--text);
		word-break: break-all;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.draw-offer {
		background: var(--bg-card);
		border: 1px solid var(--accent);
		border-radius: 8px;
		padding: 1rem;
		font-size: 0.9rem;
	}

	.status-badge {
		text-align: center;
		padding: 0.5rem;
		border-radius: 8px;
		font-size: 0.9rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text-muted);
	}

	.status-badge.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.audio-row {
		display: flex;
		gap: 0.4rem;
	}
	.mute-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text-muted);
		font-size: 1rem;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		flex-shrink: 0;
		transition: border-color 0.15s, color 0.15s;
	}
	.mute-btn:hover { border-color: var(--accent); color: var(--text); }
	.theme-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 8px;
		color: var(--text-muted);
		font-size: 0.78rem;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		flex: 1;
		text-align: left;
		transition: border-color 0.15s, color 0.15s;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.theme-btn:hover { border-color: var(--accent); color: var(--text); }

	/* ═══════════════════════════════════════════════════════════
	   MOBILE (≤ 768px)
	   ═══════════════════════════════════════════════════════════ */
	@media (max-width: 768px) {
		.game-layout {
			flex-direction: column;
			padding: 0.5rem 0.5rem 1rem;
			gap: 0.4rem;
			align-items: center;
			min-height: 0;
		}

		.board-col {
			width: 100%;
			align-items: center;
			gap: 0.5rem;
		}

		/* Le righe player si allineano alla larghezza della board */
		.player-row {
			width: min(calc(100vw - 1rem), calc(100vh - 220px));
		}

		/* Pulsante toggle pannello — visibile su mobile */
		.panel-toggle {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.4rem;
			width: min(calc(100vw - 1rem), calc(100vh - 220px));
			padding: 0.55rem 1rem;
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: 8px;
			color: var(--text);
			font-size: 0.9rem;
			cursor: pointer;
			font-weight: 500;
			transition: border-color 0.15s;
		}
		.panel-toggle:hover { border-color: var(--accent); }

		/* Backdrop semitrasparente sotto il pannello */
		.panel-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0,0,0,0.45);
			z-index: 40;
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.25s ease;
		}
		.panel-backdrop.panel-open {
			opacity: 1;
			pointer-events: auto;
		}

		/* Side col → bottom sheet */
		.side-col {
			position: fixed;
			bottom: 0; left: 0; right: 0;
			width: 100% !important;
			max-height: 72vh;
			background: var(--bg-card);
			border-top: 2px solid var(--border);
			border-radius: 16px 16px 0 0;
			padding: 0 1rem 2rem;
			z-index: 50;
			overflow-y: auto;
			transform: translateY(100%);
			transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			gap: 0.75rem;
		}
		.side-col.panel-open {
			transform: translateY(0);
		}

		/* Handle di trascinamento visivo */
		.panel-drag-handle {
			display: block;
			width: 36px;
			height: 4px;
			background: var(--border);
			border-radius: 2px;
			margin: 0.8rem auto 0.4rem;
			flex-shrink: 0;
		}

		/* Header del pannello con titolo e tasto chiudi */
		.panel-header {
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
		.panel-header span {
			font-weight: 600;
			font-size: 0.9rem;
			color: var(--text-muted);
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}
		.panel-close {
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
		.panel-close:hover { color: var(--text); }

		/* Moves panel: altezza automatica, niente flex:1 */
		.moves-panel {
			flex: none;
			max-height: 220px;
			overflow-y: auto;
		}
	}
</style>
