// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // URL frontend
  credentials: true
}));

// Route untuk membuat checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { cart, userId } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Transform cart items ke format yang dibutuhkan Stripe
    const line_items = cart.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: [item.cover],
          metadata: {
            productId: item.id
          }
        },
        unit_amount: Math.round(parseFloat(item.price) * 100), // Stripe menggunakan smallest currency unit (cents)
      },
      quantity: item.quantity || 1,
    }));

    // Buat checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cart`,
      metadata: {
        userId: userId
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Basic webhook handler untuk development
app.post('/webhook', express.json(), async (request, response) => {
  const event = request.body;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        // Handle successful payment
        console.log('Payment successful:', session.id);
        break;
      case 'payment_intent.payment_failed':
        const paymentIntent = event.data.object;
        console.log('Payment failed:', paymentIntent.id);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    response.json({received: true});
  } catch (err) {
    console.error('Webhook error:', err);
    response.status(500).send('Webhook processing failed');
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});