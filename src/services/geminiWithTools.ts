/**
 * Servicio de Gemini con acceso a Google Sheets
 * Gemini consultará Google Sheets de forma manual en el flujo (sin function calling nativo por limitaciones de API)
 */

import { queryGemini } from './gemini';
import {
  getProducts,
  searchProducts,
  getBusinessInfo,
  formatProductsForGemini,
  formatBusinessInfoForGemini,
} from './googleSheets';

/**
 * Detectar si el mensaje del usuario requiere consultar productos
 */
function needsProductInfo(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const productKeywords = [
    'producto',
    'productos',
    'catálogo',
    'catalogo',
    'qué tienen',
    'que tienen',
    'qué tienes',
    'que tienes',
    'disponible',
    'disponibles',
    'precio',
    'precios',
    'stock',
    'inventario',
    'vibrador',
    'lubricante',
    'juguete',
    'juguetes',
    'recomendar',
    'recomienda',
    'busco',
    'necesito',
    'quiero comprar',
    'me interesa',
  ];

  return productKeywords.some((keyword) => lowerMessage.includes(keyword));
}

/**
 * Detectar si el mensaje requiere información del negocio
 */
function needsBusinessInfo(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const infoKeywords = [
    'horario',
    'horarios',
    'dirección',
    'direccion',
    'ubicación',
    'ubicacion',
    'dónde',
    'donde',
    'local',
    'tienda',
    'envío',
    'envio',
    'pago',
    'pagos',
    'método',
    'metodo',
    'política',
    'politica',
    'políticas',
    'politicas',
  ];

  return infoKeywords.some((keyword) => lowerMessage.includes(keyword));
}

/**
 * Extraer término de búsqueda de productos del mensaje
 */
function extractSearchQuery(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Palabras clave de búsqueda específica
  const searchPatterns = [
    /busco?\s+(.+)/i,
    /necesito\s+(.+)/i,
    /quiero\s+(.+)/i,
    /me\s+interesa\s+(.+)/i,
    /tienes?\s+(.+)\?/i,
    /hay\s+(.+)\?/i,
  ];

  for (const pattern of searchPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Consultar Gemini con acceso a datos de Google Sheets
 * Detecta automáticamente si necesita consultar productos o info del negocio
 */
export async function queryGeminiWithSheets(
  userMessage: string,
  conversationHistory?: string,
  systemInstruction?: string,
): Promise<string> {
  console.log('🤖 queryGeminiWithSheets: analyzing message...');

  let contextData = '';

  try {
    // Detectar si necesita información del negocio
    if (needsBusinessInfo(userMessage)) {
      console.log('📋 Fetching business info from Google Sheets...');
      const info = await getBusinessInfo();
      const formatted = formatBusinessInfoForGemini(info);
      contextData += `\n\n=== INFORMACIÓN DEL NEGOCIO ===\n${formatted}\n`;
    }

    // Detectar si necesita información de productos
    if (needsProductInfo(userMessage)) {
      const searchQuery = extractSearchQuery(userMessage);

      if (searchQuery) {
        console.log(`� Searching products for: "${searchQuery}"`);
        const products = await searchProducts(searchQuery);
        const formatted = formatProductsForGemini(products);
        contextData += `\n\n=== PRODUCTOS ENCONTRADOS (búsqueda: "${searchQuery}") ===\n${formatted}\n`;
      } else {
        console.log('� Fetching all products from Google Sheets...');
        const products = await getProducts();
        const limited = products.slice(0, 10); // Limitar a 10 para no saturar el contexto
        const formatted = formatProductsForGemini(limited);
        contextData += `\n\n=== CATÁLOGO DE PRODUCTOS (mostrando primeros 10) ===\n${formatted}\n`;
      }
    }
  } catch (error: any) {
    console.error('❌ Error fetching data from Google Sheets:', error?.message);
    contextData += '\n\n[Error: No se pudo obtener información actualizada de Google Sheets]\n';
  }

  // Construir el prompt completo
  const systemPrompt =
    systemInstruction ||
    `Eres un asistente profesional y discreto de una sex shop llamada Euforia. 
Tu rol es atender consultas de forma amable, profesional y sin prejuicios.
Usa la información del catálogo y del negocio proporcionada para responder.
Mantén la privacidad y confidencialidad del cliente.
NO gestiones pagos ni facturación directamente.`;

  const fullPrompt = `${systemPrompt}

${conversationHistory || ''}

${contextData}

Usuario: ${userMessage}

Asistente:`;

  console.log('📝 Prompt length:', fullPrompt.length);
  console.log('💬 Calling Gemini API...');

  const response = await queryGemini(fullPrompt);

  console.log('✅ Response received from Gemini');

  return response;
}
