import { Order } from '../models/order.model.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { env } from '../config/env.js';

export function renderRefundEmailHtml(order: Order, refundAmountInCents?: number, reason?: string): string {
  const refundAmount = refundAmountInCents || order.payment.refundAmount || order.total;
  const formattedRefund = formatCurrency(refundAmount, order.currency);
  const formattedDate = formatDate(order.payment.refundedAt || new Date());

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Confirmation - Order #${order.orderNumber}</title>
  <style>
    body {
      margin: 0; padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      border-top: 6px solid #3b82f6;
    }
    .header {
      padding: 32px;
      text-align: center;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .badge {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .content { padding: 32px; }
    .refund-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .refund-amount {
      font-size: 28px;
      font-weight: 800;
      color: #15803d;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">&#10003; Refund Processed</div>
      <h1 style="margin: 0; font-size: 24px; color: #0f172a;">Refund Confirmation</h1>
      <p style="margin: 6px 0 0 0; color: #64748b; font-size: 14px;">Order #${order.orderNumber}</p>
    </div>

    <div class="content">
      <p style="font-size: 15px; color: #374151; line-height: 1.6;">
        Hi <strong>${order.customer.name}</strong>,<br>
        We have processed a refund for your order. Depending on your bank or card issuer, the refunded funds usually take 3 to 7 business days to appear on your statement.
      </p>

      <div class="refund-box">
        <div style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Refund Amount</div>
        <div class="refund-amount">${formattedRefund}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Refund Date:</td>
          <td style="text-align: right; font-weight: 500; color: #1e293b;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Payment Method:</td>
          <td style="text-align: right; font-weight: 500; color: #1e293b;">Original Payment Method (${(order.payment.paymentMethodType || 'Card').toUpperCase()})</td>
        </tr>
        ${order.payment.stripePaymentIntentId ? `
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Original Transaction:</td>
          <td style="text-align: right; font-family: monospace; font-size: 12px; color: #64748b;">${order.payment.stripePaymentIntentId}</td>
        </tr>
        ` : ''}
        ${order.payment.refundId ? `
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Refund Reference:</td>
          <td style="text-align: right; font-family: monospace; font-size: 12px; color: #64748b;">${order.payment.refundId}</td>
        </tr>
        ` : ''}
        ${reason ? `
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Reason:</td>
          <td style="text-align: right; color: #1e293b;">${reason}</td>
        </tr>
        ` : ''}
      </table>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.5;">
        Have questions about your refund? Contact us anytime at <a href="mailto:${env.SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${env.SUPPORT_EMAIL}</a>.<br>
        &copy; ${new Date().getFullYear()} ${env.STORE_NAME}. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
