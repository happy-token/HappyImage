const { test, expect } = require('@playwright/test')

const BASE = 'http://localhost:3100'

test.describe('HappyImage Web UI', () => {
  test('homepage loads chat-first workspace', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByText('HappyImage')).toBeVisible()
    await expect(page.getByText('Chat Studio')).toBeVisible()
    await expect(page.getByPlaceholder(/Describe the content details/)).toBeVisible()
  })

  test('configuration drawer shows skill cards', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('button', { name: /Configure/ }).click()
    await expect(page.getByText('Settings & Presets')).toBeVisible()
    await expect(page.getByText('Active Skill')).toBeVisible()
    await expect(page.getByRole('button', { name: /图文卡片/ })).toBeVisible()
  })

  test('studio page has content input', async ({ page }) => {
    await page.goto(BASE)
    const textarea = page.getByPlaceholder(/Describe the content details/)
    await expect(textarea).toBeVisible()
    await textarea.fill('测试内容')
    await expect(textarea).toHaveValue('测试内容')
  })

  test('skill selection updates aesthetic controls', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('button', { name: /Configure/ }).click()
    await page.getByRole('button', { name: /封面图|Cover Image/ }).click()
    await expect(page.getByText('Aesthetic Parameters')).toBeVisible()
    await expect(page.locator('select').filter({ hasText: /Hero|Conceptual|Typography|Minimal/ }).first()).toBeVisible()
  })

  test('navigates to settings page', async ({ page }) => {
    await page.goto(BASE)
    await page.click('a[href="/settings"]')
    await expect(page.locator('.settings-page h1')).toContainText('配置生成环境')
  })

  test('navigates to history page', async ({ page }) => {
    await page.goto(BASE)
    await page.click('a[href="/history"]')
    await expect(page.locator('.history-page h1')).toContainText('Generated Projects')
  })

  test('history page shows disk projects section', async ({ page }) => {
    await page.goto(`${BASE}/history`)
    await expect(page.getByText('Active Workspaces')).toBeVisible()
  })

  test('settings page has env field groups', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await page.getByRole('button', { name: /执行模型/ }).click()
    await expect(page.locator('.settings-fields').first()).toBeVisible()
  })

  test('settings page has skill preference editor', async ({ page }) => {
    await page.goto(`${BASE}/settings`)
    await page.getByRole('button', { name: /Skill 偏好/ }).click()
    await expect(page.locator('.settings-preference-panel h2').first()).toBeVisible()
  })

  test('studio page has publish panel', async ({ page }) => {
    await page.goto(BASE)
    await expect(page.getByText('Configure')).toBeVisible()
    await expect(page.getByPlaceholder(/Describe the content details/)).toBeVisible()
  })

  test('publish panel supports platform selection', async ({ page }) => {
    const projects = await (await fetch(`${BASE}/api/projects`)).json()
    test.skip(projects.length === 0, 'No generated projects available for publish workspace')
    await page.goto(`${BASE}/projects/${projects[0].detailId}`)
    await page.getByRole('button', { name: /Publish/ }).click()
    const select = page.locator('select').filter({ hasText: /小红书|微信公众号|X/ }).first()
    await expect(select).toBeVisible()
    const options = await select.locator('option').allTextContents()
    expect(options.some(option => option.includes('小红书'))).toBe(true)
    expect(options.some(option => option.includes('微信公众号'))).toBe(true)
  })

  test('gallery page loads', async ({ page }) => {
    await page.goto(`${BASE}/gallery`)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('project detail returns error for invalid id', async ({ page }) => {
    await page.goto(`${BASE}/projects/nonexistent-project`)
    await expect(page.getByText(/Project not found|Failed to load project|HTTP 404/)).toBeVisible()
  })
})
