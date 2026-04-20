import { Link } from 'react-router-dom';
import { FileText, Gamepad2, Shield } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { GENERAL_MATCH_RULES, MATCH_MODE_RULES, MATCH_RULES_ORDER } from '@/lib/matchRules';

export default function Rules() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl py-6 lg:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#ff1654]/30 bg-[#ff1654]/15">
              <Gamepad2 className="h-6 w-6 text-[#ff1654]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase text-white">Match Rules</h1>
              <p className="text-sm text-white/55">Map codes and competitive rules for every mode.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/terms">
                <FileText className="mr-1 h-4 w-4" />
                Terms
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/privacy">
                <Shield className="mr-1 h-4 w-4" />
                Privacy
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-[18px] border border-[#ff1654]/70 bg-[#282828] p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.45)] lg:p-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {MATCH_RULES_ORDER.map((mode) => {
              const rules = MATCH_MODE_RULES[mode];

              return (
                <section key={mode} className="rounded-[14px] bg-[#0f0404]/45 p-5">
                  <h2 className="font-display text-2xl font-black uppercase tracking-wide">{rules.title}</h2>
                  <p className="mt-3 font-bold">
                    Map Code: <span className="text-[#ff1654]">{rules.mapCode}</span>
                  </p>
                  <p className="mt-1 text-sm text-white/65">{rules.mapName}</p>
                  <h3 className="mt-6 font-display text-xl font-bold uppercase">{rules.rulesTitle}</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-5 text-white/80">
                    {rules.rules.map((rule) => (
                      <li key={rule} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff1654] shadow-[0_0_10px_#ff1654]" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <section className="mt-6 rounded-[14px] bg-[#0f0404]/45 p-5">
            <h2 className="font-display text-2xl font-black uppercase tracking-wide">{GENERAL_MATCH_RULES.title}</h2>
            <ul className="mt-4 grid gap-3 text-sm leading-5 text-white/80 lg:grid-cols-3">
              {GENERAL_MATCH_RULES.rules.map((rule) => (
                <li key={rule} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d8ff16] shadow-[0_0_10px_#d8ff16]" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
