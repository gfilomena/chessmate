// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Vite build-time constants (injected via define in vite.config.ts)
	const __GIT_HASH__: string;
	const __GIT_DATE__: string;
}

export {};
