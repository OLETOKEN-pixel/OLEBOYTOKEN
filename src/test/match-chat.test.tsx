import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchChat } from '@/components/matches/MatchChat';

const {
  channelBuilder,
  fromMock,
  insertMock,
  orderMock,
  uploadMock,
  removeMock,
  createSignedUrlMock,
  toastMock,
} = vi.hoisted(() => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(() => ({})),
  };
  channel.on.mockReturnValue(channel);

  return {
    channelBuilder: channel,
    fromMock: vi.fn(),
    insertMock: vi.fn(),
    orderMock: vi.fn(),
    uploadMock: vi.fn(),
    removeMock: vi.fn(),
    createSignedUrlMock: vi.fn(),
    toastMock: vi.fn(),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      username: 'marv',
      avatar_url: 'https://cdn.discordapp.com/avatars/current/avatar.png',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/current/avatar.png',
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    channel: vi.fn(() => channelBuilder),
    removeChannel: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: createSignedUrlMock,
        upload: uploadMock,
        remove: removeMock,
      })),
    },
  },
}));

function renderChat() {
  return render(
    <MatchChat
      matchId="match-1"
      matchStatus="in_progress"
      currentUserId="user-current"
      isAdmin={false}
      isParticipant
      hideHeader
      teamMap={{ 'user-opponent': 'A', 'user-current': 'B' }}
      variant="figmaReady"
    />,
  );
}

describe('MatchChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelBuilder.on.mockReturnValue(channelBuilder);
    channelBuilder.subscribe.mockReturnValue({});
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'msg-1',
          match_id: 'match-1',
          user_id: 'user-opponent',
          message: 'hello',
          is_system: false,
          created_at: '2026-04-18T10:00:00.000Z',
          display_name: 'lightvs',
          avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
          discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
          attachment_path: null,
          attachment_type: null,
        },
      ],
      error: null,
    });
    insertMock.mockResolvedValue({ error: null });
    uploadMock.mockResolvedValue({ error: null });
    removeMock.mockResolvedValue({ error: null });
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/image.png' }, error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'match_chat_messages_view') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: orderMock,
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      if (table === 'match_chat_messages') {
        return {
          insert: insertMock,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('renders profile photos instead of letter fallback badges', async () => {
    renderChat();

    expect(await screen.findByAltText('lightvs')).toHaveAttribute('src', 'https://cdn.discordapp.com/avatars/opponent/avatar.png');
    expect(screen.queryByText('L')).not.toBeInTheDocument();
  });

  it('adds an emoji from the picker to the message input', async () => {
    renderChat();

    await screen.findByAltText('lightvs');
    fireEvent.click(screen.getByLabelText('Open emoji picker'));
    fireEvent.click(screen.getByRole('button', { name: '🔥' }));

    expect(screen.getByPlaceholderText('Type a message...')).toHaveValue('🔥');
  });

  it('uploads an image from the figma upload button', async () => {
    const { container } = renderChat();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'proof.png', { type: 'image/png' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
    });

    const inserted = insertMock.mock.calls[0][0];
    expect(inserted.attachment_type).toBe('image');
    expect(inserted.attachment_path).toContain('match-1/user-current/');
  });

  it('allows high quality screenshots above the old 5 MB limit', async () => {
    const { container } = renderChat();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'screenshot.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 12 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
    });

    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Image too large',
      }),
    );
  });
});
