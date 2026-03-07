import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Users, Crown, ChevronRight } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Team, TeamMember, Profile } from '@/types';

interface TeamWithMembers extends Team {
  members: (TeamMember & { profile: Profile })[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] } },
};

export default function Teams() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user && !authLoading) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (user) fetchTeams();
  }, [user, authLoading, navigate, location.pathname]);

  const fetchTeams = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (memberError) throw memberError;
      
      if (!memberships || memberships.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }

      const teamIds = memberships.map(m => m.team_id);
      
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds);

      if (teamsError) throw teamsError;

      const teamsWithMembers = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: membersData, error: membersError } = await supabase.rpc('get_team_members', {
            p_team_id: team.id,
          });

          if (membersError) {
            console.error('Error fetching members for team', team.id, membersError);
            return { ...team, members: [] };
          }

          const membersResult = membersData as
            | { success: boolean; members?: Array<any>; error?: string }
            | null;

          const membersRaw = (membersResult?.success ? membersResult.members : []) ?? [];
          const members = membersRaw.map((m: any) => ({
            id: m.id ?? `${team.id}-${m.user_id}`,
            team_id: team.id,
            user_id: m.user_id,
            role: m.role,
            status: m.status,
            profile: {
              user_id: m.user_id,
              username: m.username,
              avatar_url: m.avatar_url,
              epic_username: m.epic_username,
            } as unknown as Profile,
          }));

          return { ...team, members } as TeamWithMembers;
        })
      );

      setTeams(teamsWithMembers);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i team',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast({
        title: 'Errore',
        description: 'Inserisci un nome per il team',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_team', { 
        p_name: teamName.trim() 
      });

      if (error) throw error;

      const result = data as { success: boolean; team_id?: string; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Errore nella creazione del team');
      }

      toast({
        title: 'Team creato!',
        description: `${teamName} è stato creato. Ora invita i tuoi compagni!`,
      });
      
      setCreateOpen(false);
      setTeamName('');
      fetchTeams();
      
      if (result.team_id) {
        navigate(`/teams/${result.team_id}`);
      }
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error.message || 'Errore nella creazione del team',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const getAcceptedMemberCount = (team: TeamWithMembers) => {
    return team.members?.filter(m => m.status === 'accepted').length || 0;
  };

  const getEligibilityBadge = (count: number) => {
    if (count >= 4) return '4v4';
    if (count >= 3) return '3v3';
    if (count >= 2) return '2v2';
    return null;
  };

  if (authLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="skeleton-premium h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="premium-card p-5">
                <div className="skeleton-premium h-36" />
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showChat={false}>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold uppercase tracking-tight text-foreground">
                MY TEAMS
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage your squads
              </p>
            </div>
            
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="btn-premium px-5 py-2.5 text-sm font-semibold">
                  <Plus className="w-4 h-4 mr-2" /> Create Team
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
                <DialogHeader>
                  <DialogTitle className="text-foreground text-lg">Create New Team</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Inserisci un nome per il tuo team. Potrai invitare membri dopo la creazione.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="teamName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Name</Label>
                    <Input
                      id="teamName"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Es: Pro Gamers, Team Alpha..."
                      maxLength={30}
                      autoFocus
                      className="input-premium px-4 py-3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Un tag verrà generato automaticamente
                    </p>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)} className="btn-premium-ghost">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTeam} disabled={creating || !teamName.trim()} className="btn-premium">
                    {creating ? 'Creating...' : 'Create Team'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="premium-card p-5">
                <div className="skeleton-premium h-36" />
              </div>
            ))}
          </div>
        ) : teams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
              <div className="flex flex-col items-center justify-center py-16 px-8">
                <div className="w-20 h-20 flex items-center justify-center rounded-2xl mb-6" style={{ background: 'hsl(var(--bg-2))' }}>
                  <Users className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground">No teams yet</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  Crea il tuo primo team per partecipare ai match 2v2, 3v3 o 4v4 con i tuoi amici
                </p>
                <Button size="lg" onClick={() => setCreateOpen(true)} className="btn-premium px-8 py-3 text-sm font-semibold">
                  <Plus className="w-5 h-5 mr-2" /> Create Your Team
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {teams.map((team) => {
              const memberCount = getAcceptedMemberCount(team);
              const eligibility = getEligibilityBadge(memberCount);
              const isOwner = team.owner_id === user?.id;

              return (
                <motion.div key={team.id} variants={itemVariants}>
                  <Link to={`/teams/${team.id}`}>
                    <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] group h-full cursor-pointer transition-all hover:border-[#FFC805]/20">
                      <div className="p-5">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-12 h-12 flex items-center justify-center shrink-0 rounded-xl" style={{ background: 'hsl(var(--bg-2))' }}>
                            <span className="text-base font-bold text-foreground">
                              {team.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold truncate group-hover:text-[#FFC805] transition-colors">
                              {team.name}
                            </h3>
                            <p className="text-sm text-muted-foreground font-mono">
                              {memberCount} {memberCount === 1 ? 'membro' : 'membri'}
                            </p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {isOwner && (
                              <span className="badge-gold text-[10px] flex items-center gap-1">
                                <Crown className="w-3 h-3" /> Owner
                              </span>
                            )}
                            {eligibility && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border border-[hsl(var(--border-soft))] text-muted-foreground">
                                {eligibility}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="neon-line mb-4" />
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center -space-x-2">
                            {team.members?.filter(m => m.status === 'accepted').slice(0, 4).map((member) => (
                              <Avatar 
                                key={member.user_id} 
                                className="w-8 h-8 border-2 border-[hsl(var(--bg-1))] rounded-full"
                              >
                                <AvatarImage 
                                  src={member.profile?.avatar_url || undefined}
                                  className="object-cover" 
                                />
                                <AvatarFallback className="text-[10px] bg-[hsl(var(--bg-2))]">
                                  {member.profile?.username?.[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {memberCount > 4 && (
                              <div className="w-8 h-8 rounded-full bg-[hsl(var(--bg-2))] flex items-center justify-center text-xs font-mono font-bold border-2 border-[hsl(var(--bg-1))] text-muted-foreground">
                                +{memberCount - 4}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 text-muted-foreground group-hover:text-[#FFC805] transition-all">
                            <span className="text-xs font-semibold">View</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
}
