/**
 * Esquema y modelo de Mongoose para la entidad Ticket (inscripción de un
 * usuario a un evento, con control de cupos).
 */
import mongoose from 'mongoose';

export const TICKET_STATUSES = ['confirmed', 'pending', 'cancelled'];
// Solo los tickets en estos estados ocupan cupo del evento; los cancelled no cuentan.
export const ACTIVE_TICKET_STATUSES = ['confirmed', 'pending'];

const generateReservationCode = () =>
    `TCK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const ticketSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: true
        },
        status: {
            type: String,
            enum: TICKET_STATUSES,
            default: 'confirmed'
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        },
        reservationCode: {
            type: String,
            required: true,
            unique: true,
            default: generateReservationCode
        },
        cancelledAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true // agrega createdAt y updatedAt
    }
);

export const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;
