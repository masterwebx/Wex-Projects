import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 };

async function waitForAppReady(page) {
  await page.goto('/#home');
  await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
}

test.describe('Mobile layout', () => {
  test.use({ viewport: MOBILE });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('onboardingComplete', '1');
    });
  });

  test('hamburger opens, navigates, and closes', async ({ page }) => {
    await waitForAppReady(page);

    const menuBtn = page.locator('#nav-menu-toggle');
    await expect(menuBtn).toBeVisible();

    const panel = page.locator('#nav-links-panel');
    await expect(panel).not.toBeVisible();

    await menuBtn.click();
    await expect(panel).toBeVisible();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

    await panel.getByRole('link', { name: 'My Questions' }).click();
    await expect(page.locator('#app')).toContainText('My Questions');
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('home has no horizontal overflow', async ({ page }) => {
    await waitForAppReady(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expect(page.getByRole('link', { name: "Start today's practice" })).toBeVisible();
  });

  test('browse page stacks filters on mobile', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#questions');
    await expect(page.locator('#app')).toContainText('My Questions');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('progress readiness card visible on mobile', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#progress');
    await expect(page.locator('.readiness-card')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test('practice setup usable on mobile', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#practice?setup=1');
    await expect(page.locator('#app')).toContainText('Practice');
    await expect(page.locator('#toggle-setup-btn')).toBeVisible();
  });
});
