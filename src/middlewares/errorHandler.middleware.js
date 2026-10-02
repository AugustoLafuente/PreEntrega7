/**
 * Middleware global de manejo de errores: único lugar donde se decide el
 * código de estado HTTP y el formato de respuesta ante un error. Controllers
 * y middlewares de auth/autorización solo lanzan AppError (o lo pasan a
 * next()); acá se traduce a { status: 'error', message }.
 */
import { config } from '../config/config.js';

export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Error interno del servidor';

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((validationError) => validationError.message)
            .join(', ');
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Identificador inválido';
    }

    if (statusCode === 500) {
        console.error(err);
        if (config.nodeEnv === 'production') {
            message = 'Error interno del servidor';
        }
    }

    return res.status(statusCode).json({
        status: 'error',
        message
    });
};

export const notFoundHandler = (req, res) => {
    return res.status(404).json({
        status: 'error',
        message: 'Recurso no encontrado'
    });
};

export default errorHandler;
