import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Admin } from '../models/admin.model.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  parseDurationToMs,
  getCookieOptions,
} from '../utils/token.util.js';

class AdminService {
  /**
   * Helper to issue auth cookies and record last login
   */
  async setAuthCookiesAndSave(res, admin) {
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);

    const accessMinutes = parseInt(process.env.ACCESS_COOKIES_VALIDITY, 10) || 15;
    const refreshDays = parseInt(process.env.REFRESH_COOKIES_VALIDITY, 10) || 7;
    const accessMs = accessMinutes * 60 * 1000;
    const refreshMs = refreshDays * 24 * 60 * 60 * 1000;

    admin.lastLoginAt = new Date();
    await admin.save();

    res.cookie('accessToken', accessToken, getCookieOptions(accessMs));
    res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMs));

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin._id,
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        phone: admin.phone,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt,
      },
    };
  }

  /**
   * Admin / Superadmin Login
   */
  async login(res, { email, password }) {
    if (!email || !password) {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = email.trim().toLowerCase();
    const admin = await Admin.findOne({ email: cleanEmail }).select('+password');

    if (!admin) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (!admin.isActive) {
      const err = new Error('Your account is deactivated. Please contact Superadmin.');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    return await this.setAuthCookiesAndSave(res, admin);
  }

  /**
   * Explicit token refresh endpoint
   */
  async refreshToken(req, res, token) {
    const refreshToken = token || req.cookies?.refreshToken;
    if (!refreshToken) {
      const err = new Error('Refresh token is required');
      err.statusCode = 401;
      throw err;
    }

    let refreshDecoded;
    try {
      refreshDecoded = decodeToken(refreshToken);
    } catch (tokenErr) {
      res.clearCookie('accessToken', getCookieOptions(0));
      res.clearCookie('refreshToken', getCookieOptions(0));
      const err = new Error('Refresh token is invalid or expired. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    const adminId = refreshDecoded?.adminId || refreshDecoded?._id || refreshDecoded?.id;
    if (!adminId) {
      res.clearCookie('accessToken', getCookieOptions(0));
      res.clearCookie('refreshToken', getCookieOptions(0));
      const err = new Error('Invalid refresh token payload. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    // DB call only happens here during refresh
    const admin = await Admin.findById(adminId)
      .select('+role +isActive')
      .exec();

    if (!admin || !admin.isActive) {
      res.clearCookie('accessToken', getCookieOptions(0));
      res.clearCookie('refreshToken', getCookieOptions(0));
      const err = new Error('Admin account is inactive or not found');
      err.statusCode = 401;
      throw err;
    }

    const newAccessToken = generateAccessToken(admin);
    const accessMinutes = parseInt(process.env.ACCESS_COOKIES_VALIDITY, 10) || 15;
    const accessMs = accessMinutes * 60 * 1000;

    res.cookie('accessToken', newAccessToken, getCookieOptions(accessMs));

    return {
      accessToken: newAccessToken,
      admin: {
        id: admin._id,
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        phone: admin.phone,
        isActive: admin.isActive,
        lastLoginAt: admin.lastLoginAt,
      },
    };
  }

  /**
   * Admin Logout
   */
  async logout(res) {
    res.clearCookie('accessToken', getCookieOptions(0));
    res.clearCookie('refreshToken', getCookieOptions(0));

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Superadmin: Create new admin or superadmin
   */
  async createAdmin(dto) {
    const { name, email, password, role = 'admin', phone = '', isActive = true } = dto;

    if (!name || !name.trim()) {
      const err = new Error('Name is required');
      err.statusCode = 400;
      throw err;
    }
    if (!email || !email.trim()) {
      const err = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }
    if (!password || password.length < 6) {
      const err = new Error('Password is required and must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await Admin.findOne({ email: cleanEmail });
    if (existing) {
      const err = new Error(`Admin with email '${cleanEmail}' already exists`);
      err.statusCode = 409;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new Admin({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: ['admin', 'superadmin'].includes(role) ? role : 'admin',
      phone: phone.trim(),
      isActive,
    });

    await newAdmin.save();

    return {
      id: newAdmin._id,
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      phone: newAdmin.phone,
      isActive: newAdmin.isActive,
      createdAt: newAdmin.createdAt,
    };
  }

  /**
   * Superadmin: List all admins
   */
  async getAllAdmins(query = {}) {
    const filter = {};
    if (query.role) filter.role = query.role;
    if (query.isActive !== undefined && query.isActive !== '') {
      filter.isActive = query.isActive === 'true';
    }

    const admins = await Admin.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();

    return admins;
  }

  /**
   * Superadmin: Get admin by ID
   */
  async getAdminById(id) {
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error(`Invalid admin ID format: ${id}`);
      err.statusCode = 400;
      throw err;
    }

    const admin = await Admin.findById(id).select('-password').exec();
    if (!admin) {
      const err = new Error(`Admin with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return admin;
  }

  /**
   * Superadmin: Update admin profile/role/status
   */
  async updateAdmin(id, dto) {
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error(`Invalid admin ID format: ${id}`);
      err.statusCode = 400;
      throw err;
    }

    const admin = await Admin.findById(id);
    if (!admin) {
      const err = new Error(`Admin with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (dto.name !== undefined) admin.name = dto.name.trim();
    if (dto.phone !== undefined) admin.phone = dto.phone.trim();
    if (dto.role !== undefined && ['admin', 'superadmin'].includes(dto.role)) {
      admin.role = dto.role;
    }
    if (dto.isActive !== undefined) admin.isActive = Boolean(dto.isActive);

    if (dto.email && dto.email.trim().toLowerCase() !== admin.email) {
      const cleanEmail = dto.email.trim().toLowerCase();
      const existing = await Admin.findOne({ email: cleanEmail });
      if (existing && existing._id.toString() !== id) {
        const err = new Error(`Admin with email '${cleanEmail}' already exists`);
        err.statusCode = 409;
        throw err;
      }
      admin.email = cleanEmail;
    }

    await admin.save();

    return {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      phone: admin.phone,
      isActive: admin.isActive,
      updatedAt: admin.updatedAt,
    };
  }

  /**
   * Superadmin: Set/Reset password for an admin
   */
  async setPassword(id, newPassword) {
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error(`Invalid admin ID format: ${id}`);
      err.statusCode = 400;
      throw err;
    }

    if (!newPassword || newPassword.length < 6) {
      const err = new Error('Password is required and must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    const admin = await Admin.findById(id);
    if (!admin) {
      const err = new Error(`Admin with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    return {
      success: true,
      message: `Password updated successfully for admin '${admin.email}'`,
    };
  }

  /**
   * Superadmin: Delete an admin
   */
  async deleteAdmin(id, currentSuperAdminId) {
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error(`Invalid admin ID format: ${id}`);
      err.statusCode = 400;
      throw err;
    }

    if (currentSuperAdminId && id.toString() === currentSuperAdminId.toString()) {
      const err = new Error('Superadmin cannot delete their own account');
      err.statusCode = 400;
      throw err;
    }

    const admin = await Admin.findByIdAndDelete(id).exec();
    if (!admin) {
      const err = new Error(`Admin with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return {
      success: true,
      message: `Admin '${admin.email}' deleted successfully`,
    };
  }
}

export const adminService = new AdminService();
