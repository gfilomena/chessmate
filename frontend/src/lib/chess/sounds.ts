/**
 * Modulo audio per gli scacchi.
 *
 * Temi originali:
 *   "Legno"      — CC0, lavenderdotpet/CC0-Public-Domain-Sounds
 *   "Legno Reale"— CC0, Freesound simone_ds #366065
 * Temi Lichess (piano, nes, robot) — CC BY-NC-SA 4.0
 *   https://github.com/lichess-org/lila
 */
import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

export type SoundName  = 'move' | 'capture' | 'check' | 'game_start' | 'game_over' | 'illegal';
export type SoundTheme = 'wood' | 'wood-real' | 'piano' | 'nes' | 'robot';

// ── Libreria temi ────────────────────────────────────────────────────────────

const THEMES: Record<SoundTheme, { label: string; files: Record<SoundName, string> }> = {
	'wood': {
		label: '🪵 Legno',
		files: {
			move:       '/sounds/wood_hit_01.ogg',
			capture:    '/sounds/wood_slam_01.ogg',
			check:      '/sounds/wood_hit_03.ogg',
			game_start: '/sounds/misc_01.ogg',
			game_over:  '/sounds/wood_slam_02.ogg',
			illegal:    '/sounds/wood_hit_05.ogg',
		},
	},
	'wood-real': {
		label: '♟️ Legno Reale',
		files: {
			move:       '/sounds/wood-real/move.mp3',
			capture:    '/sounds/wood-real/capture.mp3',
			check:      '/sounds/wood-real/check.mp3',
			game_start: '/sounds/wood-real/game_start.mp3',
			game_over:  '/sounds/wood-real/game_over.mp3',
			illegal:    '/sounds/wood-real/illegal.mp3',
		},
	},
	'piano': {
		label: '🎹 Piano',
		files: {
			move:       '/sounds/piano/Move.mp3',
			capture:    '/sounds/piano/Capture.mp3',
			check:      '/sounds/piano/Check.mp3',
			game_start: '/sounds/piano/GenericNotify.mp3',
			game_over:  '/sounds/piano/Victory.mp3',
			illegal:    '/sounds/piano/Error.mp3',
		},
	},
	'nes': {
		label: '🎮 NES',
		files: {
			move:       '/sounds/nes/Move.mp3',
			capture:    '/sounds/nes/Capture.mp3',
			check:      '/sounds/nes/Check.mp3',
			game_start: '/sounds/nes/GenericNotify.mp3',
			game_over:  '/sounds/nes/Victory.mp3',
			illegal:    '/sounds/nes/Error.mp3',
		},
	},
	'robot': {
		label: '🤖 Robot',
		files: {
			move:       '/sounds/robot/Move.mp3',
			capture:    '/sounds/robot/Capture.mp3',
			check:      '/sounds/robot/Check.mp3',
			game_start: '/sounds/robot/GenericNotify.mp3',
			game_over:  '/sounds/robot/Victory.mp3',
			illegal:    '/sounds/robot/Error.mp3',
		},
	},
};

export const THEME_KEYS = Object.keys(THEMES) as SoundTheme[];

// ── Stato globale ────────────────────────────────────────────────────────────

export const soundTheme = writable<SoundTheme>(
	(browser && (localStorage.getItem('soundTheme') as SoundTheme)) || 'wood-real'
);

export const soundVolume = writable<number>(
	browser ? parseFloat(localStorage.getItem('soundVolume') ?? '0.8') : 0.8
);

export const soundMuted = writable<boolean>(
	browser ? localStorage.getItem('soundMuted') === 'true' : false
);

/**
 * Cache di tutti i temi, precaricata una sola volta in initSounds().
 * Il cambio tema è istantaneo: si punta semplicemente all'altro oggetto.
 */
const cache: Partial<Record<SoundTheme, Partial<Record<SoundName, HTMLAudioElement>>>> = {};

// ── API pubblica ─────────────────────────────────────────────────────────────

/**
 * Precarica TUTTI i temi audio.
 * Chiamare in onMount — eseguito una sola volta per sessione.
 */
export function initSounds(): void {
	if (!browser) return;
	for (const [theme, config] of Object.entries(THEMES) as [SoundTheme, typeof THEMES[SoundTheme]][]) {
		if (cache[theme]) continue;
		const bucket: Partial<Record<SoundName, HTMLAudioElement>> = {};
		for (const [name, src] of Object.entries(config.files) as [SoundName, string][]) {
			const el = new Audio(src);
			el.preload = 'auto';
			el.volume  = get(soundVolume);
			el.load();
			bucket[name as SoundName] = el;
		}
		cache[theme] = bucket;
	}
}

/** Riproduce un suono del tema attivo. Ignorato se muted. */
export function playSound(name: SoundName): void {
	if (!browser || get(soundMuted)) return;
	const theme = get(soundTheme);
	const el = cache[theme]?.[name];
	if (!el) return;
	el.currentTime = 0;
	el.volume = get(soundVolume);
	el.play().catch(() => { /* autoplay blocked */ });
}

/** Imposta il volume (0–1) e lo persiste. */
export function setVolume(v: number): void {
	const vol = Math.max(0, Math.min(1, v));
	soundVolume.set(vol);
	if (browser) localStorage.setItem('soundVolume', String(vol));
	// Aggiorna tutti gli elementi già in cache
	for (const bucket of Object.values(cache)) {
		for (const el of Object.values(bucket ?? {})) {
			(el as HTMLAudioElement).volume = vol;
		}
	}
}

/** Alterna mute. Ritorna il nuovo stato (true = muted). */
export function toggleMute(): boolean {
	const next = !get(soundMuted);
	soundMuted.set(next);
	if (browser) localStorage.setItem('soundMuted', String(next));
	return next;
}

export function isMuted(): boolean { return get(soundMuted); }

/** Cicla al tema successivo e lo persiste. */
export function cycleTheme(): SoundTheme {
	const current = get(soundTheme);
	const next = THEME_KEYS[(THEME_KEYS.indexOf(current) + 1) % THEME_KEYS.length];
	soundTheme.set(next);
	if (browser) localStorage.setItem('soundTheme', next);
	return next;
}

/** Imposta un tema specifico e lo persiste. */
export function setTheme(theme: SoundTheme): void {
	soundTheme.set(theme);
	if (browser) localStorage.setItem('soundTheme', theme);
}

/** Etichetta leggibile del tema. */
export function themeLabel(theme: SoundTheme): string {
	return THEMES[theme]?.label ?? theme;
}

// ── Interno ──────────────────────────────────────────────────────────────────

/**
 * Rileva il suono da suonare dall'ultima mossa in notazione PGN.
 */
export function soundForPgnMove(pgn: string): SoundName {
	const tokens = pgn.trim().split(/\s+/);
	const moves  = tokens.filter(t => !/^\d+\./.test(t));
	const last   = moves.at(-1) ?? '';
	if (last.includes('#') || last.includes('+')) return 'check';
	if (last.includes('x'))                       return 'capture';
	return 'move';
}
