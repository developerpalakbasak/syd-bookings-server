import { Admin } from '../models/admin.model.js';
import { Customer } from '../models/customer.model.js';
import {
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  parseDurationToMs,
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

        // Generate fresh accessToken and rotate refreshToken
        const newAccessToken = generateAccessToken(admin);
        const newRefreshToken = generateRefreshToken(admin);

        const accessMs = parseDurationToMs(
          process.env.ACCESS_TOKEN_VALIDITY,
          (parseInt(process.env.ACCESS_COOKIES_VALIDITY, 10) || 30) * 60 * 1000
        );
        const refreshMs = parseDurationToMs(
          process.env.REFRESH_TOKEN_VALIDITY,
          (parseInt(process.env.REFRESH_COOKIES_VALIDITY, 10) || 7) * 24 * 60 * 60 * 1000
        );

        res.cookie('accessToken', newAccessToken, getCookieOptions(accessMs));
        res.cookie('refreshToken', newRefreshToken, getCookieOptions(refreshMs));

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

const clearCustomerCookies = (res) => {
  res.clearCookie('accessToken', getCookieOptions(0));
  res.clearCookie('refreshToken', getCookieOptions(0));
  res.clearCookie('customerAccessToken', getCookieOptions(0));
  res.clearCookie('customerRefreshToken', getCookieOptions(0));
};

/**
 * Customer authentication middleware:
 * 1. Checks customerAccessToken or accessToken (from cookies or Bearer header).
 * 2. If accessToken is valid (30m window): skips DB lookup completely (0 DB calls) and attaches decoded customer to req.customer & req.user.
 * 3. When accessToken expires after 30 minutes: uses the refreshToken to query DB once,
 *    verifies the customer is active, and automatically sets fresh rotated accessToken & refreshToken cookies.
 */
export const authenticateCustomer = async (req, res, next) => {
  try {
    const accessToken =
      req.cookies?.customerAccessToken ||
      req.cookies?.accessToken ||
      req.headers?.authorization?.replace(/^Bearer\s+/i, '');
    const refreshToken =
      req.cookies?.customerRefreshToken ||
      req.cookies?.refreshToken;

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
          const err = new Error('Account is inactive');
          err.statusCode = 401;
          return next(err);
        }

        req.customer = decoded;
        req.user = decoded;
        return next();
      } catch (accessError) {
        // If accessToken is invalid/expired, proceed only if refreshToken is present
        if (!refreshToken) {
          return next(accessError);
        }
      }
    }

    // 2. Access token missing or expired: Perform refresh & verify customer in DB
    if (refreshToken) {
      try {
        const decodedRefresh = decodeToken(refreshToken);
        const customerId =
          decodedRefresh.customerId ||
          decodedRefresh.userId ||
          decodedRefresh._id ||
          decodedRefresh.id;

        if (!customerId) {
          clearCustomerCookies(res);
          const err = new Error('Invalid refresh token payload. Please log in again.');
          err.statusCode = 401;
          return next(err);
        }

        // DB call happens here (after 30 minutes) to ensure user account is still valid & active
        const customer = await Customer.findById(customerId).select('+isActive');
        if (!customer || !customer.isActive) {
          clearCustomerCookies(res);
          const err = new Error('Customer account is inactive or not found');
          err.statusCode = 401;
          return next(err);
        }

        // Generate fresh accessToken and rotate refreshToken
        const newAccessToken = generateAccessToken(customer);
        const newRefreshToken = generateRefreshToken(customer);

        const accessMs = parseDurationToMs(
          process.env.ACCESS_TOKEN_VALIDITY,
          (parseInt(process.env.ACCESS_COOKIES_VALIDITY, 10) || 30) * 60 * 1000
        );
        const refreshMs = parseDurationToMs(
          process.env.REFRESH_TOKEN_VALIDITY,
          (parseInt(process.env.REFRESH_COOKIES_VALIDITY, 10) || 7) * 24 * 60 * 60 * 1000
        );

        res.cookie('accessToken', newAccessToken, getCookieOptions(accessMs));
        res.cookie('refreshToken', newRefreshToken, getCookieOptions(refreshMs));
        res.cookie('customerAccessToken', newAccessToken, getCookieOptions(accessMs));
        res.cookie('customerRefreshToken', newRefreshToken, getCookieOptions(refreshMs));

        req.customer = {
          _id: customer._id,
          id: customer._id,
          fullName: customer.fullName,
          name: customer.fullName,
          email: customer.email,
          role: customer.role || 'passenger',
          phone: customer.phone || '',
          isActive: customer.isActive,
          lastLoginAt: customer.lastLoginAt,
        };
        req.user = req.customer;

        return next();
      } catch (refreshError) {
        clearCustomerCookies(res);
        const err = new Error('Session expired. Please log in again.');
        err.statusCode = 401;
        return next(err);
      }
    }
  } catch (error) {
    next(error);
  }
};

