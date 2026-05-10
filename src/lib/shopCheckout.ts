import { supabase } from '@/integrations/supabase/client';
import type { ShopItemKind } from '@/lib/shopCatalog';

type ShopCheckoutRequest = {
  itemId: string;
  slug?: string | null;
  kind?: ShopItemKind | null;
  coinAmount?: number | null;
};

export async function createShopCheckout({ itemId, slug, kind, coinAmount }: ShopCheckoutRequest) {
  const { data, error } = await supabase.functions.invoke('create-shop-checkout', {
    body: {
      itemId,
      slug: slug ?? null,
      kind: kind ?? null,
      coinAmount: coinAmount ?? null,
    },
  });

  if (error) throw error;

  const checkoutUrl = (data as { url?: string } | null)?.url;
  if (!checkoutUrl) {
    throw new Error('Stripe checkout URL missing.');
  }

  return checkoutUrl;
}
