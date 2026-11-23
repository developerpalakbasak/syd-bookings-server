/**
 * Email Service using Resend REST API
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SYD Airport Transfer <onboarding@resend.dev>';

export const sendCorporateApprovalEmail = async ({
  toEmail,
  recipientName,
  companyName,
  accountType,
  creditLimit,
  billingFrequency,
  temporaryPassword,
}) => {
  if (!toEmail) return { success: false, message: 'Recipient email missing' };

  const loginUrl = 'https://auth.sydairporttransfer.com.au/customer/login';
  const portalUrl = 'https://book.sydairporttransfer.com.au/';

  const termsDescription =
    accountType === 'invoiced'
      ? `Consolidated ${billingFrequency || 'Monthly'} Invoicing (Approved Credit Limit: $${Number(creditLimit || 5000).toLocaleString()} AUD, Zero Upfront Card Payment)`
      : 'Multi-User Corporate Card (Central Tax Invoicing to Accounts Payable)';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0c1938; padding: 32px 28px; text-align: center; }
    .header h1 { color: #bea166; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
    .header p { color: #94a3b8; font-size: 11px; margin: 6px 0 0; letter-spacing: 3px; text-transform: uppercase; }
    .content { padding: 32px 28px; }
    .badge { display: inline-block; padding: 6px 14px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
    h2 { font-size: 20px; color: #0f172a; margin-top: 0; font-weight: 700; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px; }
    .cred-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .cred-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { color: #64748b; font-weight: 500; }
    .cred-val { color: #0f172a; font-weight: 700; font-family: monospace; }
    .btn { display: block; text-align: center; background: #bea166; color: #0c1938; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin: 28px 0 16px; letter-spacing: 0.5px; }
    .footer { background: #f1f5f9; padding: 20px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>SYD AIRPORT TRANSFER</h1>
      <p>Corporate & Chauffeur Services</p>
    </div>
    <div class="content">
      <div class="badge">&#10003; Corporate Account Approved</div>
      <h2>Welcome, ${recipientName || 'Executive'}</h2>
      <p>We are pleased to inform you that the corporate ground transport application for <strong>${companyName}</strong> has been verified and approved.</p>
      
      <p>Your business account is now active with the following approved parameters:</p>
      <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #334155; margin-bottom: 20px;">
        <strong>Account Model:</strong> ${termsDescription}
      </div>

      <div class="cred-box">
        <div style="font-weight: 700; font-size: 13px; color: #0c1938; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Your Corporate Login Credentials</div>
        <div class="cred-row">
          <span class="cred-label">Login Portal:</span>
          <span class="cred-val">${loginUrl}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Username / Email:</span>
          <span class="cred-val">${toEmail}</span>
        </div>
        ${temporaryPassword ? `
        <div class="cred-row">
          <span class="cred-label">Temporary Password:</span>
          <span class="cred-val" style="color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${temporaryPassword}</span>
        </div>
        ` : ''}
      </div>

      <p style="font-size: 12px; color: #64748b;">
        * For security reasons, please update your temporary password after your first login via Account Settings.
      </p>

      <a href="${loginUrl}" class="btn">Sign In to Corporate Portal &rarr;</a>

      <p style="font-size: 13px; color: #475569; margin-top: 20px;">
        Once signed in, you can book executive chauffeured rides at <a href="${portalUrl}" style="color: #0c1938; font-weight: 600;">book.sydairporttransfer.com.au</a> using your corporate account billing.
      </p>
    </div>
    <div class="footer">
      SYD Airport Transfer • Australia Premier Chauffeur Fleet<br>
      Sydney, New South Wales, Australia • Support: contact@sydairporttransfer.com.au
    </div>
  </div>
</body>
</html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'resend-node:2.0.0',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `Your Corporate Account with SYD Airport Transfer is Approved (${companyName})`,
        html: htmlContent,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`Corporate approval email sent via Resend: ${data.id} to ${toEmail}`);
      return { success: true, id: data.id };
    } else {
      console.warn(`Resend email error [${res.status}]:`, data);
      return { success: false, error: data };
    }
  } catch (err) {
    console.error('Failed to dispatch corporate approval email:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Send Booking & Payment Confirmation Email (Tax Receipt)
 */
export const sendBookingConfirmationEmail = async ({
  toEmail,
  passengerName,
  bookingNumber,
  pickup,
  dropoff,
  pickupTime,
  passengers,
  luggage,
  vehicleType,
  flightNumber,
  paymentMethod,
  paymentStatus,
  amount,
  currency = 'AUD',
  receiptUrl,
}) => {
  if (!toEmail) return { success: false, message: 'Recipient email missing' };

  const formattedDate = pickupTime
    ? new Date(pickupTime).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : 'As scheduled';

  const isCorporateInvoiced = paymentMethod === 'corporate_invoiced';
  const paymentBadge = isCorporateInvoiced
    ? 'Corporate Account (Consolidated Monthly Invoice)'
    : 'Credit / Debit Card (Stripe Verified)';

  const formattedAmount = Number(amount || 0).toFixed(2);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0c1938; padding: 32px 28px; text-align: center; }
    .header h1 { color: #bea166; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
    .header p { color: #94a3b8; font-size: 11px; margin: 6px 0 0; letter-spacing: 3px; text-transform: uppercase; }
    .content { padding: 32px 28px; }
    .badge { display: inline-block; padding: 6px 14px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
    h2 { font-size: 20px; color: #0f172a; margin-top: 0; font-weight: 700; }
    p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px; }
    .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .summary-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 700; text-align: right; max-width: 65%; word-break: break-word; }
    .amount-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px; margin: 20px 0; display: flex; justify-content: space-between; align-items: center; }
    .amount-label { color: #166534; font-size: 13px; font-weight: 600; }
    .amount-value { color: #166534; font-size: 22px; font-weight: 800; }
    .notice { background: #f1f5f9; padding: 16px; border-radius: 10px; font-size: 12px; color: #475569; line-height: 1.6; margin-top: 24px; border-left: 4px solid #bea166; }
    .footer { background: #f1f5f9; padding: 20px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>SYD AIRPORT TRANSFER</h1>
      <p>Luxury Chauffeur Services</p>
    </div>
    <div class="content">
      <div class="badge">&#10003; Booking & Payment Confirmed</div>
      <h2>Thank You, ${passengerName || 'Valued Passenger'}</h2>
      <p>Your transfer booking has been successfully scheduled. Below is your official tax receipt and ride itinerary.</p>

      <div class="amount-box">
        <div>
          <div class="amount-label">TOTAL PAID / CHARGED</div>
          <div style="font-size: 11px; color: #15803d; margin-top: 2px;">${paymentBadge}</div>
        </div>
        <div class="amount-value">$${formattedAmount} ${currency}</div>
      </div>

      <div class="summary-box">
        <div style="font-weight: 700; font-size: 13px; color: #0c1938; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Trip Itinerary</div>
        <div class="summary-row">
          <span class="label">Booking Reference:</span>
          <span class="value" style="font-family: monospace; font-size: 14px; color: #bea166; font-weight: 800;">${bookingNumber}</span>
        </div>
        <div class="summary-row">
          <span class="label">Date & Time:</span>
          <span class="value">${formattedDate}</span>
        </div>
        <div class="summary-row">
          <span class="label">Pick-up Location:</span>
          <span class="value">${pickup}</span>
        </div>
        <div class="summary-row">
          <span class="label">Drop-off Location:</span>
          <span class="value">${dropoff || 'Hourly / As directed'}</span>
        </div>
        <div class="summary-row">
          <span class="label">Vehicle Class:</span>
          <span class="value">${vehicleType || 'Executive Sedan'}</span>
        </div>
        <div class="summary-row">
          <span class="label">Passengers & Luggage:</span>
          <span class="value">${passengers || 1} Passenger(s) • ${luggage || 0} Luggage</span>
        </div>
        ${flightNumber ? `
        <div class="summary-row">
          <span class="label">Flight Number:</span>
          <span class="value" style="font-family: monospace;">${flightNumber}</span>
        </div>
        ` : ''}
        ${receiptUrl ? `
        <div class="summary-row">
          <span class="label">Stripe Tax Receipt:</span>
          <span class="value"><a href="${receiptUrl}" target="_blank" style="color: #0c1938; text-decoration: underline;">View Online Receipt</a></span>
        </div>
        ` : ''}
      </div>

      <div class="notice">
        <strong>Chauffeur Meet & Greet Instructions:</strong><br>
        • For airport arrivals, your professional chauffeur will monitor your flight in real time and meet you inside the terminal with an executive digital nameboard.<br>
        • Complimentary wait time: 60 minutes for International arrivals, 30 minutes for Domestic flights, and 15 minutes for standard city transfers.<br>
        • 24/7 Operations Support: <strong>+61 404 410 000</strong>
      </div>
    </div>
    <div class="footer">
      SYD Airport Transfer • Australia Premier Chauffeur Fleet<br>
      Sydney, New South Wales, Australia • GST included • Support: contact@sydairporttransfer.com.au
    </div>
  </div>
</body>
</html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'resend-node:2.0.0',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `Booking Confirmed [${bookingNumber}] - SYD Airport Transfer`,
        html: htmlContent,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`Booking confirmation email sent via Resend: ${data.id} to ${toEmail}`);
      return { success: true, id: data.id };
    } else {
      console.warn(`Resend email error [${res.status}]:`, data);
      return { success: false, error: data };
    }
  } catch (err) {
    console.error('Failed to dispatch booking confirmation email:', err);
    return { success: false, error: err.message };
  }
};
