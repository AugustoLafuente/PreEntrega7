/**
 * Middleware de autenticación reutilizable: valida el JWT recibido en la
 * cookie httpOnly (a través de la estrategia 'current' de Passport) y puebla
 * req.user. Si no hay sesión válida, delega un 401 al middleware global de
 * errores.
 */
import passport from 'passport';
import AppError from '../utils/AppError.js';

export const auth = (req, res, next) => {
    passport.authenticate('current', { session: false }, (err, user) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return next(new AppError('No autenticado', 401));
        }
        req.user = user;
        return next();
    })(req, res, next);
};

export default auth;
