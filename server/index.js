import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isDev = process.env.NODE_ENV !== 'production';
const PORT = isDev ? 3001 : 5000;

const PROCESSING_FEE = 0.50;
const MIN_COINS = 5;
const PRODUCTION_DOMAIN = 'https://oleboytoken.com';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: 'Missing signature or webhook secret' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('[STRIPE-WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[STRIPE-WEBHOOK] Event received:', event.type, event.id);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const coins = parseFloat(session.metadata?.coins || '0');

    if (!userId || !coins) {
      return res.status(400).json({ error: 'Missing metadata' });
    }

    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (existingTx) {
      return res.json({ received: true });
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      console.error('[STRIPE-WEBHOOK] Wallet error:', walletError);
      return res.status(500).json({ error: 'Error fetching wallet' });
    }

    const newBalance = (wallet.balance || 0) + coins;
    await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId);

    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'deposit',
      amount: coins,
      description: `Purchased ${coins} Coins via Stripe`,
      stripe_session_id: session.id,
      provider: 'stripe',
      status: 'completed',
    });

    console.log('[STRIPE-WEBHOOK] Deposit processed:', { userId, coins, newBalance });
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const userId = charge.metadata?.user_id;
    const refundedAmount = parseFloat(charge.metadata?.coins || '0');

    if (userId && refundedAmount > 0) {
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
      if (wallet) {
        const newBalance = Math.max(0, (wallet.balance || 0) - refundedAmount);
        await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId);
      }
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'refund',
        amount: -refundedAmount,
        description: `Refund: ${refundedAmount} Coins`,
        stripe_session_id: `refund_${charge.id}`,
        provider: 'stripe',
        status: 'completed',
      });
    }
  }

  res.json({ received: true });
});

app.use(express.json());

app.post('/api/create-checkout', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Payment system not configured. Contact support.' });
  }

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
    return res.status(400).json({ error: `Minimo acquisto: ${MIN_COINS} Coins (€${MIN_COINS})` });
  }

  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || PRODUCTION_DOMAIN;

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

    console.log('[CREATE-CHECKOUT] Session created:', session.id);
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[CREATE-CHECKOUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});
