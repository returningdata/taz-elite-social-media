import { expect, test } from '@playwright/test';

const widths = [320, 360, 375, 390, 412, 768, 1024, 1280, 1440, 1920];
const auditRoutes = ['/', '/about', '/experience', '/projects', '/discord', '/twitch', '/youtube', '/tiktok', '/instagram', '/contact', '/contact-success', '/cloudnord', '/sparked-host', '/vpn', '/privacy', '/privacy-policy', '/terms-of-service', '/tip'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tazMixMinimized', 'true');
    localStorage.removeItem('tazMixVolume');
  });
});

test('all target widths avoid horizontal overflow', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  for (const width of widths) {
    await page.setViewportSize({ width, height: width <= 412 ? 760 : width <= 768 ? 900 : 950 });
    for (const route of auditRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(350);
      const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      expect(dimensions.scrollWidth, `${route} overflowed at ${width}px`).toBeLessThanOrEqual(dimensions.innerWidth + 1);
    }
  }
  expect(pageErrors).toEqual([]);
});

test('mobile menu scrolls to every ordered link and stays above music', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto('/');
  await page.locator('.menu-toggle').click();
  const menu = page.locator('#mobile-menu');
  await expect(menu).toHaveAttribute('aria-hidden', 'false');
  const labels = await menu.locator('nav a').allTextContents();
  expect(labels.map((label) => label.replace('↗', '').trim())).toEqual(['Home', 'About', 'Experience', 'Projects', 'Discord', 'Twitch', 'TikTok', 'YouTube', 'Instagram', 'Contact', 'CloudNord', 'Sparked Host', 'VPN']);
  const panel = menu.locator('.mobile-menu-panel');
  expect(await panel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBeTruthy();
  await menu.getByRole('link', { name: /VPN/ }).scrollIntoViewIfNeeded();
  await expect(menu.getByRole('link', { name: /VPN/ })).toBeVisible();
  const layers = await page.evaluate(() => ({ menu: Number(getComputedStyle(document.querySelector('.mobile-menu')!).zIndex), mix: Number(getComputedStyle(document.querySelector('.taz-mix')!).zIndex) }));
  expect(layers.menu).toBeGreaterThan(layers.mix);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-hidden', 'true');
  await page.locator('.menu-toggle').click();
  await page.mouse.click(2, 240);
  await expect(menu).toHaveAttribute('aria-hidden', 'true');
});

test('shared menu survives Twitch transitions without blocking page clicks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/twitch');
  const toggle = page.locator('.menu-toggle');
  const menu = page.locator('#mobile-menu');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(menu).toHaveAttribute('aria-hidden', 'false');
  await expect(menu.getByRole('link', { name: /About/ })).toBeVisible();
  await menu.getByRole('link', { name: /About/ }).click();
  await page.waitForURL('**/about');
  await expect(page.locator('body')).not.toHaveClass(/menu-open/);
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  await page.locator('.brand-mark').click();
  await page.waitForURL(/\/$/);
  await page.locator('.menu-toggle').click();
  await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'false');
});

test('social integrations resolve to data or truthful errors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discord');
  await expect(page.locator('[data-presence-content]')).toBeVisible();
  await expect(page.locator('[data-presence-status]')).not.toHaveText(/Checking/i);
  await expect(page.locator('[data-member-count]').first()).not.toHaveText(/Loading/i);
  await expect(page.locator('[data-online-count]').first()).not.toHaveText(/Loading/i);

  await page.goto('/youtube');
  await expect(page.locator('.youtube-video')).toHaveCount(3);
  await expect(page.locator('[data-youtube-subscribers]')).toHaveText(/Unavailable|Hidden|\d/);
  await expect(page.locator('[data-youtube-channel-notice]')).not.toHaveText(/Loading/i);

  await page.goto('/tiktok');
  await expect(page.locator('[data-tiktok-notice]')).not.toHaveText(/Loading/i);
  await expect(page.locator('[data-tiktok-retry]')).toBeVisible();

  await page.goto('/twitch');
  await expect(page.locator('[data-twitch-loading]')).toBeHidden();
  const twitchContent = page.locator('[data-twitch-content]');
  const twitchError = page.locator('[data-twitch-error]');
  expect(await twitchContent.isVisible() || await twitchError.isVisible()).toBeTruthy();
  if (await twitchContent.isVisible()) {
    await expect(page.locator('[data-twitch-status]')).toHaveText(/LIVE NOW|CURRENTLY OFFLINE/);
    expect(await page.locator('[data-twitch-videos] .content-card').count()).toBeLessThanOrEqual(3);
    expect(await page.locator('[data-twitch-clips] .content-card').count()).toBeLessThanOrEqual(6);
    await expect(page.locator('body')).not.toContainText(/California Roleplay|Starz Empire/i);
    const externalContentUrls = await page.locator('[data-twitch-videos] a, [data-twitch-clips] a').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).hostname));
    expect(externalContentUrls.every((hostname) => hostname.endsWith('twitch.tv'))).toBeTruthy();
  }
});

test('Discord and Twitch loaders resolve after client navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await page.locator('a[href="/discord"]').first().click();
  await page.waitForURL('**/discord');
  await expect(page.locator('[data-presence-loading]')).toBeHidden({ timeout: 15000 });
  expect(await page.locator('[data-presence-content]').isVisible() || await page.locator('[data-presence-error]').isVisible()).toBeTruthy();
  await expect(page.locator('[data-member-count]').first()).not.toHaveClass(/loading-value/);

  await page.locator('a[href="/twitch"]').first().click();
  await page.waitForURL('**/twitch');
  await expect(page.locator('[data-twitch-loading]')).toBeHidden({ timeout: 15000 });
  expect(await page.locator('[data-twitch-content]').isVisible() || await page.locator('[data-twitch-error]').isVisible()).toBeTruthy();
});

test('approved photos remain fully visible inside bordered frames', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about');
  const photo = page.locator('.photo-card img').first();
  await expect(photo).toBeVisible();
  await expect(photo).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('.photo-card').first()).not.toHaveCSS('border-top-width', '0px');
});

test('API status page confirms website and function reachability', async ({ page }) => {
  await page.goto('/API');
  await expect(page).toHaveTitle(/API & Site Status/);
  await expect(page.locator('[data-api-status]')).toHaveText('Operational', { timeout: 10000 });
  await expect(page.locator('[data-overall-status]')).toContainText('All core systems operational');

  const response = await page.request.get('/api/status');
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ status: 'operational', reachable: true });
});

test('branding, protected pages, and music player remain intact', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  for (const route of ['/', '/twitch', '/cloudnord', '/vpn']) {
    await page.goto(route);
    await expect(page.locator('#taz-mix')).toHaveCount(1);
    await expect(page.locator('[data-volume]')).toHaveValue('25');
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  }
  await page.goto('/');
  const logo = page.locator('img[alt="Taz Elite logo"]').first();
  await expect(logo).toBeVisible();
  const logoMetrics = await logo.evaluate((image: HTMLImageElement) => ({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, fit: getComputedStyle(image).objectFit }));
  expect(logoMetrics.naturalWidth).toBeGreaterThan(0);
  expect(logoMetrics.naturalWidth / logoMetrics.naturalHeight).toBeCloseTo(1, 1);
  expect(logoMetrics.fit).toBe('contain');
});

test('music player stays audio-first and persists during internal navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const player = page.locator('#taz-mix');
  await expect(player).toHaveAttribute('data-astro-transition-persist', 'taz-mix');
  await expect(page.locator('.taz-mix__youtube')).toHaveCSS('left', '-10000px');
  await expect(page.locator('[data-volume]')).toHaveValue('25');
  const originalPlayer = await player.elementHandle();
  await page.locator('a[href="/about"]').first().click();
  await page.waitForURL('**/about');
  expect(await originalPlayer?.evaluate((element) => element.isConnected)).toBeTruthy();
  await expect(page.locator('#taz-mix')).toHaveCount(1);
});

test('reduced motion disables decorative looping effects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const animations = await page.evaluate(() => ({
    glow: getComputedStyle(document.querySelector('.site-effects__glow')!).animationName,
    hero: getComputedStyle(document.querySelector('.hero-frame img')!).animationName,
    cursor: getComputedStyle(document.querySelector('.site-effects__cursor')!).display
  }));
  expect(animations.glow).toBe('none');
  expect(animations.hero).toBe('none');
  expect(animations.cursor).toBe('none');
});
