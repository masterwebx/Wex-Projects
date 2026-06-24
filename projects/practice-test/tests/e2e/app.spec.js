import { test, expect } from '@playwright/test';

async function waitForAppReady(page) {
  await page.goto('/#home');
  await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
}

test.describe('Practice Test app', () => {
  test('home loads with primary actions', async ({ page }) => {
    await waitForAppReady(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: "Start today's practice" })).toBeVisible();
    await expect(page.getByRole('link', { name: /Review mistakes/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /New questions/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Study' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Practice' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mock Exam' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Progress' }).first()).toBeVisible();
    await expect(page.locator('.readiness-card')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Take a mock exam →' })).toHaveCount(0);
  });

  test('navigation routes render expected pages', async ({ page }) => {
    await waitForAppReady(page);

    await page.goto('/#study');
    await expect(page.locator('#app')).toContainText('Study');
    await expect(page.locator('#study-category')).toBeVisible();

    await page.goto('/#practice?setup=1');
    await expect(page.locator('#app')).toContainText('Practice');
    await expect(page.locator('#toggle-setup-btn')).toBeVisible();

    await page.goto('/#progress');
    await expect(page.locator('#app')).toContainText('Progress');
    await expect(page.locator('.readiness-card')).toBeVisible();

    await page.goto('/#exam');
    await expect(page.locator('#app')).toContainText('Mock exam');
    await expect(page.locator('#start-exam-btn')).toBeVisible();

    await page.goto('/#questions');
    await expect(page.locator('#app')).toContainText('My Questions');

    await page.goto('/#add');
    await expect(page.locator('#app')).toContainText('Add Question');

    await page.goto('/#help');
    await expect(page.locator('#app')).toContainText('How this app works');
  });

  test('practice setup shows options when expanded', async ({ page }) => {
    await page.goto('/#practice?setup=1');
    await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
    await expect(page.locator('.practice-setup-grid')).toBeVisible();
    await expect(page.locator('[data-size="custom"]')).toBeVisible();
  });

  test('mock exam timer does not tick during countdown', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#exam?start=1&timer=60');
    const overlay = page.locator('.session-countdown-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const timer = page.locator('#exam-timer');
    await expect(timer).toBeHidden();
    const first = await timer.textContent();
    await page.waitForTimeout(1100);
    const second = await timer.textContent();
    expect(first).toBe(second);
    await expect(overlay).toHaveCount(0, { timeout: 8000 });
    await expect(timer).toBeVisible();
    await expect(timer).toHaveText(/^60:00$|^59:5\d$|^59:4\d$/);
  });

  test('mock exam selects an answer and enables next', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#exam?start=1&timer=60');
    await expect(page.locator('.session-countdown-overlay')).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('#exam-next-btn')).toBeDisabled();
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('.option-btn').first().click();
    await expect(page.locator('.option-btn.option-selected')).toHaveCount(1);
    await expect(page.locator('#exam-hint')).toContainText('Answer selected');
    await expect(page.locator('#exam-next-btn')).toBeEnabled();

    await page.locator('#exam-next-btn').click();
    await expect(page.locator('#exam-counter')).toContainText('Question 2');
  });

  test('practice session answers a question and shows feedback', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#practice?quick=1');
    await expect(page.locator('.session-countdown-overlay')).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('.option-btn').first().click();
    await expect(page.locator('#answer-feedback.is-visible')).toBeVisible();
    await expect(page.locator('#next-btn')).toBeEnabled();
  });

  test('import page loads with format help', async ({ page }) => {
    await page.goto('/#import');
    await expect(page.locator('#app')).not.toContainText('Loading...', { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Import');
    await expect(page.locator('.import-format-help')).toBeVisible();
  });

  test('exam setup shows scope, timer presets, and history', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#exam');
    await expect(page.locator('#exam-category')).toBeVisible();
    await expect(page.locator('#exam-shuffle')).toBeVisible();
    await expect(page.locator('#exam-count-options')).toHaveCount(0);
    await expect(page.locator('[data-timer="0"]')).toHaveCount(0);
    await expect(page.locator('#exam-history-heading')).toContainText('Previous mock exams');
  });

  test('footer shows app version', async ({ page }) => {
    await waitForAppReady(page);
    await expect(page.locator('#app-version')).toContainText('v1.0.0');
  });

  test('practice setup shows mock exam history', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#practice?setup=1');
    await expect(page.locator('#exam-history-heading')).toContainText('Previous mock exams');
  });

  test('custom practice session size can be set', async ({ page }) => {
    await waitForAppReady(page);
    await page.goto('/#practice?setup=1');
    await expect(page.locator('.practice-setup-grid')).toBeVisible();
    await page.waitForTimeout(500);
    await page.locator('[data-size="custom"]').click();
    await expect(page.locator('#setup-size-custom')).toBeVisible();
    await page.locator('#setup-size-custom').fill('15');
    await expect(page.locator('#setup-size-custom')).toHaveValue('15');
  });
});
