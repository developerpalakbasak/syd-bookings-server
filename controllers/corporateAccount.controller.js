import * as corporateService from '../services/corporateAccount.service.js';

export const submitApplication = async (req, res, next) => {
  try {
    const {
      companyName,
      tradingName,
      abn,
      industry,
      website,
      address,
      primaryContact,
      accountsPayable,
      accountType,
      invoicedDetails,
      tradeReferences,
    } = req.body;

    if (!companyName || !abn || !primaryContact?.email || !accountsPayable?.email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required corporate application fields (Company Name, ABN, Primary & Accounts Email are mandatory).',
      });
    }

    const application = await corporateService.createApplication({
      companyName,
      tradingName,
      abn,
      industry,
      website,
      address,
      primaryContact,
      accountsPayable,
      accountType: accountType || 'invoiced',
      invoicedDetails,
      tradeReferences,
    });

    return res.status(201).json({
      success: true,
      message: 'Your corporate account application has been received successfully. Our accounts team will review and contact you shortly.',
      applicationId: application._id,
    });
  } catch (error) {
    next(error);
  }
};

export const listApplications = async (req, res, next) => {
  try {
    const { status, page, limit, search } = req.query;
    const result = await corporateService.getApplications({ status, page, limit, search });
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getApplicationDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await corporateService.getApplicationById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Corporate application not found.' });
    }
    return res.status(200).json({ success: true, application });
  } catch (error) {
    next(error);
  }
};

export const reviewApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, approvedCreditLimit } = req.body;
    const adminId = req.user?._id || req.user?.id;

    const result = await corporateService.updateApplicationStatus(id, {
      status,
      adminNotes,
      approvedCreditLimit,
      adminId,
    });

    if (!result || !result.application) {
      return res.status(404).json({ success: false, message: 'Corporate application not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `Application marked as ${status}.${result.generatedPassword ? ' Corporate login credentials created.' : ''}`,
      application: result.application,
      credentials: result.generatedPassword ? {
        email: result.application.primaryContact?.email,
        temporaryPassword: result.generatedPassword,
      } : null,
    });
  } catch (error) {
    next(error);
  }
};
