/**
 * Envuelve un handler async de Express para reenviar cualquier rechazo de
 * promesa a next(error), evitando repetir try/catch en cada controlador.
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
