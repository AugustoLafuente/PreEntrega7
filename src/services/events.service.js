/**
 * Lógica de negocio para la creación, consulta, modificación y cambio de
 * estado de eventos.
 */
import mongoose from 'mongoose';
import eventsRepository from '../repositories/events.repository.js';
import { EVENT_STATUSES } from '../models/Event.js';
import AppError from '../utils/AppError.js';

const REQUIRED_CREATE_FIELDS = ['title', 'description', 'category', 'location'];
const UPDATABLE_FIELDS = ['title', 'description', 'category', 'date', 'location', 'capacity', 'price', 'sport_type'];
const SORTABLE_FIELDS = ['date', 'price', 'capacity', 'createdAt'];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
// Un evento cancelado es un estado terminal: no se puede editar ni transicionar a otro estado.
const TERMINAL_STATUSES = ['cancelled'];

const toEventDTO = (event) => ({
    id: event._id,
    title: event.title,
    description: event.description,
    sport_type: event.sport_type,
    category: event.category,
    date: event.date,
    location: event.location,
    capacity: event.capacity,
    price: event.price,
    status: event.status,
    organizer: event.organizer
});

const parseDate = (value, fieldErrorMessage) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError(fieldErrorMessage, 400);
    }
    return parsed;
};

const getOwnedEventOrThrow = async (eventId, user) => {
    if (!mongoose.isValidObjectId(eventId)) {
        throw new AppError('Evento no encontrado', 404);
    }

    const event = await eventsRepository.getEventById(eventId);
    if (!event) {
        throw new AppError('Evento no encontrado', 404);
    }

    const isOwner = event.organizer.toString() === user.id;
    if (!isOwner && user.role !== 'admin') {
        throw new AppError('No tenés permisos para modificar este evento', 403);
    }

    return event;
};

export const listEvents = async (query = {}) => {
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.location) filter.location = query.location;

    if (query.dateFrom || query.dateTo) {
        filter.date = {};
        if (query.dateFrom) filter.date.$gte = parseDate(query.dateFrom, 'dateFrom es inválida');
        if (query.dateTo) filter.date.$lte = parseDate(query.dateTo, 'dateTo es inválida');
    }

    const page = Math.max(parseInt(query.page, 10) || DEFAULT_PAGE, 1);
    const limit = Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1);

    let sort = { date: 1 };
    if (query.sort) {
        const field = String(query.sort).replace(/^-/, '');
        if (SORTABLE_FIELDS.includes(field)) {
            const direction = String(query.sort).startsWith('-') ? -1 : 1;
            sort = { [field]: direction };
        }
    }

    const [events, total] = await Promise.all([
        eventsRepository.findEvents(filter, { page, limit, sort }),
        eventsRepository.countEvents(filter)
    ]);

    return {
        data: events.map(toEventDTO),
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    };
};

export const getEventById = async (eventId) => {
    if (!mongoose.isValidObjectId(eventId)) {
        throw new AppError('Evento no encontrado', 404);
    }

    const event = await eventsRepository.getEventById(eventId);
    if (!event) {
        throw new AppError('Evento no encontrado', 404);
    }

    return toEventDTO(event);
};

export const createEvent = async (eventData, organizerId) => {
    for (const field of REQUIRED_CREATE_FIELDS) {
        if (!eventData[field]) {
            throw new AppError(`Falta el campo obligatorio: ${field}`, 400);
        }
    }

    if (!eventData.date) {
        throw new AppError('Falta el campo obligatorio: date', 400);
    }
    const eventDate = parseDate(eventData.date, 'La fecha del evento es inválida');
    if (eventDate.getTime() < Date.now()) {
        throw new AppError('No se puede crear un evento con fecha pasada', 400);
    }

    const capacity = Number(eventData.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
        throw new AppError('La capacidad debe ser mayor a 0', 400);
    }

    const price = eventData.price === undefined ? 0 : Number(eventData.price);
    if (!Number.isFinite(price) || price < 0) {
        throw new AppError('El precio no puede ser negativo', 400);
    }

    const newEvent = await eventsRepository.createEvent({
        title: eventData.title,
        description: eventData.description,
        sport_type: eventData.sport_type,
        category: eventData.category,
        date: eventDate,
        location: eventData.location,
        capacity,
        price,
        organizer: organizerId
        // status no se acepta desde el body: todo evento nuevo nace en 'draft'
    });

    return toEventDTO(newEvent);
};

export const updateEvent = async (eventId, updates, user) => {
    const event = await getOwnedEventOrThrow(eventId, user);

    if (TERMINAL_STATUSES.includes(event.status)) {
        throw new AppError('No se puede modificar un evento cancelado', 400);
    }

    const sanitizedUpdates = {};
    for (const field of UPDATABLE_FIELDS) {
        if (updates[field] !== undefined) {
            sanitizedUpdates[field] = updates[field];
        }
    }

    if (sanitizedUpdates.date !== undefined) {
        sanitizedUpdates.date = parseDate(sanitizedUpdates.date, 'La fecha del evento es inválida');
        if (sanitizedUpdates.date.getTime() < Date.now()) {
            throw new AppError('No se puede actualizar el evento a una fecha pasada', 400);
        }
    }

    if (sanitizedUpdates.capacity !== undefined) {
        const capacity = Number(sanitizedUpdates.capacity);
        if (!Number.isFinite(capacity) || capacity <= 0) {
            throw new AppError('La capacidad debe ser mayor a 0', 400);
        }
        sanitizedUpdates.capacity = capacity;
    }

    if (sanitizedUpdates.price !== undefined) {
        const price = Number(sanitizedUpdates.price);
        if (!Number.isFinite(price) || price < 0) {
            throw new AppError('El precio no puede ser negativo', 400);
        }
        sanitizedUpdates.price = price;
    }

    const updatedEvent = await eventsRepository.updateEvent(eventId, sanitizedUpdates);
    return toEventDTO(updatedEvent);
};

export const updateEventStatus = async (eventId, newStatus, user) => {
    if (!EVENT_STATUSES.includes(newStatus)) {
        throw new AppError('Estado inválido', 400);
    }

    const event = await getOwnedEventOrThrow(eventId, user);

    if (TERMINAL_STATUSES.includes(event.status)) {
        throw new AppError('No se puede modificar el estado de un evento cancelado', 400);
    }

    if (newStatus === 'published' && event.status === 'finished') {
        throw new AppError('No se puede publicar un evento ya finalizado', 400);
    }

    const updatedEvent = await eventsRepository.updateEvent(eventId, { status: newStatus });
    return toEventDTO(updatedEvent);
};

export default {
    listEvents,
    getEventById,
    createEvent,
    updateEvent,
    updateEventStatus
};
