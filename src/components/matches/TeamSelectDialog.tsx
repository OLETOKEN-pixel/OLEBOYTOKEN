import { useState } from 'react';
import { Loader2, Users, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEligibleTeams } from '@/hooks/useEligibleTeams';
import type { Match, PaymentMode } from '@/types';

interface TeamSelectDialogProps {
  open: boolean;
  match: Match;
  onClose: () => void;
  onConfirm: (teamId: string, paymentMode: PaymentMode) => void;
  isJoining?: boolean;
}

export function TeamSelectDialog({
  open,
  match,
  onClose,
  onConfirm,
  isJoining,
}: TeamSelectDialogProps) {
  const teamSize = Number(match.team_size ?? 2);
  const entryFee = Number(match.entry_fee ?? 0);
  const { eligibleTeams, loading } = useEligibleTeams(teamSize, entryFee);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cover');

  if (!open) return null;

  const totalCost = entryFee * teamSize;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          width: 'min(520px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, rgba(18,11,15,0.98) 0%, rgba(10,7,11,0.96) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 28px 80px rgba(0,0,0,0.52)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "'Teko', sans-serif",
            fontSize: '32px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#fff',
            letterSpacing: '0.04em',
          }}
        >
          Select Team
        </h2>
        <p
          style={{
            fontFamily: "'Base Neue Trial', sans-serif",
            fontSize: '14px',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '4px',
            marginBottom: '24px',
          }}
        >
          Choose a team to join this {teamSize}v{teamSize} match. Entry: {entryFee.toFixed(2)} coins/player.
        </p>

        {/* Payment mode */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontFamily: "'Teko', sans-serif",
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            Payment Mode
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['cover', 'split'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                style={{
                  flex: 1,
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border:
                    paymentMode === mode
                      ? '1px solid rgba(255,200,5,0.4)'
                      : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  background:
                    paymentMode === mode
                      ? 'rgba(255,200,5,0.08)'
                      : 'rgba(255,255,255,0.03)',
                  color: paymentMode === mode ? '#FFC805' : 'rgba(255,255,255,0.6)',
                  fontFamily: "'Teko', sans-serif",
                  fontSize: '16px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
              >
                <Wallet size={16} />
                {mode === 'cover'
                  ? `Cover (${totalCost.toFixed(2)})`
                  : `Split (${entryFee.toFixed(2)} each)`}
              </button>
            ))}
          </div>
        </div>

        {/* Team list */}
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
            }}
          >
            <Loader2 size={24} style={{ animation: 'match-detail-spin 0.8s linear infinite', color: '#FFC805' }} />
          </div>
        ) : eligibleTeams.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              fontFamily: "'Base Neue Trial', sans-serif",
              color: 'rgba(255,255,255,0.4)',
              fontSize: '14px',
            }}
          >
            <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ margin: 0 }}>
              No eligible teams found. You need a team with {teamSize} members where
              {paymentMode === 'cover'
                ? ` you have ${totalCost.toFixed(2)} coins.`
                : ` each member has ${entryFee.toFixed(2)} coins.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {eligibleTeams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  border:
                    selectedTeamId === team.id
                      ? '1px solid rgba(255,200,5,0.4)'
                      : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  background:
                    selectedTeamId === team.id
                      ? 'rgba(255,200,5,0.06)'
                      : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Users size={20} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'Teko', sans-serif",
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#fff',
                      textTransform: 'uppercase',
                      lineHeight: 1,
                    }}
                  >
                    {team.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Base Neue Trial', sans-serif",
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.4)',
                      marginTop: '2px',
                    }}
                  >
                    {team.members?.length ?? 0} members
                  </div>
                </div>
                {/* Member avatars */}
                <div style={{ display: 'flex', marginLeft: 'auto' }}>
                  {(team.members ?? []).slice(0, 4).map((member: any, i: number) => (
                    <Avatar
                      key={member.user_id || i}
                      className="w-6 h-6"
                      style={{ marginLeft: i > 0 ? '-6px' : 0, border: '2px solid rgba(10,7,11,0.96)' }}
                    >
                      <AvatarImage src={member.profile?.avatar_url} />
                      <AvatarFallback
                        style={{ fontSize: '10px', background: 'rgba(255,255,255,0.08)' }}
                      >
                        {(member.profile?.username || '?')[0]}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isJoining}
            style={{
              height: '44px',
              padding: '0 24px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.6)',
              fontFamily: "'Teko', sans-serif",
              fontSize: '18px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedTeamId) onConfirm(selectedTeamId, paymentMode);
            }}
            disabled={!selectedTeamId || isJoining}
            style={{
              height: '44px',
              padding: '0 32px',
              border: 'none',
              borderRadius: '10px',
              background: selectedTeamId && !isJoining ? '#FFC805' : 'rgba(255,200,5,0.2)',
              color: selectedTeamId && !isJoining ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
              fontFamily: "'Teko', sans-serif",
              fontSize: '18px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: selectedTeamId && !isJoining ? 'pointer' : 'not-allowed',
              boxShadow: selectedTeamId && !isJoining ? '0 0 20px rgba(255,200,5,0.3)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isJoining && (
              <Loader2 size={16} style={{ animation: 'match-detail-spin 0.8s linear infinite' }} />
            )}
            {isJoining ? 'Joining...' : 'Join Match'}
          </button>
        </div>
      </div>
    </>
  );
}
