import { adminService } from '../services/admin.service.js';

/**
 * POST /api/admin/login
 * Admin & Superadmin login with accessToken & refreshToken in cookies
 */
export const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await adminService.login(res, { email, password });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/logout
 * Clears cookies and invalidates refreshToken in DB
 */
export const logoutAdmin = async (req, res, next) => {
  try {
    const adminId = req.admin?._id || req.admin?.id;
    const result = await adminService.logout(res, adminId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/me
 * Returns current authenticated admin profile
 */
export const getMyProfile = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      admin: {
        id: req.admin._id,
        name: req.admin.name,
        email: req.admin.email,
        role: req.admin.role,
        phone: req.admin.phone,
        isActive: req.admin.isActive,
        lastLoginAt: req.admin.lastLoginAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/admins
 * Superadmin: Create an admin or superadmin
 */
export const createAdminUser = async (req, res, next) => {
  try {
    const admin = await adminService.createAdmin(req.body);

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      admin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/admins
 * Superadmin: List all admins
 */
export const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await adminService.getAllAdmins(req.query);

    res.status(200).json({
      success: true,
      count: admins.length,
      admins,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/admins/:id
 * Superadmin: Get admin details by ID
 */
export const getAdminById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const admin = await adminService.getAdminById(id);

    res.status(200).json({
      success: true,
      admin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT / PATCH /api/admin/admins/:id
 * Superadmin: Update admin profile/role/status
 */
export const updateAdminUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const admin = await adminService.updateAdmin(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      admin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/admins/:id/set-password
 * Superadmin: Set/Reset password for an admin
 */
export const setAdminPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const result = await adminService.setPassword(id, password);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/admins/:id
 * Superadmin: Delete an admin
 */
export const deleteAdminUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentSuperAdminId = req.admin?._id;
    const result = await adminService.deleteAdmin(id, currentSuperAdminId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
