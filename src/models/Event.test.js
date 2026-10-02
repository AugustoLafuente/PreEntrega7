import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Event from './Event.js';

const VALID_DATA = {
    title: 'Maratón de Buenos Aires',
    description: 'Carrera de 42km por la ciudad',
    category: 'running',
    location: 'Buenos Aires',
    date: new Date('2027-01-01'),
    capacity: 100,
    organizer: new mongoose.Types.ObjectId()
};

describe('Modelo Event', () => {
    test('es válido con todos los campos obligatorios', () => {
        const event = new Event(VALID_DATA);
        const error = event.validateSync();
        assert.equal(error, undefined);
    });

    test('nace con status "draft" por defecto', () => {
        const event = new Event(VALID_DATA);
        assert.equal(event.status, 'draft');
    });

    test('nace con price 0 por defecto', () => {
        const event = new Event(VALID_DATA);
        assert.equal(event.price, 0);
    });

    for (const field of ['title', 'description', 'category', 'location', 'date', 'capacity', 'organizer']) {
        test(`requiere el campo "${field}"`, () => {
            const data = { ...VALID_DATA };
            delete data[field];
            const event = new Event(data);
            const error = event.validateSync();
            assert.ok(error, `se esperaba un error de validación al faltar "${field}"`);
            assert.ok(error.errors[field], `se esperaba un error puntual sobre "${field}"`);
        });
    }

    test('rechaza capacity <= 0', () => {
        const event = new Event({ ...VALID_DATA, capacity: 0 });
        const error = event.validateSync();
        assert.ok(error);
        assert.ok(error.errors.capacity);
    });

    test('rechaza price negativo', () => {
        const event = new Event({ ...VALID_DATA, price: -10 });
        const error = event.validateSync();
        assert.ok(error);
        assert.ok(error.errors.price);
    });

    test('rechaza un status fuera del enum permitido', () => {
        const event = new Event({ ...VALID_DATA, status: 'en_pausa' });
        const error = event.validateSync();
        assert.ok(error);
        assert.ok(error.errors.status);
    });

    for (const status of ['draft', 'published', 'cancelled', 'finished']) {
        test(`acepta el status "${status}"`, () => {
            const event = new Event({ ...VALID_DATA, status });
            const error = event.validateSync();
            assert.equal(error, undefined);
        });
    }
});
