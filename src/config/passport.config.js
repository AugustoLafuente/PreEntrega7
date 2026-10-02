/**
 * Configuración centralizada de Passport.js: estrategias de registro,
 * login y usuario actual. Nuevas estrategias (Google, GitHub, etc.) se
 * agregan acá sin tocar app.js.
 */
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy } from 'passport-jwt';
import usersRepository from '../repositories/users.repository.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { config, COOKIE_NAME } from './config.js';
import AppError from '../utils/AppError.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const toSafeUser = (user) => ({
    id: user._id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role
});

// Extrae el JWT desde la cookie httpOnly en lugar del header Authorization.
const cookieExtractor = (req) => req?.cookies?.[COOKIE_NAME] || null;

const initializePassport = () => {
    passport.use(
        'register',
        new LocalStrategy(
            { usernameField: 'email', passwordField: 'password', passReqToCallback: true },
            async (req, email, password, done) => {
                try {
                    const { first_name, last_name } = req.body;

                    if (!first_name || !last_name || !email || !password) {
                        return done(new AppError('Faltan campos obligatorios', 400));
                    }

                    const normalizedEmail = String(email).trim().toLowerCase();

                    if (!EMAIL_REGEX.test(normalizedEmail)) {
                        return done(new AppError('El formato del email es inválido', 400));
                    }

                    if (String(password).length < MIN_PASSWORD_LENGTH) {
                        return done(
                            new AppError(
                                `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
                                400
                            )
                        );
                    }

                    const existingUser = await usersRepository.getUserByEmail(normalizedEmail);
                    if (existingUser) {
                        return done(new AppError('El email ya está registrado', 409));
                    }

                    const hashedPassword = await hashPassword(password);

                    const newUser = await usersRepository.createUser({
                        first_name: String(first_name).trim(),
                        last_name: String(last_name).trim(),
                        email: normalizedEmail,
                        password: hashedPassword
                        // role no se acepta desde el body: siempre queda el valor por defecto del modelo
                    });

                    return done(null, toSafeUser(newUser));
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    passport.use(
        'login',
        new LocalStrategy(
            { usernameField: 'email', passwordField: 'password' },
            async (email, password, done) => {
                try {
                    if (!email || !password) {
                        return done(null, false);
                    }

                    const normalizedEmail = String(email).trim().toLowerCase();
                    const user = await usersRepository.getUserByEmail(normalizedEmail);
                    if (!user) {
                        return done(null, false);
                    }

                    const isPasswordValid = await comparePassword(password, user.password);
                    if (!isPasswordValid) {
                        return done(null, false);
                    }

                    return done(null, toSafeUser(user));
                } catch (error) {
                    return done(error);
                }
            }
        )
    );

    passport.use(
        'current',
        new JwtStrategy(
            {
                jwtFromRequest: cookieExtractor,
                secretOrKey: config.jwtSecret
            },
            async (jwtPayload, done) => {
                try {
                    // El JWT ya contiene { id, email, role }: no hace falta ir a la base.
                    return done(null, jwtPayload);
                } catch (error) {
                    return done(error);
                }
            }
        )
    );
};

// Middlewares de ruta: envuelven passport.authenticate y reenvían cualquier
// error al middleware global (src/middlewares/errorHandler.middleware.js),
// manteniendo las rutas limpias y la lógica de autenticación en las
// estrategias de arriba.
export const authenticateRegister = (req, res, next) => {
    passport.authenticate('register', { session: false }, (err, user) => {
        if (err) {
            return next(err);
        }
        req.user = user;
        return next();
    })(req, res, next);
};

export const authenticateLogin = (req, res, next) => {
    passport.authenticate('login', { session: false }, (err, user) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return next(new AppError('Credenciales inválidas', 401));
        }
        req.user = user;
        return next();
    })(req, res, next);
};

export default initializePassport;
