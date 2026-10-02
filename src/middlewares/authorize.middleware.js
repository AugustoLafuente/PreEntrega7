/**
 * Middleware de autorización reutilizable: recibe los roles permitidos y
 * los compara contra req.user.role (poblado previamente por el middleware
 * de autenticación). Si el rol no está habilitado, delega un 403 al
 * middleware global de errores.
 */
import AppError from '../utils/AppError.js';

export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user?.role)) {
            return next(new AppError('No tenés permisos para realizar esta acción', 403));
        }
        return next();
    };
};

export default authorize;
