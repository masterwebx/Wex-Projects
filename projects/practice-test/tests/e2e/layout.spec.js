import { test, expect } from '@playwright/test';

async function waitForAppReady(page) {
  await page.goto('/#home');
  await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
}

test.describe('Layout regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('onboardingComplete', '1');
    });
  });

  test('medium-width nav stays on one row', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await waitForAppReady(page);

    await expect(page.locator('#test-selector')).toHaveCount(0);

    const layout = await page.evaluate(() => {
      const top = document.querySelector('.nav-top');
      const theme = document.getElementById('theme-toggle');
      const links = document.querySelector('.nav-links-panel');
      const brand = document.querySelector('.nav-brand');
      const topRect = top.getBoundingClientRect();
      const themeRect = theme.getBoundingClientRect();
      const linksRect = links.getBoundingClientRect();
      const brandRect = brand.getBoundingClientRect();
      return {
        topHeight: Math.round(topRect.height),
        themeY: Math.round(themeRect.top),
        linksY: Math.round(linksRect.top),
        brandY: Math.round(brandRect.top),
      };
    });

    expect(layout.topHeight).toBeLessThan(72);
    expect(Math.abs(layout.themeY - layout.linksY)).toBeLessThan(8);
    expect(Math.abs(layout.brandY - layout.linksY)).toBeLessThan(8);
  });

  test('mobile practice options have equal height and fill width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#practice?quick=1');
    await expect(page.locator('.session-countdown-overlay')).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('.practice-session .option-btn').first()).toBeVisible({
      timeout: 15_000,
    });

    const metrics = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.practice-session .option-btn')];
      const list = document.querySelector('.practice-session .options-list');
      const listRect = list.getBoundingClientRect();
      const heights = buttons.map((btn) => Math.round(btn.getBoundingClientRect().height));
      const maxBtnWidth = Math.max(...buttons.map((btn) => btn.getBoundingClientRect().width));
      return {
        heights,
        listWidth: Math.round(listRect.width),
        maxBtnWidth: Math.round(maxBtnWidth),
        listHeight: Math.round(listRect.height),
      };
    });

    expect(metrics.heights).toHaveLength(4);
    const minHeight = Math.min(...metrics.heights);
    const maxHeight = Math.max(...metrics.heights);
    expect(maxHeight - minHeight).toBeLessThanOrEqual(2);
    expect(metrics.maxBtnWidth / metrics.listWidth).toBeGreaterThan(0.95);
    expect(metrics.listHeight).toBeGreaterThan(180);
  });

  test('desktop practice options fill the 2x2 grid', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#practice?quick=1');
    await expect(page.locator('.session-countdown-overlay')).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('.practice-session .option-btn').first()).toBeVisible({
      timeout: 15_000,
    });

    const metrics = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.practice-session .option-btn')];
      const list = document.querySelector('.practice-session .options-list');
      const listRect = list.getBoundingClientRect();
      const heights = buttons.map((btn) => Math.round(btn.getBoundingClientRect().height));
      const rowTop = Math.min(...buttons.map((btn) => btn.getBoundingClientRect().top));
      const rowBottom = Math.max(...buttons.map((btn) => btn.getBoundingClientRect().bottom));
      const usedHeight = Math.round(rowBottom - rowTop);
      return {
        heights,
        listHeight: Math.round(listRect.height),
        usedHeight,
        columns: new Set(buttons.map((btn) => Math.round(btn.getBoundingClientRect().left))).size,
      };
    });

    expect(metrics.heights).toHaveLength(4);
    expect(metrics.columns).toBe(2);
    const [a, b, c, d] = metrics.heights;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
    expect(Math.abs(c - d)).toBeLessThanOrEqual(2);
    expect(metrics.usedHeight / metrics.listHeight).toBeGreaterThan(0.9);
  });
});
