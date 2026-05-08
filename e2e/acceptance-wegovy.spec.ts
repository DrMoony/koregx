import { test, expect } from '@playwright/test'

test.describe('Acceptance: Wegovy 한국 허가 dossier', () => {
  test('search → click → detail page shows MFDS approval', async ({ page }) => {
    await page.goto('/search?q=위고비')
    await expect(page.getByText(/위고비/i).first()).toBeVisible()
    await page.getByText(/위고비/i).first().click()
    await expect(page).toHaveURL(/\/drug\//)
    // The detail page shows a "허가 (Approvals)" heading section
    await expect(page.getByRole('heading', { name: /허가/ })).toBeVisible()
    await expect(page.getByText('KR').first()).toBeVisible()
    await expect(page.getByText('MFDS')).toBeVisible()
  })

  test('MCP chain_drug_dossier returns 위고비 (matched)', async ({ request }) => {
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
          name: 'chain_drug_dossier',
          arguments: { query: '위고비' },
        },
      },
    })
    expect(res.ok()).toBe(true)
    const text = await res.text()
    // MCP Streamable HTTP returns SSE-style "data: {json}" lines
    let result: unknown
    if (text.startsWith('event:') || text.includes('data: ')) {
      const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) throw new Error(`no data line in SSE response: ${text.slice(0, 200)}`)
      result = JSON.parse(dataLine.slice(6))
    } else {
      result = JSON.parse(text)
    }
    const r = result as { result?: { content?: Array<{ text: string }> } }
    const content = r.result?.content?.[0]?.text ?? ''
    expect(content).toContain('matched')
    expect(content).toContain('true')
    expect(content).toContain('위고비')
    expect(content).toContain('Semaglutide')
  })

  test('MCP tools/list returns 3 tools (search_drug, get_drug, chain_drug_dossier)', async ({ request }) => {
    const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3300'
    const res = await request.post(`${baseURL}/api/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      },
    })
    expect(res.ok()).toBe(true)
    const text = await res.text()
    let result: unknown
    if (text.startsWith('event:') || text.includes('data: ')) {
      const dataLine = text.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) throw new Error(`no data line in SSE response`)
      result = JSON.parse(dataLine.slice(6))
    } else {
      result = JSON.parse(text)
    }
    const r = result as { result?: { tools?: Array<{ name: string }> } }
    const tools = r.result?.tools ?? []
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(['chain_drug_dossier', 'get_drug', 'search_drug'])
  })
})
