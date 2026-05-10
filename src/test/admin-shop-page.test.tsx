import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminShop from '@/pages/AdminShop';
import type { AdminShopCardEntry } from '@/hooks/useAdminShopCatalog';
import type { ShopCardViewModel } from '@/lib/shopCatalog';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  saveItem: vi.fn(),
  saveSlot: vi.fn(),
  publishCatalog: vi.fn(),
  updateClaim: vi.fn(),
}));

const catalogItems = [
  {
    id: 'item-coin',
    slug: 'starter-coins',
    kind: 'coin_pack',
    title: 'Starter Coins',
    subtitle: 'Entry coin pack.',
    description: 'Entry coin pack.',
    image_path: '/coin.png',
    cta_label: 'BUY NOW',
    is_active: true,
    action_key: null,
    coin_amount: 5,
    vip_duration_days: null,
    metadata: { badge: 'x5' },
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
    prices: [
      {
        id: 'price-coin-base',
        item_id: 'item-coin',
        audience: 'base',
        currency: 'eur',
        amount_minor: 500,
        compare_at_minor: null,
        is_active: true,
        created_at: '2026-05-07T10:00:00.000Z',
        updated_at: '2026-05-07T10:00:00.000Z',
      },
    ],
    unlockRule: null,
  },
  {
    id: 'item-wallet-50',
    slug: 'wallet-50',
    kind: 'coin_pack',
    title: '50 COINS',
    subtitle: 'Wallet only pack.',
    description: 'Wallet only pack.',
    image_path: '/coin.png',
    cta_label: 'BUY NOW',
    is_active: true,
    action_key: null,
    coin_amount: 50,
    vip_duration_days: null,
    metadata: { badge: 'x50' },
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
    prices: [
      {
        id: 'price-wallet-base',
        item_id: 'item-wallet-50',
        audience: 'base',
        currency: 'eur',
        amount_minor: 5000,
        compare_at_minor: null,
        is_active: true,
        created_at: '2026-05-07T10:00:00.000Z',
        updated_at: '2026-05-07T10:00:00.000Z',
      },
    ],
    unlockRule: null,
  },
  {
    id: 'item-vip',
    slug: 'vip-30',
    kind: 'vip_membership',
    title: 'VIP',
    subtitle: 'VIP membership for 30 days.',
    description: 'VIP membership for 30 days.',
    image_path: '/showreel/vip-icon.svg',
    cta_label: 'GET VIP',
    is_active: true,
    action_key: null,
    coin_amount: null,
    vip_duration_days: 30,
    metadata: { benefits: ['Real rewards'] },
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
    prices: [
      {
        id: 'price-vip-base',
        item_id: 'item-vip',
        audience: 'base',
        currency: 'coins',
        amount_minor: 5,
        compare_at_minor: null,
        is_active: true,
        created_at: '2026-05-07T10:00:00.000Z',
        updated_at: '2026-05-07T10:00:00.000Z',
      },
    ],
    unlockRule: null,
  },
  {
    id: 'item-reward',
    slug: 'reward-mousepad',
    kind: 'physical_reward',
    title: 'Mousepad',
    subtitle: 'LEVEL REWARD',
    description: 'Unlockable reward.',
    image_path: '/shop/tappetino.png',
    cta_label: 'CLAIM',
    is_active: true,
    action_key: null,
    coin_amount: null,
    vip_duration_days: null,
    metadata: {},
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
    prices: [],
    unlockRule: {
      item_id: 'item-reward',
      unlock_type: 'level',
      level_required: 15,
      challenge_id: null,
      claim_once: true,
      created_at: '2026-05-07T10:00:00.000Z',
      updated_at: '2026-05-07T10:00:00.000Z',
    },
  },
];

const slotRows = [
  {
    id: 'slot-featured',
    surface_key: 'shop.featured_cards',
    sort_order: 0,
    item_id: 'item-coin',
    card_variant: 'coins',
    title_override: '',
    subtitle_override: '',
    cta_label_override: '',
    is_active: true,
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
  },
  {
    id: 'slot-wallet-hidden',
    surface_key: 'shop.featured_cards',
    sort_order: 5,
    item_id: 'item-wallet-50',
    card_variant: 'coins',
    title_override: '',
    subtitle_override: '',
    cta_label_override: '',
    is_active: false,
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
  },
  {
    id: 'slot-unlock',
    surface_key: 'shop.unlock_cards',
    sort_order: 0,
    item_id: 'item-reward',
    card_variant: 'reward',
    title_override: '',
    subtitle_override: '',
    cta_label_override: '',
    is_active: true,
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
  },
];

const presentations = [
  {
    id: 'presentation-featured',
    slot_id: 'slot-featured',
    workspace: 'draft',
    template_key: 'featured-card',
    theme_key: 'default',
    eyebrow_text: 'COINS',
    supporting_text: 'Entry coin pack.',
    primary_image_path: '/coin.png',
    secondary_image_path: '',
    show_badge: true,
    show_subtitle: false,
    show_supporting_text: true,
    show_secondary_image: false,
    metadata: {},
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
  },
  {
    id: 'presentation-unlock',
    slot_id: 'slot-unlock',
    workspace: 'draft',
    template_key: 'unlock-card',
    theme_key: 'default',
    eyebrow_text: 'UNLOCK',
    supporting_text: 'Unlockable reward.',
    primary_image_path: '/shop/tappetino.png',
    secondary_image_path: '',
    show_badge: true,
    show_subtitle: false,
    show_supporting_text: true,
    show_secondary_image: false,
    metadata: {},
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
  },
];

const claims = [
  {
    id: 'claim-1',
    item_id: 'item-reward',
    user_id: 'user-1',
    status: 'pending',
    requested_at: '2026-05-07T12:00:00.000Z',
    resolved_at: null,
    resolved_by: null,
    admin_note: '',
    created_at: '2026-05-07T12:00:00.000Z',
    updated_at: '2026-05-07T12:00:00.000Z',
    itemTitle: 'Mousepad',
    itemSlug: 'reward-mousepad',
    itemImage: '/shop/tappetino.png',
  },
];

const challenges = [
  {
    id: 'challenge-1',
    title: 'Win 3 matches',
    description: 'Complete three wins.',
    type: 'daily',
    reward_type: 'xp',
    reward_value: 100,
    reward_xp: 100,
    reward_coin: 0,
    target_value: 3,
    is_active: true,
    sort_order: 0,
    created_at: '2026-05-07T10:00:00.000Z',
    updated_at: '2026-05-07T10:00:00.000Z',
  },
];

function makeCard(overrides: Partial<ShopCardViewModel> & Pick<ShopCardViewModel, 'id' | 'slotId' | 'title' | 'ctaLabel' | 'kind'>): ShopCardViewModel {
  return {
    id: overrides.id,
    slotId: overrides.slotId,
    surfaceKey: overrides.surfaceKey ?? 'shop.featured_cards',
    sortOrder: overrides.sortOrder ?? 0,
    cardVariant: overrides.cardVariant ?? 'coins',
    templateKey: overrides.templateKey ?? 'featured-card',
    themeKey: overrides.themeKey ?? 'default',
    title: overrides.title,
    subtitle: overrides.subtitle ?? '',
    description: overrides.description ?? '',
    supportingText: overrides.supportingText ?? overrides.description ?? '',
    image: overrides.image ?? '/coin.png',
    primaryImage: overrides.primaryImage ?? overrides.image ?? '/coin.png',
    secondaryImage: overrides.secondaryImage ?? '',
    kind: overrides.kind,
    ctaLabel: overrides.ctaLabel,
    actionKey: overrides.actionKey ?? null,
    coinAmount: overrides.coinAmount ?? null,
    vipDurationDays: overrides.vipDurationDays ?? null,
    priceLabel: overrides.priceLabel ?? null,
    priceCurrency: overrides.priceCurrency ?? null,
    unlockLabel: overrides.unlockLabel ?? null,
    levelRequired: overrides.levelRequired ?? null,
    challengeId: overrides.challengeId ?? null,
    isLocked: overrides.isLocked ?? false,
    isClaimed: overrides.isClaimed ?? false,
    claimStatus: overrides.claimStatus ?? null,
    badgeLabel: overrides.badgeLabel ?? 'COINS',
    showBadge: overrides.showBadge ?? true,
    showSubtitle: overrides.showSubtitle ?? false,
    showSupportingText: overrides.showSupportingText ?? true,
    showSecondaryImage: overrides.showSecondaryImage ?? false,
    metadata: overrides.metadata ?? {},
    searchText: overrides.searchText ?? overrides.title.toLowerCase(),
  };
}

const publicDigitalCards: AdminShopCardEntry[] = [
  {
    item: catalogItems[0],
    slot: slotRows[0],
    presentation: presentations[0],
    placement: 'public_digital',
    isVisibleInShop: true,
    card: makeCard({
      id: 'item-coin',
      slotId: 'slot-featured',
      title: 'Starter Coins',
      description: 'Entry coin pack.',
      ctaLabel: 'BUY NOW',
      kind: 'coin_pack',
      priceLabel: '€5,00',
      priceCurrency: 'eur',
      badgeLabel: 'COINS',
    }),
  },
];

const walletOffers: AdminShopCardEntry[] = [
  {
    item: catalogItems[1],
    slot: slotRows[1],
    presentation: null,
    placement: 'wallet_offer',
    isVisibleInShop: false,
    card: makeCard({
      id: 'item-wallet-50',
      slotId: 'slot-wallet-hidden',
      title: '50 COINS',
      description: 'Wallet only pack.',
      ctaLabel: 'BUY NOW',
      kind: 'coin_pack',
      priceLabel: '€50,00',
      priceCurrency: 'eur',
      badgeLabel: 'COINS',
    }),
  },
  {
    item: catalogItems[2],
    slot: null,
    presentation: null,
    placement: 'wallet_offer',
    isVisibleInShop: false,
    card: makeCard({
      id: 'item-vip',
      slotId: 'wallet-item-vip',
      title: 'VIP',
      description: 'VIP membership for 30 days.',
      ctaLabel: 'GET VIP',
      kind: 'vip_membership',
      priceLabel: '5 COINS',
      priceCurrency: 'coins',
      badgeLabel: 'VIP',
    }),
  },
];

const realItems: AdminShopCardEntry[] = [
  {
    item: catalogItems[3],
    slot: slotRows[2],
    presentation: presentations[1],
    placement: 'real_item',
    isVisibleInShop: true,
    card: makeCard({
      id: 'item-reward',
      slotId: 'slot-unlock',
      title: 'Mousepad',
      description: 'Unlockable reward.',
      ctaLabel: 'CLAIM',
      kind: 'physical_reward',
      unlockLabel: 'LVL 15',
      badgeLabel: 'UNLOCK',
      surfaceKey: 'shop.unlock_cards',
      cardVariant: 'reward',
      templateKey: 'unlock-card',
      isLocked: true,
      levelRequired: 15,
    }),
  },
];

vi.mock('@/hooks/useAdminShopCatalog', () => ({
  useAdminShopCatalog: () => ({
    draft: {
      workspace: 'draft',
      items: catalogItems,
      slots: slotRows,
      presentations,
      challenges,
    },
    live: {
      workspace: 'live',
      items: catalogItems,
      slots: slotRows,
      presentations: presentations.map((presentation) => ({ ...presentation, workspace: 'live' })),
      challenges,
    },
    items: catalogItems,
    slots: slotRows,
    presentations,
    challenges,
    liveItems: catalogItems,
    liveSlots: slotRows,
    livePresentations: presentations,
    workspaceSource: 'workspace',
    adminBackendAvailable: true,
    hasUnpublishedChanges: true,
    publicDigitalCards,
    walletOffers,
    realItems,
    isLoading: false,
    saveItem: mocks.saveItem,
    saveSlot: mocks.saveSlot,
    publishCatalog: mocks.publishCatalog,
    savingItem: false,
    savingSlot: false,
    publishingCatalog: false,
    isBootstrappingInitialDraft: false,
  }),
}));

vi.mock('@/hooks/useShopClaims', () => ({
  useShopClaims: () => ({
    claims,
    updateClaim: mocks.updateClaim,
    updatingClaim: false,
  }),
}));

vi.mock('@/hooks/useAdminStatus', () => ({
  useAdminStatus: () => ({
    user: { id: 'admin-1' },
    authLoading: false,
    isAdmin: true,
    isLoading: false,
  }),
}));

vi.mock('@/components/layout/NavbarFigmaLoggedIn', () => ({
  NavbarFigmaLoggedIn: () => <div data-testid="admin-navbar" />,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  },
}));

function renderAdminShop() {
  return render(
    <MemoryRouter>
      <AdminShop />
    </MemoryRouter>,
  );
}

function findFieldInput(label: string, selector = 'input,textarea,select') {
  const labelNode = screen.getByText(label);
  const field = labelNode.parentElement?.querySelector(selector);
  if (!field) {
    throw new Error(`Field not found for label: ${label}`);
  }
  return field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

describe('AdminShop', () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.saveItem.mockReset();
    mocks.saveSlot.mockReset();
    mocks.publishCatalog.mockReset();
    mocks.updateClaim.mockReset();
  });

  it('renders the card-first workspace and removes the legacy tabs', () => {
    renderAdminShop();

    expect(screen.getByText('Shop Workspace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Card Item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Card Real Item' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByText('Card Items')).toBeInTheDocument();
    expect(screen.getByText('Wallet Offers')).toBeInTheDocument();
    expect(screen.getAllByText('Card Real Item').length).toBeGreaterThan(0);
    expect(screen.getByText('Pending Claims')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Studio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Catalog' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Claims' })).not.toBeInTheDocument();
  });

  it('opens editors from existing cards and shows simplified forms without legacy preview toggles', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'GET VIP' }));
    expect(screen.getByText('Edit shop card')).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Destinazione')).toBeInTheDocument();
    expect(screen.getByText('Live Preview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Base' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'VIP' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Locked' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlocked' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claimed' })).not.toBeInTheDocument();
  });

  it('switches the simplified editor fields for digital and real item creation', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'Card Item' }));
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Destinazione')).toBeInTheDocument();
    expect(screen.getByText('Coins amount')).toBeInTheDocument();
    expect(screen.getByText('Prezzo')).toBeInTheDocument();
    expect(screen.getByText('Prezzo VIP')).toBeInTheDocument();

    fireEvent.change(findFieldInput('Tipo', 'select'), { target: { value: 'vip_membership' } });
    expect(screen.getByText('Durata giorni')).toBeInTheDocument();
    expect(screen.getByText('Benefits')).toBeInTheDocument();

    fireEvent.change(findFieldInput('Destinazione', 'select'), { target: { value: 'wallet_only' } });
    expect(screen.queryByText('Posizione')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Card Real Item' }));
    expect(screen.getByText('Modalita')).toBeInTheDocument();
    expect(screen.getByText('Titolo')).toBeInTheDocument();
    expect(screen.getByText('Posizione')).toBeInTheDocument();

    fireEvent.change(findFieldInput('Modalita', 'select'), { target: { value: 'purchase' } });
    expect(screen.getAllByText('Prezzo').length).toBeGreaterThan(0);
    expect(screen.getByText('Prezzo VIP')).toBeInTheDocument();

    fireEvent.change(findFieldInput('Modalita', 'select'), { target: { value: 'unlock_challenge' } });
    expect(screen.getAllByText('Challenge').length).toBeGreaterThan(0);
  });

  it('blocks VIP prices above the base price before saving a card', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'Card Item' }));
    fireEvent.change(findFieldInput('Titolo'), { target: { value: 'Official Pack' } });
    fireEvent.change(findFieldInput('Descrizione breve', 'textarea'), { target: { value: 'Exclusive pack.' } });
    fireEvent.change(findFieldInput('Immagine'), { target: { value: '/shop/pack.webp' } });
    fireEvent.change(findFieldInput('Coins amount'), { target: { value: '25' } });
    fireEvent.change(findFieldInput('Prezzo'), { target: { value: '19.99' } });
    fireEvent.change(findFieldInput('Prezzo VIP'), { target: { value: '29.99' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create card' }));

    expect(mocks.saveItem).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'VIP price must be lower than or equal to the base price.',
        variant: 'destructive',
      }),
    );
  });

  it('publishes the current draft from the simplified header action', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(mocks.publishCatalog).toHaveBeenCalledTimes(1);
  });
});
