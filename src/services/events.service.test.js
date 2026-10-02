import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import eventsRepository from '../repositories/events.repository.js';
import eventsService from './events.service.js';

const ORGANIZER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_ORGANIZER_ID = new mongoose.Types.ObjectId().toString();
const ADMIN_USER = { id: new mongoose.Types.ObjectId().toString(), role: 'admin' };

const futureDate = () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // +30 días
const pastDate = () => new Date(Date.now() - 1000 * 60 * 60 * 24); // -1 día

const VALID_CREATE_INPUT = {
    title: 'Torneo de Running',
    description: 'Carrera 10k',
    category: 'running',
    location: 'CABA',
    date: futureDate().toISOString(),
    capacity: 50,
    price: 0
};

const buildFakeEvent = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    title: 'Evento existente',
    description: 'desc',
    category: 'running',
    location: 'CABA',
    date: futureDate(),
    capacity: 10,
    price: 0,
    status: 'draft',
    organizer: ORGANIZER_ID,
    ...overrides
});

describe('events.service - createEvent', () => {
    test('rechaza fecha pasada', async () => {
        await assert.rejects(
            () => eventsService.createEvent({ ...VALID_CREATE_INPUT, date: pastDate().toISOString() }, ORGANIZER_ID),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('rechaza capacity <= 0', async () => {
        await assert.rejects(
            () => eventsService.createEvent({ ...VALID_CREATE_INPUT, capacity: 0 }, ORGANIZER_ID),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('rechaza price negativo', async () => {
        await assert.rejects(
            () => eventsService.createEvent({ ...VALID_CREATE_INPUT, price: -5 }, ORGANIZER_ID),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('rechaza campos obligatorios faltantes', async () => {
        const { title, ...withoutTitle } = VALID_CREATE_INPUT;
        await assert.rejects(
            () => eventsService.createEvent(withoutTitle, ORGANIZER_ID),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('asigna el organizer desde el parámetro e ignora el status del body', async (t) => {
        let createdPayload;
        t.mock.method(eventsRepository, 'createEvent', async (data) => {
            createdPayload = data;
            return buildFakeEvent(data);
        });

        await eventsService.createEvent({ ...VALID_CREATE_INPUT, status: 'published', organizer: OTHER_ORGANIZER_ID }, ORGANIZER_ID);

        assert.equal(createdPayload.organizer, ORGANIZER_ID);
        assert.equal(createdPayload.status, undefined); // el service nunca reenvía status al repository en el create
    });
});

describe('events.service - updateEvent', () => {
    test('rechaza actualizar a una fecha pasada (bug reportado)', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent());

        await assert.rejects(
            () => eventsService.updateEvent(new mongoose.Types.ObjectId().toString(), { date: pastDate().toISOString() }, { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 400);
                assert.match(error.message, /fecha pasada/);
                return true;
            }
        );
    });

    test('permite actualizar a una fecha futura', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent());
        t.mock.method(eventsRepository, 'updateEvent', async (id, updates) => buildFakeEvent(updates));

        const newDate = futureDate().toISOString();
        const result = await eventsService.updateEvent(
            new mongoose.Types.ObjectId().toString(),
            { date: newDate },
            { id: ORGANIZER_ID, role: 'organizer' }
        );

        assert.equal(new Date(result.date).toISOString(), new Date(newDate).toISOString());
    });

    test('bloquea la modificación de un evento cancelado', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ status: 'cancelled' }));

        await assert.rejects(
            () => eventsService.updateEvent(new mongoose.Types.ObjectId().toString(), { title: 'nuevo' }, { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('un organizer no puede modificar el evento de otro organizer', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ organizer: OTHER_ORGANIZER_ID }));

        await assert.rejects(
            () => eventsService.updateEvent(new mongoose.Types.ObjectId().toString(), { title: 'hackeado' }, { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 403);
                return true;
            }
        );
    });

    test('admin puede modificar el evento de cualquier organizer', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ organizer: OTHER_ORGANIZER_ID }));
        t.mock.method(eventsRepository, 'updateEvent', async (id, updates) => buildFakeEvent({ organizer: OTHER_ORGANIZER_ID, ...updates }));

        const result = await eventsService.updateEvent(new mongoose.Types.ObjectId().toString(), { title: 'editado por admin' }, ADMIN_USER);
        assert.equal(result.title, 'editado por admin');
    });

    test('evento inexistente responde 404', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => null);

        await assert.rejects(
            () => eventsService.updateEvent(new mongoose.Types.ObjectId().toString(), { title: 'x' }, { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });
});

describe('events.service - updateEventStatus', () => {
    test('rechaza un status inválido', async () => {
        await assert.rejects(
            () => eventsService.updateEventStatus(new mongoose.Types.ObjectId().toString(), 'no_existe', { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('no permite cambiar el status de un evento ya cancelado', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ status: 'cancelled' }));

        await assert.rejects(
            () => eventsService.updateEventStatus(new mongoose.Types.ObjectId().toString(), 'published', { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('no permite publicar un evento ya finalizado', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ status: 'finished' }));

        await assert.rejects(
            () => eventsService.updateEventStatus(new mongoose.Types.ObjectId().toString(), 'published', { id: ORGANIZER_ID, role: 'organizer' }),
            (error) => {
                assert.equal(error.statusCode, 400);
                return true;
            }
        );
    });

    test('permite cancelar un evento propio en estado draft', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => buildFakeEvent({ status: 'draft' }));
        t.mock.method(eventsRepository, 'updateEvent', async (id, updates) => buildFakeEvent({ status: updates.status }));

        const result = await eventsService.updateEventStatus(new mongoose.Types.ObjectId().toString(), 'cancelled', { id: ORGANIZER_ID, role: 'organizer' });
        assert.equal(result.status, 'cancelled');
    });
});

describe('events.service - getEventById', () => {
    test('responde 404 con un id de formato inválido', async () => {
        await assert.rejects(
            () => eventsService.getEventById('id-invalido'),
            (error) => {
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });

    test('responde 404 si el evento no existe', async (t) => {
        t.mock.method(eventsRepository, 'getEventById', async () => null);

        await assert.rejects(
            () => eventsService.getEventById(new mongoose.Types.ObjectId().toString()),
            (error) => {
                assert.equal(error.statusCode, 404);
                return true;
            }
        );
    });

    test('devuelve el DTO del evento cuando existe', async (t) => {
        const fakeEvent = buildFakeEvent();
        t.mock.method(eventsRepository, 'getEventById', async () => fakeEvent);

        const result = await eventsService.getEventById(fakeEvent._id.toString());
        assert.equal(result.title, fakeEvent.title);
        assert.equal(result.id, fakeEvent._id);
    });
});

describe('events.service - listEvents', () => {
    test('devuelve data, page, limit, total y totalPages', async (t) => {
        const fakeEvents = [buildFakeEvent(), buildFakeEvent()];
        t.mock.method(eventsRepository, 'findEvents', async () => fakeEvents);
        t.mock.method(eventsRepository, 'countEvents', async () => 12);

        const result = await eventsService.listEvents({ page: '2', limit: '2' });

        assert.equal(result.data.length, 2);
        assert.equal(result.page, 2);
        assert.equal(result.limit, 2);
        assert.equal(result.total, 12);
        assert.equal(result.totalPages, 6);
    });

    test('totalPages es 0 cuando no hay resultados', async (t) => {
        t.mock.method(eventsRepository, 'findEvents', async () => []);
        t.mock.method(eventsRepository, 'countEvents', async () => 0);

        const result = await eventsService.listEvents({});
        assert.equal(result.total, 0);
        assert.equal(result.totalPages, 0);
    });
});
