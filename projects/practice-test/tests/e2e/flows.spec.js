import { test, expect } from '@playwright/test';

async function waitForAppReady(page) {
  await page.goto('/#home');
  await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
}

test.describe('Extended app flows', () => {
  test('progress page shows exam readiness and calendar', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#progress');
    await expect(page.locator('.simple-stats')).toBeVisible();
    await expect(page.locator('.readiness-card')).toBeVisible();
    await expect(page.locator('#readiness-heading')).toContainText('Exam readiness');
    await expect(page.locator('.readiness-score-num')).toBeVisible();
    await expect(page.locator('.readiness-table')).toBeVisible();
    await expect(page.locator('.activity-calendar')).toBeVisible();
    await expect(page.locator('.category-compact-list')).toBeVisible();
    await expect(page.locator('#category-progress-heading')).toContainText('By category');
  });

  test('study page lists questions with correct answer marked', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#study');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Study');
    await expect(page.locator('#study-category')).toBeVisible();
    await expect(page.locator('.study-option-correct').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.study-option-tag').first()).toContainText('Correct');
  });

  test('onboarding can be dismissed', async ({ page }) => {
    await waitForAppReady(page);
    const overlay = page.locator('.onboarding-overlay');
    if (await overlay.isVisible()) {
      await page.waitForTimeout(500);
      await page.locator('#dismiss-onboarding').click();
      await expect(overlay).toHaveCount(0);
    }
  });

  test('backup settings page loads with merge option', async ({ page }) => {
    await page.goto('/#backup');
    await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Backup');
    await expect(page.locator('input[value="merge"]')).toBeVisible();
    await expect(page.locator('#export-btn')).toBeVisible();
  });

  test('browse questions supports search', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#questions');
    await expect(page.locator('#browse-search')).toBeVisible({ timeout: 15_000 });
    await page.locator('#browse-search').fill('venipuncture');
    await expect(page.locator('.browse-item, .browse-item-compact').first()).toBeVisible();
  });

  test('mistakes drill starts a session immediately', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#practice?focus=mistakes');
    await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
    const inSession = page.locator('.practice-session .option-btn, .practice-session #question-area');
    const empty = page.locator('.setup-warning, .empty-state');
    await expect(inSession.or(empty).first()).toBeVisible({ timeout: 15_000 });
    if (await page.locator('.practice-session').isVisible()) {
      await expect(page.locator('#start-practice-btn')).toHaveCount(0);
      await expect(page.locator('.session-countdown-overlay')).toHaveCount(0, { timeout: 6000 });
      await expect(page.locator('.option-btn').first()).toBeVisible();
    }
  });

  test('category mock exam completes with results', async ({ page }) => {
    await waitForAppReady(page);
    const category = encodeURIComponent('Specimen collection');
    await page.goto(`/#exam?start=1&timer=60&category=${category}`);
    await expect(page.locator('.session-countdown-overlay')).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 15_000 });

    for (let i = 0; i < 16; i++) {
      await page.locator('.option-btn').first().click();
      const nextBtn = page.locator('#exam-next-btn');
      await expect(nextBtn).toBeEnabled();
      await nextBtn.click();
    }

    await expect(page.locator('.exam-complete, .session-complete')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.session-review-list')).toBeVisible();
    await expect(page.locator('.exam-time-line')).toBeVisible();

    await page.goto('/#exam');
    await expect(page.locator('#exam-history-heading')).toContainText('Previous mock exams');
    await expect(page.locator('.exam-history-row-link').first()).toBeVisible({ timeout: 10_000 });
  });

  test('add question form includes explanation field', async ({ page }) => {
    await page.goto('/#add');
    await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
    await expect(page.locator('textarea[name="explanation"]')).toBeVisible();
  });

  test('practice shows explanation after answering', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#practice?quick=1');
    await expect(page.locator('.session-countdown-overlay')).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('.option-btn').first().click();
    await expect(page.locator('#answer-explanation, .question-explanation').first()).toBeVisible();
  });

  test('active nav link has aria-current', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#exam');
    await expect(page.locator('.nav-link[data-route="exam"]')).toHaveAttribute('aria-current', 'page');
  });

  test('manage tests page loads', async ({ page }) => {
    await page.goto('/#tests');
    await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
