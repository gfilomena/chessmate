<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { Chess } from 'chess.js';
	import Board from '$lib/chess/Board.svelte';
	import ChessPageLayout from '$lib/chess/ChessPageLayout.svelte';
	import { StockfishEngine } from '$lib/chess/stockfish';
	import { eloBand, getOpeningMoves, sampleMove } from '$lib/chess/opening';
	import { user, authLoading } from '$lib/stores/auth';
	import { initSounds, playSound } from '$lib/chess/sounds';
	import SoundControl from '$lib/chess/SoundControl.svelte';
	import { computeCaptured } from '$lib/chess/captured';
	import { t } from '$lib/i18n';
	import { browser } from '$app/environment';
	import { API_URL as API } from '$lib/config';

	// ── Auth guard ────────────────────────────────────────────────────────────
	$effect(() => {
		if (!$authLoading && !$user) goto('/login');
	});

	// ── Bot roster ────────────────────────────────────────────────────────────
	// randomChance: probabilità (0-1) di giocare una mossa casuale invece di Stockfish
	// movetime: ms di pensiero (usato per livelli < 1320, senza UCI_LimitStrength)
	// useElo: se true usa UCI_LimitStrength nativo di Stockfish (solo da ~1320 in su)
	const BOTS = [
		{ id: 'principino', name: 'Principino', elo:  100, stars: 1, piece: '♙', badge: 'Apprendista', color: '#2d6f3e', quote: 'Non sa come muovere i pezzi.',                 randomChance: 0.95, movetime:  40, useElo: false },
		{ id: 'piccolo',  name: 'Piccolo',  elo:  200, stars: 1, piece: '♟', badge: 'Bambino',      color: '#3f8c4f', quote: 'Gioca a caso, a volte scopre il buono.',         randomChance: 0.90, movetime:  60, useElo: false },
		{ id: 'esordiente', name: 'Esordiente', elo:  300, stars: 1, piece: '♟', badge: 'Esordiente',  color: '#4a9e5c', quote: 'Prova a fare scacchi. Risultati variabili.',    randomChance: 0.85, movetime:  70, useElo: false },
		{ id: 'matteo',   name: 'Matteo',   elo:  400, stars: 1, piece: '♟', badge: 'Principiante', color: '#4a9e5c', quote: 'Ama il cavallo, non sa perché.',            randomChance: 0.75, movetime:  80, useElo: false },
		{ id: 'sofia',    name: 'Sofia',    elo:  650, stars: 2, piece: '♞', badge: 'Novizio',       color: '#7aaa3e', quote: 'Ha letto mezza pagina di teoria.',           randomChance: 0.50, movetime: 120, useElo: false },
		{ id: 'luca',     name: 'Luca',     elo:  900, stars: 2, piece: '♝', badge: 'Intermedio',   color: '#c9a227', quote: 'Gioca e4 perché lo fanno tutti.',             randomChance: 0.20, movetime: 200, useElo: false },
		{ id: 'giulia',   name: 'Giulia',   elo: 1150, stars: 3, piece: '♜', badge: 'Club',         color: '#d4811e', quote: 'Conosce la Siciliana a memoria.',             randomChance: 0.05, movetime: 300, useElo: false },
		{ id: 'marco',    name: 'Marco',    elo: 1400, stars: 3, piece: '♛', badge: 'Avanzato',     color: '#c95f2f', quote: 'Analizza le partite la sera.',                randomChance: 0.00, movetime: 800, useElo: true  },
		{ id: 'elena',    name: 'Elena',    elo: 1650, stars: 4, piece: '♚', badge: 'Esperto',      color: '#b84040', quote: 'Punisce ogni errore senza pietà.',            randomChance: 0.00, movetime:1000, useElo: true  },
		{ id: 'riccardo', name: 'Riccardo', elo: 1950, stars: 4, piece: '♕', badge: 'Maestro',      color: '#8040a0', quote: 'Ha vinto tornei regionali.',                  randomChance: 0.00, movetime:1200, useElo: true  },
		{ id: 'magnus',   name: 'Magnus',   elo: 2500, stars: 5, piece: '♔', badge: 'Gran Maestro', color: '#2040a0', quote: 'Pressoché imbattibile. Buona fortuna.',       randomChance: 0.00, movetime:1500, useElo: true  },
	] as const;

	// ── Setup state ───────────────────────────────────────────────────────────
	let phase = $state<'setup' | 'playing'>('setup');
	let selectedBotId = $state('marco');
	let selectedColor: 'white' | 'black' | 'random' = $state('white');
	const selectedBot = $derived(BOTS.find(b => b.id === selectedBotId) ?? BOTS[4]);

	// ── Game state ────────────────────────────────────────────────────────────
	let playerColor = $state<'white' | 'black'>('white');
	let chessGame = new Chess();
	let fen = $state(chessGame.fen());
	let lastMove: { from: string; to: string } | null = $state(null);
	let isThinking = $state(false);
	type GameResult = { outcome: 'win' | 'loss' | 'draw'; reason: string } | null;
	let result: GameResult = $state(null);
	let moveHistory: string[] = $state([]);
	let savedBotGameId = $state<string | null>(null);

	// ── Move navigation ────────────────────────────────────────────────────────
	interface HistoryEntry {
		fen: string;
		move: { from: string; to: string } | null;
		sound: import('$lib/chess/sounds').SoundName | null;
		san:   string | null;
	}

	function buildBotHistory(moves: string[]): HistoryEntry[] {
		const entries: HistoryEntry[] = [{ fen: new Chess().fen(), move: null, sound: null, san: null }];
		const replay = new Chess();
		for (const san of moves) {
			try {
				const mv = replay.move(san) as any;
				if (mv) {
					const inCheck   = replay.inCheck();
					const isCapture = mv.flags.includes('c') || mv.flags.includes('e');
					const sound = inCheck ? 'check' : isCapture ? 'capture' : 'move';
					entries.push({ fen: replay.fen(), move: { from: mv.from, to: mv.to }, sound, san: mv.san });
				}
			} catch {}
		}
		return entries;
	}

	let viewIndex = $state<number | null>(null); // null = live
	let stripEl   = $state<HTMLElement | null>(null);

	const botHistory      = $derived(buildBotHistory(moveHistory));
	const isReviewing     = $derived(viewIndex !== null);
	const atStart         = $derived(viewIndex === 0);
	const atEnd           = $derived(viewIndex === null);
	const timelinePercent = $derived(
		botHistory.length <= 1 || viewIndex === null
			? 100
			: Math.round((viewIndex / (botHistory.length - 1)) * 100)
	);

	const displayFen = $derived(
		viewIndex === null ? fen : (botHistory[viewIndex]?.fen ?? fen)
	);
	const displayLastMove = $derived(
		viewIndex === null ? lastMove : (botHistory[viewIndex]?.move ?? null)
	);
	const navLabel = $derived(
		viewIndex === null ? 'Live' : `${viewIndex} / ${botHistory.length - 1}`
	);

	function playNavSound(idx: number) {
		const s = botHistory[idx]?.sound;
		if (s) playSound(s);
	}

	function navTo(idx: number) {
		if (idx <= 0)                      { viewIndex = 0; }
		else if (idx >= botHistory.length - 1) { viewIndex = null; }
		else { viewIndex = idx; playNavSound(idx); }
	}
	function navFirst() { viewIndex = 0; }
	function navPrev() {
		const idx = viewIndex ?? botHistory.length - 1;
		if (idx > 0) { viewIndex = idx - 1; playNavSound(idx - 1); }
	}
	function navNext() {
		if (viewIndex === null) return;
		if (viewIndex < botHistory.length - 1) { viewIndex++; playNavSound(viewIndex); }
		else viewIndex = null;
	}
	function navLast() { viewIndex = null; }

	// Auto-scroll strip al chip attivo
	$effect(() => {
		const idx = viewIndex ?? botHistory.length - 1;
		if (!stripEl) return;
		(stripEl.children[idx] as HTMLElement | undefined)
			?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
	});

	// Se il bot muove mentre si è in revisione → torna a live
	let prevHistLen = 0;
	$effect(() => {
		const len = botHistory.length;
		if (len > prevHistLen && prevHistLen > 0 && isReviewing) viewIndex = null;
		prevHistLen = len;
	});
	// ──────────────────────────────────────────────────────────────────────────

	// ── Engine ────────────────────────────────────────────────────────────────
	let engine: StockfishEngine | null = null;
	let engineReady = $state(false);

	let panelOpen = $state(false);

	onMount(async () => {
		initSounds();
		engine = new StockfishEngine();
		await engine.init();
		engineReady = true;
	});

	onDestroy(() => {
		engine?.destroy();
	});

	// ── Derived ───────────────────────────────────────────────────────────────
	const currentTurn = $derived(fen.split(' ')[1] as 'w' | 'b');

	const isPlayerTurn = $derived(
		phase === 'playing' &&
		!isThinking &&
		result === null &&
		((playerColor === 'white' && currentTurn === 'w') ||
		 (playerColor === 'black' && currentTurn === 'b'))
	);

	// In modalità revisione il board non accetta mosse
	const canMove = $derived(!isReviewing && isPlayerTurn);

	// ── Pezzi catturati ─────────────────────────────────────────────
	const captured    = $derived(computeCaptured(displayFen));
	const myCaptured  = $derived(playerColor === 'white' ? captured.byWhite : captured.byBlack);
	const botCaptured = $derived(playerColor === 'white' ? captured.byBlack : captured.byWhite);
	const myAdv       = $derived(playerColor === 'white' ? captured.advantage : -captured.advantage);
	const botAdv      = $derived(-myAdv);

	const movePairs = $derived(buildMovePairs(moveHistory));

	const resultDisplayText = $derived((() => {
		if (!result) return '';
		const r = result as NonNullable<GameResult>;
		const outcome = r.outcome === 'win' ? $t.bot.you_win :
		                r.outcome === 'loss' ? $t.bot.bot_wins :
		                $t.bot.draw;
		const reason = r.reason ? (($t.game.reasons as any)[r.reason] ?? '') : '';
		return reason ? `${outcome} — ${reason}` : outcome;
	})());

	function buildMovePairs(history: string[]) {
		const pairs: Array<{ n: number; w: string; b: string }> = [];
		for (let i = 0; i < history.length; i += 2) {
			pairs.push({ n: i / 2 + 1, w: history[i] ?? '', b: history[i + 1] ?? '' });
		}
		return pairs;
	}

	// ── Game functions ────────────────────────────────────────────────────────

	function startGame() {
		if (!engineReady) return;

		const resolved: 'white' | 'black' =
			selectedColor === 'random'
				? (Math.random() < 0.5 ? 'white' : 'black')
				: selectedColor;

		playerColor = resolved;
		chessGame = new Chess();
		fen = chessGame.fen();
		lastMove = null;
		result = null;
		moveHistory = [];
		isThinking = false;
		phase = 'playing';
		playSound('game_start');

		if (playerColor === 'black') {
			triggerBotMove();
		}
	}

	function handlePlayerMove(from: string, to: string, promotion?: string) {
		if (!isPlayerTurn) return;

		try {
			const moveObj: { from: string; to: string; promotion?: string } = { from, to };
			if (promotion) moveObj.promotion = promotion;
			const move = chessGame.move(moveObj);
			if (!move) return;

			fen = chessGame.fen();
			lastMove = { from, to };
			moveHistory = [...moveHistory, move.san];

			// Suono mossa: cattura, scacco o mossa normale
			if (chessGame.isCheckmate())        playSound('check');
			else if (chessGame.inCheck())       playSound('check');
			else if (move.flags.includes('c') || move.flags.includes('e')) playSound('capture');
			else                                playSound('move');

			if (checkGameOver()) return;
			triggerBotMove();
		} catch {
			// invalid move – ignore
		}
	}

	async function triggerBotMove() {
		if (!engine || !engineReady || result !== null) return;
		isThinking = true;

		try {
			const curFen = chessGame.fen();
			const ply = chessGame.history().length;
			let uciMove = '';

			// ── Livello 1: Opening DB (prime 20 mosse) ──────────────────────────
			// Dati reali di giocatori umani a quella fascia ELO.
			// Se il DB non è disponibile → passa subito al livello 2.
			if (ply < 40) {
				const band  = eloBand(selectedBot.elo);
				const moves = await getOpeningMoves(curFen, band);
				if (moves.length > 0) {
					uciMove = sampleMove(moves) ?? '';
				}
			}

			// ── Livello 2: Mossa casuale (bot deboli) ────────────────────────────
			// Per i primi 4 bot (< 1300 ELO) c'è una probabilità di giocare random.
			// Simula errori e dimenticanze tipici dei principianti.
			if (!uciMove && selectedBot.randomChance > 0 && Math.random() < selectedBot.randomChance) {
				const legal = chessGame.moves({ verbose: true });
				if (legal.length) {
					const pick = legal[Math.floor(Math.random() * legal.length)];
					uciMove = pick.from + pick.to + (pick.promotion ?? '');
				}
			}

			// ── Livello 3: Stockfish (fallback) ─────────────────────────────────
			// movetime basso per bot deboli (no UCI_LimitStrength sotto 1320),
			// UCI_LimitStrength nativo per bot forti.
			if (!uciMove) {
				uciMove = await engine.getBotMove(
					curFen,
					selectedBot.elo,
					selectedBot.movetime,
					selectedBot.useElo
				);
			}

			if (!uciMove) { isThinking = false; return; }

			const from  = uciMove.slice(0, 2);
			const to    = uciMove.slice(2, 4);
			const promo = uciMove.length >= 5 ? uciMove[4] : undefined;

			await sleep(350);

			const moveObj: { from: string; to: string; promotion?: string } = { from, to };
			if (promo) moveObj.promotion = promo;
			const move = chessGame.move(moveObj);

			if (move) {
				fen = chessGame.fen();
				lastMove = { from, to };
				moveHistory = [...moveHistory, move.san];

				if (chessGame.isCheckmate())        playSound('check');
				else if (chessGame.inCheck())       playSound('check');
				else if (move.flags.includes('c') || move.flags.includes('e')) playSound('capture');
				else                                playSound('move');

				checkGameOver();
			}
		} catch {
			// engine error – ignore
		}

		isThinking = false;
	}

	async function saveBotGame(gameResult: NonNullable<GameResult>) {
		// Salva sempre il PGN in sessionStorage come fallback
		if (browser) sessionStorage.setItem('botGamePgn', chessGame.pgn());

		// Prova a salvare nel database per persistenza nel profilo
		if (!$user) return;
		try {
			const res = await fetch(`${API}/api/bot-games`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pgn:          chessGame.pgn(),
					outcome:      gameResult.outcome,
					finish_reason: gameResult.reason,
					player_color: playerColor,
				}),
			});
			if (res.ok) {
				const json = await res.json();
				savedBotGameId = json.data?.game_id ?? null;
			}
		} catch {
			// silenzio — il fallback sessionStorage è già pronto
		}
	}

	function checkGameOver(): boolean {
		if (!chessGame.isGameOver()) return false;

		playSound('game_over');

		let gameResult: NonNullable<GameResult>;
		if (chessGame.isCheckmate()) {
			const loserColor = chessGame.turn() === 'w' ? 'white' : 'black';
			gameResult = { outcome: loserColor === playerColor ? 'loss' : 'win', reason: 'checkmate' };
		} else if (chessGame.isStalemate()) {
			gameResult = { outcome: 'draw', reason: 'stalemate' };
		} else if (chessGame.isThreefoldRepetition()) {
			gameResult = { outcome: 'draw', reason: 'threefold' };
		} else if (chessGame.isInsufficientMaterial()) {
			gameResult = { outcome: 'draw', reason: '' };
		} else {
			gameResult = { outcome: 'draw', reason: '' };
		}
		result = gameResult;
		saveBotGame(gameResult);
		return true;
	}

	function resign() {
		const gameResult: NonNullable<GameResult> = { outcome: 'loss', reason: 'resigned' };
		result = gameResult;
		isThinking = false;
		saveBotGame(gameResult);
	}

	function backToSetup() {
		result = null;
		savedBotGameId = null;
		phase = 'setup';
		viewIndex = null;
		// Reset board so it doesn't flicker
		chessGame = new Chess();
		fen = chessGame.fen();
		lastMove = null;
		moveHistory = [];
	}

	function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
</script>

<svelte:head>
	<title>{$t.bot.page_title} — Chess</title>
</svelte:head>

<!-- ══════════════════════════════════════════════════════════════════════════
     SETUP PHASE
══════════════════════════════════════════════════════════════════════════ -->
{#if phase === 'setup'}
	<div class="setup-page">
		<a href="/play" class="back-link">{$t.bot.back_to_menu}</a>

		<div class="setup-card">
			<div class="setup-header">
				<span class="setup-icon">🤖</span>
				<h1>{$t.bot.choose_opponent}</h1>
				<p class="setup-sub">{$t.bot.engine_desc}</p>
			</div>

			<!-- Bot selection -->
			<section class="setup-section bots-section">
				<h2>{$t.bot.opponent_label}</h2>
				<div class="bots-grid">
					{#each BOTS as bot}
						<button
							class="bot-card"
							class:active={selectedBotId === bot.id}
							onclick={() => selectedBotId = bot.id}
							style="--bot-color:{bot.color}"
						>
							<span class="bot-piece">{bot.piece}</span>
							<span class="bot-name">{bot.name}</span>
							<span class="bot-stars">{'★'.repeat(bot.stars)}{'☆'.repeat(5 - bot.stars)}</span>
							<span class="bot-badge">{bot.badge}</span>
							<span class="bot-quote">"{bot.quote}"</span>
							<span class="bot-elo">ELO {bot.elo}</span>
						</button>
					{/each}
				</div>
			</section>

			<!-- Color selection -->
			<section class="setup-section">
				<h2>{$t.bot.choose_color}</h2>
				<div class="color-row">
					<button class="color-btn" class:active={selectedColor === 'white'} onclick={() => selectedColor = 'white'}>
						<span class="color-piece">♔</span>{$t.bot.white}
					</button>
					<button class="color-btn" class:active={selectedColor === 'black'} onclick={() => selectedColor = 'black'}>
						<span class="color-piece dark">♚</span>{$t.bot.black}
					</button>
					<button class="color-btn" class:active={selectedColor === 'random'} onclick={() => selectedColor = 'random'}>
						<span class="color-piece">🎲</span>{$t.bot.random}
					</button>
				</div>
			</section>

			<!-- Start button -->
			<button class="btn btn-primary start-btn" onclick={startGame} disabled={!engineReady}>
				{#if engineReady}
					{$t.bot.challenge(selectedBot.name)}
				{:else}
					{$t.bot.engine_loading}
				{/if}
			</button>
		</div>
	</div>

<!-- ══════════════════════════════════════════════════════════════════════════
     PLAYING PHASE
══════════════════════════════════════════════════════════════════════════ -->
{:else}
	<ChessPageLayout
		bind:panelOpen
		panelTitle={$t.common.moves_actions_title}
		panelToggleLabel={$t.common.moves_actions}
	>

		{#snippet topPlayer()}
			<div class="player-row">
				<div class="player-info">
					<span class="player-name">{selectedBot.piece} {selectedBot.name}</span>
					<span class="player-elo">
						<span class="inline-badge" style="background:{selectedBot.color}">{selectedBot.badge}</span>
						· ELO {selectedBot.elo}
					</span>
					<div class="captured-row">
						{#each botCaptured as p}<span class="cap-piece">{p}</span>{/each}
						{#if botAdv > 0}<span class="cap-adv">+{botAdv}</span>{/if}
					</div>
				</div>
				{#if isThinking}
					<div class="thinking-badge">
						<div class="thinking-dot"></div>
						{$t.bot.thinking}
					</div>
				{/if}
			</div>
			<!-- Striscia mosse (mobile) -->
			<div class="mobile-moves-strip" bind:this={stripEl}>
				{#each botHistory as entry, i}
					{@const isActive = (viewIndex ?? botHistory.length - 1) === i}
					<button class="move-chip" class:active={isActive} class:start-chip={i === 0} onclick={() => navTo(i)}>
						{#if i === 0}◆{:else if i % 2 === 1}{Math.ceil(i / 2)}.{entry.san}{:else}{entry.san}{/if}
					</button>
				{/each}
			</div>
		{/snippet}

		{#snippet board()}
			{#if result !== null && !isReviewing}
				<div class="overlay finished">
					<p class="result-text">{resultDisplayText}</p>
					<div class="overlay-btns">
						<button class="btn btn-primary" onclick={backToSetup}>{$t.bot.new_game}</button>
						<a href="/analysis/{savedBotGameId ?? 'bot'}?autoReview=1" class="btn btn-google">{$t.game.review}</a>
					</div>
				</div>
			{/if}
			<Board fen={displayFen} {playerColor} isMyTurn={canMove} lastMove={displayLastMove} onMove={handlePlayerMove} />
		{/snippet}

		{#snippet bottomPlayer()}
			<!-- Nav timeline (mobile) -->
			<div class="mobile-nav-bar">
				<button class="nav-btn" onclick={navFirst} disabled={atStart}>⏮</button>
				<button class="nav-btn" onclick={navPrev}  disabled={atStart}>◀</button>
				<div class="nav-timeline">
					<div class="timeline-track">
						<div class="timeline-fill" style="width:{timelinePercent}%">
							<span class="timeline-thumb"></span>
						</div>
					</div>
					<span class="timeline-label" class:live={!isReviewing}>{navLabel}</span>
				</div>
				<button class="nav-btn" onclick={navNext} disabled={atEnd}>▶</button>
				<button class="nav-btn" onclick={navLast} disabled={atEnd}>⏭</button>
			</div>
			<div class="player-row">
				<div class="player-info">
					<span class="player-name">👤 {$user?.username ?? 'Tu'}</span>
					<span class="player-elo">ELO {$user?.elo_rapid ?? '—'}</span>
					<div class="captured-row">
						{#each myCaptured as p}<span class="cap-piece">{p}</span>{/each}
						{#if myAdv > 0}<span class="cap-adv">+{myAdv}</span>{/if}
					</div>
				</div>
			</div>
		{/snippet}

		{#snippet panel()}
			<div class="moves-panel">
				<h3>{$t.common.moves}</h3>
				{#if movePairs.length === 0}
					<p class="no-moves">—</p>
				{:else}
					<div class="moves-list">
						{#each movePairs as pair (pair.n)}
							<div class="move-row">
								<span class="move-num">{pair.n}.</span>
								<span class="move-san">{pair.w}</span>
								{#if pair.b}<span class="move-san">{pair.b}</span>{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			{#if result === null}
				<div class="actions">
					<button class="btn" style="background:var(--danger);color:#fff;width:100%" onclick={resign} disabled={isThinking}>
						{$t.bot.resign}
					</button>
				</div>
			{/if}

			<div class="status-badge" class:active={isPlayerTurn} class:thinking={isThinking}>
				{#if result !== null}{$t.bot.status_finished}
				{:else if isThinking}{$t.bot.status_thinking}
				{:else if isPlayerTurn}{$t.bot.status_your_turn}
				{:else}{$t.bot.status_wait}
				{/if}
			</div>

			<div class="nav-row" class:reviewing={isReviewing}>
				<button class="nav-btn" onclick={navFirst} disabled={atStart}>⏮</button>
				<button class="nav-btn" onclick={navPrev}  disabled={atStart}>◀</button>
				<span class="nav-label" class:live={!isReviewing}>{navLabel}</span>
				<button class="nav-btn" onclick={navNext}  disabled={atEnd}>▶</button>
				<button class="nav-btn" onclick={navLast}  disabled={atEnd}>⏭</button>
			</div>

			<button class="btn btn-google" style="width:100%;font-size:0.85rem" onclick={backToSetup}>
				{$t.bot.back}
			</button>

			<SoundControl />
		{/snippet}

	</ChessPageLayout>
{/if}

<style>
/* ══════════════════════════════════════════════════════
   SETUP
══════════════════════════════════════════════════════ */
/* ── Setup page: occupa tutta l'altezza disponibile ── */
.setup-page {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	min-height: 100%;
	height: 100dvh;
	overflow: hidden;
	padding: clamp(0.4rem, 1dvh, 1rem) 1rem;
	gap: clamp(0.25rem, 0.6dvh, 0.75rem);
	box-sizing: border-box;
}

.back-link {
	align-self: flex-start;
	color: var(--text-muted);
	font-size: 0.9rem;
	text-decoration: none;
	transition: color 0.15s;
	flex-shrink: 0;
}
.back-link:hover { color: var(--text); }

/* Card occupa tutto lo spazio verticale rimanente */
.setup-card {
	background: var(--bg-card);
	border: 1px solid var(--border);
	border-radius: 16px;
	padding: clamp(0.75rem, 1.5dvh, 2rem) clamp(1rem, 2vw, 2rem);
	width: 100%;
	max-width: 600px;
	display: flex;
	flex-direction: column;
	gap: clamp(0.5rem, 1dvh, 1.5rem);
	flex: 1;               /* cresce per riempire l'altezza */
	min-height: 0;         /* permette shrink */
	overflow-y: auto;
	scrollbar-width: none;
}
.setup-card::-webkit-scrollbar { display: none; }

/* Sezione bot prende tutto lo spazio extra disponibile */
.setup-section.bots-section {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}
.setup-section.bots-section .bots-grid {
	flex: 1;
	min-height: 0;
}

.setup-header {
	text-align: center;
	flex-shrink: 0;
}
.setup-icon {
	font-size: clamp(1.4rem, 2.5dvh, 2.5rem);
	display: block;
	margin-bottom: 0.2rem;
}
.setup-header h1 {
	font-size: clamp(1.1rem, 2dvh, 1.6rem);
	margin-bottom: 0.15rem;
}
.setup-sub {
	color: var(--text-muted);
	font-size: clamp(0.7rem, 1.2dvh, 0.9rem);
}

.setup-section {
	flex-shrink: 0;
}
.setup-section h2 {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.07em;
	color: var(--text-muted);
	font-weight: 600;
	margin-bottom: clamp(0.3rem, 0.6dvh, 0.6rem);
}

/* Color buttons */
.color-row {
	display: flex;
	gap: 0.6rem;
}
.color-btn {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25rem;
	padding: clamp(0.35rem, 0.8dvh, 0.75rem) 0.5rem;
	background: var(--bg);
	border: 2px solid var(--border);
	border-radius: 10px;
	cursor: pointer;
	color: var(--text);
	font-size: 0.85rem;
	font-weight: 500;
	transition: border-color 0.15s, background 0.15s;
}
.color-btn:hover { border-color: var(--accent); }
.color-btn.active {
	border-color: var(--accent);
	background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.color-piece {
	font-size: clamp(1.2rem, 2dvh, 1.7rem);
	line-height: 1;
	filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}
.color-piece.dark { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7)); }

/* Bot grid — riempie lo spazio disponibile in altezza */
.bots-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	grid-auto-rows: 1fr;   /* righe uguali, si espandono */
	gap: clamp(0.25rem, 0.6dvh, 0.5rem);
	height: 100%;
}
.bot-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: clamp(0.06rem, 0.18dvh, 0.2rem);
	padding: clamp(0.25rem, 0.7dvh, 0.6rem) 0.3rem;
	background: var(--bg);
	border: 2px solid var(--border);
	border-radius: 10px;
	cursor: pointer;
	text-align: center;
	transition: border-color 0.15s, background 0.15s, transform 0.1s;
	min-height: 0;
}
.bot-card:hover {
	border-color: var(--bot-color, var(--accent));
	transform: translateY(-1px);
}
.bot-card.active {
	border-color: var(--bot-color, var(--accent));
	background: color-mix(in srgb, var(--bot-color, var(--accent)) 10%, transparent);
}
.bot-piece {
	font-size: clamp(1rem, 1.8dvh, 1.6rem);
	line-height: 1;
	color: var(--bot-color, var(--accent));
	filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4));
}
.bot-name {
	font-size: clamp(0.6rem, 1dvh, 0.82rem);
	font-weight: 700;
	color: var(--text);
}
.bot-stars {
	font-size: clamp(0.42rem, 0.7dvh, 0.58rem);
	color: var(--bot-color, var(--accent));
	letter-spacing: 1px;
}
.bot-badge {
	font-size: clamp(0.38rem, 0.6dvh, 0.52rem);
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	padding: 0.1rem 0.35rem;
	border-radius: 20px;
	background: var(--bot-color, var(--accent));
	color: #fff;
	white-space: nowrap;
}
.bot-quote {
	font-size: clamp(0.42rem, 0.65dvh, 0.55rem);
	color: var(--text-muted);
	font-style: italic;
	line-height: 1.3;
	display: none;
}
.bot-card.active .bot-quote { display: block; }
.bot-elo {
	font-size: clamp(0.42rem, 0.65dvh, 0.58rem);
	color: var(--text-muted);
}
/* Badge inline nella riga giocatore */
.inline-badge {
	display: inline-block;
	font-size: 0.65rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	padding: 0.1rem 0.4rem;
	border-radius: 20px;
	color: #fff;
	vertical-align: middle;
}

.start-btn {
	width: 100%;
	padding: clamp(0.6rem, 1.3dvh, 1rem);
	font-size: clamp(0.9rem, 1.5dvh, 1.05rem);
}
.start-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

/* ══════════════════════════════════════════════════════
   GAME LAYOUT — ora gestito da ChessPageLayout
══════════════════════════════════════════════════════ */

/* ── Player rows ── */
.player-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 1rem;
	min-height: 2.5rem;
}
.player-info { display: flex; flex-direction: column; }
.player-name { font-weight: 600; font-size: 1rem; }
.player-elo  { font-size: 0.8rem; color: var(--text-muted); }
.captured-row {
	display: flex; flex-wrap: wrap; align-items: center;
	gap: 0.04rem; margin-top: 0.12rem; min-height: 1.3rem;
}
.cap-piece { font-size: 1.25rem; line-height: 1; opacity: 0.85; }
.cap-adv   { font-size: 0.85rem; font-weight: 700; color: var(--accent); margin-left: 0.3rem; }

.thinking-badge { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); }
.thinking-dot {
	width: 8px; height: 8px; border-radius: 50%;
	background: var(--accent); animation: blink 0.8s ease infinite alternate;
}
@keyframes blink { to { opacity: 0.2; } }

/* ── Overlay ── */
.overlay {
	position: absolute; inset: 0;
	background: rgba(0,0,0,0.65);
	display: flex; flex-direction: column; align-items: center; justify-content: center;
	z-index: 5; border-radius: 4px; font-size: 1.2rem;
}
.result-text { font-size: 1.6rem; font-weight: 700; color: var(--accent); text-align: center; padding: 0 1rem; }
.overlay-btns { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 1.2rem; min-width: 180px; }
.overlay-btns .btn, .overlay-btns button { text-align: center; width: 100%; }

/* ── Panel content ── */
.moves-panel {
	background: var(--bg-card); border: 1px solid var(--border);
	border-radius: 8px; padding: 1rem; flex: 1; min-height: 0; overflow-y: auto;
}
.moves-panel h3 { margin-bottom: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
.no-moves { color: var(--text-muted); font-size: 0.9rem; }
.moves-list { display: flex; flex-direction: column; gap: 0.2rem; }
.move-row { display: flex; gap: 0.5rem; font-size: 0.85rem; line-height: 1.6; }
.move-num { color: var(--text-muted); min-width: 1.6rem; }
.move-san { font-family: monospace; min-width: 4rem; }
.actions { display: flex; flex-direction: column; gap: 0.5rem; }
.status-badge {
	text-align: center; padding: 0.5rem; border-radius: 8px; font-size: 0.9rem;
	background: var(--bg-card); border: 1px solid var(--border); color: var(--text-muted);
}
.status-badge.active  { border-color: var(--accent); color: var(--accent); }
.status-badge.thinking { border-color: #e6a817; color: #e6a817; }
.nav-row {
	display: flex; align-items: center; gap: 0.25rem;
	background: var(--bg-card); border: 1px solid var(--border);
	border-radius: 8px; padding: 0.3rem 0.4rem; transition: border-color 0.2s;
}
.nav-row.reviewing { border-color: var(--accent); }
.nav-btn {
	background: none; border: none; color: var(--text-muted); font-size: 0.78rem;
	padding: 0.3rem 0.45rem; cursor: pointer; border-radius: 5px;
	transition: background 0.12s, color 0.12s; line-height: 1; flex-shrink: 0;
}
.nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); color: var(--text); }
.nav-btn:disabled { opacity: 0.3; cursor: default; }
.nav-label { flex: 1; text-align: center; font-size: 0.72rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.nav-label.live { color: #e05050; }

/* ── Mobile moves strip & nav bar (nascosti su desktop) ── */
.mobile-moves-strip { display: none; }
.mobile-nav-bar     { display: none; }

/* ══════════════════════════════════════════════════════
   MOBILE (≤ 768px)
══════════════════════════════════════════════════════ */
/* ── Tablet / mobile largo: 2 colonne bot ── */
@media (max-width: 768px) {
	.setup-card {
		padding: 0.75rem 1rem;
		max-width: 100%;
		border-radius: 12px;
	}
	.setup-page {
		padding: 0.5rem 0.75rem;
	}
	.bots-grid {
		grid-template-columns: repeat(2, 1fr);
	}
	.bot-card.active .bot-quote { display: block; }
}

/* ── Mobile stretto (<480px): layout a colonna singola ── */
@media (max-width: 480px) {
	.setup-page {
		padding: 0.4rem 0.5rem;
		justify-content: flex-start;
	}
	.setup-card {
		padding: 0.6rem 0.75rem;
		gap: 0.5rem;
		border-radius: 10px;
		/* Su mobile stretto: card + grid scrollabile verticalmente */
		flex: 1;
		overflow-y: auto;
	}
	.setup-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-align: left;
	}
	.setup-icon {
		font-size: 1.5rem;
		margin-bottom: 0;
		flex-shrink: 0;
	}
	.setup-header h1 { font-size: 1rem; margin-bottom: 0; }
	.setup-sub { display: none; } /* nasconde subtitle su schermi strettissimi */

	/* Bot grid su mobile stretto: lista a colonna singola */
	.bots-grid {
		grid-template-columns: 1fr;
		grid-auto-rows: auto;
		height: auto;
	}
	/* Card bot orizzontale su mobile stretto */
	.bot-card {
		flex-direction: row;
		justify-content: flex-start;
		text-align: left;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
	}
	.bot-piece { font-size: 1.4rem; flex-shrink: 0; }
	.bot-name  { font-size: 0.85rem; }
	.bot-stars { font-size: 0.55rem; }
	.bot-badge { font-size: 0.5rem; }
	.bot-elo   { font-size: 0.55rem; margin-left: auto; }
	.bot-quote { display: none !important; } /* sempre nascosta su mobile stretto */

	/* Colore e selezione rimangono su 3 colonne */
	.color-row { gap: 0.4rem; }
	.color-btn { padding: 0.4rem 0.3rem; font-size: 0.8rem; }

	/* ── Mobile game components ── */
	.mobile-moves-strip {
		display: flex; overflow-x: auto; overflow-y: hidden;
		gap: 0.2rem; padding: 0.3rem 0.4rem;
		background: var(--bg-card); border: 1px solid var(--border);
		border-radius: 8px; scrollbar-width: none;
		width: min(calc(100vw - 1rem), calc(100dvh - 185px));
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
		width: min(calc(100vw - 1rem), calc(100dvh - 185px));
		background: var(--bg-card); border: 1px solid var(--border);
		border-radius: 8px; padding: 0.4rem 0.5rem; flex-shrink: 0;
	}
	.nav-timeline { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
	.timeline-track { position: relative; height: 5px; background: var(--border); border-radius: 3px; }
	.timeline-fill {
		position: relative; height: 100%; background: var(--accent);
		border-radius: 3px; transition: width 0.15s ease; min-width: 6px;
	}
	.timeline-thumb {
		position: absolute; right: 0; top: 50%;
		transform: translate(50%, -50%); width: 11px; height: 11px;
		background: var(--accent); border-radius: 50%;
		border: 2px solid var(--bg-card); box-shadow: 0 0 0 1px var(--accent);
	}
	.timeline-label { text-align: center; font-size: 0.62rem; font-weight: 600; color: var(--text-muted); }
	.timeline-label.live { color: #e05050; }

	:global(.cpl-panel) .nav-row { display: none; }
	.moves-panel { flex: none; max-height: 200px; }
}
</style>
