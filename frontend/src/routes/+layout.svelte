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

	// Route che richiedono autenticazione
	const PROTECTED_PREFIXES = ['/play', '/learn', '/game', '/analysis', '/leaderboard', '/profile', '/admin'];
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
						⏏ {$t.user.logout}
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
				<button class="logout-btn" onclick={handleLogout} title={$t.user.logout}>⏏</button>
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
				title={sidebarCollapsed ? 'Espandi menu' : 'Comprimi menu'}
			>
				<span class="sidebar-toggle-label">{sidebarCollapsed ? '' : 'Comprimi'}</span>
				{sidebarCollapsed ? '▶' : '◀'}
			</button>
		</aside>
	{/if}

	<!-- ── Main content ──────────────────────────────────────── -->
	<main class="main-content">
		{@render children()}
	</main>

</div>

<!-- Toast inviti — visibile in ogni pagina -->
<InviteToast />

<!-- Cookie consent banner (GDPR) -->
<CookieBanner />

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

	/* ── Mobile hamburger placeholder (centra il logo) ── */
	.mobile-hamburger-placeholder {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
	}
</style>
