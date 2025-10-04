import { Router } from 'express';
import {
  getOrders,
  getOrder,
  confirmOrder,
  cancelOrder,
  updateDelivery,
  completeOrder,
  updateOrderItems,
} from '../controllers/orderController';

const router = Router();

// Gestión de pedidos
router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/:id/confirm', confirmOrder);
router.post('/:id/cancel', cancelOrder);
router.post('/:id/delivery', updateDelivery);
router.post('/:id/complete', completeOrder);
router.post('/:id/items', updateOrderItems);

export default router;
