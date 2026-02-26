import { test as base, expect, type Page } from '@playwright/test'

const TEST_EMAIL = `e2e-${Date.now()}@test.com`
const TEST_PASSWORD = 'testpassword123'

async function registerUser(page: Page) {
  await page.goto('/register')
  await page.getByPlaceholder('email@exemple.com').fill(TEST_EMAIL)
  await page.locator('input[autocomplete="new-password"]').first().fill(TEST_PASSWORD)
  await page.locator('input[autocomplete="new-password"]').last().fill(TEST_PASSWORD)
  await page.getByRole('button', { name: "S'inscrire" }).click()
  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/', { timeout: 10000 })
}

async function loginUser(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('email@exemple.com').fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL('/', { timeout: 10000 })
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Try to register, if user exists, login instead
    try {
      await registerUser(page)
    } catch {
      await loginUser(page)
    }
    await use(page)
  },
})

export { expect, TEST_EMAIL, TEST_PASSWORD }
