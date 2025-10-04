import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { sendWhatsAppMessage } from '../services/whatsapp';

/**
 * GET /orders
 * Obtener todos los pedidos con filtros opcionales
 */
export async function getOrders(req: Request, res: Response) {
  try {
    const { status, limit = '50' } = req.query;
    
    const where: any = {};
    if (status) {
      where.status = status;
    }
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        contact: true,
        session: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit as string),
    });

    return res.json({
      success: true,
      orders,
    });
  } catch (err: any) {
    console.error('Error getting orders:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * GET /orders/:id
 * Obtener un pedido específico
 */
export async function getOrder(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        contact: true,
        session: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({
      success: true,
      order,
    });
  } catch (err: any) {
    console.error('Error getting order:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /orders/:id/confirm
 * Confirmar pago de un pedido (después de validar comprobante)
 */
export async function confirmOrder(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    const { notes } = req.body as { notes?: string };
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        contact: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Actualizar estado del pedido
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'confirmed',
        paidAt: new Date(),
        notes: notes || order.notes,
      },
    });

    // Preparar mensaje de confirmación para el cliente
    const itemsList = order.items
      .map((item) => `• ${item.product.name} x${item.quantity} - $${item.subtotal.toLocaleString('es-CO')}`)
      .join('\n');

    const deliveryInfo = order.deliveryMethod === 'pickup'
      ? `\n📍 **RECOGER EN TIENDA**\nDirección: calle 49#50-31, San Pedro de los Milagros\nHorario: 11:00 AM - 8:00 PM`
      : `\n📦 **ENVÍO A DOMICILIO**\nDestinatario: ${order.recipientName}\nDirección: ${order.shippingAddress}, ${order.shippingCity}`;

    const confirmationMsg = `✅ ¡Pago confirmado!

Tu pedido #${order.id} ha sido procesado exitosamente.

🛍️ **Productos:**
${itemsList}

💰 **Total pagado:** $${order.total.toLocaleString('es-CO')} COP
${deliveryInfo}

${order.deliveryMethod === 'pickup' ? '¡Te esperamos en nuestra tienda!' : '¡Tu pedido será enviado pronto!'}

¡Gracias por tu compra en Euforia! 🎁`;

    // Enviar confirmación por WhatsApp
    const whatsappId = order.contact.number.includes('@')
      ? order.contact.number
      : `${order.contact.number}@c.us`;

    try {
      await sendWhatsAppMessage(whatsappId, confirmationMsg);
      console.log('confirmOrder: mensaje de confirmación enviado a', whatsappId);
    } catch (error) {
      console.error('Error sending confirmation message:', error);
    }

    return res.json({
      success: true,
      order: updatedOrder,
      message: 'Order confirmed and customer notified',
    });
  } catch (err: any) {
    console.error('Error confirming order:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /orders/:id/cancel
 * Cancelar un pedido
 */
export async function cancelOrder(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    const { reason } = req.body as { reason?: string };
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        contact: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Actualizar estado del pedido
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        notes: reason || order.notes,
      },
    });

    // Notificar al cliente
    const cancelMsg = `❌ Pedido #${order.id} cancelado

Lo sentimos, tu pedido ha sido cancelado.
${reason ? `\nMotivo: ${reason}` : ''}

Si tienes dudas, contáctanos en nuestro horario de atención (11:00 AM - 8:00 PM).`;

    const whatsappId = order.contact.number.includes('@')
      ? order.contact.number
      : `${order.contact.number}@c.us`;

    try {
      await sendWhatsAppMessage(whatsappId, cancelMsg);
    } catch (error) {
      console.error('Error sending cancellation message:', error);
    }

    return res.json({
      success: true,
      order: updatedOrder,
      message: 'Order cancelled and customer notified',
    });
  } catch (err: any) {
    console.error('Error cancelling order:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /orders/:id/delivery
 * Actualizar información de entrega
 */
export async function updateDelivery(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    const { deliveryMethod, recipientName, recipientDocument, shippingAddress, shippingCity } = req.body;
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId' });
    }

    if (!deliveryMethod || !['pickup', 'shipping'].includes(deliveryMethod)) {
      return res.status(400).json({ error: 'deliveryMethod must be "pickup" or "shipping"' });
    }

    // Calcular costo de envío
    const shippingCost = deliveryMethod === 'shipping' ? 16000 : 0;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Recalcular total
    const newTotal = order.subtotal + shippingCost;

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryMethod,
        shippingCost,
        total: newTotal,
        recipientName: deliveryMethod === 'shipping' ? recipientName : null,
        recipientDocument: deliveryMethod === 'shipping' ? recipientDocument : null,
        shippingAddress: deliveryMethod === 'shipping' ? shippingAddress : null,
        shippingCity: deliveryMethod === 'shipping' ? shippingCity : null,
      },
    });

    return res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('Error updating delivery:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /orders/:id/complete
 * Marcar pedido como completado (entregado/recibido)
 */
export async function completeOrder(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('Error completing order:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}

/**
 * POST /orders/:id/items
 * Agregar o actualizar items del pedido
 */
export async function updateOrderItems(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    const { items, subtotal, total } = req.body as {
      items: Array<{ productId: number; quantity: number; unitPrice: number }>;
      subtotal: number;
      total: number;
    };
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId' });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    // Eliminar items existentes
    await prisma.orderItem.deleteMany({
      where: { orderId },
    });

    // Crear nuevos items
    for (const item of items) {
      await prisma.orderItem.create({
        data: {
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
        },
      });
    }

    // Actualizar totales del pedido
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: subtotal || items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
        total: total || subtotal,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('Error updating order items:', err);
    return res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}
