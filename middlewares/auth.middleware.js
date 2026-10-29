import { Admin } from '../models/admin.model.js';
import {
  verifyToken,
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  parseDurationToMs,
  getCookieOptions,
} from '../utils/token.util.js';

/**
 * In-memory rotation grace cache to prevent race conditions during concurrent requests.
 * Maps oldRefreshToken -> { newAccessToken, newRefreshToken, adminId, accessMs, refreshMs, expiresAt }
 */
export const rotationGraceCache = new Map();

const cleanExpiredGraceCache = () => {
  const now = Date.now();
  for (const [token, data] of rotationGraceCache.entries()) {
    if (data.expiresAt <= now) {
      rotationGraceCache.delete(token);
    }
  }
};

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
        // If accessToken is expired and refreshToken exists, fall through to rotation
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

    cleanExpiredGraceCache();

    // 2a. Check if this refreshToken was rotated moments ago (concurrent requests grace window)
    if (rotationGraceCache.has(refreshToken)) {
      const cached = rotationGraceCache.get(refreshToken);
      if (cached && cached.expiresAt > Date.now()) {
        const admin = await Admin.findById(cached.adminId).select('+role +isActive');
        if (admin && admin.isActive) {
          // Re-send newest rotated cookies so client retains fresh tokens
          res.cookie('accessToken', cached.newAccessToken, getCookieOptions(cached.accessMs));
          res.cookie('refreshToken', cached.newRefreshToken, getCookieOptions(cached.refreshMs));

          req.admin = admin;
          return next();
        }
      }
    }

    // 2b. Verify signature or decode payload if expired
    let refreshDecoded;
    let isJwtExpired = false;
    try {
      refreshDecoded = verifyToken(refreshToken);
    } catch (tokenErr) {
      if (tokenErr.name === 'TokenExpiredError') {
        isJwtExpired = true;
        refreshDecoded = decodeToken(refreshToken);
      } else {
        res.clearCookie('accessToken', getCookieOptions(0));
        res.clearCookie('refreshToken', getCookieOptions(0));
        const err = new Error('Refresh token is invalid. Please log in again.');
        err.statusCode = 401;
        return next(err);
      }
    }

    const refreshAdminId = refreshDecoded?._id || refreshDecoded?.id;
    if (!refreshAdminId) {
      res.clearCookie('accessToken', getCookieOptions(0));
      res.clearCookie('refreshToken', getCookieOptions(0));
      const err = new Error('Invalid refresh token payload. Please log in again.');
      err.statusCode = 401;
      return next(err);
    }

    // Match with database stored refreshToken & refreshTokenExpiresAt
    const admin = await Admin.findById(refreshAdminId)
      .select('+refreshToken +refreshTokenExpiresAt +role +isActive')
      .exec();

    if (!admin || !admin.isActive) {
      res.clearCookie('accessToken', getCookieOptions(0));
      res.clearCookie('refreshToken', getCookieOptions(0));
      const err = new Error('Admin account is inactive or does not exist');
      err.statusCode = 401;
      return next(err);
    }

    // 2c. Analyze whether refreshToken validity has expired as per database (admin.model.js: refreshTokenExpiresAt)
    const isDbExpired =
      !admin.refreshTokenExpiresAt ||
      new Date(admin.refreshTokenExpiresAt) <= new Date();

    if (isDbExpired || isJwtExpired) {
      // If refreshToken validity expired as per database, set refreshToken empty in database
      admin.refreshToken = null;
      admin.refreshTokenExpiresAt = null;
      await admin.save();

      // Clear cookies from client
      res.clearCookie('accessToken', getCookieOptions(0));
      res.clearCookie('refreshToken', getCookieOptions(0));

      const err = new Error('Refresh token expired. Please log in again.');
      err.statusCode = 401;
      return next(err);
    }

    // 2d. Check if token matches stored active token in database
    if (!admin.refreshToken || admin.refreshToken !== refreshToken) {
      res.clearCookie('accessToken', getCookieOptions(0));
      res.clearCookie('refreshToken', getCookieOptions(0));

      const err = new Error('Refresh token revoked or invalid. Please log in again.');
      err.statusCode = 401;
      return next(err);
    }

    // 2e. Refresh token is valid: Issue new accessToken & rotated refreshToken to maintain continuous login
    const newAccessToken = generateAccessToken(admin);
    const newRefreshToken = generateRefreshToken(admin);

    const refreshValidity = process.env.REFRESH_TOKEN_VALIDITY || '7d';
    const accessValidity = process.env.ACCESS_TOKEN_VALIDITY || '30m';
    const refreshMs = parseDurationToMs(refreshValidity, 7 * 24 * 60 * 60 * 1000);
    const accessMs = parseDurationToMs(accessValidity, 30 * 60 * 1000);

    const newExpiresAt = new Date(Date.now() + refreshMs);

    // Update database with rotated token and new validity
    admin.refreshToken = newRefreshToken;
    admin.refreshTokenExpiresAt = newExpiresAt;
    await admin.save();

    // Cache the old token for a 30s grace window to handle in-flight parallel requests
    rotationGraceCache.set(refreshToken, {
      newAccessToken,
      newRefreshToken,
      adminId: admin._id.toString(),
      accessMs,
      refreshMs,
      expiresAt: Date.now() + 30 * 1000,
    });

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
