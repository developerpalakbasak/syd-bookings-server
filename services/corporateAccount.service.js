import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { CorporateAccount } from '../models/corporateAccount.model.js';
import { Customer } from '../models/customer.model.js';
import { sendCorporateApprovalEmail } from './email.service.js';

export const createApplication = async (data) => {
  const application = new CorporateAccount(data);
  return await application.save();
};

export const getApplications = async ({ status, page = 1, limit = 20, search }) => {
  const query = {};
  if (status && status !== 'all') {
    query.status = status;
  }
  if (search) {
    query.$or = [
      { companyName: { $regex: search, $options: 'i' } },
      { abn: { $regex: search, $options: 'i' } },
      { 'primaryContact.email': { $regex: search, $options: 'i' } },
      { 'primaryContact.lastName': { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [applications, total] = await Promise.all([
    CorporateAccount.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('reviewedBy', 'name email')
      .populate('userId', 'fullName email phone role'),
    CorporateAccount.countDocuments(query),
  ]);

  return {
    applications,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

export const getApplicationById = async (id) => {
  return await CorporateAccount.findById(id)
    .populate('reviewedBy', 'name email')
    .populate('userId', 'fullName email phone role');
};

export const updateApplicationStatus = async (id, { status, adminNotes, approvedCreditLimit, adminId }) => {
  const application = await CorporateAccount.findById(id);
  if (!application) {
    throw new Error('Corporate application not found');
  }

  const updateData = {
    status,
    adminNotes: adminNotes || application.adminNotes || '',
    reviewedBy: adminId || null,
    reviewedAt: new Date(),
  };

  if (approvedCreditLimit !== undefined) {
    updateData['invoicedDetails.approvedCreditLimit'] = Number(approvedCreditLimit);
  }

  // When status becomes 'approved', ensure a Customer user account exists
  let generatedPassword = null;
  if (status === 'approved') {
    const contactEmail = (application.primaryContact?.email || '').trim().toLowerCase();
    const contactPhone = (application.primaryContact?.phone || '').trim();
    const fullName = `${application.primaryContact?.firstName || ''} ${application.primaryContact?.lastName || ''}`.trim() || application.companyName;

    let customer = await Customer.findOne({ email: contactEmail });

    if (!customer) {
      // Generate a secure, user-friendly initial password
      generatedPassword = `Syd@${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(generatedPassword, salt);

      customer = await Customer.create({
        fullName,
        email: contactEmail,
        phone: contactPhone || `+614${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: hashedPassword,
        role: 'corporate_admin',
        corporateAccountId: application._id,
        isVerified: true,
        isActive: true,
      });

      updateData.userId = customer._id;
      updateData.tempPassword = generatedPassword;
    } else {
      // Existing customer: elevate role and associate corporateAccountId
      customer.role = 'corporate_admin';
      customer.corporateAccountId = application._id;
      await customer.save();
      updateData.userId = customer._id;
    }
  }

  const updated = await CorporateAccount.findByIdAndUpdate(id, { $set: updateData }, { new: true })
    .populate('reviewedBy', 'name email')
    .populate('userId', 'fullName email phone role');

  // Trigger automated email dispatch via Resend
  if (status === 'approved') {
    const contactEmail = (application.primaryContact?.email || '').trim().toLowerCase();
    const recipientName = `${application.primaryContact?.firstName || ''} ${application.primaryContact?.lastName || ''}`.trim();
    sendCorporateApprovalEmail({
      toEmail: contactEmail,
      recipientName,
      companyName: application.companyName,
      accountType: application.accountType,
      creditLimit: updateData['invoicedDetails.approvedCreditLimit'] || application.invoicedDetails?.requestedCreditLimit || 5000,
      billingFrequency: application.invoicedDetails?.billingFrequency,
      temporaryPassword: generatedPassword || application.tempPassword || null,
    }).catch((err) => console.error('Background email error:', err));
  }

  return {
    application: updated,
    generatedPassword,
  };
};
