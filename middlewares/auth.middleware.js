import { Admin } from '../models/admin.model.js';
import {
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
  parseDurationToMs,
  getCookieOptions,
} from '../utils/token.util.js';

/**
 * Authentication middleware that verifies accessToken or automatically rotates refreshToken
 */
export const authenticateAdmin = async (req, res, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');
    const refreshToken = req.cookies?.refreshToken;

    // 1. If accessToken is present, attempt verification
    if (accessToken) {
      try {
        const decoded = verifyToken(accessToken);
        const adminId = decoded._id || decoded.id;
        const admin = await Admin.findById(adminId).select('+role +isActive');

        if (!admin || !admin.isActive) {
          const err = new Error('Admin account is inactive or not found');
          err.statusCode = 401;
          return next(err);
        }

        req.admin = admin;
        return next();
      } catch (tokenErr) {
        // If accessToken is expired and refreshToken exists, fall through to auto-rotation
        if (tokenErr.name !== 'TokenExpiredError' || !refreshToken) {
          const err = new Error('Invalid access token');
          err.statusCode = 401;
          return next(err);
        }
      }
    }

    // 2. Access token missing or expired: Attempt Refresh Token Rotation
    if (!refreshToken) {
      const err = new Error('Authentication required. Please log in.');
      err.statusCode = 401;
      return next(err);
    }

    // Verify refreshToken signature
    let refreshDecoded;
    try {
      refreshDecoded = verifyToken(refreshToken);
    } catch {
      const err = new Error('Refresh token is invalid or expired. Please log in again.');
      err.statusCode = 401;
      return next(err);
    }

    // Match with database stored refreshToken
    const refreshAdminId = refreshDecoded._id || refreshDecoded.id;
    const admin = await Admin.findById(refreshAdminId)
      .select('+refreshToken +refreshTokenExpiresAt +role +isActive')
      .exec();

    if (!admin || !admin.isActive) {
      const err = new Error('Admin account is inactive or does not exist');
      err.statusCode = 401;
      return next(err);
    }

    if (
      !admin.refreshToken ||
      admin.refreshToken !== refreshToken ||
      (admin.refreshTokenExpiresAt && admin.refreshTokenExpiresAt < new Date())
    ) {
      const err = new Error('Refresh token revoked or expired. Please log in again.');
      err.statusCode = 401;
      return next(err);
    }

    // Auto-rotate refreshToken & issue new accessToken
    const newAccessToken = generateAccessToken(admin);
    const newRefreshToken = generateRefreshToken(admin);

    const refreshValidity = process.env.REFRESH_TOKEN_VALIDITY || '7d';
    const accessValidity = process.env.ACCESS_TOKEN_VALIDITY || '30m';
    const refreshMs = parseDurationToMs(refreshValidity, 7 * 24 * 60 * 60 * 1000);
    const accessMs = parseDurationToMs(accessValidity, 30 * 60 * 1000);

    admin.refreshToken = newRefreshToken;
    admin.refreshTokenExpiresAt = new Date(Date.now() + refreshMs);
    await admin.save();

    // Set updated cookies in response
    res.cookie('accessToken', newAccessToken, getCookieOptions(accessMs));
    res.cookie('refreshToken', newRefreshToken, getCookieOptions(refreshMs));

    req.admin = admin;
    return next();
  } catch (error) {
    next(error);
  }
};

/**
 * Authorization guard: Allows only 'superadmin' role
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    const err = new Error('Forbidden: Superadmin privileges required');
    err.statusCode = 403;
    return next(err);
  }
  next();
};
