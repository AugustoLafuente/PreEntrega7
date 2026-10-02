/**
 * Controlador para la gestión administrativa de Usuarios.
 */
import usersRepository from '../repositories/users.repository.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getAllUsers = asyncHandler(async (req, res) => {
    const users = await usersRepository.getAllUsers();
    return res.status(200).json({
        status: 'success',
        payload: users
    });
});

export default {
    getAllUsers
};
