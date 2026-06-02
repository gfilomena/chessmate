<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * BoardSlot — container standardizzato per la scacchiera.
	 *
	 * Calcola il quadrato massimo che entra nell'area disponibile sottraendo
	 * l'overhead (barra modalità + timeline + padding) dall'altezza del viewport.
	 * Sovrascrive la dimensione hardcoded interna di Board.svelte/SetupBoard.
	 *
	 * Usato in: learn, future sezioni di allenamento.
	 * Il game/[id] usa ancora il proprio sizing (diverso layout a pannelli).
	 *
	 * Props:
	 *   overhead  – pixel da sottrarre all'altezza utile (default 160)
	 *               learn: ~45 modebar + 48 timeline + 67 padding/gaps
	 */
	let {
		children,
		overhead = 160,
	}: {
		children: Snippet;
		overhead?: number;
	} = $props();
</script>

<div class="board-slot" style="--overhead:{overhead}px">
	{@render children()}
</div>

<style>
	.board-slot {
		/* Quadrato: min(larghezza colonna, altezza-viewport - overhead) */
		width: min(100%, calc(100vh - var(--overhead)));
		aspect-ratio: 1;
		position: relative;
		flex-shrink: 0;
	}

	/*
	 * Override del board-wrap interno di Board.svelte.
	 * Board.svelte usa width: min(720px, calc(100dvh-90px), calc(100vw-480px))
	 * che è hardcoded per il layout game/[id] e ignora questo container.
	 * Qui lo forziamo a riempire il BoardSlot invece di usare le formule viewport.
	 */
	.board-slot :global(.board-wrap) {
		width: 100% !important;
	}
</style>
