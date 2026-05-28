<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import logoSvg from '$lib/assets/logo.svg';
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { user, loadUser, logout } from '$lib/stores/auth';
	import {
		startHeartbeat, stopHeartbeat,
		startInviteSSE, stopInviteSSE
	} from '$lib/stores/invitations';
	import InviteToast from '$lib/components/InviteToast.svelte';

	let { children } = $props();

	let sidebarOpen = $state(false);

	onMount(() => loadUser());
	onDestroy(() => { stopHeartbeat(); stopInviteSSE(); });

	$effect(() => {
		if ($user) { startHeartbeat(); startInviteSSE(); }
		else        { stopHeartbeat(); stopInviteSSE(); }
	});

	// Chiudi sidebar ad ogni navigazione
	const currentPath = $derived($page.url.pathname);
	$effect(() => {
		currentPath;
		sidebarOpen = false;
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
	<title>Chess Clone</title>
</svelte:head>

<!-- ── Mobile top bar (solo < 768px) ───────────────────────── -->
<header class="mobile-header">
	<button
		class="mobile-hamburger"
		onclick={() => sidebarOpen = !sidebarOpen}
		aria-label="Menu"
	>
		{sidebarOpen ? '✕' : '☰'}
	</button>
	<img src={favicon} alt="" class="mobile-logo-icon" aria-hidden="true" />
	<span class="mobile-logo-text">Chess Clone</span>
	{#if $user}
		<div class="mobile-user-chip">{initial}</div>
	{/if}
</header>

<!-- ── Backdrop sidebar (mobile) ───────────────────────────── -->
<div
	class="sidebar-backdrop"
	class:sidebar-open={sidebarOpen}
	onclick={() => sidebarOpen = false}
	aria-hidden="true"
></div>

<div class="app-shell">

	<!-- ── Left sidebar ─────────────────────────────────────── -->
	<aside class="sidebar" class:sidebar-open={sidebarOpen}>

		<a href="/" class="sidebar-logo" onclick={() => sidebarOpen = false}>
			<img src={favicon} alt="" class="sidebar-logo-img" aria-hidden="true" />
			<span class="sidebar-logo-text">Chess Clone</span>
		</a>

		<nav class="sidebar-nav">
			<a href="/play" class="nav-item" class:active={isActive('/play')} onclick={() => sidebarOpen = false}>
				<span class="nav-icon">🎮</span>
				<span>Gioca</span>
			</a>
			<a href="/leaderboard" class="nav-item" class:active={isActive('/leaderboard')} onclick={() => sidebarOpen = false}>
				<span class="nav-icon">🏆</span>
				<span>Classifica</span>
			</a>

			<div class="nav-divider"></div>

			<span class="nav-item disabled">
				<span class="nav-icon">⋯</span>
				<span>Altro</span>
			</span>
		</nav>

		<div class="sidebar-bottom">
			{#if $user}
				<div class="user-row">
					<div class="user-avatar">{initial}</div>
					<div class="user-info">
						<div class="user-name">{$user.username}</div>
						<div class="user-elo">{$user.elo_rapid} ELO</div>
					</div>
					<button class="logout-btn" onclick={handleLogout} title="Esci">⏏</button>
				</div>
			{:else}
				<a href="/login" class="nav-item" onclick={() => sidebarOpen = false}>
					<span class="nav-icon">🔑</span>
					<span>Accedi</span>
				</a>
				<a href="/register" class="nav-item" onclick={() => sidebarOpen = false}>
					<span class="nav-icon">✨</span>
					<span>Registrati</span>
				</a>
			{/if}
		</div>
	</aside>

	<!-- ── Main content ──────────────────────────────────────── -->
	<main class="main-content">
		{@render children()}
	</main>

</div>

<!-- Toast inviti — visibile in ogni pagina -->
<InviteToast />
