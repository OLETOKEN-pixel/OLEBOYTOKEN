import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, UserPlus, Users, LogOut, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/custom-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn, StaggerContainer, StaggerItem, AnimatedNumber } from '@/components/ui/motion';
import { InviteMemberForm } from '@/components/teams/InviteMemberForm';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Team, TeamMember, Profile } from '@/types';
import { cn } from '@/lib/utils';

interface TeamWithMembers extends Team {
  members: (TeamMember & { profile: Profile })[];
}

type TeamMemberPublic = Pick<Profile, 'user_id' | 'username' | 'avatar_url' | 'epic_username'>;

export default function TeamDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [team, setTeam] = useState<TeamWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const fetchTeam = async () => {
    if (!id) return;

    const { data, error } = await supabase.from('teams').select('*').eq('id', id).maybeSingle();

    if (error) {
      console.error('Team fetch error:', error);
      toast({
        title: 'Error loading team',
        description: `${error.message} (code: ${error.code})`,
        variant: 'destructive',
      });
      navigate('/teams');
      return;
    }
    
    if (!data) {
      toast({
        title: 'Team not found',
        description: 'The team you are looking for does not exist.',
        variant: 'destructive',
      });
      navigate('/teams');
      return;
    }

    const baseTeam = data as Team;

    const { data: membersData, error: membersError } = await supabase.rpc('get_team_members', {
      p_team_id: baseTeam.id,
    });

    if (membersError) {
      console.error('Team members fetch error:', membersError);
      toast({
        title: 'Error loading team members',
        description: `${membersError.message} (code: ${membersError.code})`,
        variant: 'destructive',
      });
      navigate('/teams');
      return;
    }

    const membersResult = membersData as
      | { success: boolean; members?: Array<any>; error?: string }
      | null;
    const membersRaw = (membersResult?.success ? membersResult.members : []) ?? [];

    const members = membersRaw.map((m: any) => {
      const profile: TeamMemberPublic = {
        user_id: m.user_id,
        username: m.username,
        avatar_url: m.avatar_url,
        epic_username: m.epic_username,
      };

      return {
        id: m.id ?? `${m.team_id}-${m.user_id}-${m.role}-${m.status}`,
        team_id: m.team_id,
        user_id: m.user_id,
        role: m.role,
        status: m.status,
        created_at: m.created_at,
        profile: profile as unknown as Profile,
      } as TeamMember & { profile: Profile };
    });

    setTeam({ ...baseTeam, members } as TeamWithMembers);
    setLoading(false);
  };

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isOwner = team?.owner_id === user?.id;
  const acceptedMembers = team?.members?.filter(m => m.status === 'accepted') ?? [];
  const pendingMembers = team?.members?.filter(m => m.status === 'pending') ?? [];
  const memberCount = acceptedMembers.length;
  const maxMembers = 4;

  const getEligibilityText = () => {
    if (memberCount === 0) return 'No members';
    if (memberCount === 1) return 'Invite 1 more for 2v2';
    if (memberCount === 2) return 'Eligible for 2v2';
    if (memberCount === 3) return 'Eligible for 3v3';
    if (memberCount === 4) return 'Eligible for 4v4';
    return '';
  };

  const handleLeaveTeam = async () => {
    if (!team) return;
    
    setLeaving(true);
    try {
      const { data, error } = await supabase.rpc('leave_team', {
        p_team_id: team.id,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string } | null;
      if (result && !result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Left team',
        description: `You have left ${team.name}`,
      });
      navigate('/teams');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to leave team',
        variant: 'destructive',
      });
    } finally {
      setLeaving(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    
    if (!confirm(`Are you sure you want to delete the team "${team.name}"? All members will be removed. This action is irreversible.`)) {
      return;
    }
    
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_team', {
        p_team_id: team.id,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string } | null;
      if (result && !result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Team deleted',
        description: `Team ${team.name} has been deleted.`,
      });
      navigate('/teams');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unable to delete team',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!team) return;
    
    setRemovingMember(memberId);
    try {
      const { data, error } = await supabase.rpc('remove_team_member', {
        p_team_id: team.id,
        p_user_id: memberId,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string } | null;
      if (result && !result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Member removed',
        description: 'The member has been removed from the team.',
      });
      
      setTeam(prev => prev ? {
        ...prev,
        members: prev.members.filter(m => m.user_id !== memberId),
      } : null);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setRemovingMember(null);
    }
  };

  const handleInviteSent = () => {
    toast({
      title: 'Invite sent!',
      description: 'The user will receive a notification.',
    });
    fetchTeam();
  };

  if (authLoading || loading) {
    return (
      <MainLayout showChat={false}>
        <Skeleton className="h-96 rounded-xl skeleton-premium" />
      </MainLayout>
    );
  }

  if (!team) {
    return (
      <MainLayout showChat={false}>
        <FadeIn className="text-center py-12">
          <div className="relative inline-block mb-4">
            <AlertCircle className="w-16 h-16 text-muted-foreground" />
            <div className="absolute inset-0 bg-muted-foreground/10 blur-xl rounded-full" />
          </div>
          <h1 className="text-2xl font-bold font-display mb-2">Team Not Found</h1>
          <Button asChild className="btn-premium mt-4">
            <Link to="/teams">Back to Teams</Link>
          </Button>
        </FadeIn>
      </MainLayout>
    );
  }

  return (
    <MainLayout showChat={false}>
      <div className="space-y-6 lg:max-w-3xl lg:mx-auto">
        <FadeIn>
          <Link
            to="/teams"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-[hsl(186,100%,50%)] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Teams
          </Link>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] overflow-hidden">
            <div className="relative p-5 lg:p-6">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFC805]/5 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <motion.div
                      className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FFC805]/20 to-[#FFC805]/5 flex items-center justify-center text-[#FFC805] font-bold text-xl font-display border border-[#FFC805]/15"
                      whileHover={{ scale: 1.05 }}
                    >
                      {team.tag}
                    </motion.div>
                    <div>
                      <h1 className="text-2xl font-display font-bold uppercase text-white">
                        {team.name}
                      </h1>
                      <p className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
                        <Users className="w-4 h-4" />
                        <AnimatedNumber value={memberCount} /> / {maxMembers} members
                      </p>
                    </div>
                  </div>
                  {isOwner && (
                    <Badge variant="accent" className="glow-gold-soft">
                      <Crown className="w-3 h-3 mr-1" />
                      Owner
                    </Badge>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Team Size</span>
                      <span className="font-medium font-mono">{memberCount}/4</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#FFC805] to-[#FFC805]/70"
                        initial={{ width: 0 }}
                        animate={{ width: `${(memberCount / maxMembers) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={memberCount >= 2 ? 'default' : 'outline'} className={cn(
                      memberCount >= 2 && "bg-[#FFC805]/10 text-[#FFC805] border-[#FFC805]/20"
                    )}>
                      <CheckCircle className={cn("w-3 h-3 mr-1", memberCount >= 2 ? "text-[#FFC805]" : "text-muted-foreground")} />
                      {getEligibilityText()}
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {isOwner && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteTeam}
                          disabled={deleting}
                          className="bg-destructive/80 hover:bg-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {deleting ? 'Deleting...' : 'Delete Team'}
                        </Button>
                      </motion.div>
                    )}
                    {!isOwner && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          variant="destructive"
                          onClick={handleLeaveTeam}
                          disabled={leaving}
                          className="bg-destructive/80 hover:bg-destructive"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          {leaving ? 'Leaving...' : 'Leave Team'}
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {isOwner && memberCount < maxMembers && (
          <FadeIn delay={0.2}>
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
              <div className="p-5 lg:p-6">
                <h2 className="flex items-center gap-2 font-display font-bold text-lg mb-1 uppercase">
                  <UserPlus className="w-5 h-5 text-[#FFC805]" />
                  Invite Members
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Search for users to invite to your team
                </p>
                <InviteMemberForm teamId={team.id} onInviteSent={handleInviteSent} />
              </div>
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.3}>
          <div className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
            <div className="p-5 lg:p-6">
              <h2 className="font-display font-bold text-lg mb-4 uppercase">TEAM MEMBERS</h2>
              <StaggerContainer className="space-y-3">
                {acceptedMembers.map((member) => (
                  <StaggerItem key={member.id}>
                    <div
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl",
                        "bg-white/[0.03] border border-white/[0.06]",
                        "hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className={cn(
                          "ring-2 ring-offset-1 ring-offset-background",
                          member.role === 'owner' ? "ring-[hsl(var(--accent))]/40" : "ring-white/[0.08]"
                        )}>
                          <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-[#FFC805]/10 text-[#FFC805]">
                            {member.profile?.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.profile?.username || 'User'}</p>
                          {member.profile?.epic_username ? (
                            <p className="text-xs text-muted-foreground">Epic: {member.profile.epic_username}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Epic not connected</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={member.role === 'owner' ? 'accent' : 'outline'} className={cn(
                          member.role === 'owner' && "glow-gold-soft"
                        )}>
                          {member.role === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                          {member.role}
                        </Badge>
                        {isOwner && member.user_id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMember(member.user_id)}
                            disabled={removingMember === member.user_id}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                ))}

                {pendingMembers.length > 0 && (
                  <>
                    <div className="pt-4 border-t border-white/[0.06]">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Pending Invites
                      </h4>
                    </div>
                    {pendingMembers.map((member) => (
                      <StaggerItem key={member.id}>
                        <div
                          className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06]"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="opacity-60 ring-1 ring-white/[0.06]">
                              <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-muted/50">
                                {member.profile?.username?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-muted-foreground">
                                {member.profile?.username}
                              </p>
                              <p className="text-xs text-muted-foreground">Pending...</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="border-white/[0.08]">Invited</Badge>
                        </div>
                      </StaggerItem>
                    ))}
                  </>
                )}
              </StaggerContainer>
            </div>
          </div>
        </FadeIn>
      </div>
    </MainLayout>
  );
}
