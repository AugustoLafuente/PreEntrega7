/**
 * Repository: intermediario entre el service y el DAO, aísla al resto
 * de la app de los detalles de persistencia (Mongoose).
 */
import ticketsDao from '../dao/tickets.dao.js';

export const createTicket = async (data) => {
    return ticketsDao.create(data);
};

export const getTicketById = async (id) => {
    return ticketsDao.findById(id);
};

export const findActiveTicket = async (userId, eventId) => {
    return ticketsDao.findActiveByUserAndEvent(userId, eventId);
};

export const getOccupiedQuantity = async (eventId) => {
    return ticketsDao.sumActiveQuantityByEvent(eventId);
};

export const getTicketsByUser = async (userId) => {
    return ticketsDao.findByUser(userId);
};

export const getTicketsByEvent = async (eventId) => {
    return ticketsDao.findByEvent(eventId);
};

export const updateTicket = async (id, updates) => {
    return ticketsDao.updateById(id, updates);
};

export default {
    createTicket,
    getTicketById,
    findActiveTicket,
    getOccupiedQuantity,
    getTicketsByUser,
    getTicketsByEvent,
    updateTicket
};
