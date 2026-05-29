/**
 * Board component — cross-browser / cross-device E2E tests.
 *
 * Covers:
 *  1. Click-to-move  (select piece → click target)
 *  2. Drag-and-drop  (pointer drag, desktop + mobile simulation)
 *  3. Deselect / invalid move (no move emitted)
 *  4. Capture move
 *  5. Playing as Black (board flipped)
 *  6. Pawn promotion dialog
 *  7. isMyTurn=false (board ignores all input)
 */

import { test, expect, type Page } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────────

const BASE = '/test/board';

/**
 * Wait until the test harness signals that client-side hydration is complete
 * (onMount has run, pointer-event handlers are attached).
 * This prevents clicking on SSR-rendered squares that aren't interactive yet.
 */
async function waitForBoard(page: Page) {
  await page.waitForSelector('body[data-hydrated="true"]', { timeout: 15_000 });
}

/** Center coordinates of a square button (data-sq attribute). */
async function squareCenter(page: Page, sq: string) {
  const el  = page.locator(`[data-sq="${sq}"]`);
  const box = await el.boundingBox();
  if (!box) throw new Error(`Square ${sq} not found`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Click-to-move via two clicks (pointer events — works on all browsers and devices). */
async function clickMove(page: Page, from: string, to: string) {
  await page.locator(`[data-sq="${from}"]`).click();
  await page.locator(`[data-sq="${to}"]`).click();
}

/**
 * Drag via Pointer Events API — mirrors the Board's own implementation.
 * Uses page.mouse so it works on desktop browsers; also works with
 * Playwright's mobile device emulation (which translates mouse to touch).
 */
async function dragMove(page: Page, from: string, to: string) {
  const f = await squareCenter(page, from);
  const t = await squareCenter(page, to);

  await page.mouse.move(f.x, f.y);
  await page.mouse.down();
  // Small initial jolt to cross the drag threshold (8 px)
  await page.mouse.move(f.x + 10, f.y + 5, { steps: 3 });
  // Slide to target in smooth steps so pointermove fires repeatedly
  await page.mouse.move(t.x, t.y, { steps: 15 });
  await page.mouse.up();
}

/**
 * Touch-drag: directly dispatches Pointer Events with pointerType='touch'.
 * Matches what a real Android browser sends and what our Board listens to.
 */
async function touchDragMove(page: Page, from: string, to: string) {
  const f = await squareCenter(page, from);
  const t = await squareCenter(page, to);

  await page.evaluate(
    ({ f, t }) => {
      const opts = (x: number, y: number) => ({
        bubbles: true, cancelable: true,
        pointerId: 1, pointerType: 'touch',
        isPrimary: true, pressure: 0.5,
        clientX: x, clientY: y,
        screenX: x, screenY: y,
      } as PointerEventInit);

      const origin = document.elementFromPoint(f.x, f.y);
      if (!origin) return;

      origin.dispatchEvent(new PointerEvent('pointerdown', opts(f.x, f.y)));

      // Intermediate move to cross threshold
      document.dispatchEvent(new PointerEvent('pointermove', opts(f.x + 12, f.y + 5)));
      document.dispatchEvent(new PointerEvent('pointermove', opts(t.x, t.y)));
      document.dispatchEvent(new PointerEvent('pointerup',   opts(t.x, t.y)));
    },
    { f, t },
  );
}

/** Last move text shown in the harness. */
const lastMove  = (page: Page) => page.locator('[data-testid="last-move"]');
const moveCount = (page: Page) => page.locator('[data-testid="move-count"]');

// ── Test setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Pre-set cookie consent so the banner never overlaps the board
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', 'essential');
    localStorage.setItem('lang', 'en');
  });
  await page.goto(BASE);
  // Wait for client-side hydration, not just SSR HTML
  await waitForBoard(page);
});

// ── 1. Click-to-move ───────────────────────────────────────────────────────

test.describe('Click-to-move', () => {

  test('e2-e4 pawn opening', async ({ page }) => {
    await clickMove(page, 'e2', 'e4');
    await expect(lastMove(page)).toHaveText('e2-e4');
  });

  test('d2-d4 then d7-d5', async ({ page }) => {
    // White move
    await clickMove(page, 'd2', 'd4');
    await expect(lastMove(page)).toHaveText('d2-d4');

    // Board reloads with black to move — test page keeps isMyTurn=true
    // so we simulate opponent with the same control
    await clickMove(page, 'd7', 'd5');
    await expect(lastMove(page)).toHaveText('d7-d5');
    await expect(moveCount(page)).toHaveText('2');
  });

  test('clicking same square deselects without move', async ({ page }) => {
    // Select a piece
    await page.locator('[data-sq="e2"]').click();
    // Click same square again — deselect
    await page.locator('[data-sq="e2"]').click();
    await expect(lastMove(page)).toHaveText('—');
  });

  test('clicking invalid target cancels selection without move', async ({ page }) => {
    // Select e2 pawn
    await page.locator('[data-sq="e2"]').click();
    // Click e5 — not reachable from e2 on first move
    await page.locator('[data-sq="e5"]').click();
    await expect(lastMove(page)).toHaveText('—');
  });

  test('knight move: g1-f3', async ({ page }) => {
    await clickMove(page, 'g1', 'f3');
    await expect(lastMove(page)).toHaveText('g1-f3');
  });

});

// ── 2. Drag-and-drop (mouse / desktop pointer) ─────────────────────────────

test.describe('Drag-and-drop (mouse)', () => {

  test('drag e2 → e4', async ({ page }) => {
    await dragMove(page, 'e2', 'e4');
    await expect(lastMove(page)).toHaveText('e2-e4');
  });

  test('drag d2 → d4', async ({ page }) => {
    await dragMove(page, 'd2', 'd4');
    await expect(lastMove(page)).toHaveText('d2-d4');
  });

  test('drag to invalid square does not register move', async ({ page }) => {
    // Pawn cannot jump to e6 from e2 directly
    await dragMove(page, 'e2', 'e6');
    await expect(lastMove(page)).toHaveText('—');
  });

  test('drag knight g1 → f3', async ({ page }) => {
    await dragMove(page, 'g1', 'f3');
    await expect(lastMove(page)).toHaveText('g1-f3');
  });

});

// ── 3. Touch drag (Android / iOS simulation) ───────────────────────────────

test.describe('Touch drag (pointer events, pointerType=touch)', () => {

  test('touch-drag e2 → e4', async ({ page }) => {
    await touchDragMove(page, 'e2', 'e4');
    await expect(lastMove(page)).toHaveText('e2-e4');
  });

  test('touch-drag g1 → f3', async ({ page }) => {
    await touchDragMove(page, 'g1', 'f3');
    await expect(lastMove(page)).toHaveText('g1-f3');
  });

  test('touch-drag to invalid target does not move', async ({ page }) => {
    await touchDragMove(page, 'e2', 'e6');
    await expect(lastMove(page)).toHaveText('—');
  });

});

// ── 4. Capture move ────────────────────────────────────────────────────────

test.describe('Capture', () => {

  // FEN: white e4 pawn vs black d5 pawn — white to move
  const CAPTURE_FEN = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

  test('click-to-move capture: e4xd5', async ({ page }) => {
    await page.goto(`${BASE}?fen=${encodeURIComponent(CAPTURE_FEN)}`);
    await waitForBoard(page);
    await clickMove(page, 'e4', 'd5');
    await expect(lastMove(page)).toHaveText('e4-d5');
  });

  test('drag capture: e4xd5', async ({ page }) => {
    await page.goto(`${BASE}?fen=${encodeURIComponent(CAPTURE_FEN)}`);
    await waitForBoard(page);
    await dragMove(page, 'e4', 'd5');
    await expect(lastMove(page)).toHaveText('e4-d5');
  });

});

// ── 5. Playing as Black (board flipped) ────────────────────────────────────

test.describe('Playing as Black', () => {

  // FEN after 1.e4 — black to move
  const BLACK_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

  test('click-to-move as black: e7-e5', async ({ page }) => {
    await page.goto(`${BASE}?fen=${encodeURIComponent(BLACK_FEN)}&color=black`);
    await waitForBoard(page);
    await clickMove(page, 'e7', 'e5');
    await expect(lastMove(page)).toHaveText('e7-e5');
  });

  test('drag as black: d7-d5', async ({ page }) => {
    await page.goto(`${BASE}?fen=${encodeURIComponent(BLACK_FEN)}&color=black`);
    await waitForBoard(page);
    await dragMove(page, 'd7', 'd5');
    await expect(lastMove(page)).toHaveText('d7-d5');
  });

});

// ── 6. Pawn promotion ──────────────────────────────────────────────────────

test.describe('Promotion', () => {

  // White pawn on e7, e8 is empty — white to move
  // Black king on h8, white king on a1 (both away from promotion square)
  const PROMO_FEN = '7k/4P3/8/8/8/8/8/K7 w - - 0 1';

  test('promotion dialog appears and queen selection works', async ({ page }) => {
    await page.goto(`${BASE}?fen=${encodeURIComponent(PROMO_FEN)}`);
    await waitForBoard(page);

    // Move pawn to e8 (triggers promotion)
    await clickMove(page, 'e7', 'e8');

    // Promotion modal must appear
    const modal = page.locator('.promo-modal');
    await expect(modal).toBeVisible();

    // Click queen (first button)
    await page.locator('.promo-btn').first().click();

    // Move should be registered with promotion
    await expect(lastMove(page)).toContainText('e7-e8=');
  });

  test('drag to promotion square also shows dialog', async ({ page }) => {
    await page.goto(`${BASE}?fen=${encodeURIComponent(PROMO_FEN)}`);
    await waitForBoard(page);

    await dragMove(page, 'e7', 'e8');
    await expect(page.locator('.promo-modal')).toBeVisible();

    // Choose rook (second button)
    await page.locator('.promo-btn').nth(1).click();
    await expect(lastMove(page)).toContainText('e7-e8=r');
  });

});

// ── 7. isMyTurn=false — board ignores all input ─────────────────────────────

test.describe('Not my turn', () => {

  test('click does nothing when isMyTurn=false', async ({ page }) => {
    await page.goto(`${BASE}?turn=0`);
    await waitForBoard(page);
    // Click two squares — neither should register
    await page.locator('[data-sq="e2"]').click();
    await page.locator('[data-sq="e4"]').click();
    await expect(lastMove(page)).toHaveText('—');
  });

  test('drag does nothing when isMyTurn=false', async ({ page }) => {
    await page.goto(`${BASE}?turn=0`);
    await waitForBoard(page);
    await dragMove(page, 'e2', 'e4');
    await expect(lastMove(page)).toHaveText('—');
  });

});
