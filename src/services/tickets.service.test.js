import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import ticketsRepository from '../repositories/tickets.repository.js';
import eventsRepository from '../repositories/events.repository.js';
import mailer from '../utils/mailer.js';
import ticketsService from './tickets.service.js';

const USER = { id: new mongoose.Types.ObjectId().toString(), email: 'user@mail.com', role: 'user' };
const ADMIN = { id: new mongoose.Types.ObjectId().toString(), role: 'admin' };
const ORGANIZER_ID = new mongoose.Types.ObjectId().toString();

const futureDate = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);

const buildFakeEvent = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    title: 'Maratón',
    date: futureDate(),
    location: 'CABA',
    capacity: 2,
    status: 'published',
    organizer: ORGANIZER_ID,
    ...overrides
});

const buildFakeTicket = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    user: USER.id,
    event: new mongoose.Types.ObjectId(),
    status: 'confirmed',
    quantity: 1,
    reservationCode: 'TCK-TEST',
    createdAt: new Date(),
    cancelledAt: null,
    ...overrides
});

describe('tickets.service - createTicket', () => {
    test('evento inexistente responde 404', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => null);

        await assert.rejects(
            () => ticketsService.createTicket(new mongoose.Types.ObjectId().toString(), USER, 1),
            (error) => {
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });

    test('rechaza inscripción a evento cancelado', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ status: 'cancelled' }));

        await assert.rejects(
            () => ticketsService.createTicket(new mongoose.Types.ObjectId().toString(), USER, 1),
            (error) => {
                assert.equal(error.statusCode, 400);
                assert.match(error.message, /cancelado/);
                return true;
            }
        );
    });

    test('rechaza inscripción a evento finalizado', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ status: 'finished' }));

        await assert.rejects(
            () => ticketsService.createTicket(new mongoose.Types.ObjectId().toString(), USER, 1),
            (error) => {
                assert.equal(error.statusCode, 400);
                assert.match(error.message, /finalizó/);
                return true;
            }
        );
    });

    test('rechaza inscripción a evento en draft (no publicado)', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ status: 'draft' }));

        await assert.rejects(
            () => ticketsService.createTicket(new mongoose.Types.ObjectId().toString(), USER, 1),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('rechaza quantity inválida', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent());

        await assert.rejects(
            () => ticketsService.createTicket(new mongoose.Types.ObjectId().toString(), USER, 0),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('rechaza una segunda inscripción activa del mismo usuario', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent());
        t.mock.method(ticketsRepository, 'findActiveTicket', async () => buildFakeTicket());

        await assert.rejects(
            () => ticketsService.createTicket(new mongoose.Types.ObjectId().toString(), USER, 1),
            (error) => {
                assert.equal(error.statusCode, 409);
                return true;
            }
        );
    });

    test('rechaza cuando no hay cupos suficientes (cancelados no cuentan)', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ capacity: 2 }));
        t.mock.method(ticketsRepository, 'findActiveTicket', async () => null);
        t.mock.method(ticketsRepository, 'getOccupiedQuantity', async () => 2); // cupo lleno con tickets activos

        await assert.rejects(
            () => ticketsService.createTicket(new mongoose.Types.ObjectId().toString(), USER, 1),
            (error) => {
                assert.equal(error.statusCode, 400);
                assert.match(error.message, /cupos/);
                return true;
            }
        );
    });

    test('crea el ticket cuando hay cupo disponible y envía el email de confirmación', async (t) => {
        const fakeEvent = buildFakeEvent({ capacity: 2 });
        t.mock.method(eventsRepository, 'getEventById', async () => fakeEvent);
        t.mock.method(ticketsRepository, 'findActiveTicket', async () => null);
        t.mock.method(ticketsRepository, 'getOccupiedQuantity', async () => 0);
        let createdPayload;
        t.mock.method(ticketsRepository, 'createTicket', async (data) => {
            createdPayload = data;
            return buildFakeTicket(data);
        });
        const mailMock = t.mock.method(mailer, 'sendTicketConfirmationEmail', async () => ({ sent: true }));

        const result = await ticketsService.createTicket(fakeEvent._id.toString(), USER, 1);

        assert.equal(result.status, 'confirmed');
        assert.equal(createdPayload.user, USER.id);
        assert.equal(mailMock.mock.callCount(), 1);
    });

    test('la inscripción no falla aunque el email rechace el envío', async (t) => {
        const fakeEvent = buildFakeEvent({ capacity: 2 });
        t.mock.method(eventsRepository, 'getEventById', async () => fakeEvent);
        t.mock.method(ticketsRepository, 'findActiveTicket', async () => null);
        t.mock.method(ticketsRepository, 'getOccupiedQuantity', async () => 0);
        t.mock.method(ticketsRepository, 'createTicket', async (data) => buildFakeTicket(data));
        t.mock.method(mailer, 'sendTicketConfirmationEmail', async () => {
            throw new Error('SMTP caído');
        });

        const result = await ticketsService.createTicket(fakeEvent._id.toString(), USER, 1);
        assert.equal(result.status, 'confirmed');
    });
});

describe('tickets.service - cancelTicket', () => {
    test('ticket inexistente responde 404', async (t) => {
        t.mock.method(ticketsRepository, 'getTicketById', async () => null);

        await assert.rejects(
            () => ticketsService.cancelTicket(new mongoose.Types.ObjectId().toString(), USER),
            (error) => {
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });

    test('un user no puede cancelar el ticket de otro', async (t) => {
        t.mock.method(ticketsRepository, 'getTicketById', async () => buildFakeTicket({ user: new mongoose.Types.ObjectId().toString() }));

        await assert.rejects(
            () => ticketsService.cancelTicket(new mongoose.Types.ObjectId().toString(), USER),
            (error) => {
                assert.equal(error.statusCode, 403);
                return true;
            }
        );
    });

    test('admin puede cancelar el ticket de cualquier usuario', async (t) => {
        t.mock.method(ticketsRepository, 'getTicketById', async () => buildFakeTicket({ user: new mongoose.Types.ObjectId().toString() }));
        t.mock.method(ticketsRepository, 'updateTicket', async (id, updates) => buildFakeTicket(updates));

        const result = await ticketsService.cancelTicket(new mongoose.Types.ObjectId().toString(), ADMIN);
        assert.equal(result.status, 'cancelled');
        assert.ok(result.cancelledAt);
    });

    test('no permite cancelar un ticket ya cancelado', async (t) => {
        t.mock.method(ticketsRepository, 'getTicketById', async () => buildFakeTicket({ status: 'cancelled' }));

        await assert.rejects(
            () => ticketsService.cancelTicket(new mongoose.Types.ObjectId().toString(), USER),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });
});

describe('tickets.service - listEventTickets', () => {
    test('un organizer ajeno al evento no puede ver sus tickets', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ organizer: new mongoose.Types.ObjectId().toString() }));

        await assert.rejects(
            () => ticketsService.listEventTickets(new mongoose.Types.ObjectId().toString(), { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 403);
                return true;
            }
        );
    });

    test('el organizer dueño del evento puede ver sus tickets', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ organizer: ORGANIZER_ID }));
        t.mock.method(ticketsRepository, 'getTicketsByEvent', async () => [buildFakeTicket()]);

        const result = await ticketsService.listEventTickets(new mongoose.Types.ObjectId().toString(), { id: ORGANIZER_ID, role: 'organizer' });
        assert.equal(result.length, 1);
    });
});
