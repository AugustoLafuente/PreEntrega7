/**
 * Controlador para la gestión de Sesiones y Autenticación.
 * La validación de datos y credenciales vive en las estrategias de Passport
 * (src/config/passport.config.js); acá solo se genera el JWT, se setea la
 * cookie y se da forma a la respuesta. Cualquier error se delega al
 * middleware global de errores vía asyncHandler.
 */
import { signToken } from '../utils/jwt.js';
import { config, COOKIE_NAME, COOKIE_MAX_AGE } from '../config/config.js';
import asyncHandler from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
    return res.status(201).json({
        status: 'success',
        payload: req.user
    });
});

export const login = asyncHandler(async (req, res) => {
    const { id, email, role } = req.user;

    const token = signToken({ id, email, role });

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        secure: config.nodeEnv === 'production'
    });

    return res.status(200).json({
        status: 'success',
        message: 'Login correcto'
    });
});

export const current = asyncHandler(async (req, res) => {
    const { id, email, role } = req.user;
    return res.status(200).json({
        status: 'success',
        payload: { id, email, role }
    });
});

export const logout = asyncHandler(async (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.nodeEnv === 'production'
    });
    return res.status(200).json({
        status: 'success',
        message: 'Sesión cerrada'
    });
});

export default {
    register,
    login,
    current,
    logout
};
