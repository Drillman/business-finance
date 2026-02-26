import { test, expect } from '@playwright/test'

const uniqueEmail = `e2e-auth-${Date.now()}@test.com`
const password = 'testpassword123'

test.describe('Authentication', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Connexion')).toBeVisible()
    await expect(page.getByPlaceholder('email@exemple.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  })

  test('shows register page', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText('Créer un compte')).toBeVisible()
    await expect(page.getByRole('button', { name: "S'inscrire" })).toBeVisible()
  })

  test('can navigate between login and register', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: "S'inscrire" }).click()
    await expect(page).toHaveURL('/register')

    await page.getByRole('link', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('register, login, and logout flow', async ({ page }) => {
    // Register
    await page.goto('/register')
    await page.getByPlaceholder('email@exemple.com').fill(uniqueEmail)
    await page.locator('input[autocomplete="new-password"]').first().fill(password)
    await page.locator('input[autocomplete="new-password"]').last().fill(password)
    await page.getByRole('button', { name: "S'inscrire" }).click()

    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 })

    // Logout - find logout button/link in the layout
    await page.getByRole('button', { name: /déconnexion/i }).click()

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })

    // Login with same credentials
    await page.getByPlaceholder('email@exemple.com').fill(uniqueEmail)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: 'Se connecter' }).click()

    // Should be back on dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 })
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('email@exemple.com').fill('nonexistent@test.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Se connecter' }).click()

    // Should show error message
    await expect(page.locator('.alert-error')).toBeVisible({ timeout: 5000 })
  })

  test('shows error for password mismatch on register', async ({ page }) => {
    await page.goto('/register')
    await page.getByPlaceholder('email@exemple.com').fill('mismatch@test.com')
    await page.locator('input[autocomplete="new-password"]').first().fill('password123')
    await page.locator('input[autocomplete="new-password"]').last().fill('differentpass')
    await page.getByRole('button', { name: "S'inscrire" }).click()

    await expect(page.getByText('Les mots de passe ne correspondent pas')).toBeVisible()
  })
})
