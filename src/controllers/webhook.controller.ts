import { Request, Response } from 'express';
import { stripeService } from '../services/stripe.service.js';
import { webhookService } from '../services/webhook.service.js';
import { asyncHandler } from '../utils/async-handler.js';

export class WebhookController {
  static handleStripe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signature = (req.headers['stripe-signature'] as string) || '';

    // req.body is raw Buffer because of express.raw middleware on this route
    const event = stripeService.constructWebhookEvent(req.body, signature);

    // Process event in background / service
    const result = await webhookService.processStripeEvent(event);

    res.status(200).json({
      received: true,
      handled: result.handled,
      eventType: result.eventType,
    });
  });
}
