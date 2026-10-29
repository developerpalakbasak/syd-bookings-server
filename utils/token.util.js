import jwt from 'jsonwebtoken';

const getJwtSecret = () => process.env.JWT_SECRET || 'quotes_secret_fallback_key';

/**
 * Parses duration string (e.g. '30m', '7d', '1h') into milliseconds
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

export const generateAccessToken = (admin) => {
  const expiresIn = process.env.ACCESS_TOKEN_VALIDITY || '30m';
  return jwt.sign(
    {
      _id: admin._id || admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
    },
    getJwtSecret(),
    { expiresIn }
  );
};

export const generateRefreshToken = (admin) => {
  const expiresIn = process.env.REFRESH_TOKEN_VALIDITY || '7d';
  return jwt.sign(
    {
      _id: admin._id || admin.id,
    },
    getJwtSecret(),
    { expiresIn }
  );
};

export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

export const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Cookie options helper for secure HttpOnly cookie storage
 */
export const getCookieOptions = (maxAgeMs) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  };
  if (typeof maxAgeMs === 'number') {
    options.maxAge = maxAgeMs;
  }
  return options;
};
