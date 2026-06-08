/**
 * Analysis page — layout & board dimension tests.
 *
 * Verifica che la scacchiera e il pannello mosse si dimensionino correttamente
 * su ogni device: mobile (iPhone, Pixel), tablet (iPad Pro) e desktop.
 *
 * Strategia di isolamento:
 *  - Auth:      mockato via page.route (GET /api/auth/me → utente fake)
 *  - Partita:   mockato via page.route (GET /api/games/layout-test-id)
 *  - Stockfish: Worker mockato in addInitScript → risponde istantaneamente ai
 *               comandi UCI senza caricare WASM o file JS
 *  - SSE / heartbeat: interrotti
 *
 * Run: npm test -- --grep "Analysis layout"
 */

import { test, expect, type Page, type ViewportSize } from '@playwright/test';

// ── Costanti ───────────────────────────────────────────────────────────────

const GAME_ID = 'layout-test-id';

/** PGN campione abbastanza lungo da popolare la moves-list. */
const SAMPLE_PGN = [
  '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 5. d3 d6',
  '6. c3 O-O 7. h3 a6 8. Bb3 Ba7 9. Re1 h6 10. Nbd2 Re8',
  '11. Nf1 Be6 12. Bxe6 Rxe6 13. Ng3 g6 14. d4 exd4 15. cxd4 Bb6',
  '16. e5 Nd7 17. exd6 cxd6 18. d5 Re8 19. dxc6 bxc6 20. Qd3 Nf8',
  '21. Nh4 Qd7 22. Nhf5 gxf5 23. Nxf5 Ng6 24. Bg5 hxg5 25. Qxg6+ Kh8',
  '26. Qxe8+ Rxe8 27. Rxe8# 1-0',
].join(' ');

/** Tolleranza in pixel per confronti di dimensioni (arrotondamenti sub-pixel). */
const PX = 3;

/**
 * Script UCI minimale che sostituisce stockfish.js nel Worker.
 * Risponde istantaneamente ai comandi UCI senza caricare WASM.
 * Intercettato via page.route('** /stockfish.js') — Playwright applica
 * le route anche alle richieste fatte dai Worker, quindi funziona anche
 * quando il Worker viene creato con new Worker('/stockfish.js').
 */
const MOCK_STOCKFISH_WORKER_SCRIPT = `
self.onmessage = function (e) {
  var cmd = typeof e.data === 'string' ? e.data : String(e.data);
  if (cmd === 'uci') {
    postMessage('id name MockFish');
    postMessage('uciok');
  } else if (cmd === 'isready') {
    postMessage('readyok');
  } else if (cmd.indexOf('go') === 0) {
    setTimeout(function () { postMessage('bestmove (none)'); }, 60);
  }
  // stop / setoption / quit / position — ignorati silenziosamente
};
`;

// ── Setup helpers ──────────────────────────────────────────────────────────

async function setupAnalysisPage(page: Page) {
  // 1. Prefs (lang, cookie consent)
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', 'essential');
    localStorage.setItem('lang', 'en');
  });

  // 2. Sostituisci stockfish.js con uno script UCI minimale:
  //    Playwright intercetta anche le fetch dei Worker → engine.init()
  //    risolve in <100ms senza caricare WASM
  await page.route('**/stockfish.js', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: MOCK_STOCKFISH_WORKER_SCRIPT,
    })
  );

  // 3. Mock auth
  await page.route('**/api/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id:         'layout-test-user',
          username:   'LayoutTester',
          email:      'layout@test.com',
          elo_rapid:  1200,
          elo_blitz:  1100,
          elo_bullet: 1000,
          is_admin:   false,
        },
      }),
    })
  );

  // 4. Mock game data
  await page.route(`**/api/games/${GAME_ID}`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id:               GAME_ID,
          white_username:   'LayoutTester',
          black_username:   'Opponent',
          white_elo:        '1200',
          black_elo:        '1100',
          white_id:         'layout-test-user',
          black_id:         'opponent-id',
          result:           '1-0',
          pgn:              SAMPLE_PGN,
        },
      }),
    })
  );

  // 5. Sopprime heartbeat e SSE (non servono per layout test)
  await page.route('**/api/users/*/heartbeat',           route => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/users/*/invitations/stream',  route => route.abort());

  // 6. Naviga e attendi board
  await page.goto(`/analysis/${GAME_ID}`);
  // Attendi che board e moves-list siano entrambi nel DOM (layout completamente renderizzato)
  await page.waitForSelector('.board-wrap',  { timeout: 20_000 });
  await page.waitForSelector('.moves-list',  { timeout: 10_000 });
  // Pausa aggiuntiva per stabilizzazione CSS (transizioni, layout paint su iPad)
  await page.waitForTimeout(1_000);
}

async function getBBox(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`Elemento non trovato o non visibile: "${selector}"`);
  return box;
}

function isMobile(vp: ViewportSize | null): boolean {
  return vp !== null && vp.width <= 768;
}

// ══════════════════════════════════════════════════════════════════════════
// UNIVERSALI — tutti i device
// ══════════════════════════════════════════════════════════════════════════

test.describe('Analysis layout — universali (tutti i device)', () => {

  test.beforeEach(async ({ page }) => { await setupAnalysisPage(page); });

  test('la board è quadrata (|width − height| ≤ 3px)', async ({ page }) => {
    const b = await getBBox(page, '.board-wrap');
    expect(
      Math.abs(b.width - b.height),
      `board ${b.width.toFixed(1)}×${b.height.toFixed(1)} non è quadrata`
    ).toBeLessThanOrEqual(PX);
  });

  test('board non supera il bordo destro del viewport', async ({ page }) => {
    const vp = page.viewportSize()!;
    const b  = await getBBox(page, '.board-wrap');
    expect(b.x + b.width, `board.right=${b.x + b.width} > vp.width=${vp.width}`)
      .toBeLessThanOrEqual(vp.width + PX);
  });

  test('board non supera il bordo inferiore del viewport', async ({ page }) => {
    const vp = page.viewportSize()!;
    const b  = await getBBox(page, '.board-wrap');
    expect(b.y + b.height, `board.bottom=${b.y + b.height} > vp.height=${vp.height}`)
      .toBeLessThanOrEqual(vp.height + PX);
  });

  test('nessun scroll orizzontale di pagina', async ({ page }) => {
    const vp = page.viewportSize()!;
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw, `scrollWidth=${sw} > vp.width=${vp.width}`)
      .toBeLessThanOrEqual(vp.width + PX);
  });

  test('board ha almeno 180px di lato', async ({ page }) => {
    const b = await getBBox(page, '.board-wrap');
    expect(b.width, `board troppo piccola: ${b.width.toFixed(1)}px`).toBeGreaterThan(180);
  });

  test('moves-list è visibile e ha altezza > 40px', async ({ page }) => {
    const b = await getBBox(page, '.moves-list');
    expect(b.height, `moves-list.height=${b.height.toFixed(1)}px`).toBeGreaterThan(40);
  });

  test('moves-list non supera il bordo inferiore del viewport', async ({ page }) => {
    const vp = page.viewportSize()!;
    const b  = await getBBox(page, '.moves-list');
    expect(b.y + b.height, `moves-list.bottom=${b.y + b.height} > vp.height=${vp.height}`)
      .toBeLessThanOrEqual(vp.height + PX);
  });

  test('board e moves-list non si sovrappongono', async ({ page }) => {
    const vp   = page.viewportSize()!;
    const board = await getBBox(page, '.board-wrap');
    const moves = await getBBox(page, '.moves-list');
    if (isMobile(vp)) {
      // Mobile: layout colonna — moves-list inizia dopo la board
      expect(moves.y, `moves-list.top=${moves.y} sovrappone board.bottom=${board.y + board.height}`)
        .toBeGreaterThanOrEqual(board.y + board.height - PX);
    } else {
      // Desktop/tablet: layout riga — moves-list è a destra della board
      expect(moves.x, `moves-list.left=${moves.x} sovrappone board.right=${board.x + board.width}`)
        .toBeGreaterThanOrEqual(board.x + board.width - PX);
    }
  });

});

// ══════════════════════════════════════════════════════════════════════════
// MOBILE (≤ 768px)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Analysis layout — mobile (≤ 768px)', () => {

  test.skip(({ viewport }) => !isMobile(viewport), 'Solo mobile');
  test.beforeEach(async ({ page }) => { await setupAnalysisPage(page); });

  test('board ≤ 44% altezza viewport (cap 42vh + tolleranza)', async ({ page }) => {
    const vp  = page.viewportSize()!;
    const b   = await getBBox(page, '.board-wrap');
    const max = vp.height * 0.44 + PX;
    expect(b.width, `board=${b.width.toFixed(1)}px supera 44% di vh=${vp.height}px (max=${max.toFixed(1)}px)`)
      .toBeLessThanOrEqual(max);
  });

  test('moves-col ha almeno 140px di altezza', async ({ page }) => {
    const b = await getBBox(page, '.moves-col');
    expect(b.height, `moves-col.height=${b.height.toFixed(1)}px`)
      .toBeGreaterThanOrEqual(140);
  });

  test('moves-col è sotto board-col (flex colonna)', async ({ page }) => {
    const boardCol = await getBBox(page, '.board-col');
    const movesCol = await getBBox(page, '.moves-col');
    expect(movesCol.y)
      .toBeGreaterThanOrEqual(boardCol.y + boardCol.height - PX);
  });

  test('board è almeno 65% della larghezza netta disponibile', async ({ page }) => {
    const vp = page.viewportSize()!;
    const b  = await getBBox(page, '.board-wrap');
    // La board è min(100vw-2rem, 42vh).
    // Su schermi con vh piccolo è la formula vh a dominare.
    // Verifichiamo che la board non sia meno del 65% della larghezza disponibile.
    const availableWidth = vp.width - 32; // 100vw - 2rem (padding)
    expect(b.width, `board=${b.width.toFixed(1)}px < 65% di ${availableWidth}px`)
      .toBeGreaterThan(availableWidth * 0.65);
  });

  test('analysis-layout ha overflow:hidden (contenuto non scorra)', async ({ page }) => {
    // Controlla l'intent del layout (non lo scrollHeight assoluto,
    // che varia con dvh vs svh in Playwright emulation)
    const overflow = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.analysis-layout')!).overflowY
    );
    expect(overflow).toBe('hidden');
  });

});

// ══════════════════════════════════════════════════════════════════════════
// DESKTOP e TABLET (> 768px)
// ══════════════════════════════════════════════════════════════════════════

test.describe('Analysis layout — desktop e tablet (> 768px)', () => {

  test.skip(({ viewport }) => isMobile(viewport), 'Solo desktop/tablet');
  test.beforeEach(async ({ page }) => { await setupAnalysisPage(page); });

  test('board-col e moves-col sono affiancati (flex riga)', async ({ page }) => {
    const boardCol = await getBBox(page, '.board-col');
    const movesCol = await getBBox(page, '.moves-col');
    // Y simili (stessa riga)
    expect(Math.abs(boardCol.y - movesCol.y),
      `Y divergenti: board.y=${boardCol.y}, moves.y=${movesCol.y}`)
      .toBeLessThan(80);
    // moves-col è a destra di board-col
    expect(movesCol.x).toBeGreaterThan(boardCol.x + boardCol.width - PX);
  });

  test('board ≤ 78% della larghezza viewport', async ({ page }) => {
    const vp = page.viewportSize()!;
    const b  = await getBBox(page, '.board-wrap');
    expect(b.width, `board=${b.width.toFixed(1)}px > 78% di vp.width=${vp.width}px`)
      .toBeLessThanOrEqual(vp.width * 0.78);
  });

  test('board occupa almeno il 30% della dimensione minore del viewport', async ({ page }) => {
    // Su schermi landscape (laptop): vh è il lato corto → 30% di vh è ragionevole.
    // Su tablet portrait (iPad 834×1194): vw è il lato corto → 30% di vw.
    // Questo test verifica che la board non sia mai "microscopica".
    const vp  = page.viewportSize()!;
    const b   = await getBBox(page, '.board-wrap');
    const ref = Math.min(vp.width, vp.height);
    expect(b.height, `board.height=${b.height.toFixed(1)}px < 30% di min(vw,vh)=${ref}px`)
      .toBeGreaterThan(ref * 0.30);
  });

  test('moves-col occupa almeno l\'80% dell\'altezza viewport', async ({ page }) => {
    const vp = page.viewportSize()!;
    const b  = await getBBox(page, '.moves-col');
    expect(b.height, `moves-col.height=${b.height.toFixed(1)}px < 80% di vh=${vp.height}px`)
      .toBeGreaterThan(vp.height * 0.80);
  });

  test('eval-bar è visibile su desktop/tablet', async ({ page }) => {
    const evalBar = page.locator('.eval-bar').first();
    await expect(evalBar).toBeVisible();
    const b = await evalBar.boundingBox();
    expect(b!.height).toBeGreaterThan(100);
  });

});
