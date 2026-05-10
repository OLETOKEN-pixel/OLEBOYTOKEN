import { supabase } from '@/integrations/supabase/client';

export async function createShopCheckout(itemId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error('You must be logged in to start checkout.');
  }

  const { data, error } = await supabase.functions.invoke('create-shop-checkout', {
    body: { itemId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) throw error;

  const checkoutUrl = (data as { url?: string } | null)?.url;
  if (!checkoutUrl) {
    throw new Error('Stripe checkout URL missing.');
  }

  return checkoutUrl;
}
