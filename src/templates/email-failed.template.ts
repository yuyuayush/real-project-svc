import { Order } from '../models/order.model.js';
import { formatCurrency } from '../utils/formatters.js';
import { env } from '../config/env.js';

export function renderPaymentFailedEmailHtml(order: Order, reason?: string): string {
  const formattedTotal = formatCurrency(order.total, order.currency);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Action Required: Payment Failed</title>
  <style>
    body {
      margin: 0; padding: 0;
      background-color: #fef2f2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.08);
      border-top: 6px solid #ef4444;
    }
    .header {
      padding: 30px;
      text-align: center;
    }
    .badge {
      display: inline-block;
      background: #fee2e2;
      color: #b91c1c;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .content { padding: 0 32px 32px; }
    .button {
      display: inline-block;
      background-color: #ef4444;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 28px;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Payment Declined</div>
      <h1 style="margin: 0; font-size: 24px; color: #111827;">Action Required for Order #${order.orderNumber}</h1>
    </div>
    <div class="content">
      <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
        Hi ${order.customer.name},<br>
        We were unable to process your payment of <strong>${formattedTotal}</strong> for order <strong>#${order.orderNumber}</strong>.
      </p>
      ${reason ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; font-size: 14px; color: #991b1b; margin: 16px 0;">Reason: ${reason}</div>` : ''}
      <p style="font-size: 14px; color: #6b7280;">
        Your order is currently on hold. Please update your payment details or try another card to complete your order.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${env.CLIENT_URL}" class="button" target="_blank">Retry Payment</a>
      </div>
      <div style="font-size: 13px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Need assistance? Reach out to <a href="mailto:${env.SUPPORT_EMAIL}" style="color: #ef4444;">${env.SUPPORT_EMAIL}</a>.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
