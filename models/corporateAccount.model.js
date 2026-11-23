import mongoose from 'mongoose';

const corporateAccountSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company legal name is required'],
      trim: true,
    },
    tradingName: {
      type: String,
      trim: true,
      default: '',
    },
    abn: {
      type: String,
      required: [true, 'Australian Business Number (ABN/ACN) is required'],
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    // Company Physical & Billing Address
    address: {
      street: { type: String, required: true },
      suburb: { type: String, required: true },
      state: { type: String, required: true },
      postcode: { type: String, required: true },
      country: { type: String, default: 'Australia' },
    },
    // Primary Account Contact (Executive/Booking Manager)
    primaryContact: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      jobTitle: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, required: true },
    },
    // Accounts Payable / Billing Contact
    accountsPayable: {
      name: { type: String, default: '' },
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, default: '' },
    },
    // Corporate Account Type requested
    accountType: {
      type: String,
      enum: ['invoiced', 'multi_user_card'],
      required: [true, 'Account type is required (invoiced or multi_user_card)'],
      default: 'invoiced',
    },
    // Details specific to Invoiced Account
    invoicedDetails: {
      billingFrequency: {
        type: String,
        enum: ['weekly', 'fortnightly', 'monthly'],
        default: 'monthly',
      },
      paymentMethod: {
        type: String,
        enum: ['bank_transfer', 'credit_card', 'direct_debit'],
        default: 'bank_transfer',
      },
      requestedCreditLimit: {
        type: Number,
        default: 5000,
      },
      approvedCreditLimit: {
        type: Number,
        default: 0,
      },
      estimatedMonthlySpend: {
        type: String,
        default: '$1,000 - $5,000',
      },
    },
    // Trade references for credit assessment
    tradeReferences: [
      {
        company: { type: String, default: '' },
        contactName: { type: String, default: '' },
        phone: { type: String, default: '' },
        email: { type: String, default: '' },
      },
    ],
    // Workflow Status
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Associated Corporate User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    tempPassword: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const CorporateAccount = mongoose.model(
  'CorporateAccount',
  corporateAccountSchema
);
