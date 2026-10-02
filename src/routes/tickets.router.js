import { Router } from 'express';
import { listMyTickets, cancelTicket } from '../controllers/tickets.controller.js';
import auth from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/tickets/my-tickets → tickets propios del usuario autenticado
router.get('/my-tickets', auth, listMyTickets);

// PATCH /api/tickets/:tid/cancel → dueño del ticket o admin (chequeo en el service)
router.patch('/:tid/cancel', auth, cancelTicket);

export default router;
