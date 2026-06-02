<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { user, authLoading, loadUser, logout } from '$lib/stores/auth';
	import {
		startHeartbeat, stopHeartbeat,
		startInviteSSE, stopInviteSSE
	} from '$lib/stores/invitations';
	import InviteToast from '$lib/components/InviteToast.svelte';
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import { t, lang, setLang, LANGS } from '$lib/i18n';

	let { children } = $props();

	let sidebarOpen      = $state(false);
	let userMenuOpen     = $state(false);
	let sidebarCollapsed = $state(false);

	// Deploy badge (solo admin) — valori iniettati da Vite a build-time (vite.config.ts define)
	const deployVersion = __GIT_HASH__;
	const deployDate    = __GIT_DATE__;

	// Route che richiedono autenticazione
	const PROTECTED_PREFIXES = ['/play', '/learn', '/game', '/analysis', '/leaderboard', '/profile', '/admin', '/settings'];
	const PUBLIC_PATHS = ['/', '/login', '/register', '/about', '/privacy', '/verify-email'];

	function isProtected(path: string) {
		return PROTECTED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
	}

	// Redirect a /login se non autenticato su route protetta
	$effect(() => {
		if ($authLoading) return;
		if (!$user && isProtected($page.url.pathname)) {
			goto(`/login?redirect=${encodeURIComponent($page.url.pathname)}`);
		}
	});

	// Sidebar visibile solo quando l'utente è autenticato
	const showSidebar = $derived(!!$user);

	onMount(() => loadUser());
	onDestroy(() => { stopHeartbeat(); stopInviteSSE(); });

	$effect(() => {
		if ($user) { startHeartbeat(); startInviteSSE(); }
		else        { stopHeartbeat(); stopInviteSSE(); }
	});

	// Chiudi sidebar e menu utente ad ogni navigazione
	const currentPath = $derived($page.url.pathname);
	$effect(() => {
		currentPath;
		sidebarOpen  = false;
		userMenuOpen = false;
	});

	async function handleLogout() {
		stopHeartbeat();
		stopInviteSSE();
		await logout();
		window.location.href = '/';
	}

	function isActive(path: string) {
		return currentPath === path || currentPath.startsWith(path + '/');
	}

	const initial = $derived($user?.username?.[0]?.toUpperCase() ?? '?');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Chess</title>
	<meta name="description" content="Scacchi online gratuiti con matchmaking ELO, bot Stockfish e analisi partite. Rapid, Blitz, Bullet — nessun abbonamento." />
</svelte:head>

<!-- ── Mobile top bar (solo < 768px) ───────────────────────── -->
<header class="mobile-header">
	{#if showSidebar}
		<button
			class="mobile-hamburger"
			onclick={() => sidebarOpen = !sidebarOpen}
			aria-label="Menu"
		>
			{sidebarOpen ? '✕' : '☰'}
		</button>
	{:else}
		<!-- Placeholder per mantenere il logo centrato -->
		<div class="mobile-hamburger-placeholder"></div>
	{/if}

	<img src={favicon} alt="" class="mobile-logo-icon" aria-hidden="true" />
	<span class="mobile-logo-text">Chess</span>

	{#if $user}
		<div class="user-chip-wrap">
			<button
				class="mobile-user-chip"
				onclick={() => userMenuOpen = !userMenuOpen}
				aria-label="Menu utente"
			>{initial}</button>
			{#if userMenuOpen}
				<div class="user-menu-backdrop" onclick={() => userMenuOpen = false} aria-hidden="true"></div>
				<div class="user-dropdown">
					<a href="/profile/{$user.id}" class="dropdown-item" onclick={() => userMenuOpen = false}>
						👤 {$t.user.profile}
					</a>
					<button class="dropdown-item dropdown-logout" onclick={handleLogout}>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> {$t.user.logout}
					</button>
				</div>
			{/if}
		</div>
	{:else}
		<div class="mobile-hamburger-placeholder"></div>
	{/if}
</header>

<!-- ── Backdrop sidebar (mobile) ───────────────────────────── -->
{#if showSidebar}
	<div
		class="sidebar-backdrop"
		class:sidebar-open={sidebarOpen}
		onclick={() => sidebarOpen = false}
		aria-hidden="true"
	></div>
{/if}

<div class="app-shell" class:no-sidebar={!showSidebar} class:sidebar-collapsed={sidebarCollapsed}>

	<!-- ── Left sidebar (solo utenti loggati) ───────────────── -->
	{#if showSidebar}
		<aside class="sidebar" class:sidebar-open={sidebarOpen} class:collapsed={sidebarCollapsed}>

			<a href="/" class="sidebar-logo" onclick={() => sidebarOpen = false}>
				<img src={favicon} alt="" class="sidebar-logo-img" aria-hidden="true" />
				<span class="sidebar-logo-text">Chess</span>
			</a>

			<!-- User row — sopra la navigazione -->
			<div class="user-row">
				<a href="/profile/{$user!.id}" class="user-avatar-link" onclick={() => sidebarOpen = false}>
					<div class="user-avatar">{initial}</div>
				</a>
				<a href="/profile/{$user!.id}" class="user-info" onclick={() => sidebarOpen = false}>
					<div class="user-name">{$user!.username}</div>
					<div class="user-elo">{$user!.elo_rapid} ELO</div>
				</a>
				<button class="logout-btn" onclick={handleLogout} title={$t.user.logout}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
			</div>

			<nav class="sidebar-nav">
				<a href="/play" class="nav-item" class:active={isActive('/play')} onclick={() => sidebarOpen = false}>
					<span class="nav-icon">🎮</span>
					<span>{$t.nav.play}</span>
				</a>
				<a href="/learn" class="nav-item" class:active={isActive('/learn')} onclick={() => sidebarOpen = false}>
					<span class="nav-icon">📖</span>
					<span>{$t.nav.learn}</span>
				</a>
				<a href="/leaderboard" class="nav-item" class:active={isActive('/leaderboard')} onclick={() => sidebarOpen = false}>
					<span class="nav-icon">🏆</span>
					<span>{$t.nav.leaderboard}</span>
				</a>
				<a href="/settings" class="nav-item" class:active={isActive('/settings')} onclick={() => sidebarOpen = false}>
					<span class="nav-icon">🎨</span>
					<span>{$t.nav.settings}</span>
				</a>
				{#if $user?.is_admin}
					<div class="nav-divider"></div>
					<a href="/admin" class="nav-item nav-item-admin" class:active={isActive('/admin')} onclick={() => sidebarOpen = false}>
						<span class="nav-icon">⚙️</span>
						<span>Admin</span>
					</a>
				{/if}
			</nav>

			<button
				class="sidebar-toggle"
				onclick={() => sidebarCollapsed = !sidebarCollapsed}
				title={sidebarCollapsed ? $t.sidebar.expand : $t.sidebar.collapse}
			>
				<span class="sidebar-toggle-label">{sidebarCollapsed ? '' : $t.sidebar.collapse}</span>
				{sidebarCollapsed ? '▶' : '◀'}
			</button>
		</aside>
	{/if}

	<!-- ── Main content ──────────────────────────────────────── -->
	<main class="main-content">
		{#if $authLoading}
			<!-- Auth in corso: non mostrare nulla (evita flash di contenuto protetto) -->
			<div class="auth-gate-spinner">
				<div class="auth-gate-dot"></div>
			</div>
		{:else if !$user && isProtected($page.url.pathname)}
			<!-- Non autenticato su route protetta: vuoto (il $effect farà redirect) -->
		{:else}
			{@render children()}
		{/if}
	</main>

</div>

<!-- Toast inviti — visibile in ogni pagina -->
<InviteToast />

<!-- Cookie consent banner (GDPR) -->
<CookieBanner />

<!-- Deploy badge — solo admin -->
{#if $user?.is_admin}
<div class="deploy-badge" title="Versione deploy in produzione">
	🚀 {deployDate} · <span class="deploy-ver">{deployVersion}</span>
</div>
{/if}

<style>
	/* ── Admin nav item ── */
	:global(.nav-item-admin) {
		color: #c8a84b;
	}
	:global(.nav-item-admin:hover) {
		color: #e0c070;
	}
	:global(.nav-item-admin.active) {
		background: rgba(200, 168, 75, 0.12);
		color: #c8a84b;
	}

	/* ── Auth gate spinner ── */
	.auth-gate-spinner {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.auth-gate-dot {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: auth-spin 0.7s linear infinite;
	}
	@keyframes auth-spin { to { transform: rotate(360deg); } }

	/* ── Deploy badge (solo admin) ── */
	.deploy-badge {
		position: fixed;
		bottom: 0.5rem;
		right: 0.6rem;
		font-size: 0.62rem;
		color: var(--text-muted);
		opacity: 0.45;
		pointer-events: none;
		z-index: 9999;
		white-space: nowrap;
		font-family: monospace;
		transition: opacity 0.2s;
	}
	.deploy-badge:hover { opacity: 0.9; pointer-events: auto; }
	.deploy-ver { opacity: 0.7; }

	/* ── Mobile hamburger placeholder (centra il logo) ── */
	.mobile-hamburger-placeholder {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
	}
</style>
