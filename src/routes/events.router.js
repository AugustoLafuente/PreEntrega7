import { Router } from 'express';
import { getEvents, getEventById, createEvent, updateEvent, updateEventStatus } from '../controllers/events.controller.js';
import { createTicket, listEventTickets } from '../controllers/tickets.controller.js';
import auth from '../middlewares/auth.middleware.js';
import authorize from '../middlewares/authorize.middleware.js';

const router = Router();

// GET /api/events → público, admite filtros + paginación + ordenamiento
router.get('/', getEvents);

// GET /api/events/:id → público
router.get('/:id', getEventById);

// POST /api/events → solo organizer o admin
router.post('/', auth, authorize('organizer', 'admin'), createEvent);

// PUT /api/events/:id → dueño del evento o admin
router.put('/:id', auth, authorize('organizer', 'admin'), updateEvent);

// PATCH /api/events/:id/status → dueño del evento o admin (cancelar = status 'cancelled')
router.patch('/:id/status', auth, authorize('organizer', 'admin'), updateEventStatus);

// POST /api/events/:eid/tickets → cualquier usuario autenticado se inscribe al evento
router.post('/:eid/tickets', auth, createTicket);

// GET /api/events/:eid/tickets → organizer dueño del evento o admin (chequeo en el service)
router.get('/:eid/tickets', auth, listEventTickets);

export default router;
