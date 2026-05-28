/**
 * Modulo audio per gli scacchi.
 * Suoni: CC0 Public Domain — lavenderdotpet/CC0-Public-Domain-Sounds
 * (wood_hit / wood_slam da "100-CC0-wood-metal-SFX")
 */
import { browser } from '$app/environment';

export type SoundName = 'move' | 'capture' | 'check' | 'game_start' | 'game_over' | 'illegal';

const FILES: Record<SoundName, string> = {
	move:       '/sounds/wood_hit_01.ogg',
	capture:    '/sounds/wood_slam_01.ogg',
	check:      '/sounds/wood_hit_03.ogg',
	game_start: '/sounds/misc_01.ogg',
	game_over:  '/sounds/wood_slam_02.ogg',
	illegal:    '/sounds/wood_hit_05.ogg',
};

const elements: Partial<Record<SoundName, HTMLAudioElement>> = {};
let muted = false;

/** Precarica tutti i suoni. Chiamare in onMount. */
export function initSounds(): void {
	if (!browser) return;
	for (const [name, src] of Object.entries(FILES) as [SoundName, string][]) {
		const el = new Audio(src);
		el.preload = 'auto';
		elements[name] = el;
	}
}

/** Riproduce un suono. Ignorato se muted o browser non supporta. */
export function playSound(name: SoundName): void {
	if (!browser || muted) return;
	const el = elements[name];
	if (!el) return;
	el.currentTime = 0;
	el.play().catch(() => { /* autoplay blocked prima del primo click */ });
}

/** Alterna mute. Ritorna il nuovo stato (true = muted). */
export function toggleMute(): boolean {
	muted = !muted;
	return muted;
}

export function isMuted(): boolean {
	return muted;
}

/**
 * Rileva il suono corretto da suonare dopo una mossa,
 * analizzando l'ultima notazione PGN.
 * Es: "Nxf6+" → capture+check → 'check'
 *     "exd5"  → capture       → 'capture'
 *     "Nf3"   → mossa normale → 'move'
 */
export function soundForPgnMove(pgn: string): SoundName {
	const tokens = pgn.trim().split(/\s+/);
	const moves  = tokens.filter(t => !/^\d+\./.test(t));
	const last   = moves.at(-1) ?? '';

	if (last.includes('#') || last.includes('+')) return 'check';
	if (last.includes('x'))                       return 'capture';
	return 'move';
}
