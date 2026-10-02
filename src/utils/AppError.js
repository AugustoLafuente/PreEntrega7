/**
 * Error de aplicación con código de estado HTTP asociado. Lo usan las
 * estrategias de Passport, los middlewares y la capa de services para
 * señalar errores esperados (400/401/403/404/409...) que el middleware
 * global de errores traduce a la respuesta JSON final.
 */
export class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}

export default AppError;
