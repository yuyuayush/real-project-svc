import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Order, type EmailSendResult } from '../types/index.js';
import { renderReceiptEmailHtml, renderReceiptPlainText } from '../templates/email-receipt.template.js';
import { renderPaymentFailedEmailHtml } from '../templates/email-failed.template.js';
import { renderRefundEmailHtml } from '../templates/email-refund.template.js';

export type { EmailSendResult };

export class EmailService {
  private resend: Resend | null = null;

  constructor() {
    if (!env.isMockResend) {
      this.resend = new Resend(env.RESEND_API_KEY);
      logger.info('📧 Resend Email Service initialized with production/test API key');
    } else {
      logger.warn('⚠️ RESEND_API_KEY is placeholder or not set. Running in development simulation mode.');
    }
  }

  /**
   * Send order payment confirmation receipt via Resend
   */
  async sendOrderReceipt(order: Order): Promise<EmailSendResult> {
    const to = order.customer.email;
    const subject = `Order Confirmation #${order.orderNumber} - ${env.STORE_NAME}`;
    const html = renderReceiptEmailHtml(order);
    const text = renderReceiptPlainText(order);

    if (env.isMockResend || !this.resend) {
      logger.info(
        {
          to,
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
        },
        '📨 [MOCK EMAIL] Simulating Resend email delivery for order receipt'
      );
      return {
        success: true,
        messageId: `mock_email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    }

    logger.info({ to, orderNumber: order.orderNumber }, '🚀 Sending receipt email via Resend API');
    
    const { data, error } = await this.resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
      headers: {
        'X-Entity-Ref-ID': order.orderNumber,
      },
    });

    if (error) {
      logger.error({ error, orderNumber: order.orderNumber }, '❌ Resend failed to deliver email');
      return {
        success: false,
        error: error.message,
      };
    }

    logger.info({ messageId: data?.id, orderNumber: order.orderNumber }, '✅ Resend email sent successfully');
    return {
      success: true,
      messageId: data?.id,
    };
  }

  /**
   * Send payment failure notification via Resend
   */
  async sendPaymentFailureAlert(order: Order, reason?: string): Promise<EmailSendResult> {
    const to = order.customer.email;
    const subject = `Payment Failed: Action required for Order #${order.orderNumber}`;
    const html = renderPaymentFailedEmailHtml(order, reason);

    if (env.isMockResend || !this.resend) {
      logger.info({ to, orderNumber: order.orderNumber, reason }, '📨 [MOCK EMAIL] Simulating payment failure email');
      return {
        success: true,
        messageId: `mock_failed_${Date.now()}`,
      };
    }

    const { data, error } = await this.resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error({ error, orderNumber: order.orderNumber }, '❌ Resend failed to send failure notification');
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  }

  /**
   * Send refund confirmation receipt via Resend
   */
  async sendRefundConfirmation(
    order: Order,
    refundAmountInCents?: number,
    reason?: string
  ): Promise<EmailSendResult> {
    const to = order.customer.email;
    const subject = `Refund Confirmation for Order #${order.orderNumber} - ${env.STORE_NAME}`;
    const html = renderRefundEmailHtml(order, refundAmountInCents, reason);

    if (env.isMockResend || !this.resend) {
      logger.info(
        { to, orderNumber: order.orderNumber, refundAmountInCents },
        '📨 [MOCK EMAIL] Simulating Resend refund confirmation delivery'
      );
      return {
        success: true,
        messageId: `mock_refund_${Date.now()}`,
      };
    }

    const { data, error } = await this.resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error({ error, orderNumber: order.orderNumber }, '❌ Resend failed to send refund receipt');
      return { success: false, error: error.message };
    }

    logger.info({ messageId: data?.id, orderNumber: order.orderNumber }, '✅ Resend refund receipt sent');
    return { success: true, messageId: data?.id };
  }
}

export const emailService = new EmailService();
