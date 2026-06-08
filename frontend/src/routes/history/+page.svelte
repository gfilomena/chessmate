<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n';
	import { user, authLoading } from '$lib/stores/auth';
	import { API_URL as API } from '$lib/config';

	// ── Auth guard ────────────────────────────────────────────────────────────
	$effect(() => {
		if (!$authLoading && !$user) goto('/login');
	});

	// ── State ─────────────────────────────────────────────────────────────────
	const BOT_ID = '00000000-0000-0000-0000-000000000000';

	let loading = $state(true);
	let error   = $state('');
	let games   = $state<any[]>([]);
	let filter  = $state<'all' | 'human' | 'bot'>('all');

	// ── Load ──────────────────────────────────────────────────────────────────
	onMount(async () => {
		if (!$user) return;
		try {
			const res  = await fetch(`${API}/api/users/${$user.id}/games`, { credentials: 'include' });
			const json = await res.json();
			games = json.data ?? json ?? [];
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	});

	// ── Helpers ───────────────────────────────────────────────────────────────
	function isBot(game: any): boolean {
		return game.white_id === BOT_ID || game.black_id === BOT_ID;
	}

	const filtered = $derived(
		filter === 'all'   ? games :
		filter === 'bot'   ? games.filter(isBot) :
		                     games.filter(g => !isBot(g))
	);

	function resultForUser(game: any): 'win' | 'loss' | 'draw' {
		if (!game.result || game.result === 'draw') return 'draw';
		const iAmWhite = game.white_id === $user?.id;
		if ((game.result === 'white' && iAmWhite) || (game.result === 'black' && !iAmWhite)) return 'win';
		return 'loss';
	}

	function myColor(game: any): 'white' | 'black' {
		return game.white_id === $user?.id ? 'white' : 'black';
	}

	function opponentName(game: any): string {
		if (isBot(game)) return $t.history.bot_label;
		return myColor(game) === 'white' ? game.black_username : game.white_username;
	}

	function eloChange(game: any): string {
		if (isBot(game)) return '—';
		const delta = (game.elo_after ?? 0) - (game.elo_before ?? 0);
		if (delta === 0) return '—';
		return delta > 0 ? `+${delta}` : `${delta}`;
	}

	function eloSign(game: any): 'positive' | 'negative' | '' {
		if (isBot(game)) return '';
		const delta = (game.elo_after ?? 0) - (game.elo_before ?? 0);
		return delta > 0 ? 'positive' : delta < 0 ? 'negative' : '';
	}

	function formatTC(seconds: number): string {
		if (!seconds) return '—';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		const label = seconds <= 179 ? 'Bullet' : seconds <= 599 ? 'Blitz' : 'Rapid';
		const tc    = s > 0 ? `${m}+${s}` : `${m} min`;
		return `${tc} · ${label}`;
	}

	function formatDate(str: string | null): string {
		if (!str) return '—';
		return new Date(str).toLocaleDateString('it-IT', {
			day: '2-digit', month: 'short', year: 'numeric'
		});
	}

	function reasonLabel(reason: string | null): string {
		if (!reason) return '—';
		const r = $t.game.reasons as Record<string, string>;
		return r[reason] ?? reason;
	}

	function reviewHref(game: any): string {
		return `/analysis/${game.id}?autoReview=1`;
	}

	// Abbreviazioni risultato
	function resAbbr(res: 'win'|'loss'|'draw'): string {
		if (res === 'win')  return $t.profile.win_abbr;
		if (res === 'loss') return $t.profile.loss_abbr;
		return $t.profile.draw_abbr;
	}
</script>

<svelte:head>
	<title>{$t.history.title} — Chess</title>
</svelte:head>

<div class="history-page">

	<!-- Header -->
	<div class="page-header">
		<h1>{$t.history.title}</h1>

		<!-- Filter tabs -->
		<div class="filter-tabs" role="tablist">
			<button
				class="filter-tab"
				class:active={filter === 'all'}
				role="tab"
				aria-selected={filter === 'all'}
				onclick={() => filter = 'all'}
			>{$t.history.all} {filter === 'all' ? `(${games.length})` : ''}</button>
			<button
				class="filter-tab"
				class:active={filter === 'human'}
				role="tab"
				aria-selected={filter === 'human'}
				onclick={() => filter = 'human'}
			>{$t.history.human} {filter === 'human' ? `(${games.filter(g => !isBot(g)).length})` : ''}</button>
			<button
				class="filter-tab"
				class:active={filter === 'bot'}
				role="tab"
				aria-selected={filter === 'bot'}
				onclick={() => filter = 'bot'}
			>{$t.history.bot} {filter === 'bot' ? `(${games.filter(isBot).length})` : ''}</button>
		</div>
	</div>

	<!-- Body -->
	{#if loading}
		<p class="state-msg">{$t.history.loading}</p>
	{:else if error}
		<p class="state-msg error">{error}</p>
	{:else if filtered.length === 0}
		<p class="state-msg muted">{$t.history.no_games}</p>
	{:else}

		<!-- ── Desktop table ─────────────────────────────────────── -->
		<div class="table-wrap">
			<table class="history-table">
				<thead>
					<tr>
						<th>{$t.history.result_col}</th>
						<th>{$t.history.opponent_col}</th>
						<th>{$t.history.color_col}</th>
						<th>{$t.history.time_col}</th>
						<th>{$t.history.reason_col}</th>
						<th>{$t.history.elo_col}</th>
						<th>{$t.history.date_col}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as game}
						{@const res  = resultForUser(game)}
						{@const col  = myColor(game)}
						{@const elo  = eloChange(game)}
						{@const sign = eloSign(game)}
						<tr class="game-row" onclick={() => goto(reviewHref(game))}>
							<td>
								<span class="result-badge {res}">{resAbbr(res)}</span>
							</td>
							<td class="opponent-cell">
								<span class="opponent-icon">{isBot(game) ? '🤖' : '👤'}</span>
								<span class="opponent-name">{opponentName(game)}</span>
							</td>
							<td>
								<span class="color-chip {col}">
									{col === 'white' ? $t.history.color_white : $t.history.color_black}
								</span>
							</td>
							<td class="tc-cell">{formatTC(game.time_control)}</td>
							<td class="reason-cell">{reasonLabel(game.finish_reason)}</td>
							<td class="elo-cell {sign}">{elo}</td>
							<td class="date-cell">{formatDate(game.finished_at)}</td>
							<td class="action-cell">
								<a
									href={reviewHref(game)}
									class="review-btn"
									onclick={(e) => e.stopPropagation()}
								>{$t.history.review} →</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- ── Mobile cards ──────────────────────────────────────── -->
		<div class="cards-list">
			{#each filtered as game}
				{@const res  = resultForUser(game)}
				{@const col  = myColor(game)}
				{@const elo  = eloChange(game)}
				{@const sign = eloSign(game)}
				<a class="game-card" href={reviewHref(game)}>
					<!-- Left: result badge -->
					<span class="result-badge {res} badge-lg">{resAbbr(res)}</span>

					<!-- Center: main info -->
					<div class="card-body">
						<div class="card-row1">
							<span class="opponent-icon">{isBot(game) ? '🤖' : '👤'}</span>
							<strong class="opponent-name">{opponentName(game)}</strong>
							<span class="color-chip {col} chip-sm">
								{col === 'white' ? '⬜' : '⬛'}
							</span>
							{#if !isBot(game) && elo !== '—'}
								<span class="elo-chip {sign}">{elo}</span>
							{/if}
						</div>
						<div class="card-row2">
							<span class="reason-text">{reasonLabel(game.finish_reason)}</span>
							<span class="sep">·</span>
							<span class="tc-text">{formatTC(game.time_control)}</span>
							<span class="sep">·</span>
							<span class="date-text">{formatDate(game.finished_at)}</span>
						</div>
					</div>

					<!-- Right: arrow -->
					<span class="card-arrow">→</span>
				</a>
			{/each}
		</div>

	{/if}
</div>

<style>
	.history-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		height: 100%;
		overflow-y: auto;
		box-sizing: border-box;
	}

	/* ── Header ──────────────────────────────────────────────── */
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	/* ── Filter tabs ─────────────────────────────────────────── */
	.filter-tabs {
		display: flex;
		gap: 0.3rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.25rem;
	}

	.filter-tab {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0.4rem 0.9rem;
		border-radius: 7px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		white-space: nowrap;
	}
	.filter-tab:hover { color: var(--text); }
	.filter-tab.active {
		background: var(--accent);
		color: #000;
	}

	/* ── State messages ──────────────────────────────────────── */
	.state-msg {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}
	.state-msg.error { color: var(--danger); }

	/* ── Result badge ────────────────────────────────────────── */
	.result-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px; height: 28px;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 700;
		flex-shrink: 0;
	}
	.result-badge.win  { background: rgba(129,182,76,0.18); color: #81b64c; }
	.result-badge.loss { background: rgba(201,95,95,0.18);  color: #c95f5f; }
	.result-badge.draw { background: rgba(158,157,154,0.18);color: #9e9d9a; }

	.badge-lg {
		width: 38px; height: 38px;
		border-radius: 8px;
		font-size: 0.88rem;
	}

	/* ── Color chip ──────────────────────────────────────────── */
	.color-chip {
		font-size: 0.75rem;
		white-space: nowrap;
	}
	.chip-sm { font-size: 1rem; line-height: 1; }

	/* ── ELO chip (mobile) ───────────────────────────────────── */
	.elo-chip {
		font-size: 0.78rem;
		font-weight: 700;
	}
	.elo-chip.positive { color: #81b64c; }
	.elo-chip.negative { color: #c95f5f; }

	/* ── ELO cell (desktop) ──────────────────────────────────── */
	.elo-cell { font-size: 0.85rem; font-weight: 700; }
	.elo-cell.positive { color: #81b64c; }
	.elo-cell.negative { color: #c95f5f; }

	/* ════════════════════════════════════════════════════════════
	   DESKTOP TABLE
	   ════════════════════════════════════════════════════════════ */
	.table-wrap {
		overflow-x: auto;
		border-radius: 8px;
		border: 1px solid var(--border);
	}

	.history-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.history-table th {
		padding: 0.7rem 1rem;
		text-align: left;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		background: var(--bg-card);
	}

	.history-table td {
		padding: 0.65rem 1rem;
		vertical-align: middle;
		border-bottom: 1px solid rgba(255,255,255,0.04);
	}

	.game-row { cursor: pointer; transition: background 0.12s; }
	.game-row:hover td { background: var(--bg-card); }
	.game-row:last-child td { border-bottom: none; }

	.opponent-cell {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.opponent-icon { font-size: 1rem; flex-shrink: 0; }
	.opponent-name { font-weight: 600; }

	.tc-cell, .date-cell, .reason-cell {
		color: var(--text-muted);
		font-size: 0.82rem;
		white-space: nowrap;
	}

	.action-cell { white-space: nowrap; }
	.review-btn {
		color: var(--accent);
		font-size: 0.82rem;
		font-weight: 600;
		text-decoration: none;
		padding: 0.3rem 0.6rem;
		border-radius: 5px;
		transition: background 0.12s;
	}
	.review-btn:hover {
		background: rgba(129,182,76,0.12);
		text-decoration: none;
	}

	/* ── Mobile: hide table, show cards ─────────────────────── */
	.cards-list { display: none; }

	/* ════════════════════════════════════════════════════════════
	   MOBILE CARDS
	   ════════════════════════════════════════════════════════════ */
	@media (max-width: 768px) {
		.history-page {
			padding: 1.25rem 1rem;
		}

		.page-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
			margin-bottom: 1rem;
		}

		.page-header h1 { font-size: 1.25rem; }

		.filter-tabs { width: 100%; }
		.filter-tab  { flex: 1; text-align: center; padding: 0.45rem 0.5rem; }

		/* Show cards, hide table */
		.table-wrap  { display: none; }
		.cards-list  {
			display: flex;
			flex-direction: column;
			gap: 0.55rem;
		}

		/* Game card */
		.game-card {
			display: flex;
			align-items: center;
			gap: 0.85rem;
			padding: 0.85rem 1rem;
			background: var(--bg-card);
			border: 1px solid var(--border);
			border-radius: 10px;
			text-decoration: none;
			color: var(--text);
			transition: border-color 0.15s, background 0.12s;
		}
		.game-card:hover {
			border-color: var(--accent);
			background: color-mix(in srgb, var(--accent) 6%, var(--bg-card));
			text-decoration: none;
		}

		.card-body {
			flex: 1;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 0.3rem;
		}

		.card-row1 {
			display: flex;
			align-items: center;
			gap: 0.4rem;
			flex-wrap: wrap;
		}
		.card-row2 {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			flex-wrap: wrap;
			font-size: 0.78rem;
			color: var(--text-muted);
		}

		.card-row1 .opponent-name {
			font-size: 0.95rem;
			font-weight: 600;
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.sep { color: var(--border); }

		.reason-text, .tc-text, .date-text {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.card-arrow {
			font-size: 1rem;
			color: var(--text-muted);
			flex-shrink: 0;
		}
	}
</style>
