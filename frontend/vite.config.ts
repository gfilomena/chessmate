import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

function gitInfo() {
	// In Docker build, injected via VITE_GIT_COMMIT / VITE_GIT_DATE env vars
	if (process.env.VITE_GIT_COMMIT && process.env.VITE_GIT_COMMIT !== 'unknown') {
		return {
			hash: process.env.VITE_GIT_COMMIT.slice(0, 7),
			date: process.env.VITE_GIT_DATE ?? '',
		};
	}
	// Local dev: read from git
	try {
		const hash = execSync('git rev-parse --short HEAD').toString().trim();
		const date = execSync('git log -1 --format=%ci').toString().trim().slice(0, 16);
		return { hash, date };
	} catch {
		return { hash: 'dev', date: new Date().toISOString().slice(0, 16) };
	}
}

const { hash, date } = gitInfo();

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__GIT_HASH__: JSON.stringify(hash),
		__GIT_DATE__: JSON.stringify(date),
	}
});
