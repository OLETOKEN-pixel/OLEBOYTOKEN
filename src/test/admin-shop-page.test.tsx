import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminShop from '@/pages/AdminShop';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  refetch: vi.fn(),
  saveItem: vi.fn(),
  saveSlot: vi.fn(),
  setItemActive: vi.fn(),
  publishCatalog: vi.fn(),
  updateClaim: vi.fn(),
}));

const catalogItems = [
  {
    id: 'item-coin',
    slug: 'starter-coins',
    kind: 'coin_pack',
    title: 'Starter Coins',
    subtitle: 'BOOST',
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
    id: 'item-vip',
    slug: 'vip-30',
    kind: 'vip_membership',
    title: 'VIP',
    subtitle: '1 MONTH',
    description: '30 day VIP offer.',
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
    supporting_text: '',
    primary_image_path: '/coin.png',
    secondary_image_path: '',
    show_badge: true,
    show_subtitle: true,
    show_supporting_text: false,
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
    show_subtitle: true,
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
    isLoading: false,
    refetch: mocks.refetch,
    saveItem: mocks.saveItem,
    saveSlot: mocks.saveSlot,
    setItemActive: mocks.setItemActive,
    publishCatalog: mocks.publishCatalog,
    hasUnpublishedChanges: true,
    workspaceSource: 'workspace',
    adminBackendAvailable: true,
    savingItem: false,
    savingSlot: false,
    togglingItem: false,
    publishingCatalog: false,
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
        remove: vi.fn().mockResolvedValue({ error: null }),
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
    mocks.refetch.mockReset();
    mocks.saveItem.mockReset();
    mocks.saveSlot.mockReset();
    mocks.setItemActive.mockReset();
    mocks.publishCatalog.mockReset();
    mocks.updateClaim.mockReset();
  });

  it('renders the visual draft workspace with studio, catalog, and claims tabs', () => {
    renderAdminShop();

    expect(screen.getByText('Shop Workspace')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Studio' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Claims' })).toBeInTheDocument();
    expect(screen.getByText('Featured row')).toBeInTheDocument();
    expect(screen.getByText('Unlock row')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish shop' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Catalog' }));
    expect(screen.getByText('Starter Coins')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Claims' }));
    expect(screen.getByText('Mousepad')).toBeInTheDocument();
  });

  it('opens the shared editor from a studio card and exposes the reward preview states', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'CLAIM' }));

    expect(screen.getByText('Edit draft shop card')).toBeInTheDocument();
    expect(screen.getByText('User-facing preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Base' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VIP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Locked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlocked' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claimed' })).toBeInTheDocument();
  });

  it('switches editor fields by kind and surface for featured cards and unlock rewards', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'New featured card' }));

    fireEvent.change(findFieldInput('Kind', 'select'), { target: { value: 'vip_membership' } });
    expect(screen.getByText('Duration days')).toBeInTheDocument();
    expect(screen.getByText('Base coin price')).toBeInTheDocument();
    expect(screen.getByText('VIP coin price')).toBeInTheDocument();
    expect(screen.getByText('Benefits (comma separated)')).toBeInTheDocument();

    fireEvent.change(findFieldInput('Surface', 'select'), { target: { value: 'shop.unlock_cards' } });
    expect(screen.getByText('Unlock type')).toBeInTheDocument();
    expect(screen.getByText('Claim once')).toBeInTheDocument();

    fireEvent.change(findFieldInput('Unlock type', 'select'), { target: { value: 'level' } });
    expect(screen.getByText('Level required')).toBeInTheDocument();
  });

  it('blocks VIP prices above the base price before saving a draft card', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'New featured card' }));
    fireEvent.change(findFieldInput('Kind', 'select'), { target: { value: 'physical_product' } });
    fireEvent.change(findFieldInput('Slug'), { target: { value: 'hoodie' } });
    fireEvent.change(findFieldInput('Title'), { target: { value: 'Official Hoodie' } });
    fireEvent.change(findFieldInput('Item image path or upload'), { target: { value: '/shop/hoodie.webp' } });
    fireEvent.change(findFieldInput('Base EUR price'), { target: { value: '29.99' } });
    fireEvent.change(findFieldInput('VIP EUR price'), { target: { value: '39.99' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create draft card' }));

    expect(mocks.saveItem).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'VIP price must be lower than or equal to the base price.',
        variant: 'destructive',
      }),
    );
  });

  it('publishes the draft workspace from the admin header action', () => {
    renderAdminShop();

    fireEvent.click(screen.getByRole('button', { name: 'Publish shop' }));

    expect(mocks.publishCatalog).toHaveBeenCalledTimes(1);
  });
});
