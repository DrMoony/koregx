import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { searchLawTool } from './tools/search-law'
import { searchInterpretationTool } from './tools/search-interpretation'
import { searchAdminRuleTool } from './tools/search-admin-rule'
import { searchHiraDecisionTool } from './tools/search-hira-decision'
import { getLawArticleTool } from './tools/get-law-article'
import { getInterpretationTool } from './tools/get-interpretation'
import { getAdminRuleTool } from './tools/get-admin-rule'
import { chainLawLifecycleTool } from './tools/chain-law-lifecycle'

const tools = [
  searchLawTool,
  searchInterpretationTool,
  searchAdminRuleTool,
  searchHiraDecisionTool,
  getLawArticleTool,
  getInterpretationTool,
  getAdminRuleTool,
  chainLawLifecycleTool,
]
const toolByName = new Map(tools.map((t) => [t.name, t]))

export function createKoRegXServer() {
  const server = new Server(
    { name: 'koregx', version: '0.2.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const tool = toolByName.get(name)
    if (!tool) throw new Error(`unknown tool: ${name}`)
    const parsed = tool.inputSchema.parse(args ?? {})
    const result = await tool.execute(parsed as never)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  })

  return server
}

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [key, value] of Object.entries(schema.shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny)
      const v = value as z.ZodTypeAny
      if (!(v instanceof z.ZodOptional) && !(v instanceof z.ZodDefault)) {
        required.push(key)
      }
    }
    return { type: 'object', properties, required }
  }
  if (schema instanceof z.ZodString) return { type: 'string', description: schema.description }
  if (schema instanceof z.ZodNumber) return { type: 'number', description: schema.description }
  if (schema instanceof z.ZodBoolean) return { type: 'boolean', description: schema.description }
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options, description: schema.description }
  if (schema instanceof z.ZodOptional)
    return zodToJsonSchema(
      (schema._def as unknown as { innerType: z.ZodTypeAny }).innerType,
    )
  if (schema instanceof z.ZodDefault)
    return zodToJsonSchema(
      (schema._def as unknown as { innerType: z.ZodTypeAny }).innerType,
    )
  return { type: 'string' }
}
