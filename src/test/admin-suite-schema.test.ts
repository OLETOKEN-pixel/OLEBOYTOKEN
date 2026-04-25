import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Admin suite content management wiring', () => {
  it('adds the live shop rewards schema, storage bucket, and admin mutation RPCs', () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20260425150000_admin_suite_content_management.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_level_rewards');
    expect(migration).toContain('shop_level_rewards_unique_active_level_idx');
    expect(migration).toContain("'shop-rewards'");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_upsert_shop_level_reward');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_set_shop_level_reward_active');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_upsert_challenge');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_set_challenge_active');
    expect(migration).toContain('public.log_admin_action');
  });

  it('registers the new admin suite routes and keeps detail pages pointing back to list pages', () => {
    const appFile = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const adminUserDetail = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/AdminUserDetail.tsx'),
      'utf8',
    );
    const adminMatchDetail = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/AdminMatchDetail.tsx'),
      'utf8',
    );

    expect(appFile).toContain('path="/admin"');
    expect(appFile).toContain('path="/admin/users"');
    expect(appFile).toContain('path="/admin/users/:id"');
    expect(appFile).toContain('path="/admin/matches"');
    expect(appFile).toContain('path="/admin/matches/:id"');
    expect(appFile).toContain('path="/admin/transactions"');
    expect(appFile).toContain('path="/admin/withdrawals"');
    expect(appFile).toContain('path="/admin/shop"');
    expect(appFile).toContain('path="/admin/challenges"');

    expect(adminUserDetail).toContain("navigate('/admin/users')");
    expect(adminMatchDetail).toContain("navigate('/admin/matches')");
  });

  it('exposes shop_level_rewards and new admin RPCs in generated frontend types', () => {
    const typesFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/integrations/supabase/types.ts'),
      'utf8',
    );

    expect(typesFile).toContain('shop_level_rewards: {');
    expect(typesFile).toContain('admin_upsert_shop_level_reward');
    expect(typesFile).toContain('admin_set_shop_level_reward_active');
    expect(typesFile).toContain('admin_upsert_challenge');
    expect(typesFile).toContain('admin_set_challenge_active');
  });
});
