import prisma from '../config/prisma.js';
import { hashPassword, comparePassword } from '../utils/passwordUtils.js';
import { signToken } from '../config/jwt.js';

export const registerUser = async (email, password, name) => {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('User already exists');
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
        },
    });

    const token = signToken({ userId: user.id, email: user.email });
    return { user, token };
};

export const loginUser = async (email, password) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
        throw new Error('Invalid email or password');
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid email or password');
    }

    const token = signToken({ userId: user.id, email: user.email });
    return { user, token };
};

export const handleGoogleAuth = async (googleUser, tokens) => {
    const { email, name, picture, id } = googleUser;

    // 1. Check if user exists by email
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        // Create new user (no password)
        user = await prisma.user.create({
            data: {
                email,
                name,
                image: picture,
                accounts: {
                    create: {
                        provider: 'google',
                        providerAccountId: id,
                        access_token: tokens.access_token,
                        refresh_token: tokens.refresh_token,
                    },
                },
            },
        });
    } else {
        // User exists - ensure Account link exists
        // (Optional: update image/name)
        const existingAccount = await prisma.account.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: 'google',
                    providerAccountId: id,
                },
            },
        });

        if (!existingAccount) {
            // Link Google account to existing user
            await prisma.account.create({
                data: {
                    userId: user.id,
                    provider: 'google',
                    providerAccountId: id,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                },
            });
        } else {
            // Update tokens
            await prisma.account.update({
                where: { id: existingAccount.id },
                data: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                }
            });
        }
    }

    const token = signToken({ userId: user.id, email: user.email });
    return { user, token };
};

export const getUserById = async (userId) => {
    return await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, image: true, createdAt: true },
    });
};
