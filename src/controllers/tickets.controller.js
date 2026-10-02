/**
 * Controlador para la gestión de Tickets: solo maneja request/response,
 * toda la lógica de negocio vive en tickets.service.js.
 */
import ticketsService from '../services/tickets.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createTicket = asyncHandler(async (req, res) => {
    const ticket = await ticketsService.createTicket(req.params.eid, req.user, req.body.quantity);
    return res.status(201).json({
        status: 'success',
        payload: ticket
    });
});

export const listMyTickets = asyncHandler(async (req, res) => {
    const tickets = await ticketsService.listMyTickets(req.user.id);
    return res.status(200).json({
        status: 'success',
        payload: tickets
    });
});

export const listEventTickets = asyncHandler(async (req, res) => {
    const tickets = await ticketsService.listEventTickets(req.params.eid, req.user);
    return res.status(200).json({
        status: 'success',
        payload: tickets
    });
});

export const cancelTicket = asyncHandler(async (req, res) => {
    const ticket = await ticketsService.cancelTicket(req.params.tid, req.user);
    return res.status(200).json({
        status: 'success',
        payload: ticket
    });
});

export default {
    createTicket,
    listMyTickets,
    listEventTickets,
    cancelTicket
};
