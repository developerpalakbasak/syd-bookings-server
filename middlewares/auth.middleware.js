import { Admin } from '../models/admin.model.js';
import {
  decodeToken,
  generateAccessToken,
  getCookieOptions,
} from '../utils/token.util.js';

/**
 * Authentication middleware:
 * 1. Checks accessToken (from cookies or Bearer header).
 * 2. If accessToken is valid (15m window): skips DB lookup completely (0 DB calls) and attaches decoded admin to req.admin.
 * 3. When accessToken expires after 15 minutes: uses the multi-device stateless refreshToken to query DB once,
 *    verifies the admin is active, and automatically sets a fresh accessToken cookie for the next 15 minutes.
 */
export const authenticateAdmin = async (req, res, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');
    const refreshToken = req.cookies?.refreshToken;

    if (!accessToken && !refreshToken) {
      const err = new Error('Authentication required. Please log in.');
      err.statusCode = 401;
      return next(err);
    }

    // 1. If accessToken is present, verify directly without DB query (0 DB calls)
    if (accessToken) {
      try {
        const decoded = decodeToken(accessToken);
        decoded._id = decoded._id || decoded.id;
        decoded.id = decoded._id;

        // Check if token payload marks account inactive
        if (decoded.isActive === false) {
          const err = new Error('Admin account is inactive');
          err.statusCode = 401;
          return next(err);
        }

        req.admin = decoded;
        return next();
      } catch (accessError) {
        // If accessToken is invalid/expired, proceed only if refreshToken is present
        if (!refreshToken) {
          return next(accessError);
        }
      }
    }

    // 2. Access token missing or expired: Perform refresh & verify admin in DB (only once every 15 minutes)
    if (refreshToken) {
      try {
        const decodedRefresh = decodeToken(refreshToken);
        const adminId = decodedRefresh.adminId || decodedRefresh._id || decodedRefresh.id;

        if (!adminId) {
          res.clearCookie('accessToken', getCookieOptions(0));
          res.clearCookie('refreshToken', getCookieOptions(0));
          const err = new Error('Invalid refresh token payload. Please log in again.');
          err.statusCode = 401;
          return next(err);
        }

        // DB call happens here (after 15 minutes) to ensure user account is still valid & active
        const admin = await Admin.findById(adminId).select('+role +isActive');
        if (!admin || !admin.isActive) {
          res.clearCookie('accessToken', getCookieOptions(0));
          res.clearCookie('refreshToken', getCookieOptions(0));
          const err = new Error('Admin account is inactive or not found');
          err.statusCode = 401;
          return next(err);
        }

        // Generate fresh 15-minute accessToken
        const newAccessToken = generateAccessToken(admin);
        const accessMinutes = parseInt(process.env.ACCESS_COOKIES_VALIDITY, 10) || 15;
        const accessMaxAge = accessMinutes * 60 * 1000;

        res.cookie('accessToken', newAccessToken, getCookieOptions(accessMaxAge));

        req.admin = {
          _id: admin._id,
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          phone: admin.phone || '',
          isActive: admin.isActive,
          lastLoginAt: admin.lastLoginAt,
        };

        return next();
      } catch (refreshError) {
        res.clearCookie('accessToken', getCookieOptions(0));
        res.clearCookie('refreshToken', getCookieOptions(0));
        const err = new Error('Session expired. Please log in again.');
        err.statusCode = 401;
        return next(err);
      }
    }
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

