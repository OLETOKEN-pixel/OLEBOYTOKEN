import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const imgStarShape = 'https://www.figma.com/api/mcp/asset/b944e37d-0240-42aa-822c-ac853169e74d';
const imgArrowStroke = 'https://www.figma.com/api/mcp/asset/ec14e7db-5773-45a0-a2d5-3b8376726351';
const imgBwArrow = 'https://www.figma.com/api/mcp/asset/e12f7b98-5d06-48c1-af82-b2cf70ff59ba';
const imgFwArrow = 'https://www.figma.com/api/mcp/asset/5a185007-b402-4f24-b2f4-0ee1ef3191e0';
const imgSpaccatoTitle = 'https://www.figma.com/api/mcp/asset/639ca509-638c-46fa-adf5-9c3797239b58';

interface TeamDisplay {
  rank: number;
  name: string;
  avatarUrl: string | null;
  score: string;
}

const PLACEHOLDERS: TeamDisplay[] = [
  { rank: 1, name: '—', avatarUrl: null, score: '0/30' },
  { rank: 2, name: '—', avatarUrl: null, score: '0/30' },
  { rank: 3, name: '—', avatarUrl: null, score: '0/30' },
];

export const TeamsSection = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamDisplay[]>(PLACEHOLDERS);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, name, avatar_url, member_count, max_members')
          .order('member_count', { ascending: false })
          .limit(3);

        if (!error && data && data.length > 0) {
          setTeams(
            data.map((t: any, i: number) => ({
              rank: i + 1,
              name: t.name || `Team ${i + 1}`,
              avatarUrl: t.avatar_url || null,
              score: `${t.member_count ?? 0}/${t.max_members ?? 30}`,
            }))
          );
        }
      } catch {
        // silently keep placeholders
      }
    };
    fetchTeams();
  }, []);

  const TeamAvatar = ({ url, alt }: { url: string | null; alt: string }) =>
    url ? (
      <img
        className="w-[40px] h-[40px] object-cover rounded-full flex-shrink-0"
        alt={alt}
        src={url}
      />
    ) : (
      <div className="w-[40px] h-[40px] rounded-full bg-gradient-to-br from-[#3b28cc] to-[#6f5cff] flex-shrink-0" />
    );

  const ranks = ['1°', '2°', '3°'];

  return (
    <div id="s-teams" className="z-[1] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">

        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px]">
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-highlights'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Previous" src={imgBwArrow} />
          </button>
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-shop'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Next" src={imgFwArrow} />
          </button>
        </div>

        {/* Right side — star + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img
            className="absolute top-[102px] left-[47px] w-[760px] h-[388px] rotate-[-15.44deg]"
            alt=""
            src={imgStarShape}
          />

          <button
            onClick={() => navigate('/teams')}
            className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex items-center justify-center bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040] cursor-pointer"
          >
            <div className="flex items-center gap-[11px]">
              <span className="w-[167px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">
                TEAM UP
              </span>
              <img className="mt-[7px] w-8 h-[23px] rotate-[-90deg]" alt="" src={imgArrowStroke} />
            </div>
          </button>

          <p className="absolute top-[217px] left-[135px] h-[114px] [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[48px] text-right tracking-[0] leading-[normal]">
            Build or join a team.<br />Discover why...
          </p>
        </div>

        {/* Top 3 teams list */}
        <div className="absolute top-[257px] left-[53px] w-[531px] flex flex-col gap-[11px]">
          {teams.map((team) => (
            <div
              key={team.rank}
              className="relative w-[531px] h-[63px] rounded-[9px] border border-solid border-[#0f0404] flex items-center px-4 gap-3"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, rgba(255, 22, 84, 0.42) 0%, rgba(80, 37, 37, 0.42) 64.904%), linear-gradient(90deg, rgba(15, 4, 4, 0.32) 0%, rgba(15, 4, 4, 0.32) 100%)',
              }}
            >
              <TeamAvatar url={team.avatarUrl} alt={team.name} />
              <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[20px] leading-[normal] flex-1 truncate">
                {team.name}
              </span>
              <span className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[#ff1654] text-[22px] leading-[normal] tracking-[2px] w-[34px] text-center">
                {ranks[team.rank - 1]}
              </span>
              <span
                className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[19px] leading-[normal] w-[69px] text-right"
                style={{
                  background: 'linear-gradient(to right, white, #ff4e7d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {team.score}
              </span>
            </div>
          ))}
        </div>

        {/* Section title */}
        <img className="left-0 w-[682px] absolute top-0 h-[207px]" alt="" src={imgSpaccatoTitle} />
        <div className="absolute top-[65px] left-[79px] w-[797px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          TEAMS
        </div>
      </div>
    </div>
  );
};
