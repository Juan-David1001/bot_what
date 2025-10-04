import { Router } from 'express';
import {
  handleClientMessage,
  resolveConsultation,
  escalateConsultation,
  closeSession,
  submitSurvey,
  getSessionHistory,
  getMetrics,
  getHandoffs,
  reactivateBot,
} from '../controllers/mcpController';

const router = Router();

// Proceso principal: recibir y responder mensaje
router.post('/message', handleClientMessage);

// Gestión de consultas
router.post('/consultation/:id/resolve', resolveConsultation);
router.post('/consultation/:id/escalate', escalateConsultation);

// Gestión de sesiones
router.post('/session/:id/close', closeSession);
router.get('/session/:id/history', getSessionHistory);

// Encuestas de satisfacción
router.post('/survey', submitSurvey);

// Gestión de handoffs (panel de administración)
router.get('/handoffs', getHandoffs);
router.post('/handoffs/:sessionId/reactivate', reactivateBot);

// Reportes y métricas
router.get('/reports/metrics', getMetrics);

export default router;
