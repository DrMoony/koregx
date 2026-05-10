import { createMcpServer } from '@drmoony/koregx-shared/mcp'
import { chainLawLifecycleTool } from './tools/chain-law-lifecycle'
import { chainNaturalQueryTool } from './tools/chain-natural-query'
import { getAdminRuleTool } from './tools/get-admin-rule'
import { getInterpretationTool } from './tools/get-interpretation'
import { getLawArticleTool } from './tools/get-law-article'
import { searchAdminRuleTool } from './tools/search-admin-rule'
import { searchHiraDecisionTool } from './tools/search-hira-decision'
import { searchInterpretationTool } from './tools/search-interpretation'
import { searchLawTool } from './tools/search-law'

const tools = [
  searchLawTool,
  searchInterpretationTool,
  searchAdminRuleTool,
  searchHiraDecisionTool,
  getLawArticleTool,
  getInterpretationTool,
  getAdminRuleTool,
  chainLawLifecycleTool,
  chainNaturalQueryTool, // 9th tool: LLM Q&A orchestrator
]

export function createKoRegXServer() {
  return createMcpServer({
    name: 'koregx',
    version: '0.2.1',
    tools,
  })
}
