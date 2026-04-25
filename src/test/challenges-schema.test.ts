import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Challenges backend wiring', () => {
  it('restores daily and weekly period keys with sort order in the new migration', () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20260425090000_challenges_page_and_periodic_reset.sql',
      ),
      'utf8',
    );

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0");
    expect(migration).toContain("public.get_current_period_key('daily')");
    expect(migration).toContain("public.get_current_period_key('weekly')");
    expect(migration).toContain("'sort_order', c.sort_order");
    expect(migration).not.toContain("'lifetime'");
  });

  it('exposes challenges.sort_order in generated frontend types', () => {
    const typesFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/integrations/supabase/types.ts'),
      'utf8',
    );

    expect(typesFile).toMatch(/sort_order: number/);
  });
});
