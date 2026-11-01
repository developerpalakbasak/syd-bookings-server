import { Contact } from '../models/contact.model.js';

// POST /api/contacts - Submit contact form enquiry
export const submitContact = async (req, res, next) => {
  try {
    const { fullName, email, phone, subject, message } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required',
      });
    }

    const contact = await Contact.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      subject: subject && subject.trim() ? subject.trim() : 'General Enquiry',
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry received successfully. Our operations team will contact you shortly.',
      data: {
        id: contact._id,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        subject: contact.subject,
        message: contact.message,
        status: contact.status,
        createdAt: contact.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/contacts - Get all enquiries (with pagination, status filter, and keyword search)
export const getAllContacts = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = {};

    if (status && ['new', 'in-progress', 'responded', 'archived'].includes(status)) {
      query.status = status;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { subject: regex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [contacts, total] = await Promise.all([
      Contact.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Contact.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/contacts/:id - Get single enquiry by ID
export const getContactById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found',
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/contacts/:id/status - Update enquiry status or admin notes
export const updateContactStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const updateFields = {};

    if (status && ['new', 'in-progress', 'responded', 'archived'].includes(status)) {
      updateFields.status = status;
      if (status === 'responded') {
        updateFields.respondedAt = new Date();
      }
    }

    if (typeof adminNotes === 'string') {
      updateFields.adminNotes = adminNotes.trim();
    }

    const contact = await Contact.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact enquiry updated successfully',
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/contacts/:id - Delete enquiry
export const deleteContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact enquiry deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
