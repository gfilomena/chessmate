/**
 * E2E: Multi-user chess game flow
 *
 * Simulates two players (Alice and Bob) in separate browser contexts:
 *  1. Register / login via API
 *  2. Matchmaking  — join queue, get paired
 *  3. Navigate to game page (WebSocket connects, board hydrates)
 *  4. Play moves via click-to-move (wait for status badge to confirm turn)
 *  5. Resign → game-over overlay visible on both sides
 *  6. Analysis page — board + action buttons + review engine
 *
 * Prerequisites:
 *   - Backend running at http://localhost:8080  (or set BACKEND_URL env)
 *   - Frontend dev server at http://localhost:5173 (auto-started by Playwright)
 *
 * Run:
 *   npx playwright test game.spec.ts --project chromium
 */

import {
  test, expect,
  type Browser, type BrowserContext, type Page,
} from '@playwright/test';

// ── Constants ──────────────────────────────────────────────────────────────────

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:8080';

/** Unique suffix so each test run creates fresh users in the DB. */
const RUN = Date.now().toString(36);

// ── Types ──────────────────────────────────────────────────────────────────────

interface Player {
  ctx:      BrowserContext;
  page:     Page;
  username: string;
  email:    string;
}

// ── Player factory ─────────────────────────────────────────────────────────────

/**
 * Create a browser context, register a new user, and return a Player.
 * The auth_token cookie is stored in the context cookie jar so all page
 * navigations and ctx.request calls are authenticated.
 */
async function createPlayer(
  browser:  Browser,
  username: string,
  email:    string,
): Promise<Player> {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();

  // Suppress cookie / language banners before any navigation
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', 'essential');
    localStorage.setItem('lang', 'en');
  });

  // Register → server sets auth_token cookie for localhost domain
  const res = await ctx.request.post(`${BACKEND}/api/auth/register`, {
    data: { username, email, password: 'Pw!23456' },
  });

  // 409 Conflict = user already exists from a previous run → login instead
  if (res.status() === 409) {
    await ctx.request.post(`${BACKEND}/api/auth/login`, {
      data: { email, password: 'Pw!23456' },
    });
  }

  return { ctx, page, username, email };
}

// ── API helpers ────────────────────────────────────────────────────────────────

/** POST /api/matchmaking/join with a rapid-10min time control. */
async function joinQueue(
  player: Player,
  tc   = 600,
  inc  = 0,
  type = 'rapid',
): Promise<void> {
  const res = await player.ctx.request.post(`${BACKEND}/api/matchmaking/join`, {
    data: { time_control: tc, increment: inc, game_type: type },
  });
  expect(res.ok(), `${player.username}: join queue response ok`).toBe(true);
}

/**
 * Poll GET /api/games/active until a game ID appears (max 15 s).
 * The endpoint returns { game_id: "..." } when a live game exists.
 */
async function waitForActiveGame(
  player: Player,
  maxMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const res = await player.ctx.request.get(`${BACKEND}/api/games/active`);
    if (res.ok()) {
      const data = (await res.json()) as { game_id?: string };
      if (data?.game_id) return data.game_id;
    }
    await player.page.waitForTimeout(400);
  }
  throw new Error(`${player.username}: timeout waiting for active game`);
}

/**
 * Poll GET /api/games/{id} until pgn contains the expected SAN token.
 * This confirms the backend has processed a move before asserting UI state.
 */
async function waitForPGN(
  player:   Player,
  gameId:   string,
  contains: string,
  maxMs = 8_000,
): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const res = await player.ctx.request.get(`${BACKEND}/api/games/${gameId}`);
    if (res.ok()) {
      const data = (await res.json()) as { pgn: string };
      if ((data.pgn ?? '').includes(contains)) return;
    }
    await player.page.waitForTimeout(300);
  }
  throw new Error(`Timeout: PGN for game ${gameId} never contained "${contains}"`);
}

// ── Board / UI helpers ─────────────────────────────────────────────────────────

/**
 * Wait until the Board component has rendered squares.
 * `[data-sq]` elements appear only after the component mounts and receives
 * the initial FEN — which only happens after the WS game_start message.
 */
async function waitForBoard(page: Page): Promise<void> {
  await expect(
    page.locator('[data-sq="e2"]'),
    'Board should render after WS game_start',
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Wait until the .status-badge shows "Your turn" for this player.
 * The badge is driven by $gameState and isMyTurn derived from the WS state,
 * so this implicitly confirms the move_made WS message has been processed.
 */
async function waitForMyTurn(player: Player): Promise<void> {
  await expect(
    player.page.locator('.status-badge'),
    `${player.username}: status-badge should show "Your turn"`,
  ).toContainText(/your turn|tocca a te|tu turno/i, { timeout: 10_000 });
}

/** Click-to-move: select piece square, then click target square. */
async function clickMove(
  page: Page,
  from: string,
  to:   string,
): Promise<void> {
  await page.locator(`[data-sq="${from}"]`).click();
  await page.locator(`[data-sq="${to}"]`).click();
}

// ── Test suites ────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// Suite A — Matchmaking + gameplay + resign + analysis
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Multi-user: matchmaking game flow', () => {
  // All tests share gameId, whitePlayer, etc. → must run serially.
  test.describe.configure({ mode: 'serial' });

  // Only run on one browser to avoid creating duplicate DB records.
  // Usage: npx playwright test game.spec.ts --project chromium
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Multi-user suite: chromium only to avoid duplicate DB writes per project',
  );

  let alice:       Player;
  let bob:         Player;
  let gameId:      string;
  let whitePlayer: Player;
  let blackPlayer: Player;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  test.beforeAll(async ({ browser }) => {
    alice = await createPlayer(
      browser,
      `alice_${RUN}`,
      `alice_${RUN}@pw-test.com`,
    );
    bob = await createPlayer(
      browser,
      `bob_${RUN}`,
      `bob_${RUN}@pw-test.com`,
    );

    // Announce both as online so heartbeat table is current
    await Promise.all([
      alice.ctx.request.post(`${BACKEND}/api/users/heartbeat`),
      bob.ctx.request.post(`${BACKEND}/api/users/heartbeat`),
    ]);
  });

  test.afterAll(async () => {
    await alice?.ctx.close().catch(() => {});
    await bob?.ctx.close().catch(() => {});
  });

  // ── 1. Matchmaking ───────────────────────────────────────────────────────

  test('1 — matchmaking: both join queue and are paired to the same game', async () => {
    await joinQueue(alice);
    await joinQueue(bob);

    // The matchmaker pairs players within ~1 s of both joining
    gameId          = await waitForActiveGame(alice);
    const bobGameId = await waitForActiveGame(bob);

    expect(gameId,     'game ID must be a non-empty string').toBeTruthy();
    expect(bobGameId,  'Alice and Bob must land in the same game').toBe(gameId);
  });

  // ── 2. Open game page ────────────────────────────────────────────────────

  test('2 — both players open /game/{id} and board hydrates', async () => {
    await Promise.all([
      alice.page.goto(`/game/${gameId}`),
      bob.page.goto(`/game/${gameId}`),
    ]);

    // Board renders only after WS game_start is received
    await Promise.all([
      waitForBoard(alice.page),
      waitForBoard(bob.page),
    ]);

    // Identify colours so subsequent tests know who to click for
    const [gameRes, meRes] = await Promise.all([
      alice.ctx.request.get(`${BACKEND}/api/games/${gameId}`),
      alice.ctx.request.get(`${BACKEND}/api/auth/me`),
    ]);
    const gameData = (await gameRes.json()) as { white_id: string; black_id: string };
    const meData   = (await meRes.json())   as { id: string };

    whitePlayer = gameData.white_id === meData.id ? alice : bob;
    blackPlayer = gameData.white_id === meData.id ? bob   : alice;
  });

  // ── 3. Play moves ────────────────────────────────────────────────────────

  test('3 — white plays e4 (e2→e4)', async () => {
    // The status badge drives from WS state — waiting for it ensures
    // game_start has been fully processed on white's side.
    await waitForMyTurn(whitePlayer);
    await clickMove(whitePlayer.page, 'e2', 'e4');
    // Confirm backend stored the move in PGN
    await waitForPGN(alice, gameId, 'e4');
  });

  test('4 — black plays e5 (e7→e5)', async () => {
    // Black's "Your turn" fires after the move_made WS message arrives
    await waitForMyTurn(blackPlayer);
    await clickMove(blackPlayer.page, 'e7', 'e5');
    await waitForPGN(alice, gameId, 'e5');
  });

  test('5 — white plays Nf3 (g1→f3)', async () => {
    await waitForMyTurn(whitePlayer);
    await clickMove(whitePlayer.page, 'g1', 'f3');
    await waitForPGN(alice, gameId, 'Nf3');
  });

  // ── 4. Resign ────────────────────────────────────────────────────────────

  test('6 — black resigns; game-over overlay appears on both pages', async () => {
    // The resign button uses a native confirm() dialog
    blackPlayer.page.once('dialog', (dialog) => dialog.accept());

    const resignBtn = blackPlayer.page.getByRole('button', {
      name: /resign|abbandona|rendirse/i,
    });
    await expect(resignBtn).toBeVisible({ timeout: 5_000 });
    await resignBtn.click();

    // Both pages should transition to the finished overlay
    await Promise.all([
      expect(whitePlayer.page.locator('.overlay.finished')).toBeVisible({
        timeout: 10_000,
      }),
      expect(blackPlayer.page.locator('.overlay.finished')).toBeVisible({
        timeout: 10_000,
      }),
    ]);
  });

  // ── 5. Analysis page ─────────────────────────────────────────────────────

  test('7 — navigate to /analysis/{id}; board renders', async () => {
    await alice.page.goto(`/analysis/${gameId}`);
    await expect(alice.page.locator('.board-wrap')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('8 — analysis: primary + ghost action buttons are visible', async () => {
    // "Nuova partita" primary CTA
    await expect(alice.page.locator('.action-primary')).toBeVisible();

    // Accent ghost = start-review button (visible when review has not started)
    await expect(alice.page.locator('.action-ghost--accent')).toBeVisible();

    // PGN download link
    await expect(
      alice.page.locator('.action-ghost').filter({ hasText: 'PGN' }),
    ).toBeVisible();
  });

  test('9 — analysis: clicking review triggers engine analysis', async () => {
    const reviewBtn = alice.page.locator('.action-ghost--accent');
    await expect(reviewBtn).toBeVisible({ timeout: 5_000 });
    await reviewBtn.click();

    // Either the progress bar or the engine-info badge should appear
    await expect(
      alice.page.locator('.review-progress, .engine-info').first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite B — Invitation flow (Alice invites Bob from the /play online-users list)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Multi-user: invitation flow', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Invitation suite: chromium only',
  );

  // Use a fresh suffix so users don't collide with Suite A
  const INV = `inv${Date.now().toString(36)}`;

  let alice: Player;
  let bob:   Player;
  let gameId: string;

  test.beforeAll(async ({ browser }) => {
    alice = await createPlayer(browser, `alice_${INV}`, `alice_${INV}@pw-test.com`);
    bob   = await createPlayer(browser, `bob_${INV}`,   `bob_${INV}@pw-test.com`);

    // Both must be online before Alice can see Bob
    await Promise.all([
      alice.ctx.request.post(`${BACKEND}/api/users/heartbeat`),
      bob.ctx.request.post(`${BACKEND}/api/users/heartbeat`),
    ]);
  });

  test.afterAll(async () => {
    await alice?.ctx.close().catch(() => {});
    await bob?.ctx.close().catch(() => {});
  });

  test('10 — Bob opens /play (subscribes to invitation SSE stream)', async () => {
    await bob.page.goto('/play');
    // Give the EventSource connection a moment to establish
    await bob.page.waitForTimeout(1_000);
    await expect(bob.page.locator('body')).toBeAttached();
  });

  test('11 — Alice sends a blitz-5min invite to Bob via API', async () => {
    // Resolve Bob's user ID
    const bobMe = (await (
      await bob.ctx.request.get(`${BACKEND}/api/auth/me`)
    ).json()) as { id: string };

    const res = await alice.ctx.request.post(`${BACKEND}/api/invitations`, {
      data: {
        to_user_id:   bobMe.id,
        time_control: 300,
        increment:    0,
        game_type:    'blitz',
      },
    });
    expect(res.ok(), 'invite POST should succeed').toBe(true);
  });

  test('12 — Bob sees the invitation banner and accepts', async () => {
    // The /play page renders an invite banner when SSE fires the invitation event
    const invBanner = bob.page
      .locator('.invite-banner, [data-testid="invite-banner"], .invitation')
      .first();
    await expect(invBanner).toBeVisible({ timeout: 10_000 });

    const acceptBtn = bob.page.getByRole('button', {
      name: /accept|accetta|aceptar/i,
    });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();
  });

  test('13 — both players land on the game page after acceptance', async () => {
    gameId = await waitForActiveGame(alice);
    expect(gameId).toBeTruthy();

    // Alice may have been redirected automatically or needs to navigate
    if (!alice.page.url().includes('/game/')) {
      await alice.page.goto(`/game/${gameId}`);
    }

    await Promise.all([
      waitForBoard(alice.page),
      waitForBoard(bob.page),
    ]);
  });
});
