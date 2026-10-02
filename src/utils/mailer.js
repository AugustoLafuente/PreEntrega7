/**
 * Envío de emails con Nodemailer. Las credenciales SMTP se leen siempre de
 * variables de entorno (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS,
 * MAIL_FROM); nunca se hardcodean. Si no están configuradas, el envío se
 * omite con un warning en consola en vez de romper el flujo de negocio
 * (crear un ticket no debería fallar por un problema de mail).
 */
import nodemailer from 'nodemailer';
import { config } from '../config/config.js';

const isMailConfigured = () => Boolean(config.mail.host && config.mail.user && config.mail.pass);

let transporter = null;

const getTransporter = () => {
    if (!isMailConfigured()) {
        return null;
    }
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.mail.host,
            port: config.mail.port,
            secure: config.mail.port === 465,
            auth: {
                user: config.mail.user,
                pass: config.mail.pass
            }
        });
    }
    return transporter;
};

export const sendMail = async ({ to, subject, html }) => {
    const activeTransporter = getTransporter();
    if (!activeTransporter) {
        console.warn('[mailer] MAIL_HOST/MAIL_USER/MAIL_PASS no configurados: se omite el envío de email.');
        return { sent: false };
    }

    await activeTransporter.sendMail({
        from: config.mail.from || config.mail.user,
        to,
        subject,
        html
    });

    return { sent: true };
};

export const sendTicketConfirmationEmail = async (to, { eventTitle, eventDate, quantity, reservationCode }) => {
    const formattedDate = new Date(eventDate).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return sendMail({
        to,
        subject: `Inscripción confirmada: ${eventTitle}`,
        html: `
            <h2>¡Tu inscripción fue confirmada!</h2>
            <p><strong>Evento:</strong> ${eventTitle}</p>
            <p><strong>Fecha:</strong> ${formattedDate}</p>
            <p><strong>Cantidad de lugares:</strong> ${quantity}</p>
            <p><strong>Código de reserva:</strong> ${reservationCode}</p>
        `
    });
};

export default {
    sendMail,
    sendTicketConfirmationEmail
};
