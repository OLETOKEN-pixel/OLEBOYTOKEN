import { supabase } from '@/integrations/supabase/client';

export async function createShopCheckout(itemId: string) {
  const { data, error } = await supabase.functions.invoke('create-shop-checkout', {
    body: { itemId },
  });

  if (error) throw error;

  const checkoutUrl = (data as { url?: string } | null)?.url;
  if (!checkoutUrl) {
    throw new Error('Stripe checkout URL missing.');
  }

  return checkoutUrl;
}
