import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { searchDrugTool } from './tools/search-drug'
import { getDrugTool } from './tools/get-drug'
import { chainDrugDossierTool } from './tools/chain-drug-dossier'

const tools = [searchDrugTool, getDrugTool, chainDrugDossierTool]
const toolByName = new Map(tools.map((t) => [t.name, t]))

export function createKoRegXServer() {
  const server = new Server(
    { name: 'koregx', version: '0.1.0' },
    { capabilities: { tools: {} } }
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

// Minimal Zod → JSON Schema converter for tool input descriptions
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
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
  if (schema instanceof z.ZodOptional) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return zodToJsonSchema((schema._def as any).innerType as z.ZodTypeAny)
  }
  if (schema instanceof z.ZodDefault) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return zodToJsonSchema((schema._def as any).innerType as z.ZodTypeAny)
  }
  return { type: 'string' }
}
