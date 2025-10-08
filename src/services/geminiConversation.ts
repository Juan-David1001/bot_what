/**
 * Servicio de conversación persistente con Gemini
 * Mantiene el historial de conversación para interacción continua
 * Usa Google Sheets como fuente de datos en vez de base de datos
 */

import { GoogleGenAI } from '@google/genai';
import { queryGemini } from './gemini';
import { queryGeminiWithSheets } from './geminiWithTools';
import { executeMCPTool, MCP_TOOLS_FOR_GEMINI, MCPToolCall } from './mcpClient';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationHistory {
  threadId: string;
  messages: ConversationMessage[];
}

// Almacén en memoria para historiales (en producción usar Redis o DB)
const conversations = new Map<string, ConversationHistory>();

/**
 * Inicializar o recuperar una conversación
 */
export function getOrCreateConversation(threadId: string): ConversationHistory {
  if (!conversations.has(threadId)) {
    console.log('getOrCreateConversation: creating new conversation for', threadId);
    conversations.set(threadId, {
      threadId,
      messages: [
        {
          role: 'assistant',
          content:
            'Hola, soy tu asistente virtual de la tienda. ¿En qué puedo ayudarte hoy? Recuerda que tu privacidad es importante para nosotros.',
        },
      ],
    });
  }
  console.log('getOrCreateConversation: returning conversation for', threadId);
  return conversations.get(threadId)!;
}

/**
 * Agregar mensaje del usuario a la conversación
 */
export function addUserMessage(threadId: string, content: string): void {
  const conversation = getOrCreateConversation(threadId);
  conversation.messages.push({ role: 'user', content });
  console.log('addUserMessage:', threadId, content.slice(0, 200));
}

/**
 * Agregar respuesta del asistente a la conversación
 */
export function addAssistantMessage(threadId: string, content: string): void {
  const conversation = getOrCreateConversation(threadId);
  conversation.messages.push({ role: 'assistant', content });
  console.log('addAssistantMessage:', threadId, content.slice(0, 200));
}

/**
 * Consultar Gemini con historial completo de conversación
 */
export async function queryGeminiWithHistory(
  threadId: string,
  userMessage: string,
  options?: { mode?: 'greeting' | 'service'; externalContext?: string; dbSchema?: string },
): Promise<string> {
  const conversation = getOrCreateConversation(threadId);

  // Agregar mensaje del usuario
  addUserMessage(threadId, userMessage);
  console.log('queryGeminiWithHistory: threadId=', threadId);
  console.log('queryGeminiWithHistory: userMessagePreview=', userMessage.slice(0, 300));

  // Build a single prompt combining system + history + user message
  const mode = options?.mode ?? 'service';

  const systemPrompt =
    mode === 'greeting'
      ? `Eres un asistente cordial y breve que da la bienvenida al usuario de forma amigable y discreta.`
      : `Eres un asistente profesional y discreto de una sex shop. Tu rol es:
- Atender consultas sobre productos de manera profesional y sin prejuicios
- Dar recomendaciones personalizadas según necesidades del cliente
- Proporcionar información sobre uso y cuidado de productos
- Mantener la privacidad y confidencialidad del cliente
- NO gestionar pagos ni facturación
- Clasificar la consulta en: producto, recomendacion, soporte_uso, queja_sugerencia`;

  const historyText = conversation.messages
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  let fullPrompt = `${systemPrompt}\n\nHistorial:\n${historyText}\n\nUsuario: ${userMessage}\n\nResponde de forma profesional y discreta:`;

  // Attach external context if provided (e.g., query results or product lists)
  if (options?.externalContext) {
    fullPrompt = `${fullPrompt}\n\nContexto externo:\n${options.externalContext}`;
  }

  // Attach DB schema for the assistant to understand the data model (only for first messages)
  if (options?.dbSchema) {
    fullPrompt = `${fullPrompt}\n\nBase de datos (esquema):\n${options.dbSchema}`;
  }

  try {
    console.log('queryGeminiWithHistory: calling Gemini with Google Sheets integration');
    
    // Usar queryGeminiWithSheets que consulta automáticamente Google Sheets según el mensaje
    const assistantResponse = await queryGeminiWithSheets(
      userMessage,
      historyText,
      systemPrompt,
    );
    
    console.log('queryGeminiWithHistory: assistantResponsePreview=', assistantResponse.slice(0, 400));
    addAssistantMessage(threadId, assistantResponse);
    return assistantResponse;
  } catch (error: any) {
    const errorMsg = `Error al procesar tu consulta: ${error.message}`;
    console.error('queryGeminiWithHistory: error', error);
    addAssistantMessage(threadId, errorMsg);
    throw error;
  }
}

/**
 * Obtener historial completo de conversación
 */
export function getConversationHistory(threadId: string): ConversationMessage[] {
  const conversation = conversations.get(threadId);
  return conversation?.messages ?? [];
}

/**
 * Limpiar conversación (al cerrar sesión)
 */
export function clearConversation(threadId: string): void {
  conversations.delete(threadId);
}

/**
 * Handoff state management
 * Mantiene en memoria si una sesión está en handoff y metadatos básicos
 */
interface HandoffState {
  inHandoff: boolean;
  agentId?: number | null;
  reason?: string | null;
  startedAt?: Date | null;
}

const handoffs = new Map<string, HandoffState>();

export function startHandoff(threadId: string, agentId?: number | null, reason?: string | null): void {
  handoffs.set(threadId, {
    inHandoff: true,
    agentId: agentId ?? null,
    reason: reason ?? null,
    startedAt: new Date(),
  });
  console.log('startHandoff: thread=', threadId, 'agentId=', agentId, 'reason=', reason);
}

export function endHandoff(threadId: string): void {
  const state = handoffs.get(threadId);
  if (!state) return;
  state.inHandoff = false;
  state.agentId = null;
  state.reason = null;
  state.startedAt = null;
  handoffs.set(threadId, state);
  console.log('endHandoff: thread=', threadId);
}

export function isInHandoff(threadId: string): boolean {
  const state = handoffs.get(threadId);
  return !!state && state.inHandoff === true;
}

/**
 * Detección simple de saludos para forzar modo greeting
 */
export function isGreeting(message: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase().trim();
  return /^(hola|buenas|buenos días|buenos dias|buenas tardes|buenas noches|hi|hello)\b/.test(m);
}

/**
 * Formatear la respuesta del asistente para WhatsApp (limpiar espacios, acortar si es muy larga)
 */
export function formatAssistantResponse(response: string): string {
  if (!response) return '';
  // Normalize line endings and trim
  let out = response.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // Optional: Limit to 4000 chars to avoid WhatsApp limits
  if (out.length > 4000) {
    out = out.slice(0, 3996) + '\n\n[...]';
  }
  return out;
}

/**
 * Clasificar automáticamente la consulta usando IA
 */
export function classifyConsultation(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('producto') ||
    lowerMessage.includes('precio') ||
    lowerMessage.includes('stock') ||
    lowerMessage.includes('disponible')
  ) {
    return 'producto';
  }

  if (
    lowerMessage.includes('recomiend') ||
    lowerMessage.includes('sugerir') ||
    lowerMessage.includes('cual') ||
    lowerMessage.includes('mejor')
  ) {
    return 'recomendacion';
  }

  if (
    lowerMessage.includes('como us') ||
    lowerMessage.includes('instruc') ||
    lowerMessage.includes('manual') ||
    lowerMessage.includes('funciona')
  ) {
    return 'soporte_uso';
  }

  if (
    lowerMessage.includes('queja') ||
    lowerMessage.includes('reclam') ||
    lowerMessage.includes('problema') ||
    lowerMessage.includes('sugerencia')
  ) {
    return 'queja_sugerencia';
  }

  return 'producto'; // default
}

/**
 * Query Gemini usando MCP tools con Function Calling
 * Esta es la nueva forma preferida de interactuar con Gemini
 */
export async function queryGeminiWithMCP(
  threadId: string,
  userMessage: string,
  options?: { mode?: 'greeting' | 'service' },
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const conversation = getOrCreateConversation(threadId);
  addUserMessage(threadId, userMessage);

  const mode = options?.mode ?? 'service';
  const systemPrompt =
    mode === 'greeting'
      ? `Eres un asistente cordial y breve que da la bienvenida al usuario de forma amigable y discreta.`
      : `Eres un asistente profesional y discreto de una sex shop. Tu rol es:
- Atender consultas sobre productos de manera profesional y sin prejuicios
- Dar recomendaciones personalizadas según necesidades del cliente
- Proporcionar información sobre uso y cuidado de productos
- Mantener la privacidad y confidencialidad del cliente
- Usar las herramientas disponibles para consultar productos e información del negocio
- Clasificar la consulta en: producto, recomendacion, soporte_uso, queja_sugerencia

IMPORTANTE: Cuando el usuario pregunte por productos, USA la herramienta search_products o get_products.`;

  const historyText = conversation.messages
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const fullPrompt = `${systemPrompt}

Historial de conversación:
${historyText}

Mensaje actual del cliente: ${userMessage}

Responde de forma profesional y discreta.`;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    console.log(`🤖 Procesando mensaje con detección inteligente de tools`);
    
    // Detección inteligente: detectar qué herramientas usar basándose en el mensaje
    const detectedTools = await detectRequiredTools(userMessage, historyText);
    
    if (detectedTools.length > 0) {
      console.log(`� Herramientas detectadas:`, detectedTools.map(t => t.name));
      
      // Ejecutar las herramientas detectadas
      const toolResults: any[] = [];
      for (const tool of detectedTools) {
        console.log(`  📞 Ejecutando: ${tool.name}`, tool.arguments);
        
        const result = await executeMCPTool({
          name: tool.name,
          arguments: tool.arguments,
        });
        
        console.log(`  ✅ Resultado:`, JSON.stringify(result).slice(0, 300));
        toolResults.push({
          tool: tool.name,
          result: result.data,
        });
      }
      
      // Agregar contexto de las herramientas al prompt
      const toolContext = `\n\nContexto obtenido de herramientas:\n${JSON.stringify(toolResults, null, 2)}`;
      const enhancedPrompt = fullPrompt + toolContext + '\n\nResponde usando esta información de forma natural y profesional.';
      
      const result: any = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: enhancedPrompt,
      });
      
      const finalText = result?.text || 
                        result?.candidates?.[0]?.content?.parts?.[0]?.text ||
                        'Lo siento, no pude procesar tu consulta.';
      
      console.log('queryGeminiWithMCP: finalResponse=', finalText.slice(0, 400));
      addAssistantMessage(threadId, finalText);
      return formatAssistantResponse(finalText);
      
    } else {
      // Sin herramientas, respuesta directa
      console.log('📝 Sin herramientas necesarias, respuesta directa');
      
      const result: any = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: fullPrompt,
      });
      
      const finalText = result?.text || 
                        result?.candidates?.[0]?.content?.parts?.[0]?.text ||
                        'Lo siento, no pude procesar tu consulta.';
      
      console.log('queryGeminiWithMCP: finalResponse=', finalText.slice(0, 400));
      addAssistantMessage(threadId, finalText);
      return formatAssistantResponse(finalText);
    }
    
  } catch (error: any) {
    console.error('Error en queryGeminiWithMCP:', error?.message || error);
    const errorMsg = 'Lo siento, hubo un error al procesar tu consulta. Por favor intenta de nuevo.';
    addAssistantMessage(threadId, errorMsg);
    return errorMsg;
  }
}

/**
 * Detectar qué herramientas MCP se necesitan basándose en el mensaje del usuario
 */
async function detectRequiredTools(
  message: string,
  history: string,
): Promise<Array<{ name: string; arguments: any }>> {
  const lowerMessage = message.toLowerCase();
  const tools: Array<{ name: string; arguments: any }> = [];

  // Detección de búsqueda de productos
  if (
    lowerMessage.includes('producto') ||
    lowerMessage.includes('catálogo') ||
    lowerMessage.includes('catalogo') ||
    lowerMessage.includes('qué tienes') ||
    lowerMessage.includes('que tienes') ||
    lowerMessage.includes('qué vendes') ||
    lowerMessage.includes('que vendes') ||
    lowerMessage.includes('disponible') ||
    lowerMessage.includes('stock')
  ) {
    // Si menciona algo específico, buscar
    if (
      lowerMessage.includes('lubricante') ||
      lowerMessage.includes('vibrador') ||
      lowerMessage.includes('anillo') ||
      lowerMessage.includes('kit')
    ) {
      const searchTerms = lowerMessage.match(/\b(lubricante|vibrador|anillo|kit)\w*/gi);
      const query = searchTerms ? searchTerms[0] : '';
      tools.push({ name: 'search_products', arguments: { query } });
    } else {
      // Catálogo general
      tools.push({ name: 'get_products', arguments: {} });
    }
  }

  // Detección de información del negocio
  if (
    lowerMessage.includes('horario') ||
    lowerMessage.includes('dirección') ||
    lowerMessage.includes('direccion') ||
    lowerMessage.includes('ubicación') ||
    lowerMessage.includes('ubicacion') ||
    lowerMessage.includes('teléfono') ||
    lowerMessage.includes('telefono') ||
    lowerMessage.includes('contacto') ||
    lowerMessage.includes('envío') ||
    lowerMessage.includes('envio') ||
    lowerMessage.includes('pago') ||
    lowerMessage.includes('devolución') ||
    lowerMessage.includes('devolucion') ||
    lowerMessage.includes('política') ||
    lowerMessage.includes('politica')
  ) {
    tools.push({ name: 'get_business_info', arguments: {} });
  }

  // Detección de intención de compra/orden (CLARA Y ESPECÍFICA)
  const purchaseKeywords = [
    'lo quiero',
    'lo compro',
    'me lo llevo',
    'donde lo recojo',
    'dónde lo recojo',
    'donde puedo recoger',
    'dónde puedo recoger',
    'como pago',
    'cómo pago',
    'donde pago',
    'dónde pago',
    'hacer el pago',
    'realizar el pago',
    'procesar el pedido',
    'confirmar la compra',
    'comprar el',
    'comprar la',
  ];

  const hasPurchaseIntent = purchaseKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Si menciona un producto específico O pregunta por proceso de compra
  if (hasPurchaseIntent || (lowerMessage.includes('comprar') && (lowerMessage.includes('donde') || lowerMessage.includes('dónde') || lowerMessage.includes('como') || lowerMessage.includes('cómo')))) {
    console.log('💰 Intención de compra CLARA detectada - Gemini manejará handoff');
    // No agregamos tool, pero el sistema sabrá que debe hacer handoff
    // Gemini responderá indicando transferencia a agente humano
  }

  return tools;
}
