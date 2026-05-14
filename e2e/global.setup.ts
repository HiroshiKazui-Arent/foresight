import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const authFile = path.join(__dirname, '.auth/user.json')

setup('ログイン済み状態を保存する', async ({ page }) => {
  const dir = path.dirname(authFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill('admin@example.com')
  await page.getByLabel('パスワード').fill('password123')
  await page.getByRole('button', { name: 'サインイン' }).click()

  await expect(page).toHaveURL('/projects', { timeout: 15000 })

  await page.context().storageState({ path: authFile })
})
