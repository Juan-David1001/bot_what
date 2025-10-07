/**
 * MCP Server - Model Context Protocol Server
 * Proporciona herramientas (tools) para que Gemini consulte y actualice Google Sheets
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import {
  getProducts,
  searchProducts,
  getBusinessInfo,
  formatProductsForGemini,
  formatBusinessInfoForGemini,
  getSessions,
  getSession,
  getActiveSession,
  upsertSession,
  closeSession as closeSes,
  startHandoffInSheet,
  endHandoffInSheet,
  getActiveHandoffs,
  Session,
} from './googleSheets';

// Definir las herramientas disponibles
const TOOLS: Tool[] = [
  {
    name: 'get_products',
    description:
      'Obtiene la lista completa de productos disponibles en la tienda desde Google Sheets. Use esta herramienta cuando el usuario pregunte por el catálogo, productos disponibles, inventario o qué productos hay.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_products',
    description:
      'Busca productos específicos por nombre, categoría, descripción o tags en Google Sheets. Use esta herramienta cuando el usuario busque productos específicos con palabras clave (ej: "vibrador", "lubricante", "principiantes").',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Término de búsqueda para encontrar productos',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_business_info',
    description:
      'Obtiene información del negocio como horarios, dirección, políticas de envío, métodos de pago, etc. desde Google Sheets. Use esta herramienta cuando el usuario pregunte sobre la tienda, horarios, ubicación, envíos o políticas.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_active_session',
    description:
      'Obtiene la sesión activa de un contacto por número de teléfono. Use esta herramienta para verificar si existe una conversación activa.',
    inputSchema: {
      type: 'object',
      properties: {
        contactNumber: {
          type: 'string',
          description: 'Número de teléfono del contacto',
        },
      },
      required: ['contactNumber'],
    },
  },
  {
    name: 'create_or_update_session',
    description:
      'Crea una nueva sesión o actualiza una existente en Google Sheets. Use esta herramienta para registrar conversaciones.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID único de la sesión',
        },
        contactNumber: {
          type: 'string',
          description: 'Número de teléfono del contacto',
        },
        contactAlias: {
          type: 'string',
          description: 'Alias o nombre del contacto',
        },
        status: {
          type: 'string',
          enum: ['active', 'closed'],
          description: 'Estado de la sesión',
        },
      },
      required: ['sessionId', 'contactNumber'],
    },
  },
  {
    name: 'start_handoff',
    description:
      'Inicia un handoff (transferencia a agente humano) para una sesión. Use esta herramienta cuando se necesite intervención humana (pagos, validaciones, quejas complejas).',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID de la sesión',
        },
        reason: {
          type: 'string',
          description: 'Razón del handoff (ej: payment_proof, complex_query)',
        },
        agentId: {
          type: 'string',
          description: 'ID del agente asignado (opcional)',
        },
      },
      required: ['sessionId', 'reason'],
    },
  },
  {
    name: 'end_handoff',
    description:
      'Finaliza un handoff y devuelve el control al bot. Use esta herramienta cuando el agente humano haya terminado la atención.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID de la sesión',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'get_active_handoffs',
    description:
      'Obtiene todas las sesiones que están actualmente en handoff (atendidas por agentes humanos).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Crear el servidor MCP
const server = new Server(
  {
    name: 'euforia-sheets-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler: Listar herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handler: Ejecutar herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.log(`🔧 MCP Tool called: ${name}`, args);

  try {
    switch (name) {
      case 'get_products': {
        const products = await getProducts();
        const formatted = formatProductsForGemini(products);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: products.length,
                products: products.slice(0, 10), // Limitar a 10 para evitar sobrecarga
                formatted,
              }),
            },
          ],
        };
      }

      case 'search_products': {
        const query = (args as any).query || '';
        const products = await searchProducts(query);
        const formatted = formatProductsForGemini(products);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                query,
                count: products.length,
                products,
                formatted,
              }),
            },
          ],
        };
      }

      case 'get_business_info': {
        const info = await getBusinessInfo();
        const formatted = formatBusinessInfoForGemini(info);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                info,
                formatted,
              }),
            },
          ],
        };
      }

      case 'get_active_session': {
        const contactNumber = (args as any).contactNumber || '';
        const session = await getActiveSession(contactNumber);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                session,
                exists: !!session,
              }),
            },
          ],
        };
      }

      case 'create_or_update_session': {
        const sessionData = args as Partial<Session>;
        const session = await upsertSession(sessionData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                session,
              }),
            },
          ],
        };
      }

      case 'start_handoff': {
        const { sessionId, reason, agentId } = args as any;
        await startHandoffInSheet(sessionId, reason, agentId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Handoff started successfully',
                sessionId,
              }),
            },
          ],
        };
      }

      case 'end_handoff': {
        const { sessionId } = args as any;
        await endHandoffInSheet(sessionId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Handoff ended successfully',
                sessionId,
              }),
            },
          ],
        };
      }

      case 'get_active_handoffs': {
        const handoffs = await getActiveHandoffs();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: handoffs.length,
                handoffs,
              }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    console.error(`❌ Error executing tool ${name}:`, error?.message);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error?.message || 'Tool execution failed',
          }),
        },
      ],
      isError: true,
    };
  }
});

// Iniciar el servidor MCP
async function startMCPServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('🚀 MCP Server started successfully');
  console.log('📋 Available tools:', TOOLS.length);
}

// Exportar para uso programático
export { server, startMCPServer, TOOLS };

// Si se ejecuta directamente, iniciar servidor
if (require.main === module) {
  startMCPServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
