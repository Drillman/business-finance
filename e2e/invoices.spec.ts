import { test, expect } from './fixtures/auth'

test.describe('Invoice Management', () => {
  test('navigates to invoices page', async ({ authenticatedPage: page }) => {
    await page.getByRole('link', { name: /factures/i }).first().click()
    await expect(page).toHaveURL('/invoices')
  })

  test('creates a new invoice', async ({ authenticatedPage: page }) => {
    await page.goto('/invoices')

    // Open create modal
    await page.getByRole('button', { name: /nouvelle facture|ajouter/i }).click()

    // Fill out the form
    await page.locator('input[name="client"], [placeholder*="client"]').first().fill('E2E Test Client')
    await page.locator('input[name="amountHt"], input[type="number"]').first().fill('1000')

    // Submit
    await page.getByRole('button', { name: /créer|ajouter|enregistrer/i }).click()

    // Should see the invoice in the list
    await expect(page.getByText('E2E Test Client')).toBeVisible({ timeout: 5000 })
  })

  test('shows invoice summary', async ({ authenticatedPage: page }) => {
    await page.goto('/invoices')

    // The summary section should be visible with financial data
    await expect(page.locator('text=/CA|Chiffre/i')).toBeVisible({ timeout: 5000 })
  })
})
