import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { GENERAL_MATCH_RULES, MATCH_MODE_RULES, MATCH_RULES_ORDER } from '@/lib/matchRules';

export default function Rules() {
  return (
    <LegalPageShell
      title="MATCH RULES"
      active="rules"
      description="Map codes and competitive rules for every mode."
    >
      <div className="legal-rules-grid">
        {MATCH_RULES_ORDER.map((mode) => {
          const rules = MATCH_MODE_RULES[mode];

          return (
            <section key={mode} className="legal-rule-card">
              <h2>{rules.title}</h2>
              <p className="legal-map-pill">
                Map Code: <span>{rules.mapCode}</span>
              </p>
              <p>{rules.mapName}</p>
              <h3>{rules.rulesTitle}</h3>
              <ul>
                {rules.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="legal-rule-card" style={{ marginTop: 20 }}>
        <h2>{GENERAL_MATCH_RULES.title}</h2>
        <ul>
          {GENERAL_MATCH_RULES.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
    </LegalPageShell>
  );
}
