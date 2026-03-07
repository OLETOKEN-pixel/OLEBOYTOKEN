import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
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
}
