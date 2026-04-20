import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Loader2, MessagesSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ProfileSummary } from '@/types';

const F = "'Base Neue Trial', 'Inter', sans-serif";

interface ChatMessage {
  id: string;
  match_id: string;
  user_id: string;
  message: string | null;
  is_system: boolean;
  created_at: string;
  display_name?: string;
  avatar_url?: string | null;
  discord_avatar_url?: string | null;
  attachment_path?: string | null;
  attachment_type?: string | null;
  attachment_url?: string | null;
}

interface MatchChatProps {
  matchId: string;
  matchStatus: string;
  currentUserId: string;
  isAdmin: boolean;
  isParticipant: boolean;
  className?: string;
  hideHeader?: boolean;
  teamMap?: Record<string, 'A' | 'B'>;
  profileMap?: Record<string, ProfileSummary>;
  variant?: 'default' | 'figmaReady';
}

const ACTIVE_STATUSES = ['open', 'joined', 'ready_check', 'in_progress', 'result_pending', 'disputed', 'full', 'started'];
const CHAT_IMAGE_BUCKET = 'match-chat-images';
const MAX_CHAT_IMAGE_SIZE_MB = 50;
const MAX_CHAT_IMAGE_SIZE = MAX_CHAT_IMAGE_SIZE_MB * 1024 * 1024;
const READY_CHAT_ASSETS = {
  emotes: '/figma-assets/match-ready/chat-emotes.svg',
  uploadButton: '/figma-assets/match-ready/chat-send-button.svg',
};
const _B = 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/';
const QUICK_EMOJIS = [
  { char: '🤡', url: _B + 'Clown%20Face.png',                          name: 'clown' },
  { char: '🙊', url: _B + 'Speak-No-Evil%20Monkey.png',                name: 'speak-no-evil' },
  { char: '🙉', url: _B + 'Hear-No-Evil%20Monkey.png',                 name: 'hear-no-evil' },
  { char: '😡', url: _B + 'Pouting%20Face.png',                        name: 'pouting' },
  { char: '🙈', url: _B + 'See-No-Evil%20Monkey.png',                  name: 'see-no-evil' },
  { char: '👹', url: _B + 'Ogre.png',                                  name: 'ogre' },
  { char: '💀', url: _B + 'Skull.png',                                 name: 'skull' },
  { char: '🤯', url: _B + 'Exploding%20Head.png',                      name: 'exploding-head' },
  { char: '☠️', url: _B + 'Skull%20and%20Crossbones.png',              name: 'skull-crossbones' },
  { char: '🤮', url: _B + 'Face%20Vomiting.png',                       name: 'vomiting' },
  { char: '👿', url: _B + 'Angry%20Face%20with%20Horns.png',           name: 'horns' },
  { char: '💩', url: _B + 'Pile%20of%20Poo.png',                       name: 'poo' },
  { char: '😅', url: _B + 'Grinning%20Face%20with%20Sweat.png',        name: 'sweat' },
  { char: '👽', url: _B + 'Alien.png',                                 name: 'alien' },
  { char: '👻', url: _B + 'Ghost.png',                                 name: 'ghost' },
  { char: '🤣', url: _B + 'Rolling%20on%20the%20Floor%20Laughing.png', name: 'rofl' },
  { char: '🤢', url: _B + 'Nauseated%20Face.png',                      name: 'nauseated' },
  { char: '👺', url: _B + 'Goblin.png',                                name: 'goblin' },
  { char: '🤬', url: _B + 'Face%20with%20Symbols%20on%20Mouth.png',    name: 'symbols-mouth' },
  { char: '🤑', url: _B + 'Money-Mouth%20Face.png',                    name: 'money-mouth' },
  { char: '🥶', url: _B + 'Cold%20Face.png',                           name: 'cold' },
  { char: '🤐', url: _B + 'Zipper-Mouth%20Face.png',                   name: 'zipper-mouth' },
  { char: '🤖', url: _B + 'Robot.png',                                 name: 'robot' },
];

function normalizeChatMessageAvatar(message: ChatMessage, profileMap?: Record<string, ProfileSummary>): ChatMessage {
  const mappedProfile = profileMap?.[message.user_id];
  const avatarUrl = getDiscordAvatarUrl(message) || getDiscordAvatarUrl(mappedProfile);

  return {
    ...message,
    display_name: message.display_name && message.display_name !== 'Unknown'
      ? message.display_name
      : mappedProfile?.username || message.display_name,
    avatar_url: message.avatar_url || mappedProfile?.avatar_url || null,
    discord_avatar_url: avatarUrl,
  };
}

function getTeamColor(userId: string, teamMap?: Record<string, 'A' | 'B'>): string {
  const side = teamMap?.[userId];
  if (side === 'A') return '#ff1654';
  if (side === 'B') return '#d8ff16';
  return '#ffffff';
}

export function MatchChat({
  matchId,
  matchStatus,
  currentUserId,
  isAdmin,
  isParticipant,
  className,
  hideHeader,
  teamMap,
  profileMap,
  variant = 'default',
}: MatchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  const canSendMessage = (isParticipant || isAdmin) && ACTIVE_STATUSES.includes(matchStatus);
  const isReadOnly = !ACTIVE_STATUSES.includes(matchStatus);
  const isFigmaReady = variant === 'figmaReady';
  const chatProfileMap = useMemo<Record<string, ProfileSummary>>(() => {
    const profiles = { ...(profileMap ?? {}) };
    if (currentUserId && profile) {
      profiles[currentUserId] = profile as ProfileSummary;
    }
    return profiles;
  }, [
    currentUserId,
    profile?.avatar_url,
    profile?.discord_avatar_url,
    profile?.discord_display_name,
    profile?.epic_username,
    profile?.username,
    profileMap,
  ]);

  const enrichMessages = useCallback(async (rawMessages: ChatMessage[]) => {
    const normalized = rawMessages.map((message) => normalizeChatMessageAvatar(message, chatProfileMap));

    return Promise.all(normalized.map(async (message) => {
      if (message.attachment_type !== 'image' || !message.attachment_path || message.attachment_url) {
        return message;
      }

      const { data, error } = await supabase.storage
        .from(CHAT_IMAGE_BUCKET)
        .createSignedUrl(message.attachment_path, 60 * 60);

      if (error || !data?.signedUrl) return message;

      return {
        ...message,
        attachment_url: data.signedUrl,
      };
    }));
  }, [chatProfileMap]);

  const fetchMessages = useCallback(async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('match_chat_messages_view')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(await enrichMessages((messagesData || []) as unknown as ChatMessage[]));
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId, enrichMessages]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`match-chat-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_chat_messages',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          // Enrich via view to guarantee display_name === 'ADMIN' for admins
          const { data: enriched } = await supabase
            .from('match_chat_messages_view')
            .select('*')
            .eq('id', newMsg.id)
            .maybeSingle();

          const [message] = await enrichMessages([(enriched || newMsg) as unknown as ChatMessage]);
          setMessages(prev => {
            if (prev.some((item) => item.id === message.id)) return prev;
            return [...prev, message];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, fetchMessages, enrichMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !canSendMessage) return;

    const messageText = newMessage.trim();
    if (messageText.length > 500) {
      toast({
        title: 'Message too long',
        description: 'Message cannot exceed 500 characters.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('match_chat_messages')
        .insert({
          match_id: matchId,
          user_id: currentUserId,
          message: messageText,
          is_system: false,
        });

      if (error) throw error;
    } catch (error: any) {
      console.error('Send message error:', error);
      setNewMessage(messageText);
      toast({
        title: 'Error',
        description: 'Failed to send message.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (uploading || !canSendMessage) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please choose an image file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_CHAT_IMAGE_SIZE) {
      toast({
        title: 'Image too large',
        description: `Images cannot exceed ${MAX_CHAT_IMAGE_SIZE_MB} MB.`,
        variant: 'destructive',
      });
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80) || `image.${extension}`;
    const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const storagePath = `${matchId}/${currentUserId}/${Date.now()}-${randomId}-${safeName}`;

    setUploading(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from(CHAT_IMAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('match_chat_messages')
        .insert({
          match_id: matchId,
          user_id: currentUserId,
          message: '',
          is_system: false,
          attachment_path: storagePath,
          attachment_type: 'image',
        });

      if (insertError) {
        await supabase.storage.from(CHAT_IMAGE_BUCKET).remove([storagePath]);
        throw insertError;
      }

      await fetchMessages();
    } catch (error) {
      console.error('Upload chat image error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void handleImageUpload(file);
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? newMessage.length;
    const end = input?.selectionEnd ?? newMessage.length;
    const nextMessage = `${newMessage.slice(0, start)}${emoji}${newMessage.slice(end)}`;

    setNewMessage(nextMessage);
    setEmojiOpen(false);

    window.requestAnimationFrame(() => {
      input?.focus();
      const caret = start + emoji.length;
      input?.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isParticipant && !isAdmin) return null;

  return (
    <div className={cn("match-chat-root flex flex-col h-full bg-card rounded-lg border border-border/50 overflow-hidden", className)}>
      {/* Header — hidden when parent renders its own title */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-secondary/30">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Chat</span>
            <span className="text-xs text-muted-foreground">({messages.length})</span>
          </div>
          {isReadOnly && (
            <span className="text-xs text-muted-foreground">Closed</span>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isFigmaReady ? '8px 0 0' : '8px 0' }} ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 && isFigmaReady ? (
          <div aria-label="No chat messages yet" style={{ height: '100%' }} />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <MessagesSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No messages</p>
          </div>
        ) : (
          <div>
            {messages.map((msg) => {
              const isAdminMessage = msg.display_name === 'ADMIN';

              if (msg.is_system) {
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px' }}>
                    <span style={{ fontFamily: F, fontSize: 11, color: '#9c9c9c', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: 99 }}>
                      {msg.message}
                    </span>
                  </div>
                );
              }

              const avatarSrc = msg.discord_avatar_url || undefined;
              const usernameColor = isAdminMessage ? '#ff1654' : getTeamColor(msg.user_id, teamMap);
              const avatarSize = isFigmaReady ? 38 : 50;
              const hasText = !!msg.message?.trim();

              return (
                <div key={msg.id} style={{ display: 'flex', gap: isFigmaReady ? 10 : 12, padding: isFigmaReady ? '7px 24px' : '8px 16px', alignItems: 'flex-start' }}>
                  {/* 50×50 avatar */}
                  <div
                    aria-label={avatarSrc ? `${msg.display_name || 'Player'} avatar` : 'Profile image unavailable'}
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: '50%',
                      flexShrink: 0,
                      overflow: 'hidden',
                      background: '#565656',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={msg.display_name || 'Player'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </div>

                  {/* content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: F, fontWeight: 700, fontSize: isAdminMessage ? 20 : 16, color: usernameColor, lineHeight: 1.2 }}>
                        {msg.display_name}
                      </span>
                      <span style={{ fontFamily: F, fontStyle: 'italic', fontSize: 13, color: '#9c9c9c' }}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                    {hasText && (
                      <p style={{ fontFamily: F, fontSize: isAdminMessage ? 16 : 14, color: '#ffffff', margin: '2px 0 0 0', wordBreak: 'break-word', lineHeight: 1.4 }}>
                        {msg.message}
                      </p>
                    )}
                    {msg.attachment_type === 'image' && msg.attachment_url && (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open chat image"
                        style={{
                          display: 'block',
                          width: 'min(100%, 260px)',
                          marginTop: hasText ? 8 : 4,
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: '#1c1c1c',
                        }}
                      >
                        <img
                          src={msg.attachment_url}
                          alt="Chat attachment"
                          style={{ display: 'block', width: '100%', maxHeight: 220, objectFit: 'cover' }}
                        />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div
        style={{
          position: 'relative',
          padding: isFigmaReady ? '11px 24px 19px' : '12px 16px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexShrink: 0,
          borderTop: isFigmaReady ? '0' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {isFigmaReady && emojiOpen && (
          <div
            aria-label="Emoji picker"
            style={{
              position: 'absolute',
              right: 82,
              bottom: 75,
              width: 292,
              padding: 12,
              borderRadius: 12,
              background: '#1c1c1c',
              boxShadow: '0 12px 30px rgba(0,0,0,0.55)',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 6,
              zIndex: 5,
            }}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji.name}
                type="button"
                className="match-chat-emoji-option"
                onClick={() => insertEmoji(emoji.char)}
                title={emoji.name}
                style={{
                  width: 48,
                  height: 48,
                  border: 'none',
                  borderRadius: 8,
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <img
                  src={emoji.url}
                  alt={emoji.name}
                  width={40}
                  height={40}
                  style={{ display: 'block', pointerEvents: 'none' }}
                />
              </button>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          className="match-chat-upload-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div
          style={{
            flex: 1,
            background: '#1c1c1c',
            borderRadius: 10,
            padding: isFigmaReady ? '0 14px 0 16px' : '0 16px',
            height: 53,
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <input
            ref={inputRef}
            className="match-chat-input"
            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontFamily: F, fontSize: 15, color: '#ffffff' } as React.CSSProperties}
            placeholder={isReadOnly ? 'Chat closed' : 'Type a message...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || !canSendMessage}
            maxLength={500}
          />
          {isFigmaReady && (
            <button
              type="button"
              className="match-chat-emoji-button"
              aria-label="Open emoji picker"
              onClick={() => {
                setEmojiOpen((open) => !open);
                inputRef.current?.focus();
              }}
              disabled={!canSendMessage}
              style={{
                width: 24,
                height: 24,
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: canSendMessage ? 'pointer' : 'default',
                flexShrink: 0,
                opacity: canSendMessage ? 0.85 : 0.35,
              }}
            >
              <img
                src={READY_CHAT_ASSETS.emotes}
                alt=""
                aria-hidden
                style={{ width: 20, height: 20, display: 'block' }}
              />
            </button>
          )}
        </div>
        <button
          type="button"
          className="match-chat-action-button"
          aria-label={isFigmaReady ? 'Upload image' : 'Send message'}
          onClick={isFigmaReady ? () => fileInputRef.current?.click() : handleSendMessage}
          disabled={isFigmaReady ? uploading || !canSendMessage : sending || !newMessage.trim() || !canSendMessage}
          style={{
            width: 53, height: 53, borderRadius: isFigmaReady ? 10 : '50%', background: isFigmaReady ? 'transparent' : '#ff1654',
            border: 'none', cursor: canSendMessage && (isFigmaReady || newMessage.trim()) ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, opacity: (!canSendMessage || (!isFigmaReady && !newMessage.trim())) ? (isFigmaReady ? 0.75 : 0.35) : 1,
            transition: 'opacity 0.15s',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {sending || uploading ? (
            <Loader2 style={{ width: 22, height: 22, color: 'white' }} className="animate-spin" />
          ) : isFigmaReady ? (
            <img src={READY_CHAT_ASSETS.uploadButton} alt="" aria-hidden style={{ width: 53, height: 53, display: 'block' }} />
          ) : (
            <Send style={{ width: 20, height: 20, color: 'white' }} />
          )}
        </button>
      </div>
    </div>
  );
}
