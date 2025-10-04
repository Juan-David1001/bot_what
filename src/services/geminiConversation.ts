/**
 * Servicio de conversación persistente con Gemini
 * Mantiene el historial de conversación para interacción continua
 */

import { queryGeminiChat } from './gemini';

interface ConversationMessage {
  role: 'user' | 'model'; // Gemini usa 'model' en lugar de 'assistant'
  content: string;
}

interface ConversationHistory {
  threadId: string;
  messages: ConversationMessage[];
  systemPrompt: string;
  schemaSent?: boolean;
  mode?: 'bot' | 'human';
  assignedAgentId?: string | null;
  handoffReason?: string | null;
}

// Almacén en memoria para historiales (en producción usar Redis o DB)
const conversations = new Map<string, ConversationHistory>();

// Prompt base del sistema para el asistente. Indica claramente el dominio (sex shop)
const SYSTEM_PROMPT = `Eres un asistente profesional y amable de la sex shop "Euforia Erotismo a tú alcance
🍒Lencería 🔥s€x shop
🛵Domicilios 🇨🇴envíos Nacionales
📞 (57) 313 744 7166
calle 49#50-31, San Pedro de los Milagros" en línea. Tu rol es:

- Atender consultas sobre productos de manera profesional
- Dar recomendaciones personalizadas según las necesidades del cliente
- Proporcionar información sobre uso, características y disponibilidad de productos
- Mantener la privacidad y confidencialidad del cliente
- Ser breve y conciso en tus respuestas (máximo 2-3 párrafos)
- NO gestionar pagos ni facturación directamente

Responde siempre en español de forma natural y conversacional.

REGLAS CRÍTICAS:
1. Los datos del catálogo (nombres exactos, precios, disponibilidad) vienen EXCLUSIVAMENTE de la sección "Contexto externo".
2. NUNCA inventes productos, precios o disponibilidad que no estén en el "Contexto externo".
3. PUEDES y DEBES usar tu conocimiento general para:
   - Explicar características técnicas y beneficios de los productos del catálogo
   - Dar recomendaciones de uso, cuidado y limpieza
   - Sugerir combinaciones de productos
   - Responder dudas sobre seguridad y materiales
   - Ofrecer información educativa sobre productos similares
4. Combina datos exactos del catálogo con tu conocimiento para dar respuestas completas y útiles.
5. Si no hay "Contexto externo" o está vacío, indica que no encontraste información específica en el catálogo pero puedes dar orientación general si el usuario pregunta sobre un tipo de producto.
6. Devuelve siempre texto plano (sin bloques de código ni JSON) y sin explicaciones técnicas.
7. NO uses negritas, asteriscos, guiones de Markdown, encabezados, ni formato Markdown alguno. Devuelve solo texto plano.
8. NO empieces respuestas con saludos adicionales si la conversación ya está en curso; responde directamente a la pregunta del usuario, a menos que el usuario haya saludado explícitamente y sea la primera interacción.
9. Si el "Contexto externo" comienza con la línea 'NO_EXACT_MATCH', interpreta que no hay coincidencias exactas. En ese caso:
  - Responde de forma empática y útil, NO repitas literalmente "No se encontraron resultados".
  - Ofrece alternativas concretas (productos similares, categorías relevantes o productos populares) usando la información incluida en el "Contexto externo".
  - Si no hay alternativas en el catálogo, ofrece orientación general, sugiere términos de búsqueda o pregunta por preferencias (material, tamaño, intensidad).

FORMATO DE SALIDA REQUERIDO (usar exactamente este estilo):

- Cuando el usuario pide productos (lista):
  - Encabezado breve (1 línea) que indique cuántos resultados se muestran.
  - Lista numerada (1. ... 2. ...), máximo 5 productos.
  - Cada elemento en la lista debe tener: Nombre — Precio — Disponibilidad — Descripción corta (máx 100 caracteres).
  - Finalizar con una línea de cierre que ofrezca ayuda adicional: "¿Quieres ver más detalles o enlaces de algún producto?"

Ejemplo:
Resultados (3):
1. Vibrador Classic — $29.99 — Disponible — Vibrador clásico, silicona, 3 velocidades.
2. Lubricante water-based 100ml — $9.99 — Disponible — Lubricante a base de agua, fórmula suave.
3. Anillo vibrador — $19.99 — Agotado — Anillo con vibración para parejas, recargable.

¿Quieres que te muestre más detalles o enlaces de algún producto?

- Cuando el usuario pide categorías:
  - Lista con viñetas de las categorías disponibles.
Ejemplo:
Categorías disponibles:
- juguetes
- lubricantes
- lenceria

¿En cuál de estas categorías quieres que busque?

- Si no hay resultados:
  - Mensaje claro: "No se encontraron resultados para tu consulta en el catálogo. ¿Quieres que busque con otro término?"

Cumple estrictamente este formato para facilitar su presentación en WhatsApp.
`;

// Prompts parametrizados según el tipo de interacción
const GREETING_PROMPT = `Eres un asistente amigable y cálido de Euforia. Saluda al cliente con una bienvenida corta que mencione el nombre de la tienda (Euforia) y ofrece ayuda. Mantén un tono muy cordial y profesional.`;

const SERVICE_PROMPT = `Eres un asistente profesional y directo para atención al cliente. Contesta la consulta de forma precisa y útil, ofreciendo recomendaciones si aplica. Mantén la privacidad del cliente.`;

function isGreetingText(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  return /^(hola|buenas|buenos días|buenos dias|buenas tardes|buenas noches|buen día|buen dia|buenas)$/i.test(t) || /\b(hola|buenas|buenos días|buenos dias|buen día|buen dia)\b/.test(t);
}

/**
 * Inicializar o recuperar una conversación
 * @param dbSchema - Schema de la base de datos (solo se pasa en primera inicialización)
 */
export function getOrCreateConversation(threadId: string, dbSchema?: string): ConversationHistory {
  if (!conversations.has(threadId)) {
    console.log('getOrCreateConversation: nueva conversación', threadId);
    
    // Construir system prompt con schema de DB para primera sesión
    let enhancedPrompt = SYSTEM_PROMPT;
    if (dbSchema) {
      enhancedPrompt = `${SYSTEM_PROMPT}

CONTEXTO INICIAL DE LA SESIÓN:
Eres asistente de una sex shop. Tienes acceso al catálogo completo de productos a través de consultas SQL.

${dbSchema}

CAPACIDADES ESPECIALES:
1. Cuando el usuario pregunte por productos, se ejecutará automáticamente una consulta SQL para obtener datos reales del catálogo.
2. Recibirás los resultados en la sección "Contexto externo" y debes usarlos EXACTAMENTE como vienen.
3. Además de los datos del catálogo, puedes usar tu conocimiento general sobre productos similares para:
   - Explicar mejor el uso y beneficios
   - Dar recomendaciones de cuidado y limpieza
   - Sugerir combinaciones de productos
   - Responder dudas sobre características técnicas
   - Ofrecer consejos de uso seguro

IMPORTANTE: Combina la información exacta del catálogo (nombres, precios, disponibilidad) con tu conocimiento para dar respuestas completas y útiles.`;
    }
    
    conversations.set(threadId, {
      threadId,
      systemPrompt: enhancedPrompt,
      messages: [],
      schemaSent: dbSchema ? false : true,
    });
  }
  return conversations.get(threadId)!;
}

/**
 * Agregar mensaje del usuario a la conversación
 */
export function addUserMessage(threadId: string, content: string): void {
  const conversation = getOrCreateConversation(threadId);
  conversation.messages.push({ role: 'user', content });
  console.log('addUserMessage:', threadId, content.slice(0, 100));
}

/**
 * Agregar respuesta del asistente a la conversación
 */
export function addAssistantMessage(threadId: string, content: string): void {
  const conversation = getOrCreateConversation(threadId);
  conversation.messages.push({ role: 'model', content });
  console.log('addAssistantMessage:', threadId, content.slice(0, 100));
}

/**
 * Consultar Gemini con historial completo de conversación usando API nativa de chat
 */
export async function queryGeminiWithHistory(
  threadId: string,
  userMessage: string,
  options?: { mode?: 'greeting' | 'service'; externalContext?: string; dbSchema?: string },
): Promise<string> {
  const conversation = getOrCreateConversation(threadId, options?.dbSchema);

  // Si la conversación está en handoff a humano, no generar respuesta automática
  if (conversation.mode === 'human') {
    const msg = 'La conversación ha sido transferida a un agente humano. Tu mensaje será atendido por un operador.';
    console.log(`queryGeminiWithHistory: thread=${threadId} en handoff, bot no responde.`);
    addAssistantMessage(threadId, msg);
    return msg;
  }

  // Agregar mensaje del usuario
  addUserMessage(threadId, userMessage);
  console.log('queryGeminiWithHistory:', threadId, 'msg:', userMessage.slice(0, 100));

  try {
    // Determinar modo: greeting vs service. Se puede forzar con options.mode
    const forceMode = options?.mode;
    const isGreetingMsg =
      forceMode === 'greeting' ||
      (forceMode !== 'service' && !conversation.schemaSent && conversation.messages.length <= 1 && isGreetingText(userMessage));

    const geminiMessages: Array<{ role: 'user' | 'model'; parts: string }> = [];

    if (isGreetingMsg) {
      // Primer mensaje de bienvenida — usar prompt de saludo específico
      geminiMessages.push({ role: 'user', parts: GREETING_PROMPT + '\n\n' + userMessage });
    } else {
      // Modo servicio — construir historial completo y añadir el nuevo mensaje
      // En el PRIMER mensaje de servicio (después del saludo), incluir el system prompt con DB schema
      // En mensajes subsecuentes, solo incluir el contexto externo si existe
      // Si el schema aún no fue enviado para esta conversación, incluir system prompt completo (con DB schema si se proporcionó)
      if (!conversation.schemaSent) {
        const external = options?.externalContext ? '\n\nContexto externo:\n' + options.externalContext : '';
        geminiMessages.push({ role: 'user', parts: conversation.systemPrompt + external });
        // Marcar que ya enviamos el schema para no repetirlo
        conversation.schemaSent = true;
      } else {
        // Mensajes subsecuentes: sólo contexto externo si existe, sin repetir system prompt
        if (options?.externalContext) {
          geminiMessages.push({ role: 'user', parts: 'Contexto externo:\n' + options.externalContext });
        }
      }
      
      for (const msg of conversation.messages) {
        geminiMessages.push({ role: msg.role, parts: msg.content });
      }
      geminiMessages.push({ role: 'user', parts: userMessage });
    }

    console.log('queryGeminiWithHistory: enviando', geminiMessages.length, 'mensajes a Gemini (greeting=', isGreetingMsg, ')');
    const assistantResponse = await queryGeminiChat(geminiMessages, process.env.GEMINI_MODEL ?? 'gemini-2.5-flash');

  console.log('queryGeminiWithHistory: respuesta cruda:', assistantResponse.slice(0, 200));
  // Sanitizar respuesta para eliminar markdown no deseado
  const cleaned = sanitizeResponse(assistantResponse);
  console.log('queryGeminiWithHistory: respuesta limpiada:', cleaned.slice(0, 200));
  addAssistantMessage(threadId, cleaned);
  return cleaned;
  } catch (error: any) {
    const errorMsg = 'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?';
    console.error('queryGeminiWithHistory: error', error?.message ?? error);
    addAssistantMessage(threadId, errorMsg);
    return errorMsg;
  }
}

export { isGreetingText as isGreeting };

// Handoff helpers: pasar conversación a humano y volver al bot
export function startHandoff(threadId: string, agentId?: string | null, reason?: string) {
  const conv = getOrCreateConversation(threadId);
  conv.mode = 'human';
  conv.assignedAgentId = agentId ?? null;
  conv.handoffReason = reason ?? null;
  console.log(`startHandoff: thread=${threadId} agent=${agentId} reason=${reason}`);
}

export function endHandoff(threadId: string) {
  const conv = getOrCreateConversation(threadId);
  conv.mode = 'bot';
  conv.assignedAgentId = null;
  conv.handoffReason = null;
  console.log(`endHandoff: thread=${threadId}`);
}

export function isInHandoff(threadId: string): boolean {
  const conv = conversations.get(threadId);
  return !!(conv && conv.mode === 'human');
}

/**
 * Elimina formatos Markdown simples (**, *, _, headings) y normaliza saltos de línea
 */
export function sanitizeResponse(text: string): string {
  if (!text) return text;
  let s = text;
  // Remove fenced code blocks
  s = s.replace(/```[\s\S]*?```/g, '');
  // Remove bold **text** and italics *text* and underscores
  s = s.replace(/\*\*(.*?)\*\*/gs, '$1');
  s = s.replace(/\*(.*?)\*/gs, '$1');
  s = s.replace(/__(.*?)__/gs, '$1');
  s = s.replace(/_(.*?)_/gs, '$1');
  // Remove markdown headings
  s = s.replace(/^#{1,6}\s*/gm, '');
  // Replace multiple blank lines with two
  s = s.replace(/\n{3,}/g, '\n\n');
  // Remove tab characters
  s = s.replace(/\t+/g, ' ');
  // Collapse multiple spaces
  s = s.replace(/ {2,}/g, ' ');
  // Trim
  s = s.trim();
  return s;
}

/**
 * Formatea la respuesta para mejorar presentación en WhatsApp:
 * - Normaliza saltos de línea
 * - Agrega emojis por secciones (preguntas, seguridad, características, limpieza, etc.)
 * - Quita sangrías y tabulaciones
 */
export function formatAssistantResponse(text: string): string {
  if (!text) return text;
  // Primero sanitizamos marcas y exceso de espacios
  let s = sanitizeResponse(text);

  // Detectar tablas Markdown de comparación y convertirlas a formato amigable de chat
  function parseTableToComparison(input: string): string | null {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Keep only lines that contain '|' and are not just separators
    const tableLines = lines.filter((l) => l.includes('|'));
    if (tableLines.length < 2) return null;

    // Normalize: remove possible leading/trailing pipes
    const rows = tableLines.map((l) => {
      let row = l;
      if (row.startsWith('|')) row = row.slice(1);
      if (row.endsWith('|')) row = row.slice(0, -1);
      return row.split('|').map((c) => c.trim());
    });

    // Detect header row and separator (like ---)
    const header = rows[0];
    const hasSeparator = rows[1] && rows[1].every((cell) => /^:?-{2,}:?$/.test(cell));
    const dataRows = hasSeparator ? rows.slice(2) : rows.slice(1);
    if (header.length < 2 || dataRows.length === 0) return null;

    // Build comparison text
    const title = header.slice(1).join(' vs ');
    let out = `🔎 Comparación: ${title}\n\n`;
    for (const r of dataRows) {
      const key = r[0] || 'Característica';
      out += `• ${key}\n`;
      for (let i = 1; i < header.length; i++) {
        const pName = header[i] || `Producto ${i}`;
        const cell = r[i] ?? '-';
        // Shorten long cell content
        const cellText = cell.length > 220 ? cell.slice(0, 217) + '...' : cell;
        out += `  - ${pName}: ${cellText}\n`;
      }
      out += `\n`;
    }
    return out.trim();
  }

  const tableConverted = parseTableToComparison(s);
  if (tableConverted) {
    // Use converted table as starting text to format further
    s = tableConverted;
  }

  // Normalizar saltos de línea a doble salto entre párrafos
  s = s.replace(/\n{2,}/g, '\n\n');

  // Dividir por líneas y procesar cada una
  const lines = s.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detectar título de producto (línea corta en mayúsculas o Title Case)
    if (/^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚñáéíóúü0-9\s\-]{2,60}$/.test(line) && line.split(' ').length <= 5) {
      out.push(`🔹 ${line}`);
      continue;
    }

    // Preguntas (¿ ... ?)
    if (/^¿.*\?$/.test(line) || /^\?.*\?$/.test(line)) {
      out.push(`❓ ${line}`);
      continue;
    }

    // Secciones comunes con emojis
    const lower = line.toLowerCase();
    if (lower.startsWith('seguridad') || lower.includes('seguridad') || lower.includes('salud')) {
      out.push(`🛡️ ${line}`);
      continue;
    }
    if (lower.includes('suavidad') || lower.includes('suave') || lower.includes('tacto')) {
      out.push(`🤍 ${line}`);
      continue;
    }
    if (lower.includes('durabil') || lower.includes('duradero') || lower.includes('durabilidad')) {
      out.push(`⏳ ${line}`);
      continue;
    }
    if (lower.includes('limpiar') || lower.includes('limpieza') || lower.includes('higién')) {
      out.push(`🧼 ${line}`);
      continue;
    }
    if (lower.includes('lubricant') || lower.includes('lubricant') || lower.includes('lubricant')) {
      out.push(`💧 ${line}`);
      continue;
    }
    if (lower.includes('veloc') || lower.includes('modo') || lower.includes('vibracion') || lower.includes('velocidades')) {
      out.push(`⚡ ${line}`);
      continue;
    }
    if (lower.includes('diseñ') || lower.includes('ergon') || lower.includes('diseño')) {
      out.push(`🎯 ${line}`);
      continue;
    }

    // CTA final
    if (i === lines.length - 1 && /\b(duda|pregunta|ayuda|¿|quieres)\b/i.test(line)) {
      out.push(`❓ ${line}`);
      continue;
    }

    // Por defecto, mantener la línea
    out.push(line);
  }

  // Reunir en párrafos: separar con doble salto de línea cada bloque detectado
  // Además, unir líneas cortas que pertenecen a la misma idea
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const ln of out) {
    // Si la línea es un título o empieza con emoji, considera nueva línea
    if (/^[^a-z0-9]/i.test(ln) || ln.startsWith('🔹')) {
      if (current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
      }
      paragraphs.push(ln);
      continue;
    }
    // Si la línea está en mayúscula inicial y corta, también separa
    if (ln.length < 60 && /^[A-ZÁÉÍÓÚÑ]/.test(ln)) {
      if (current.length > 0) {
        paragraphs.push(current.join(' '));
        current = [];
      }
      paragraphs.push(ln);
      continue;
    }
    current.push(ln);
  }
  if (current.length > 0) paragraphs.push(current.join(' '));

  // Unir párrafos con doble salto
  const finalText = paragraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return finalText;
}

/**
 * Obtener historial completo de conversación
 */
export function getConversationHistory(threadId: string): Array<{ role: string; content: string }> {
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
