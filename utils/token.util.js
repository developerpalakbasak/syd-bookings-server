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
 * Generates an Access Token with admin details encoded in the payload.
 * Default validity is 15 minutes.
 */
export const generateAccessToken = (admin) => {
  const expiresIn = process.env.ACCESS_TOKEN_VALIDITY || '15m';
  return jwt.sign(
    {
      _id: admin._id || admin.id,
      id: admin._id || admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      phone: admin.phone || '',
      isActive: admin.isActive !== false,
      lastLoginAt: admin.lastLoginAt,
    },
    getJwtSecret(),
    { expiresIn }
  );
};

/**
 * Generates a Refresh Token encoded as a JWT.
 * Not bound to a single database column, enabling concurrent logins across multiple devices.
 * Default validity is 7 days.
 */
export const generateRefreshToken = (admin) => {
  const expiresIn = process.env.REFRESH_TOKEN_VALIDITY || '7d';
  const adminId = (admin?._id || admin?.id || admin).toString();
  return jwt.sign(
    {
      adminId,
      _id: adminId,
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

