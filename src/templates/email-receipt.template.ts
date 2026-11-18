import { Order } from '../models/order.model.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { env } from '../config/env.js';

export function renderReceiptEmailHtml(order: Order): string {
  const formattedTotal = formatCurrency(order.total, order.currency);
  const formattedSubtotal = formatCurrency(order.subtotal, order.currency);
  const formattedTax = formatCurrency(order.tax, order.currency);
  const formattedShipping = formatCurrency(order.shipping, order.currency);
  const formattedDate = formatDate(order.payment.paidAt || order.createdAt);

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 14px 0; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">
          <div style="font-weight: 600; color: #111827; font-size: 15px;">${escapeHtml(item.name)}</div>
          ${item.description ? `<div style="color: #6b7280; font-size: 13px; margin-top: 2px;">${escapeHtml(item.description)}</div>` : ''}
          <div style="color: #9ca3af; font-size: 13px; margin-top: 4px;">Qty: ${item.quantity} &times; ${formatCurrency(item.price, order.currency)}</div>
        </td>
        <td style="padding: 14px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-weight: 600; color: #111827; font-size: 15px; vertical-align: middle;">
          ${formatCurrency(item.price * item.quantity, order.currency)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${order.orderNumber}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #1f2937;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .success-badge {
      display: inline-block;
      background: #10b981;
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    .content {
      padding: 32px;
    }
    .summary-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 24px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 28px;
      border-radius: 6px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="success-badge">&#10003; Payment Confirmed</div>
      <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em;">Thank you for your order!</h1>
      <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">Order #${order.orderNumber}</p>
    </div>

    <div class="content">
      <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px 0; color: #374151;">
        Hi <strong>${escapeHtml(order.customer.name)}</strong>,<br>
        We have received your payment. Your order has been confirmed and is now being processed.
      </p>

      <div class="summary-card">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="color: #64748b; padding-bottom: 6px;">Payment Date:</td>
            <td style="text-align: right; font-weight: 500; color: #1e293b;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="color: #64748b; padding-bottom: 6px;">Payment Method:</td>
            <td style="text-align: right; font-weight: 500; color: #1e293b;">${(order.payment.paymentMethodType || 'Card').toUpperCase()} &bull;&bull;&bull;&bull;</td>
          </tr>
          ${order.payment.stripePaymentIntentId ? `
          <tr>
            <td style="color: #64748b;">Transaction Reference:</td>
            <td style="text-align: right; font-family: monospace; font-size: 12px; color: #64748b;">${order.payment.stripePaymentIntentId}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <h2 style="font-size: 17px; font-weight: 600; margin: 24px 0 12px 0; color: #0f172a;">Order Summary</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Calculation Breakdown -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 28px;">
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Subtotal</td>
          <td style="padding: 4px 0; text-align: right; color: #1e293b;">${formattedSubtotal}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Shipping</td>
          <td style="padding: 4px 0; text-align: right; color: #1e293b;">${order.shipping === 0 ? 'FREE' : formattedShipping}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #64748b;">Estimated Tax</td>
          <td style="padding: 4px 0; text-align: right; color: #1e293b;">${formattedTax}</td>
        </tr>
        <tr style="border-top: 2px solid #e2e8f0; font-size: 17px; font-weight: 700;">
          <td style="padding: 12px 0; color: #0f172a;">Total Paid</td>
          <td style="padding: 12px 0; text-align: right; color: #0f172a;">${formattedTotal}</td>
        </tr>
      </table>

      <!-- Track order button -->
      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${env.CLIENT_URL}/order-success.html?orderId=${order.id}" class="button" target="_blank">
          View Order Status
        </a>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.5;">
        Need help? Contact our 24/7 customer support at <a href="mailto:${env.SUPPORT_EMAIL}" style="color: #2563eb; text-decoration: none;">${env.SUPPORT_EMAIL}</a>.<br>
        &copy; ${new Date().getFullYear()} ${escapeHtml(env.STORE_NAME)}. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

export function renderReceiptPlainText(order: Order): string {
  const formattedTotal = formatCurrency(order.total, order.currency);
  return `
Thank you for your order, ${order.customer.name}!

Order Number: ${order.orderNumber}
Payment Status: CONFIRMED
Date: ${formatDate(order.payment.paidAt || order.createdAt)}
Total Paid: ${formattedTotal}

Items:
${order.items.map((i) => `- ${i.name} x${i.quantity}: ${formatCurrency(i.price * i.quantity, order.currency)}`).join('\n')}

Subtotal: ${formatCurrency(order.subtotal, order.currency)}
Tax: ${formatCurrency(order.tax, order.currency)}
Shipping: ${order.shipping === 0 ? 'FREE' : formatCurrency(order.shipping, order.currency)}
Total: ${formattedTotal}

Transaction ID: ${order.payment.stripePaymentIntentId || 'N/A'}

Need help? Contact ${env.SUPPORT_EMAIL}
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
