import { expect, test } from '@playwright/test';

const widths = [320, 360, 375, 390, 412, 768, 1024, 1280, 1440, 1920];
const auditRoutes = ['/', '/discord', '/youtube', '/tiktok', '/instagram', '/contact'];

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
  expect(labels.map((label) => label.replace('↗', '').trim())).toEqual(['Home', 'About', 'Experience', 'Projects', 'Discord', 'Twitch', 'TikTok', 'YouTube', 'Instagram', 'Contact', 'Game Hosting', 'VPN']);
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
  await expect(page.locator('[data-twitch-error]')).toBeVisible();
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
