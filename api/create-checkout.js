import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const PROCESSING_FEE = 0.50;
const MIN_COINS = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({ error: 'Payment system not configured. Contact support.' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { amount } = req.body;
  if (!amount || amount < MIN_COINS) {
    return res.status(400).json({ error: `Minimo acquisto: ${MIN_COINS} Coins` });
  }

  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://oleboytoken.com';

  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `${amount} Coins`, description: 'OLEBOY TOKEN Gaming Coins' },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'Commissione di servizio', description: 'Processing fee' },
            unit_amount: Math.round(PROCESSING_FEE * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/payment/success?provider=stripe&success=true&coins=${amount}`,
      cancel_url: `${origin}/buy?canceled=true`,
      metadata: {
        user_id: user.id,
        coins: amount.toString(),
        fee: PROCESSING_FEE.toString(),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          coins: amount.toString(),
        },
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[CREATE-CHECKOUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
