/**
 * DAO: acceso directo al modelo de Mongoose para la colección de tickets.
 */
import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import { ACTIVE_TICKET_STATUSES } from '../models/Ticket.js';

export const create = async (data) => {
    return Ticket.create(data);
};

export const findById = async (id) => {
    return Ticket.findById(id);
};

export const findActiveByUserAndEvent = async (userId, eventId) => {
    return Ticket.findOne({ user: userId, event: eventId, status: { $in: ACTIVE_TICKET_STATUSES } });
};

export const sumActiveQuantityByEvent = async (eventId) => {
    const result = await Ticket.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId), status: { $in: ACTIVE_TICKET_STATUSES } } },
        { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);
    return result[0]?.total || 0;
};

export const findByUser = async (userId) => {
    return Ticket.find({ user: userId })
        .sort({ createdAt: -1 })
        .populate('event', 'title date location status');
};

export const findByEvent = async (eventId) => {
    return Ticket.find({ event: eventId })
        .sort({ createdAt: -1 })
        .populate('user', 'first_name last_name email');
};

export const updateById = async (id, updates) => {
    return Ticket.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
};

export default {
    create,
    findById,
    findActiveByUserAndEvent,
    sumActiveQuantityByEvent,
    findByUser,
    findByEvent,
    updateById
};
