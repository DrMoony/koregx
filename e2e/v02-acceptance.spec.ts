import { test, expect } from '@playwright/test'

test.describe('Acceptance: v0.2 (law + interpretation + admin-rule + decision)', () => {
  test('home page shows stats dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'KoRegX' })).toBeVisible()
    // Stat labels rendered as divs inside links — check by text content
    await expect(page.locator('.text-xs.text-muted-foreground', { hasText: '법령' }).first()).toBeVisible()
    await expect(page.locator('.text-xs.text-muted-foreground', { hasText: '행정해석' }).first()).toBeVisible()
    await expect(page.locator('.text-xs.text-muted-foreground', { hasText: '행정규칙' }).first()).toBeVisible()
    await expect(page.locator('.text-xs.text-muted-foreground', { hasText: 'HIRA 결정' }).first()).toBeVisible()
  })

  test('/laws shows 약사법 in list', async ({ page }) => {
    await page.goto('/laws')
    await expect(page.getByRole('heading', { name: '한국 헬스케어 법령' })).toBeVisible()
    await expect(page.getByText('약사법').first()).toBeVisible()
  })

  test('navigates to law detail and article', async ({ page }) => {
    await page.goto('/laws')
    await page.getByText('약사법', { exact: false }).first().click()
    await expect(page).toHaveURL(/\/laws\//)
    await expect(page.getByText('조문', { exact: false })).toBeVisible()
    // click first article link
    const firstArticle = page.getByText(/제\d+조/, { exact: false }).first()
    await firstArticle.click()
    await expect(page).toHaveURL(/\/articles\//)
    await expect(page.getByRole('heading', { name: /관련 법제처 행정해석/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /관련 행정규칙/ })).toBeVisible()
  })

  test('/interpretations search returns results', async ({ page }) => {
    await page.goto('/interpretations?q=약사법')
    await expect(page.getByRole('heading', { name: '법제처 행정해석' })).toBeVisible()
    // Should have at least one result with 약사법
    const results = page.locator('a').filter({ hasText: '약사법' })
    expect(await results.count()).toBeGreaterThan(0)
  })

  test('/admin-rules search returns results', async ({ page }) => {
    await page.goto('/admin-rules?q=의약품')
    await expect(page.getByRole('heading', { name: '행정규칙 (고시·예규·훈령)' })).toBeVisible()
  })

  test('/decisions filter by 약평위 works', async ({ page }) => {
    await page.goto('/decisions?body=dbc')
    await expect(page.getByRole('heading', { name: 'HIRA 결정' })).toBeVisible()
    await expect(page.getByText('약평위').first()).toBeVisible()
  })

  test('MCP tools/list returns 9 tools', async ({ request }) => {
    const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3300'
    const res = await request.post(`${baseURL}/api/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(res.ok()).toBe(true)
    const text = await res.text()
    let data: { result?: { tools?: Array<{ name: string }> } }
    if (text.startsWith('event:') || text.includes('data: ')) {
      const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
      data = JSON.parse(dataLine!.slice(6))
    } else {
      data = JSON.parse(text)
    }
    const tools = data.result?.tools ?? []
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual([
      'chain_law_lifecycle',
      'chain_natural_query',
      'get_admin_rule',
      'get_interpretation',
      'get_law_article',
      'search_admin_rule',
      'search_hira_decision',
      'search_interpretation',
      'search_law',
    ])
  })

  test('MCP chain_law_lifecycle 약사법 1조 returns dossier', async ({ request }) => {
    const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3300'
    const res = await request.post(`${baseURL}/api/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'chain_law_lifecycle',
          arguments: { lawShortName: '약사법', articleNo: '1' },
        },
      },
    })
    expect(res.ok()).toBe(true)
    const text = await res.text()
    let data: { result?: { content?: Array<{ text: string }> } }
    if (text.startsWith('event:') || text.includes('data: ')) {
      const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
      data = JSON.parse(dataLine!.slice(6))
    } else {
      data = JSON.parse(text)
    }
    const content = data.result?.content?.[0]?.text ?? ''
    expect(content).toContain('matched')
    expect(content).toContain('true')
    expect(content).toContain('약사법')
  })

  test('MCP search_interpretation 약사법 returns results', async ({ request }) => {
    const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3300'
    const res = await request.post(`${baseURL}/api/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_interpretation',
          arguments: { query: '약사법' },
        },
      },
    })
    expect(res.ok()).toBe(true)
    const text = await res.text()
    let data: { result?: { content?: Array<{ text: string }> } }
    if (text.startsWith('event:') || text.includes('data: ')) {
      const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
      data = JSON.parse(dataLine!.slice(6))
    } else {
      data = JSON.parse(text)
    }
    const content = data.result?.content?.[0]?.text ?? ''
    expect(content).toContain('items')
    expect(content).toContain('total')
  })
})
