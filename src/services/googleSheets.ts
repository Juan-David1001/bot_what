/**
 * Servicio para interactuar con Google Sheets API
 * Lee datos de las hojas "informacion" y "productos" del spreadsheet del negocio
 */

import { google } from 'googleapis';
import path from 'path';

const SPREADSHEET_ID = '1p79w-78L2WOVp8qiomaCvTpe-iEyN714eaR3gIc_0Ec';

// Nombres exactos de las hojas (case-sensitive según listSheets.ts)
const BUSINESS_INFO_SHEET = 'Informacion'; // Información del negocio (Campo | Valor)
const PRODUCTS_SHEET = 'Productos'; // Catálogo de productos
const SESSIONS_SHEET = 'Estado_Contactos'; // Estados de sesiones y handoff
const MESSAGES_SHEET = 'Mensajes'; // Log de mensajes
const ORDERS_SHEET = 'Ordenes'; // Gestión de pedidos

// Inicializar cliente de autenticación con credenciales de servicio
let sheets: any = null;

async function getAuthClient() {
  try {
    const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                        path.join(process.cwd(), 'gen-lang-client-0594774333-95a18bb02c4b.json');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return await auth.getClient();
  } catch (error) {
    console.error('Error initializing Google Sheets auth:', error);
    throw error;
  }
}

async function initializeSheets() {
  if (!sheets) {
    const auth = await getAuthClient();
    sheets = google.sheets({ version: 'v4', auth: auth as any });
    console.log('✅ Google Sheets API initialized');
  }
  return sheets;
}

/**
 * Leer datos de la hoja "informacion"
 * Contiene: horarios, dirección, políticas, etc.
 */
export async function getBusinessInfo(): Promise<any[]> {
  try {
    const api = await initializeSheets();
    
    const response = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BUSINESS_INFO_SHEET}!A:B`,
    });

    const rows = response.data.values || [];
    console.log('📋 Business info retrieved:', rows.length, 'rows');
    
    // Convertir a objeto clave-valor
    const info: any = {};
    for (const row of rows) {
      if (row.length >= 2) {
        const key = row[0]?.toString().trim();
        const value = row[1]?.toString().trim();
        if (key) {
          info[key] = value;
        }
      }
    }
    
    return rows;
  } catch (error) {
    console.error('Error reading business info from Google Sheets:', error);
    throw error;
  }
}

/**
 * Leer datos de la hoja "productos"
 * Contiene: nombre, categoría, precio, descripción, stock, etc.
 */
export async function getProducts(): Promise<any[]> {
  try {
    const api = await initializeSheets();
    
    const response = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PRODUCTS_SHEET}!A:Z`,
    });

    const rows = response.data.values || [];
    console.log('🛍️ Products retrieved:', rows.length - 1, 'products (excluding header)');
    
    if (rows.length === 0) {
      return [];
    }

    // Primera fila son los headers
    const headers = rows[0].map((h: any) => h?.toString().toLowerCase().trim());
    const products = [];

    // Convertir cada fila en objeto
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const product: any = {};
      
      for (let j = 0; j < headers.length && j < row.length; j++) {
        const header = headers[j];
        const value = row[j]?.toString().trim();
        
        if (header && value) {
          // Conversión de tipos para campos numéricos
          if (header === 'precio' || header === 'price') {
            product[header] = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          } else if (header === 'stock' || header === 'cantidad') {
            product[header] = parseInt(value.replace(/[^0-9]/g, '')) || 0;
          } else {
            product[header] = value;
          }
        }
      }
      
      if (Object.keys(product).length > 0) {
        products.push(product);
      }
    }

    return products;
  } catch (error) {
    console.error('Error reading products from Google Sheets:', error);
    throw error;
  }
}

/**
 * Buscar productos por término de búsqueda
 */
export async function searchProducts(query: string): Promise<any[]> {
  try {
    const allProducts = await getProducts();
    const searchTerm = query.toLowerCase();

    const results = allProducts.filter((product: any) => {
      const searchableText = [
        product.nombre,
        product.name,
        product.categoria,
        product.category,
        product.descripcion,
        product.description,
        product.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(searchTerm);
    });

    console.log(`🔍 Search for "${query}": ${results.length} results found`);
    return results;
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
}

/**
 * Formatear productos para mostrar a Gemini
 */
export function formatProductsForGemini(products: any[]): string {
  if (!products || products.length === 0) {
    return 'No se encontraron productos.';
  }

  const formatted = products.map((p, idx) => {
    return `${idx + 1}. ${p.nombre || p.name || 'Sin nombre'}
   - Categoría: ${p.categoria || p.category || 'N/A'}
   - Precio: $${p.precio || p.price || '0'} COP
   - Descripción: ${p.descripcion || p.description || 'N/A'}
   - Stock: ${p.stock !== undefined ? (p.stock > 0 ? 'Disponible' : 'Agotado') : 'N/A'}`;
  }).join('\n\n');

  return formatted;
}

/**
 * Formatear información del negocio para mostrar a Gemini
 */
export function formatBusinessInfoForGemini(info: any[]): string {
  if (!info || info.length === 0) {
    return 'No hay información del negocio disponible.';
  }

  return info
    .map((row) => {
      if (row.length >= 2) {
        return `${row[0]}: ${row[1]}`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Obtener todo el contexto del negocio (info + productos)
 */
export async function getFullBusinessContext(): Promise<{
  info: any[];
  products: any[];
  formattedInfo: string;
  formattedProducts: string;
}> {
  try {
    const [info, products] = await Promise.all([
      getBusinessInfo(),
      getProducts(),
    ]);

    return {
      info,
      products,
      formattedInfo: formatBusinessInfoForGemini(info),
      formattedProducts: formatProductsForGemini(products),
    };
  } catch (error) {
    console.error('Error getting full business context:', error);
    throw error;
  }
}

// ==========================================
// GESTIÓN DE SESIONES Y HANDOFF
// ==========================================

export interface Session {
  sessionId: string;
  contactNumber: string;
  contactAlias: string;
  status: 'active' | 'closed';
  channel: string;
  startedAt: string;
  closedAt?: string;
  handoff: boolean;
  handoffReason?: string;
  assignedAgentId?: string;
  handoffStartedAt?: string;
  lastMessageAt: string;
}

/**
 * Obtener todas las sesiones de la hoja "sesiones"
 */
export async function getSessions(): Promise<Session[]> {
  try {
    const api = await initializeSheets();
    
    const response = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SESSIONS_SHEET}!A:L`,
    });

    const rows = response.data.values || [];
    console.log('📊 Sessions retrieved:', rows.length - 1, 'sessions (excluding header)');
    
    if (rows.length === 0) {
      return [];
    }

    // Primera fila son los headers
    const headers = rows[0].map((h: any) => h?.toString().toLowerCase().trim());
    const sessions: Session[] = [];

    // Convertir cada fila en objeto Session
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const session: any = {};
      
      for (let j = 0; j < headers.length && j < row.length; j++) {
        const header = headers[j];
        const value = row[j]?.toString().trim();
        
        if (header && value !== undefined) {
          // Conversión de tipos
          if (header === 'handoff') {
            session[header] = value.toLowerCase() === 'true' || value === '1';
          } else {
            session[header] = value;
          }
        }
      }
      
      if (session.sessionId) {
        sessions.push(session as Session);
      }
    }

    return sessions;
  } catch (error) {
    console.error('Error reading sessions from Google Sheets:', error);
    return []; // Return empty array if sheet doesn't exist yet
  }
}

/**
 * Obtener una sesión por sessionId
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const sessions = await getSessions();
  return sessions.find(s => s.sessionId === sessionId) || null;
}

/**
 * Obtener sesión activa por número de contacto
 */
export async function getActiveSession(contactNumber: string): Promise<Session | null> {
  const sessions = await getSessions();
  return sessions.find(s => 
    s.contactNumber === contactNumber && 
    s.status === 'active'
  ) || null;
}

/**
 * Crear o actualizar una sesión
 */
export async function upsertSession(session: Partial<Session>): Promise<Session> {
  try {
    const api = await initializeSheets();
    const sessions = await getSessions();
    
    // Buscar si existe
    const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);
    
    const sessionData: Session = {
      sessionId: session.sessionId || `session-${Date.now()}`,
      contactNumber: session.contactNumber || '',
      contactAlias: session.contactAlias || '',
      status: session.status || 'active',
      channel: session.channel || 'whatsapp',
      startedAt: session.startedAt || new Date().toISOString(),
      closedAt: session.closedAt,
      handoff: session.handoff || false,
      handoffReason: session.handoffReason,
      assignedAgentId: session.assignedAgentId,
      handoffStartedAt: session.handoffStartedAt,
      lastMessageAt: session.lastMessageAt || new Date().toISOString(),
    };

    const rowData = [
      sessionData.sessionId,
      sessionData.contactNumber,
      sessionData.contactAlias,
      sessionData.status,
      sessionData.channel,
      sessionData.startedAt,
      sessionData.closedAt || '',
      sessionData.handoff.toString(),
      sessionData.handoffReason || '',
      sessionData.assignedAgentId || '',
      sessionData.handoffStartedAt || '',
      sessionData.lastMessageAt,
    ];

    if (existingIndex >= 0) {
      // Actualizar sesión existente (fila existingIndex + 2 porque header es fila 1)
      const range = `sesiones!A${existingIndex + 2}:L${existingIndex + 2}`;
      await api.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData],
        },
      });
      console.log('✅ Session updated in Google Sheets:', sessionData.sessionId);
    } else {
      // Agregar nueva sesión
      await api.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SESSIONS_SHEET}!A:L`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData],
        },
      });
      console.log('✅ Session created in Google Sheets:', sessionData.sessionId);
    }

    return sessionData;
  } catch (error) {
    console.error('Error upserting session:', error);
    throw error;
  }
}

/**
 * Cerrar una sesión
 */
export async function closeSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    await upsertSession({
      ...session,
      status: 'closed',
      closedAt: new Date().toISOString(),
    });
  }
}

/**
 * Iniciar handoff para una sesión
 */
export async function startHandoffInSheet(
  sessionId: string,
  reason: string,
  agentId?: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    await upsertSession({
      ...session,
      handoff: true,
      handoffReason: reason,
      assignedAgentId: agentId,
      handoffStartedAt: new Date().toISOString(),
    });
    console.log('🔀 Handoff started for session:', sessionId);
  }
}

/**
 * Terminar handoff para una sesión
 */
export async function endHandoffInSheet(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    await upsertSession({
      ...session,
      handoff: false,
      handoffReason: undefined,
      assignedAgentId: undefined,
      handoffStartedAt: undefined,
    });
    console.log('✅ Handoff ended for session:', sessionId);
  }
}

/**
 * Obtener todas las sesiones en handoff activo
 */
export async function getActiveHandoffs(): Promise<Session[]> {
  const sessions = await getSessions();
  return sessions.filter(s => s.handoff === true && s.status === 'active');
}

// ============================================================================
// MENSAJES - Log de mensajes para auditoría
// ============================================================================

export interface Message {
  timestamp: string;
  sessionId: string;
  contactNumber: string;
  direction: 'incoming' | 'outgoing';
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document';
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: string;
}

/**
 * Guardar un mensaje en el log
 */
export async function logMessage(message: Partial<Message>): Promise<void> {
  try {
    const api = await initializeSheets();
    
    const rowData = [
      message.timestamp || new Date().toISOString(),
      message.sessionId || '',
      message.contactNumber || '',
      message.direction || 'incoming',
      message.messageType || 'text',
      message.content || '',
      message.status || 'sent',
      message.metadata ? JSON.stringify(message.metadata) : '',
    ];

    await api.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MESSAGES_SHEET}!A:H`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    });
    
    console.log('📝 Message logged:', message.sessionId, message.direction);
  } catch (error) {
    console.error('Error logging message:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

/**
 * Obtener mensajes de una sesión
 */
export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  try {
    const api = await initializeSheets();
    
    const response = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MESSAGES_SHEET}!A:H`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const messages: Message[] = [];
    
    // Saltar header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] === sessionId) {
        messages.push({
          timestamp: row[0] || '',
          sessionId: row[1] || '',
          contactNumber: row[2] || '',
          direction: row[3] as any || 'incoming',
          messageType: row[4] as any || 'text',
          content: row[5] || '',
          status: row[6] as any || 'sent',
          metadata: row[7] || '',
        });
      }
    }
    
    return messages;
  } catch (error) {
    console.error('Error getting session messages:', error);
    return [];
  }
}

// ============================================================================
// ORDENES - Gestión de pedidos
// ============================================================================

export interface Order {
  orderId: string;
  sessionId: string;
  contactNumber: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  currency: string;
  items: string; // JSON string
  shippingAddress?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

/**
 * Crear una orden
 */
export async function createOrder(order: Partial<Order>): Promise<Order> {
  try {
    const api = await initializeSheets();
    
    const orderId = order.orderId || `ORD-${Date.now()}`;
    const now = new Date().toISOString();
    
    const orderData: Order = {
      orderId,
      sessionId: order.sessionId || '',
      contactNumber: order.contactNumber || '',
      status: order.status || 'pending',
      total: order.total || 0,
      currency: order.currency || 'COP',
      items: order.items || '[]',
      shippingAddress: order.shippingAddress || '',
      paymentMethod: order.paymentMethod || '',
      createdAt: now,
      updatedAt: now,
      notes: order.notes || '',
    };

    const rowData = [
      orderData.orderId,
      orderData.sessionId,
      orderData.contactNumber,
      orderData.status,
      orderData.total,
      orderData.currency,
      orderData.items,
      orderData.shippingAddress,
      orderData.paymentMethod,
      orderData.createdAt,
      orderData.updatedAt,
      orderData.notes,
    ];

    await api.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ORDERS_SHEET}!A:L`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    });
    
    console.log('🛒 Order created:', orderId);
    return orderData;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

/**
 * Obtener órdenes de una sesión/contacto
 */
export async function getOrders(contactNumber: string): Promise<Order[]> {
  try {
    const api = await initializeSheets();
    
    const response = await api.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ORDERS_SHEET}!A:L`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return [];

    const orders: Order[] = [];
    
    // Saltar header
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[2] === contactNumber) {
        orders.push({
          orderId: row[0] || '',
          sessionId: row[1] || '',
          contactNumber: row[2] || '',
          status: row[3] as any || 'pending',
          total: parseFloat(row[4]) || 0,
          currency: row[5] || 'COP',
          items: row[6] || '[]',
          shippingAddress: row[7] || '',
          paymentMethod: row[8] || '',
          createdAt: row[9] || '',
          updatedAt: row[10] || '',
          notes: row[11] || '',
        });
      }
    }
    
    return orders;
  } catch (error) {
    console.error('Error getting orders:', error);
    return [];
  }
}
