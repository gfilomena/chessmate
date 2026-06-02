/**
 * Board settings: piece set and board theme.
 * Persisted in localStorage.
 */
import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

// ── Piece set ─────────────────────────────────────────────────────────────────

export type PieceSet = 'cburnett' | 'merida' | 'alpha';

export interface PieceSetMeta {
	id:    PieceSet;
	label: string;
	preview: string; // path to king preview
}

export const PIECE_SETS: PieceSetMeta[] = [
	{ id: 'cburnett', label: 'Classic',  preview: '/pieces/cburnett/wK.svg' },
	{ id: 'merida',   label: 'Merida',   preview: '/pieces/merida/wK.svg'   },
	{ id: 'alpha',    label: 'Alpha',    preview: '/pieces/alpha/wK.svg'    },
];

export const pieceSet = writable<PieceSet>(
	(browser && (localStorage.getItem('pieceSet') as PieceSet)) || 'cburnett'
);

export function setPieceSet(s: PieceSet): void {
	pieceSet.set(s);
	if (browser) localStorage.setItem('pieceSet', s);
}

/** Returns the URL for a piece in the current set. */
export function pieceUrl(set: PieceSet, code: string): string {
	return `/pieces/${set}/${code}.svg`;
}

// ── Board theme ───────────────────────────────────────────────────────────────

export type BoardThemeId = 'brown' | 'blue' | 'wood' | 'marble' | 'leather' | 'olive';

export interface BoardTheme {
	id:         BoardThemeId;
	label:      string;
	/** CSS background for light squares (color or url(...)) */
	light:      string;
	/** CSS background for dark squares */
	dark:       string;
	/** Preview: two-color pair shown in the picker */
	previewLight: string;
	previewDark:  string;
	/** For texture themes: the board bg-image (tiled) */
	texture?:   string;
}

export const BOARD_THEMES: BoardTheme[] = [
	{
		id:           'brown',
		label:        'Classico',
		light:        '#F0D9B5',
		dark:         '#B58863',
		previewLight: '#F0D9B5',
		previewDark:  '#B58863',
	},
	{
		id:           'blue',
		label:        'Oceano',
		light:        '#DEE3E6',
		dark:         '#788A94',
		previewLight: '#DEE3E6',
		previewDark:  '#788A94',
	},
	{
		id:           'wood',
		label:        'Legno',
		light:        'url(/board/wood.jpg)',
		dark:         'url(/board/wood.jpg)',
		previewLight: '#D4A96A',
		previewDark:  '#8B5E3C',
		texture:      '/board/wood.jpg',
	},
	{
		id:           'marble',
		label:        'Marmo',
		light:        'url(/board/marble.jpg)',
		dark:         'url(/board/marble.jpg)',
		previewLight: '#C8D8E8',
		previewDark:  '#4E6B8A',
		texture:      '/board/marble.jpg',
	},
	{
		id:           'leather',
		label:        'Pelle',
		light:        'url(/board/leather.jpg)',
		dark:         'url(/board/leather.jpg)',
		previewLight: '#C8A882',
		previewDark:  '#6B4C30',
		texture:      '/board/leather.jpg',
	},
	{
		id:           'olive',
		label:        'Oliva',
		light:        'url(/board/olive.jpg)',
		dark:         'url(/board/olive.jpg)',
		previewLight: '#B8C8A0',
		previewDark:  '#5A7040',
		texture:      '/board/olive.jpg',
	},
];

export const boardTheme = writable<BoardThemeId>(
	(browser && (localStorage.getItem('boardTheme') as BoardThemeId)) || 'brown'
);

export function setBoardTheme(id: BoardThemeId): void {
	boardTheme.set(id);
	if (browser) localStorage.setItem('boardTheme', id);
}

export function getBoardThemeMeta(id: BoardThemeId): BoardTheme {
	return BOARD_THEMES.find(t => t.id === id) ?? BOARD_THEMES[0];
}
