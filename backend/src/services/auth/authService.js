import prisma from '../../config/prisma.js';
import { hashPassword, comparePassword } from '../../utils/passwordUtils.js';
import { signToken } from '../../config/jwt.js';
import { createSession } from './sessionService.js';
import { encryptData } from '../../utils/dataEncryption.js';

/**
 * The user fields that may leave the server.
 *
 * Every auth entry point used to return the raw Prisma `User` row, and the controllers put
 * it straight into the response body — so `POST /auth/signup` and `POST /auth/login`
 * answered with the account's bcrypt `password` hash on success. A hash is not a password,
 * but it is the material an offline cracking attempt needs, it was handed to anyone who
 * could log in (including to their own browser's devtools, extensions, and any XSS), and
 * nothing in the client ever read it.
 *
 * This is a projection rather than a `delete user.password`: a field added to the model
 * later is excluded by default instead of being published until someone remembers it.
 */
export const toPublicUser = (user) => user && ({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    createdAt: user.createdAt
});

export const registerUser = async (email, password, name, userAgent = null, ip = null) => {
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

    const { refreshToken, sessionId } = await createSession(user.id, userAgent, ip);
    const token = signToken({ userId: user.id, email: user.email, sessionId });

    return { user: toPublicUser(user), token, refreshToken, sessionId };
};

/**
 * Per-account brute-force limits.
 *
 * Rate limiting was per-IP only, which does not see the attack it most needs to: credential
 * stuffing against one known account, spread thin across many addresses. Ten attempts from
 * a thousand IPs never troubled a per-IP bucket. The counter therefore lives on the User row
 * — durable, and shared across every source address — rather than in Redis, where a cache
 * restart would silently reset a lockout mid-attack.
 *
 * The threshold is high enough that a person mistyping a password does not trip it, and the
 * cool-off is short enough to be an inconvenience rather than a denial of service, because
 * anyone who knows an email address can deliberately lock it. That griefing risk is the
 * accepted cost of the control; it is why this expires on its own rather than requiring
 * support to unlock.
 */
export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_MINUTES = 15;

const lockoutError = (until) => {
    const error = new Error('Too many failed sign-in attempts for this account. Try again shortly.');
    error.statusCode = 429;
    error.retryAfter = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
    return error;
};

/** Record a failed attempt and lock the account once the threshold is reached. */
const registerFailedLogin = async (user) => {
    const attempts = user.failedLoginAttempts + 1;

    if (attempts >= LOCKOUT_THRESHOLD) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil }
        });
        return lockedUntil;
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts }
    });
    return null;
};

export const loginUser = async (email, password, userAgent = null, ip = null) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
        throw new Error('Invalid email or password');
    }

    // Checked before the password comparison: while locked, an attempt must cost nothing and
    // reveal nothing, not even through the timing of a bcrypt compare.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw lockoutError(user.lockedUntil);
    }

    if (user.deletedAt) {
        const error = new Error('This account is scheduled for deletion. Restore it first if you did not mean to delete it.');
        error.statusCode = 410;
        throw error;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        const lockedUntil = await registerFailedLogin(user);
        if (lockedUntil) throw lockoutError(lockedUntil);
        throw new Error('Invalid email or password');
    }

    // A successful sign-in clears the record — someone who eventually remembers their own
    // password should not be one typo away from a lockout for the rest of the day.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null }
        });
    }

    const { refreshToken, sessionId } = await createSession(user.id, userAgent, ip);
    const token = signToken({ userId: user.id, email: user.email, sessionId });

    return { user: toPublicUser(user), token, refreshToken, sessionId };
};

/**
 * Verify a password for the sole purpose of cancelling a pending deletion.
 *
 * Requesting deletion revokes every session, so there is no token to authenticate the
 * cancellation with — and re-entering the password is the right bar for undoing a
 * destructive request anyway. Deliberately narrow: it issues no session and returns nothing
 * but an id, so it cannot be repurposed as a second, lockout-free login path.
 */
export const verifyCredentialsForRestore = async (email, password) => {
    const user = await prisma.user.findUnique({ where: { email } });
    const invalid = () => {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        return error;
    };

    if (!user || !user.password) throw invalid();
    if (user.lockedUntil && user.lockedUntil > new Date()) throw lockoutError(user.lockedUntil);

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        const lockedUntil = await registerFailedLogin(user);
        if (lockedUntil) throw lockoutError(lockedUntil);
        throw invalid();
    }

    return user.id;
};

export const handleGoogleAuth = async (googleUser, tokens, userAgent, ip) => {
    const { email, name, picture, id, verified_email: verifiedEmail } = googleUser;

    // An email address is the sole link between an OAuth identity and an existing account:
    // the lookup below hands over whatever account already claims this address, including one
    // created with an email and password. That is only sound if the provider has actually
    // verified the address, so an unverified one is refused rather than trusted.
    if (!email || verifiedEmail === false) {
        const error = new Error('Your Google account has no verified email address. Verify it with Google, then sign in again.');
        error.statusCode = 400;
        throw error;
    }

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
                        access_token: encryptData(tokens.access_token),
                        refresh_token: encryptData(tokens.refresh_token),
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
                    access_token: encryptData(tokens.access_token),
                    refresh_token: encryptData(tokens.refresh_token),
                },
            });
        } else {
            // Update tokens
            await prisma.account.update({
                where: { id: existingAccount.id },
                data: {
                    access_token: encryptData(tokens.access_token),
                    refresh_token: encryptData(tokens.refresh_token),
                }
            });
        }
    }

    const { refreshToken, sessionId } = await createSession(user.id, userAgent, ip);
    const token = signToken({ userId: user.id, email: user.email, sessionId });
    return { user: toPublicUser(user), token, refreshToken, sessionId };
};

export const getUserById = async (userId) => {
    return await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, image: true, createdAt: true },
    });
};

export const handleGithubAuth = async (githubUser, tokens, userAgent, ip) => {
    const { email, name, avatar_url, id, login } = githubUser;

    // 1. Check if user exists by email
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        // Create new user
        user = await prisma.user.create({
            data: {
                email,
                name: name || login,
                image: avatar_url,
                accounts: {
                    create: {
                        provider: 'github',
                        providerAccountId: id.toString(),
                        access_token: encryptData(tokens.access_token),
                    },
                },
            },
        });
    } else {
        // User exists - ensure Account link exists
        const existingAccount = await prisma.account.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: 'github',
                    providerAccountId: id.toString(),
                },
            },
        });

        if (!existingAccount) {
            // Link GitHub account to existing user
            await prisma.account.create({
                data: {
                    userId: user.id,
                    provider: 'github',
                    providerAccountId: id.toString(),
                    access_token: encryptData(tokens.access_token),
                },
            });
        } else {
            // Update tokens
            await prisma.account.update({
                where: { id: existingAccount.id },
                data: {
                    access_token: encryptData(tokens.access_token),
                }
            });
        }
    }

    const { refreshToken, sessionId } = await createSession(user.id, userAgent, ip);
    const token = signToken({ userId: user.id, email: user.email, sessionId });
    return { user: toPublicUser(user), token, refreshToken, sessionId };
};
