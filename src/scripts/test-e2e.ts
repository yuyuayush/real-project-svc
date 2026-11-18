import { createApp } from '../app.js';

async function runTests() {
  console.log('🧪 Starting End-to-End Verification Test...');
  const app = createApp();

  const server = app.listen(5099, async () => {
    try {
      const baseUrl = 'http://127.0.0.1:5099';

      // 1. Healthcheck
      console.log('1️⃣ Testing Health Check...');
      const healthRes = await fetch(`${baseUrl}/health`);
      const healthData = (await healthRes.json()) as { status: string };
      console.log('   Status:', healthRes.status, healthData.status);
      if (healthRes.status !== 200) throw new Error('Health check failed');

      // 2. Create Checkout Session
      console.log('2️⃣ Testing Checkout Session Creation...');
      const checkoutRes = await fetch(`${baseUrl}/api/v1/checkout/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: 'Alex Johnson',
            email: 'alex@example.com',
          },
          items: [
            {
              name: 'Sony WH-1000XM5 ANC Headphones',
              price: 34900,
              quantity: 1,
            },
          ],
          currency: 'usd',
        }),
      });
      const checkoutData = (await checkoutRes.json()) as {
        success: boolean;
        data?: { orderId: string };
      };
      console.log('   Status:', checkoutRes.status, 'Order ID:', checkoutData.data?.orderId);
      if (checkoutRes.status !== 201 || !checkoutData.data) throw new Error('Checkout creation failed');

      const orderId = checkoutData.data.orderId;

      // 3. Query Order
      console.log('3️⃣ Testing Order Query...');
      const orderRes = await fetch(`${baseUrl}/api/v1/orders/${orderId}`);
      const orderData = (await orderRes.json()) as {
        success: boolean;
        data?: { orderNumber: string };
      };
      console.log('   Status:', orderRes.status, 'Order Number:', orderData.data?.orderNumber);
      if (orderRes.status !== 200) throw new Error('Order query failed');

      // 4. Simulate Payment & Resend Receipt
      console.log('4️⃣ Testing Payment Completion & Resend Email Trigger...');
      const payRes = await fetch(`${baseUrl}/api/v1/payments/simulate-success/${orderId}`, {
        method: 'POST',
      });
      const payData = (await payRes.json()) as {
        success: boolean;
        data?: { status: string };
      };
      console.log('   Status:', payRes.status, 'Payment Status:', payData.data?.status);
      if (payRes.status !== 200 || payData.data?.status !== 'PAID') {
        throw new Error('Payment simulation failed');
      }

      // 5. Test Webhook Ingestion (Raw Payload)
      console.log('5️⃣ Testing Stripe Webhook Receiver...');
      const webhookPayload = JSON.stringify({
        id: 'evt_test_123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_mock',
            payment_status: 'paid',
            metadata: { orderId },
          },
        },
      });

      const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'mock_sig',
        },
        body: webhookPayload,
      });
      const webhookData = (await webhookRes.json()) as {
        received: boolean;
        handled: boolean;
        eventType: string;
      };
      console.log('   Status:', webhookRes.status, 'Webhook Response:', webhookData);
      if (webhookRes.status !== 200) throw new Error('Webhook test failed');

      console.log('\n🎉 ALL 5/5 INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀');
    } catch (err) {
      console.error('❌ Test failed:', err);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

runTests();
