<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { user, authLoading } from '$lib/stores/auth';

	const status = $derived($page.status);
	const message = $derived($page.error?.message ?? 'Errore sconosciuto');

	// Redirect automatico dopo 3 secondi
	let countdown = $state(3);
	let interval: ReturnType<typeof setInterval>;

	$effect(() => {
		interval = setInterval(() => {
			countdown--;
			if (countdown <= 0) {
				clearInterval(interval);
				// 404 o non autenticato → login, altrimenti home
				if (status === 404 || !$user) {
					goto('/login');
				} else {
					goto('/');
				}
			}
		}, 1000);
		return () => clearInterval(interval);
	});

	function goNow() {
		clearInterval(interval);
		if (status === 404 || !$user) {
			goto('/login');
		} else {
			goto('/');
		}
	}
</script>

<svelte:head>
	<title>{status} — Chess</title>
</svelte:head>

<div class="error-page">
	<div class="error-card">
		<div class="error-code">{status}</div>
		<div class="error-emoji">
			{#if status === 404}♟️{:else if status === 403}🔒{:else}⚠️{/if}
		</div>
		<h1 class="error-title">
			{#if status === 404}
				Pagina non trovata
			{:else if status === 403}
				Accesso negato
			{:else}
				Qualcosa è andato storto
			{/if}
		</h1>
		<p class="error-sub">
			{#if status === 404}
				Questa pagina non esiste o è stata spostata.
			{:else}
				{message}
			{/if}
		</p>

		{#if !$authLoading}
			<button class="btn btn-primary" onclick={goNow}>
				{!$user || status === 404 ? 'Vai al login' : 'Torna alla home'}
			</button>
			<p class="countdown">Redirect automatico tra {countdown}s…</p>
		{/if}
	</div>
</div>

<style>
	.error-page {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.error-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
		max-width: 380px;
	}

	.error-code {
		font-size: 5rem;
		font-weight: 900;
		color: var(--border);
		line-height: 1;
		letter-spacing: -0.05em;
	}

	.error-emoji {
		font-size: 2.5rem;
		margin-top: -0.5rem;
	}

	.error-title {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text);
		margin: 0;
	}

	.error-sub {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.countdown {
		font-size: 0.78rem;
		color: var(--text-muted);
		opacity: 0.6;
		margin: 0;
	}
</style>
