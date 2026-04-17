import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, MessagesSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const F = "'Base Neue Trial', 'Inter', sans-serif";

interface ChatMessage {
  id: string;
  match_id: string;
  user_id: string;
  message: string;
  is_system: boolean;
  created_at: string;
  display_name?: string;
  avatar_url?: string | null;
  discord_avatar_url?: string | null;
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
}

const ACTIVE_STATUSES = ['open', 'joined', 'ready_check', 'in_progress', 'result_pending', 'disputed', 'full'];

function normalizeChatMessageAvatar(message: ChatMessage): ChatMessage {
  return {
    ...message,
    discord_avatar_url: getDiscordAvatarUrl(message),
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
}: MatchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const canSendMessage = (isParticipant || isAdmin) && ACTIVE_STATUSES.includes(matchStatus);
  const isReadOnly = !ACTIVE_STATUSES.includes(matchStatus);

  const fetchMessages = useCallback(async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('match_chat_messages_view')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(((messagesData || []) as unknown as ChatMessage[]).map(normalizeChatMessageAvatar));
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

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

          setMessages(prev => [...prev, normalizeChatMessageAvatar((enriched || newMsg) as unknown as ChatMessage)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, fetchMessages]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isParticipant && !isAdmin) return null;

  return (
    <div className={cn("flex flex-col h-full bg-card rounded-lg border border-border/50 overflow-hidden", className)}>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
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
              const initials = msg.display_name?.charAt(0).toUpperCase() || '?';
              const usernameColor = isAdminMessage ? '#ff1654' : getTeamColor(msg.user_id, teamMap);

              return (
                <div key={msg.id} style={{ display: 'flex', gap: 12, padding: '8px 16px', alignItems: 'flex-start' }}>
                  {/* 50×50 avatar */}
                  <div style={{ width: 50, height: 50, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: '#3a3a3a', border: `2px solid ${usernameColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: usernameColor }}>{initials}</span>
                    )}
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
                    <p style={{ fontFamily: F, fontSize: isAdminMessage ? 16 : 14, color: '#ffffff', margin: '2px 0 0 0', wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {msg.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ flex: 1, background: '#1c1c1c', borderRadius: 10, padding: '0 16px', height: 53, display: 'flex', alignItems: 'center' }}>
          <input
            className="match-chat-input"
            style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontFamily: F, fontSize: 15, color: '#ffffff' } as React.CSSProperties}
            placeholder={isReadOnly ? 'Chat closed' : 'Type a message...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || !canSendMessage}
            maxLength={500}
          />
        </div>
        <button
          onClick={handleSendMessage}
          disabled={sending || !newMessage.trim() || !canSendMessage}
          style={{
            width: 53, height: 53, borderRadius: '50%', background: '#ff1654',
            border: 'none', cursor: canSendMessage && newMessage.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, opacity: (!newMessage.trim() || !canSendMessage) ? 0.35 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {sending ? (
            <Loader2 style={{ width: 22, height: 22, color: 'white' }} className="animate-spin" />
          ) : (
            <Send style={{ width: 20, height: 20, color: 'white' }} />
          )}
        </button>
      </div>
    </div>
  );
}
