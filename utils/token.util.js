import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const getJwtSecret = () => process.env.JWT_SECRET || 'quotes_secret_fallback_key';

/**
 * Parses duration string (e.g. '15m', '7d', '1h') into milliseconds
 */
export const parseDurationToMs = (durationStr, fallbackMs) => {
  if (!durationStr) return fallbackMs;
  const match = durationStr.toString().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
};

/**
 * Generates an Access Token with user/admin details encoded in the payload.
 * Default validity configured via ACCESS_TOKEN_VALIDITY (e.g. 30m).
 */
export const generateAccessToken = (user) => {
  const expiresIn = process.env.ACCESS_TOKEN_VALIDITY || '30m';
  const name = user.fullName || user.name || '';
  return jwt.sign(
    {
      _id: user._id || user.id,
      id: user._id || user.id,
      name,
      fullName: name,
      email: user.email,
      role: user.role || 'passenger',
      phone: user.phone || '',
      isActive: user.isActive !== false,
      lastLoginAt: user.lastLoginAt,
    },
    getJwtSecret(),
    { expiresIn }
  );
};

/**
 * Generates a Refresh Token encoded as a JWT with token rotation UUID.
 * Not bound to a single database column, enabling concurrent logins across multiple devices.
 * Default validity configured via REFRESH_TOKEN_VALIDITY (e.g. 7d).
 */
export const generateRefreshToken = (user) => {
  const expiresIn = process.env.REFRESH_TOKEN_VALIDITY || '7d';
  const userId = (user?._id || user?.id || user).toString();
  return jwt.sign(
    {
      userId,
      adminId: userId,
      customerId: userId,
      _id: userId,
      role: user?.role || 'passenger',
      tokenId: crypto.randomUUID(),
    },
    getJwtSecret(),
    { expiresIn }
  );
};

/**
 * Verifies a JWT and returns decoded payload.
 * Throws structured errors with statusCode 401 on expiration or invalid signature.
 */
export const decodeToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Token expired');
      err.name = 'TokenExpiredError';
      err.statusCode = 401;
      throw err;
    }
    if (error.name === 'JsonWebTokenError') {
      const err = new Error('Invalid token');
      err.name = 'JsonWebTokenError';
      err.statusCode = 401;
      throw err;
    }
    const err = new Error('Authentication failed');
    err.statusCode = 401;
    throw err;
  }
};

export const verifyToken = (token) => {
  return decodeToken(token);
};

/**
 * Cookie options helper for secure HttpOnly cookie storage.
 * Works seamlessly in both local development and HTTPS production.
 */
export const getCookieOptions = (maxAgeMs) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };
  if (typeof maxAgeMs === 'number') {
    options.maxAge = maxAgeMs;
  }
  return options;
};

