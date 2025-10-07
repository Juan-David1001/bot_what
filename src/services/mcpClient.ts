/**
 * Cliente MCP simplificado para integración con Gemini
 * Permite ejecutar tools del MCP Server de forma local
 */

import {
  getProducts,
  searchProducts,
  getBusinessInfo,
  formatProductsForGemini,
  formatBusinessInfoForGemini,
  getActiveSession,
  upsertSession,
  startHandoffInSheet,
  endHandoffInSheet,
  getActiveHandoffs,
  logMessage,
  getSessionMessages,
  createOrder,
  getOrders,
  Session,
} from './googleSheets';

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Ejecutar una herramienta MCP localmente
 */
export async function executeMCPTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
  const { name, arguments: args } = toolCall;

  console.log(`🔧 Executing MCP tool: ${name}`, args);

  try {
    switch (name) {
      case 'get_products': {
        const products = await getProducts();
        const formatted = formatProductsForGemini(products.slice(0, 10));
        return {
          success: true,
          data: {
            count: products.length,
            products: products.slice(0, 10),
            formatted,
          },
        };
      }

      case 'search_products': {
        const query = args.query || '';
        const products = await searchProducts(query);
        const formatted = formatProductsForGemini(products);
        return {
          success: true,
          data: {
            query,
            count: products.length,
            products,
            formatted,
          },
        };
      }

      case 'get_business_info': {
        const info = await getBusinessInfo();
        const formatted = formatBusinessInfoForGemini(info);
        return {
          success: true,
          data: {
            info,
            formatted,
          },
        };
      }

      case 'get_active_session': {
        const contactNumber = args.contactNumber || '';
        const session = await getActiveSession(contactNumber);
        return {
          success: true,
          data: {
            session,
            exists: !!session,
          },
        };
      }

      case 'create_or_update_session': {
        const sessionData = args as Partial<Session>;
        const session = await upsertSession(sessionData);
        return {
          success: true,
          data: { session },
        };
      }

      case 'start_handoff': {
        const { sessionId, reason, agentId } = args;
        await startHandoffInSheet(sessionId, reason, agentId);
        return {
          success: true,
          data: {
            message: 'Handoff started successfully',
            sessionId,
          },
        };
      }

      case 'end_handoff': {
        const { sessionId } = args;
        await endHandoffInSheet(sessionId);
        return {
          success: true,
          data: {
            message: 'Handoff ended successfully',
            sessionId,
          },
        };
      }

      case 'get_active_handoffs': {
        const handoffs = await getActiveHandoffs();
        return {
          success: true,
          data: {
            count: handoffs.length,
            handoffs,
          },
        };
      }

      case 'get_session_messages': {
        const { sessionId } = args;
        const messages = await getSessionMessages(sessionId);
        return {
          success: true,
          data: {
            count: messages.length,
            messages,
          },
        };
      }

      case 'create_order': {
        const order = await createOrder(args);
        return {
          success: true,
          data: { order },
        };
      }

      case 'get_orders': {
        const { contactNumber } = args;
        const orders = await getOrders(contactNumber);
        return {
          success: true,
          data: {
            count: orders.length,
            orders,
          },
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    console.error(`❌ Error executing tool ${name}:`, error?.message);
    return {
      success: false,
      error: error?.message || 'Tool execution failed',
    };
  }
}

/**
 * Definiciones de herramientas para Gemini Function Calling
 */
export const MCP_TOOLS_FOR_GEMINI = [
  {
    name: 'get_products',
    description:
      'Obtiene la lista de productos disponibles en la tienda. Use cuando el usuario pregunte por el catálogo o productos.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_products',
    description:
      'Busca productos específicos por palabras clave. Use cuando el usuario busque productos con términos específicos.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'Término de búsqueda',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_business_info',
    description:
      'Obtiene información del negocio: horarios, dirección, políticas. Use cuando pregunten sobre la tienda.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_active_session',
    description: 'Verifica si existe una sesión activa para un contacto.',
    parameters: {
      type: 'object' as const,
      properties: {
        contactNumber: {
          type: 'string' as const,
          description: 'Número de teléfono',
        },
      },
      required: ['contactNumber'],
    },
  },
  {
    name: 'start_handoff',
    description:
      'Transfiere la conversación a un agente humano. Use cuando se necesite intervención manual.',
    parameters: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string' as const,
          description: 'ID de la sesión',
        },
        reason: {
          type: 'string' as const,
          description: 'Razón del handoff',
        },
      },
      required: ['sessionId', 'reason'],
    },
  },
  {
    name: 'get_session_messages',
    description: 'Obtiene el historial de mensajes de una sesión.',
    parameters: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string' as const,
          description: 'ID de la sesión',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'create_order',
    description: 'Crea una orden de compra para el cliente.',
    parameters: {
      type: 'object' as const,
      properties: {
        sessionId: {
          type: 'string' as const,
          description: 'ID de la sesión',
        },
        contactNumber: {
          type: 'string' as const,
          description: 'Número de contacto',
        },
        total: {
          type: 'number' as const,
          description: 'Total de la orden',
        },
        items: {
          type: 'string' as const,
          description: 'Items de la orden (JSON string)',
        },
        shippingAddress: {
          type: 'string' as const,
          description: 'Dirección de envío',
        },
        paymentMethod: {
          type: 'string' as const,
          description: 'Método de pago',
        },
      },
      required: ['sessionId', 'contactNumber', 'total', 'items'],
    },
  },
  {
    name: 'get_orders',
    description: 'Obtiene las órdenes de un cliente.',
    parameters: {
      type: 'object' as const,
      properties: {
        contactNumber: {
          type: 'string' as const,
          description: 'Número de contacto',
        },
      },
      required: ['contactNumber'],
    },
  },
];
