import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = '7d';
const JWT_ISSUER = 'sra-backend';
const JWT_AUDIENCE = 'sra-frontend';

export const signToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN, issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, algorithms: ['HS256'] });
    } catch (error) {
        return null;
    }
};
