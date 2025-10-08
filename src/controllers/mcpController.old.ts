import { Request, Response } from 'express';
import prisma from '../db/prisma';
import {
  queryGeminiWithHistory,
  classifyConsultation,
  getConversationHistory,
  clearConversation,
} from '../services/geminiConversation';
import { sendWhatsAppMessage } from '../services/whatsapp';

/**
 * Controlador MCP - Sistema de atención al cliente
 * Procesos: Registro, Recepción, Clasificación, Atención, Escalamiento, Cierre, Encuesta
 */

/**
 * POST /mcp/message
 * Recibir mensaje del cliente y procesar consulta completa
 */
export async function handleClientMessage(req: Request, res: Response) {
  console.log('handleClientMessage: received request body:', req.body);
  const {
    message,
    contactNumber,
    contactAlias,
    contactRealName,
    channel = 'whatsapp',
    advisorId,
  } = req.body as {
    message: string;
    contactNumber: string;
    contactAlias?: string;
    contactRealName?: string;
    channel?: string;
    advisorId?: number;
  };

  if (!message || !contactNumber) {
    return res.status(400).json({ error: 'message and contactNumber are required' });
  }

  try {
    // 1. Registro/Recuperación del cliente
    const contact = await prisma.contact.upsert({
      where: { number: contactNumber },
      update: {
        alias: contactAlias ?? undefined,
        realName: contactRealName ?? undefined,
      },
      create: {
        number: contactNumber,
        alias: contactAlias ?? `Cliente-${contactNumber.slice(-4)}`,
        realName: contactRealName,
        privacyMode: !contactRealName,
      },
    });
  console.log('handleClientMessage: contact upserted:', { id: contact.id, alias: contact.alias, number: contact.number });

    // 2. Obtener o crear sesión activa
    let session = await prisma.session.findFirst({
      where: {
        contactId: contact.id,
        status: 'active',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      session = await prisma.session.create({
        data: {
          contactId: contact.id,
          channel,
          status: 'active',
          geminiThreadId: `thread-${contact.id}-${Date.now()}`,
        },
      });
      console.log('handleClientMessage: created new session:', { id: session.id, geminiThreadId: session.geminiThreadId });
    }
    console.log('handleClientMessage: using session:', { id: session.id, status: session.status });

    // 3. Registrar mensaje entrante (puede omitirse para generar respuestas sin depender de la DB)
    const RESPOND_WITHOUT_DB = process.env.RESPOND_WITHOUT_DB === 'true';
    let incomingMessage: any = null;
    if (!RESPOND_WITHOUT_DB) {
      incomingMessage = await prisma.message.create({
        data: {
          content: message,
          direction: 'IN',
          contactId: contact.id,
          sessionId: session.id,
        },
      });
      console.log('handleClientMessage: incoming message saved id=', incomingMessage.id);
    } else {
      console.log('handleClientMessage: RESPOND_WITHOUT_DB=true -> no se guarda mensaje entrante antes de responder');
    }

    // 4. Clasificar consulta
    const category = classifyConsultation(message);

    // REANUDAR BOT: si el usuario envía un mensaje que termina con 'hasta luego', terminar handoff SILENCIOSAMENTE
    const trimmedLower = message.trim().toLowerCase();
    if (trimmedLower.endsWith('hasta luego')) {
      const { endHandoff, isInHandoff } = await import('../services/geminiConversation');
      const threadId = session.geminiThreadId!;
      const inHandoff = isInHandoff(threadId);
      if (inHandoff) {
        endHandoff(threadId);
        // actualizar DB
  await prisma.session.update({ where: { id: session.id }, data: ({ handoff: false, assignedAgentId: null, handoffReason: null } as any) }).catch(() => {});
        // NO enviar mensaje al cliente, reactivar silenciosamente
        console.log('handleClientMessage: bot reactivado silenciosamente mediante "hasta luego"');
        return res.json({ success: true, resumed: true });
      }
    }

    // Helper: detectar intención de compra (SOLO si ya seleccionó producto específico)
    function isPurchaseIntent(text: string) {
      if (!text) return false;
      const t = text.toLowerCase();
      
      // SI tiene pregunta (cuáles, qué tienes, etc), NO es intent to purchase
      if (/\b(cuál|cuáles|qué|que|tienes|tenés|hay|mostrar|muestra|opciones|disponibles?)\b|\?/.test(t)) {
        return false;
      }
      
      // Palabras clave de compra
      const hasPurchaseKeyword = /\b(comprar|pagar|pedido|realizar pedido|hacer pedido|me llevo|proceder|confirmar pedido)\b/.test(t);
      
      // DEBE mencionar "el/la/este/esta/ese/esa" (artículos definidos = ya seleccionó)
      const hasDefiniteArticle = /\b(el |la |este |esta |ese |esa |los |las )\b/.test(t);
      
      return hasPurchaseKeyword && hasDefiniteArticle;
    }

    // Helper: detectar si el mensaje es una pregunta/consulta sobre productos (evitar activar pago)
    function isQuestionLike(text: string) {
      if (!text) return false;
      const t = text.toLowerCase();
      return /\b(cual|cuales|cuál|cuáles|qué|que|qué tienes|qué tenés|qué muestran|qué hay|mostrar|muéstrame|mostrame|listame|disponible|disponen)\b|\?/.test(t);
    }

    // Helper: detectar confirmaciones explícitas de compra (aceptación final)
    function isPurchaseConfirmation(text: string) {
      if (!text) return false;
      const t = text.toLowerCase().trim();
      // Confirmaciones explícitas que sí deben iniciar pago
      return /(^|\b)(sí|si|confirmo|lo quiero|lo compro|quiero ese|quiero el|quiero la|me lo llevo|me la llevo|proceder con el pago|pagar ahora|confirmar pago|confirmar pedido|proceder con|a donde puedo pagar|donde pagar|donde pago|como pago|formas de pago|métodos de pago)\b/.test(t) && t.length < 100;
    }

    // 4.b: Si el usuario pregunta por información del local (horarios, dirección), responder directamente
    const lowerMsg = message.toLowerCase();
    if (/(horari|horas|apertura|cerrad|direccion|local|dónde|domicili|sede)\b/i.test(lowerMsg)) {
      const infoMsg = `Nuestro local Euforia atiende todos los días de 11:00 AM a 8:00 PM.\nDirección: calle 49#50-31, San Pedro de los Milagros.\nTambién hacemos envíos nacionales.`;
      await sendWhatsAppMessage(contact.number.includes('@') ? contact.number : `${contact.number}@c.us`, infoMsg).catch(() => {});
      return res.json({ success: true, info: true });
    }

    // 4.c: Si es media (foto), activar handoff al agente para validar comprobante
    if ((req.body as any).isMedia) {
      console.log('handleClientMessage: media recibido, iniciando handoff y notificando a agente');
      const threadId = session.geminiThreadId!;
      const { startHandoff } = await import('../services/geminiConversation');
      const { forwardToAgent } = await import('../services/agentHandoff');

      // Buscar pedido pendiente de esta sesión
      const pendingOrder = await prisma.order.findFirst({
        where: {
          sessionId: session.id,
          status: { in: ['pending_payment', 'payment_received'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Si hay pedido pendiente, actualizar estado y guardar URL del comprobante
      if (pendingOrder) {
        const mediaUrl = (req.body as any).mediaUrl || 'comprobante_recibido';
        await prisma.order.update({
          where: { id: pendingOrder.id },
          data: {
            status: 'payment_received',
            paymentProofUrl: mediaUrl,
          },
        });
        console.log('handleClientMessage: comprobante asociado a pedido id=', pendingOrder.id);
      }

      // Marcar handoff en memoria y en DB
      startHandoff(threadId, null, 'payment_proof');
  await prisma.session.update({ where: { id: session.id }, data: ({ handoff: true, handoffReason: 'payment_proof', handoffStartedAt: new Date() } as any) }).catch(() => {});

      // Notificar a agente (si hay webhook configurado)
      try {
        await forwardToAgent(null, { threadId, contactNumber, note: 'Comprobante de pago recibido (imagen)', orderId: pendingOrder?.id });
      } catch (err) {
        console.error('handleClientMessage: error notifying agent', err);
      }

      // Responder al usuario confirmando recepción del comprobante
      const confirmMsg = 'Recibimos tu comprobante de pago. Un agente humano revisará la transacción y se pondrá en contacto contigo para confirmar la compra.';
      await sendWhatsAppMessage(contact.number.includes('@') ? contact.number : `${contact.number}@c.us`, confirmMsg).catch((e) => console.error('sendWhatsAppMessage error', e));

      return res.json({ success: true, message: 'media_received_handoff', orderId: pendingOrder?.id });
    }

    // 4.c: Si detectamos intención de compra, iniciar proceso de pago manual
  const { isInHandoff } = await import('../services/geminiConversation');
  const sessionInHandoff = isInHandoff(session.geminiThreadId!);

  const questionLike = isQuestionLike(message);
  const purchaseConfirmed = isPurchaseConfirmation(message);

  // Sólo iniciar flujo de pago si es una confirmación explícita o si no es una pregunta (ej. "Quiero comprar el vibrador modelo X")
  if ((purchaseConfirmed || (isPurchaseIntent(message) && !questionLike)) && !sessionInHandoff) {
      console.log('handleClientMessage: intención de compra confirmada, iniciando proceso de pago manual');
      const { startHandoff } = await import('../services/geminiConversation');
      const { forwardToAgent } = await import('../services/agentHandoff');

      // Bancolombia ficticio para pruebas
      const bankInfo = {
        bank: 'Bancolombia',
        accountType: 'Ahorros',
        accountNumber: '0001234567890',
        accountName: 'EUFORIA SAS',
        nit: '900123456-7',
      };

      const instructions = `✅ Perfecto, aquí están los pasos para completar tu compra en Euforia:

📋 **PASO 1: Realiza la transferencia**
🏦 Banco: ${bankInfo.bank}
💳 Tipo: ${bankInfo.accountType}
🔢 Cuenta: ${bankInfo.accountNumber}
👤 Titular: ${bankInfo.accountName}
🆔 NIT: ${bankInfo.nit}

📋 **PASO 2: Confirma tu método de entrega**
Por favor responde con una de estas opciones:

🏪 **RECOGER EN TIENDA**
📍 Dirección: calle 49#50-31, San Pedro de los Milagros
⏰ Horario: Todos los días 11:00 AM - 8:00 PM
💰 Costo: GRATIS

📦 **ENVÍO NACIONAL**
💰 Costo adicional: $16.000 COP
📮 Se requiere: nombre completo, cédula, dirección completa y ciudad

📋 **PASO 3: Envía comprobante de pago**
📸 Sube la foto del comprobante de transferencia a este chat

Un agente humano validará tu pago y finalizará tu pedido. ¡Gracias por tu compra! 🎁`;

      // Crear pedido inicial (pendiente de pago)
      const newOrder = await prisma.order.create({
        data: {
          contactId: contact.id,
          sessionId: session.id,
          subtotal: 0, // Se actualizará manualmente
          shippingCost: 0,
          total: 0,
          deliveryMethod: 'pickup', // Por defecto, se actualizará después
          status: 'pending_payment',
        },
      });
      console.log('handleClientMessage: pedido creado id=', newOrder.id);

      // iniciar handoff y notificar agente
      const threadId = session.geminiThreadId!;
  startHandoff(threadId, null, 'purchase_request');
  await prisma.session.update({ where: { id: session.id }, data: ({ handoff: true, handoffReason: 'purchase_request', handoffStartedAt: new Date() } as any) }).catch(() => {});
      await forwardToAgent(null, { threadId, contactNumber, reason: 'purchase_request', orderId: newOrder.id }).catch(() => {});

      // enviar instrucciones al usuario
      await sendWhatsAppMessage(contact.number.includes('@') ? contact.number : `${contact.number}@c.us`, instructions).catch((e) => console.error('sendWhatsAppMessage error', e));

      return res.json({ success: true, message: 'purchase_flow_started', orderId: newOrder.id });
    } else if (isPurchaseIntent(message) && questionLike) {
      // Si el usuario está preguntando "¿Cuáles tienes?" o similar, no iniciar pago: dejar que el flujo de productos muestre opciones
      console.log('handleClientMessage: intento de compra identificado pero es una pregunta - se mostrarán opciones de producto en la respuesta');
      // dejar que el flujo continue para generar SQL y mostrar productos en la respuesta (no iniciar handoff)
    }

    // 5. Obtener respuesta de Gemini con historial completo
  console.log('handleClientMessage: classifying message...');
  // Determinar si forzamos modo saludo
  const { isGreeting } = await import('../services/geminiConversation');
  const forceGreeting = isGreeting(message);

  // Detectar si es la primera interacción de esta sesión para pasar DB schema
  const isFirstMessage = await prisma.message.count({
    where: { sessionId: session.id },
  });
  const isNewSession = isFirstMessage === 0 || (isFirstMessage === 1 && forceGreeting);

  // Preparar DB Schema solo para primera sesión
  let dbSchema: string | undefined = undefined;
  if (isNewSession) {
    const { DB_SCHEMA } = await import('../services/geminiSqlGenerator');
    dbSchema = DB_SCHEMA;
    console.log('handleClientMessage: Primera sesión detectada - pasando DB schema a Gemini');
  }

  // FLUJO DE DOS ETAPAS CON GEMINI:
  // 1. Primer Gemini genera SQL basado en la consulta del usuario
  // 2. Ejecutamos la query y obtenemos datos
  // 3. Segundo Gemini genera respuesta usando los datos obtenidos + su conocimiento

  let externalContext: string | undefined = undefined;

  if (category === 'producto' && !forceGreeting) {
    try {
      // Etapa 1: Generar SQL con Gemini
      const { generateSQLFromQuery, formatResultsForDisplay } = await import(
        '../services/geminiSqlGenerator'
      );

      console.log('handleClientMessage: ETAPA 1 - Generando SQL con Gemini...');
      const generatedSQL = await generateSQLFromQuery(message);

      if (generatedSQL) {
        console.log('handleClientMessage: SQL generada:', generatedSQL);

        // Etapa 2: Ejecutar query en la base de datos
        try {
          const results = await prisma.$queryRawUnsafe(generatedSQL);
          console.log('handleClientMessage: ETAPA 2 - Query ejecutada, resultados:', Array.isArray(results) ? results.length : 0);

          // Formatear resultados para contexto
          if (Array.isArray(results) && results.length > 0) {
            const limited = results.slice(0, 5);
            externalContext = formatResultsForDisplay(limited);
            console.log('handleClientMessage: externalContext preparado con', limited.length, 'resultados (mostrando max 5)');
          } else {
            console.log('handleClientMessage: no se encontraron resultados exactos, intentando búsquedas alternativas');
            // Fallback 1: intentar buscar por tokens en nombre, descripción o tags
            const tokens = message
              .toLowerCase()
              .replace(/[^a-z0-9áéíóúñü\s]/gi, ' ')
              .split(/\s+/)
              .filter((w) => w.length > 3);

            let altProducts: any[] = [];
            if (tokens.length > 0) {
              try {
                const orClauses: any[] = [
                  ...tokens.map((t) => ({ name: { contains: t } })),
                  ...tokens.map((t) => ({ description: { contains: t } })),
                  ...tokens.map((t) => ({ tags: { contains: t } })),
                ];
                // Also search tags using raw LIKE
                altProducts = await prisma.product.findMany({
                  where: {
                    OR: orClauses,
                    inStock: true,
                  },
                  take: 5,
                });
              } catch (errSearch: any) {
                console.error('handleClientMessage: error en búsqueda alternativa por tokens', errSearch?.message ?? errSearch);
                altProducts = [];
              }
            }

            if (altProducts.length > 0) {
              const { formatResultsForDisplay } = await import('../services/geminiSqlGenerator');
              const limited = altProducts.slice(0, 5);
              externalContext = `NO_EXACT_MATCH\nAlternativas relevantes:\n${formatResultsForDisplay(limited)}`;
              console.log('handleClientMessage: externalContext preparado con alternativas (token search)', limited.length);
            } else {
              // Fallback 2: mostrar productos populares/recientes en stock
              try {
                const popular = await prisma.product.findMany({ where: { inStock: true }, orderBy: { createdAt: 'desc' }, take: 5 });
                if (popular && popular.length > 0) {
                  const { formatResultsForDisplay } = await import('../services/geminiSqlGenerator');
                  externalContext = `NO_EXACT_MATCH\nNo encontramos coincidencias exactas. Algunas opciones populares que podrían interesarte:\n${formatResultsForDisplay(popular)}`;
                  console.log('handleClientMessage: externalContext preparado con populares (fallback)');
                } else {
                  externalContext = `NO_EXACT_MATCH\nNo se encontraron productos similares en el catálogo. ¿Quieres que busque por otra palabra clave o categoría?`;
                  console.log('handleClientMessage: no hay productos populares para sugerir');
                }
              } catch (errPop: any) {
                console.error('handleClientMessage: error en fallback popular', errPop?.message ?? errPop);
                externalContext = 'No se encontraron resultados para tu consulta en el catálogo.';
              }
            }
          }
        } catch (sqlError: any) {
          console.error('handleClientMessage: error ejecutando SQL:', sqlError?.message ?? sqlError);
          externalContext = 'Hubo un error al buscar en el catálogo. Intenta reformular tu pregunta.';
        }
      } else {
        console.log('handleClientMessage: No se generó SQL (saludo o consulta no relacionada con productos)');
        externalContext = undefined;
      }
    } catch (err: any) {
      console.error('handleClientMessage: error en flujo SQL:', err?.message ?? err);
      externalContext = undefined;
    }
  }

  // Etapa 3: Segundo Gemini genera respuesta usando los datos obtenidos + su conocimiento
  console.log('handleClientMessage: ETAPA 3 - Generando respuesta con Gemini...');
  const aiResponseRaw = await queryGeminiWithHistory(session.geminiThreadId!, message, {
    mode: forceGreeting ? 'greeting' : 'service',
    externalContext,
    dbSchema: isNewSession ? dbSchema : undefined,
  });
  // Import formatting helper to clean and improve presentation for WhatsApp
  const { formatAssistantResponse } = await import('../services/geminiConversation');
  const aiResponse = formatAssistantResponse(aiResponseRaw);
  console.log('handleClientMessage: aiResponse sanitized preview=', aiResponse.slice(0, 240));
  console.log('handleClientMessage: received aiResponse preview=', aiResponse.slice(0, 300));

    // 6. Registrar mensaje saliente (opcional: si LOG_MESSAGES=false se omite)
    const LOG_MESSAGES = process.env.LOG_MESSAGES !== 'false';
    let outgoingMessage: any = null;
    if (LOG_MESSAGES) {
      outgoingMessage = await prisma.message.create({
        data: {
          content: aiResponse,
          direction: 'OUT',
          contactId: contact.id,
          sessionId: session.id,
        },
      });
      console.log('handleClientMessage: outgoing message saved id=', outgoingMessage.id);
    } else {
      console.log('handleClientMessage: LOG_MESSAGES=false -> no se guarda mensaje saliente');
    }

    // 7. Crear/actualizar consulta
    let consultation: any = null;
    if (LOG_MESSAGES) {
      consultation = await prisma.consultation.findFirst({
        where: {
          sessionId: session.id,
          status: { in: ['pending', 'in_progress'] },
        },
      });

      if (!consultation) {
        consultation = await prisma.consultation.create({
          data: {
            contactId: contact.id,
            sessionId: session.id,
            advisorId: advisorId ?? undefined,
            category,
            topic: message.slice(0, 100),
            description: message,
            response: aiResponse,
            status: 'in_progress',
          },
        });
        console.log('handleClientMessage: consultation created id=', consultation.id);
      } else {
        await prisma.consultation.update({
          where: { id: consultation.id },
          data: {
            response: aiResponse,
          },
        });
        console.log('handleClientMessage: consultation updated id=', consultation.id);
      }
    } else {
      console.log('handleClientMessage: LOG_MESSAGES=false -> no se crea/actualiza consulta en DB');
    }

    // 8. Enviar respuesta por WhatsApp si es ese canal
    if (channel === 'whatsapp') {
      try {
        const whatsappId = contactNumber.includes('@')
          ? contactNumber
          : `${contactNumber}@c.us`;
        console.log('handleClientMessage: sending WhatsApp message to', whatsappId);
        await sendWhatsAppMessage(whatsappId, aiResponse);
        console.log('handleClientMessage: WhatsApp send attempted to', whatsappId);
      } catch (error) {
        console.error('Error sending WhatsApp message:', error);
      }
    }

    console.log('handleClientMessage: finished processing for session', session.id);
    return res.json({
      success: true,
      response: aiResponse,
      sessionId: session.id,
      consultationId: consultation?.id ?? null,
      category,
    });
  } catch (err: any) {
    console.error('Error in handleClientMessage:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /mcp/consultation/:id/resolve
 * Marcar consulta como resuelta
 */
export async function resolveConsultation(req: Request, res: Response) {
  const consultationId = parseInt(req.params.id);
  const { advisorId, finalResponse } = req.body as {
    advisorId?: number;
    finalResponse?: string;
  };

  try {
    const consultation = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        advisorId: advisorId ?? undefined,
        response: finalResponse ?? undefined,
      },
    });

    return res.json({ success: true, consultation });
  } catch (err: any) {
    console.error('Error resolving consultation:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /mcp/consultation/:id/escalate
 * Escalar consulta a supervisor
 */
export async function escalateConsultation(req: Request, res: Response) {
  const consultationId = parseInt(req.params.id);
  const { reason, assignedToId } = req.body as { reason: string; assignedToId?: number };

  if (!reason) {
    return res.status(400).json({ error: 'reason is required' });
  }

  try {
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: 'escalated' },
    });

    const escalation = await prisma.escalation.create({
      data: {
        consultationId,
        reason,
        assignedToId: assignedToId ?? undefined,
      },
    });

    return res.json({ success: true, escalation });
  } catch (err: any) {
    console.error('Error escalating consultation:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /mcp/session/:id/close
 * Cerrar sesión y solicitar encuesta
 */
export async function closeSession(req: Request, res: Response) {
  const sessionId = parseInt(req.params.id);

  try {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
      include: {
        contact: true,
        consultations: true,
      },
    });

    if (session.geminiThreadId) {
      clearConversation(session.geminiThreadId);
    }

    if (session.channel === 'whatsapp') {
      const surveyMessage =
        '¡Gracias por tu consulta! 🌟\n\nNos gustaría conocer tu opinión. ¿Podrías calificar tu experiencia del 1 al 5?';
      const whatsappId = session.contact.number.includes('@')
        ? session.contact.number
        : `${session.contact.number}@c.us`;

      try {
        await sendWhatsAppMessage(whatsappId, surveyMessage);
      } catch (error) {
        console.error('Error sending survey request:', error);
      }
    }

    return res.json({ success: true, session });
  } catch (err: any) {
    console.error('Error closing session:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /mcp/survey
 * Registrar encuesta de satisfacción
 */
export async function submitSurvey(req: Request, res: Response) {
  const { consultationId, rating, comments } = req.body as {
    consultationId: number;
    rating: number;
    comments?: string;
  };

  if (!consultationId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'valid consultationId and rating (1-5) are required' });
  }

  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) {
      return res.status(404).json({ error: 'consultation not found' });
    }

    const survey = await prisma.satisfactionSurvey.create({
      data: {
        contactId: consultation.contactId,
        consultationId,
        rating,
        comments: comments ?? undefined,
      },
    });

    return res.json({ success: true, survey });
  } catch (err: any) {
    console.error('Error submitting survey:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * GET /mcp/session/:id/history
 * Obtener historial completo de conversación
 */
export async function getSessionHistory(req: Request, res: Response) {
  const sessionId = parseInt(req.params.id);

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        consultations: {
          include: {
            advisor: true,
            escalation: true,
            survey: true,
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'session not found' });
    }

    let geminiHistory = null;
    if (session.geminiThreadId) {
      geminiHistory = getConversationHistory(session.geminiThreadId);
    }

    return res.json({
      success: true,
      session,
      geminiHistory,
    });
  } catch (err: any) {
    console.error('Error getting session history:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * GET /mcp/handoffs
 * Obtener todas las sesiones activas con información de handoff
 */
export async function getHandoffs(req: Request, res: Response) {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        status: 'active',
      },
      include: {
        contact: true,
      },
      orderBy: {
        handoffStartedAt: 'desc',
      },
    });

    return res.json({
      success: true,
      sessions,
    });
  } catch (err: any) {
    console.error('Error getting handoffs:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /mcp/handoffs/:sessionId/reactivate
 * Reactivar el bot para una sesión específica (terminar handoff)
 */
export async function reactivateBot(req: Request, res: Response) {
  try {
    const sessionId = parseInt(req.params.sessionId);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { contact: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Terminar handoff en memoria
    if (session.geminiThreadId) {
      const { endHandoff } = await import('../services/geminiConversation');
      endHandoff(session.geminiThreadId);
    }

    // Actualizar en BD
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        handoff: false,
        assignedAgentId: null,
        handoffReason: null,
        handoffStartedAt: null,
      },
    });

    // NO enviar mensaje al cliente (reactivación silenciosa)
    console.log('reactivateBot: bot reactivado silenciosamente para sesión', sessionId);

    return res.json({
      success: true,
      session: updatedSession,
      message: 'Bot reactivated successfully',
    });
  } catch (err: any) {
    console.error('Error reactivating bot:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * GET /mcp/reports/metrics
 * Obtener métricas de atención al cliente
 */
export async function getMetrics(req: Request, res: Response) {
  try {
    const totalConsultations = await prisma.consultation.count();
    const resolvedConsultations = await prisma.consultation.count({
      where: { status: 'resolved' },
    });
    const escalatedConsultations = await prisma.consultation.count({
      where: { status: 'escalated' },
    });

    const avgRating = await prisma.satisfactionSurvey.aggregate({
      _avg: { rating: true },
    });

    const consultationsByCategory = await prisma.consultation.groupBy({
      by: ['category'],
      _count: true,
    });

    return res.json({
      success: true,
      metrics: {
        totalConsultations,
        resolvedConsultations,
        escalatedConsultations,
        averageRating: avgRating._avg.rating ?? 0,
        consultationsByCategory,
      },
    });
  } catch (err: any) {
    console.error('Error getting metrics:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}
