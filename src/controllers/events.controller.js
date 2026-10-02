/**
 * Controlador para la gestión de Eventos: solo maneja request/response,
 * toda la lógica de negocio vive en events.service.js y los errores se
 * delegan al middleware global vía asyncHandler.
 */
import eventsService from '../services/events.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getEvents = asyncHandler(async (req, res) => {
    const result = await eventsService.listEvents(req.query);
    return res.status(200).json({
        status: 'success',
        ...result
    });
});

export const getEventById = asyncHandler(async (req, res) => {
    const event = await eventsService.getEventById(req.params.id);
    return res.status(200).json({
        status: 'success',
        payload: event
    });
});

export const createEvent = asyncHandler(async (req, res) => {
    const event = await eventsService.createEvent(req.body, req.user.id);
    return res.status(201).json({
        status: 'success',
        payload: event
    });
});

export const updateEvent = asyncHandler(async (req, res) => {
    const event = await eventsService.updateEvent(req.params.id, req.body, req.user);
    return res.status(200).json({
        status: 'success',
        payload: event
    });
});

export const updateEventStatus = asyncHandler(async (req, res) => {
    const event = await eventsService.updateEventStatus(req.params.id, req.body.status, req.user);
    return res.status(200).json({
        status: 'success',
        payload: event
    });
});

export default {
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    updateEventStatus
};
