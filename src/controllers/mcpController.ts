import { Request, Response } from 'express';
import {
  getActiveSession,
  upsertSession,
  logMessage,
  startHandoffInSheet,
  Session,
} from '../services/googleSheets';
import {
  queryGeminiWithMCP,
  clearConversation,
} from '../services/geminiConversation';
import { sendWhatsAppMessage } from '../services/whatsapp';

/**
 * Controlador MCP completamente basado en Google Sheets
 * Sin Prisma - Todo en Sheets
 */

/**
 * POST /mcp/message
 * Recibir mensaje del cliente y procesar con MCP + Google Sheets
 */
export async function handleClientMessage(req: Request, res: Response) {
  console.log('📥 MCP: received request', req.body);
  const {
    message,
    contactNumber,
    contactAlias,
    channel = 'whatsapp',
  } = req.body as {
    message: string;
    contactNumber: string;
    contactAlias?: string;
    channel?: string;
  };

  if (!message || !contactNumber) {
    return res.status(400).json({ error: 'message and contactNumber required' });
  }

  try {
    // 1. Obtener o crear sesión en Google Sheets
    let session = await getActiveSession(contactNumber);
    
    if (!session) {
      console.log('📝 Creating new session in Sheets for', contactNumber);
      const sessionData: Partial<Session> = {
        sessionId: `session-${Date.now()}-${contactNumber.slice(-4)}`,
        contactNumber,
        contactAlias: contactAlias || `Cliente-${contactNumber.slice(-4)}`,
        status: 'active',
        channel,
        startedAt: new Date().toISOString(),
        handoff: false,
        lastMessageAt: new Date().toISOString(),
      };
      session = await upsertSession(sessionData);
    } else {
      // Actualizar lastMessageAt
      session.lastMessageAt = new Date().toISOString();
      await upsertSession(session);
    }

    console.log('✅ Using session:', session.sessionId);

    // 2. Registrar mensaje entrante en Sheets
    await logMessage({
      timestamp: new Date().toISOString(),
      sessionId: session.sessionId,
      contactNumber,
      direction: 'incoming',
      messageType: 'text',
      content: message,
      status: 'delivered',
    });

    // 3. Verificar si el usuario quiere terminar handoff
    const trimmedLower = message.trim().toLowerCase();
    if (trimmedLower.includes('hasta luego') || trimmedLower.includes('reanudar bot')) {
      if (session.handoff) {
        session.handoff = false;
        session.handoffReason = undefined;
        session.assignedAgentId = undefined;
        session.handoffStartedAt = undefined;
        await upsertSession(session);
        console.log('🔄 Bot reactivado para sesión', session.sessionId);
        return res.json({ success: true, resumed: true });
      }
    }

    // 4. Si está en handoff, no procesar con Gemini (esperar agente humano)
    if (session.handoff) {
      console.log('⏸️ Sesión en handoff - mensaje no procesado por bot');
      return res.json({ 
        success: true, 
        handoff: true, 
        message: 'Session in handoff - waiting for human agent' 
      });
    }

    // 5. Procesar mensaje con Gemini + MCP (detección inteligente de tools)
    console.log('🤖 Processing message with Gemini + MCP...');
    const threadId = `thread-${session.sessionId}`;
    
    const aiResponse = await queryGeminiWithMCP(threadId, message);
    
    console.log('✅ AI Response:', aiResponse.slice(0, 200));

    // 6. Detectar si Gemini mencionó "agente humano" o "transferir" en la respuesta
    // Esto significa que Gemini determinó que se necesita handoff
    const needsHandoff = /\b(agente humano|transferir|contactar|asistente humano|derivar|escalar)\b/i.test(aiResponse);
    
    if (needsHandoff && !session.handoff) {
      console.log('🔀 Gemini detected handoff needed - initiating transfer');
      
      // Iniciar handoff en Sheets
      await startHandoffInSheet(session.sessionId, 'gemini_detected', undefined);
      session.handoff = true;
      session.handoffReason = 'gemini_detected';
      session.handoffStartedAt = new Date().toISOString();
      await upsertSession(session);
      
      // Agregar nota al final de la respuesta
      const handoffNote = '\n\n🔔 Un agente humano revisará tu consulta y se pondrá en contacto contigo pronto.';
      const finalResponse = aiResponse + handoffNote;
      
      // Registrar mensaje saliente
      await logMessage({
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        contactNumber,
        direction: 'outgoing',
        messageType: 'text',
        content: finalResponse,
        status: 'sent',
      });

      // Enviar por WhatsApp
      if (channel === 'whatsapp') {
        const whatsappId = contactNumber.includes('@') ? contactNumber : `${contactNumber}@c.us`;
        await sendWhatsAppMessage(whatsappId, finalResponse).catch(console.error);
      }

      return res.json({
        success: true,
        response: finalResponse,
        handoff: true,
        sessionId: session.sessionId,
      });
    }

    // 7. Registrar mensaje saliente normal
    await logMessage({
      timestamp: new Date().toISOString(),
      sessionId: session.sessionId,
      contactNumber,
      direction: 'outgoing',
      messageType: 'text',
      content: aiResponse,
      status: 'sent',
    });

    // 8. Enviar respuesta por WhatsApp
    if (channel === 'whatsapp') {
      const whatsappId = contactNumber.includes('@') ? contactNumber : `${contactNumber}@c.us`;
      await sendWhatsAppMessage(whatsappId, aiResponse).catch(console.error);
      console.log('📤 WhatsApp message sent to', whatsappId);
    }

    return res.json({
      success: true,
      response: aiResponse,
      sessionId: session.sessionId,
    });
    
  } catch (err: any) {
    console.error('❌ Error in handleClientMessage:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /mcp/session/:id/close
 * Cerrar sesión en Sheets
 */
export async function closeSession(req: Request, res: Response) {
  try {
    const sessionId = req.params.id;
    
    const session = await getActiveSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'closed';
    session.closedAt = new Date().toISOString();
    await upsertSession(session);

    // Limpiar conversación de Gemini
    const threadId = `thread-${sessionId}`;
    clearConversation(threadId);

    console.log('✅ Session closed:', sessionId);

    return res.json({ success: true, session });
  } catch (err: any) {
    console.error('Error closing session:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /mcp/handoffs/:sessionId/reactivate
 * Reactivar bot (terminar handoff)
 */
export async function reactivateBot(req: Request, res: Response) {
  try {
    const sessionId = req.params.sessionId;
    
    const session = await getActiveSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.handoff = false;
    session.handoffReason = undefined;
    session.assignedAgentId = undefined;
    session.handoffStartedAt = undefined;
    await upsertSession(session);

    console.log('🔄 Bot reactivated for session:', sessionId);

    return res.json({
      success: true,
      session,
      message: 'Bot reactivated successfully',
    });
  } catch (err: any) {
    console.error('Error reactivating bot:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * GET /mcp/session/:id/history
 * Obtener historial de mensajes de una sesión desde Sheets
 */
export async function getSessionHistory(req: Request, res: Response) {
  try {
    const sessionId = req.params.id;
    
    const { getSessionMessages } = await import('../services/googleSheets');
    const messages = await getSessionMessages(sessionId);

    return res.json({
      success: true,
      sessionId,
      messages,
      count: messages.length,
    });
  } catch (err: any) {
    console.error('Error getting session history:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * GET /mcp/handoffs
 * Obtener sesiones con handoff activo desde Sheets
 */
export async function getHandoffs(req: Request, res: Response) {
  try {
    const { getActiveHandoffs } = await import('../services/googleSheets');
    const sessions = await getActiveHandoffs();

    return res.json({
      success: true,
      handoffs: sessions,
      count: sessions.length,
    });
  } catch (err: any) {
    console.error('Error getting handoffs:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}
