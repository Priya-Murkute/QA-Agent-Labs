import { test, expect } from '@playwright/test';

test('Playwright smoke test', async ({ page}) => {
    await page.goto('https://demo.playwright.dev/todomvc/');
    await expect(page).toHaveTitle(/TodoMVC/);
});