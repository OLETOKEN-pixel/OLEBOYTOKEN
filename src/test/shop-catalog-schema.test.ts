import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Shop catalog canonical schema', () => {
  it('adds the new catalog migration with enums, tables, RPCs, and coin-pack seeding', () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260507203000_shop_catalog_v1.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE TYPE public.shop_item_kind AS ENUM');
    expect(migration).toContain('CREATE TYPE public.shop_price_audience AS ENUM');
    expect(migration).toContain('CREATE TYPE public.shop_price_currency AS ENUM');
    expect(migration).toContain('CREATE TYPE public.shop_unlock_type AS ENUM');
    expect(migration).toContain('CREATE TYPE public.shop_claim_status AS ENUM');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_items');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_item_prices');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_item_unlock_rules');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_surface_slots');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_item_claims');
    expect(migration).toContain('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)');
    expect(migration).toContain("'shop-catalog'");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.get_shop_catalog()');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_upsert_shop_item');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_upsert_shop_surface_slot');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_set_shop_item_active');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.claim_shop_reward');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_update_shop_claim');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.purchase_shop_wallet_item');
    expect(migration).toContain("'coin-pack-50'");
    expect(migration).toContain("'vip-membership-30d'");
  });

  it('adds the draft/live workspace migration with slot presentations and publish RPCs', () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260509113000_shop_workspace_draft_publish.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE TYPE public.shop_workspace AS ENUM');
    expect(migration).toContain("'draft'");
    expect(migration).toContain("'live'");
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_draft_items');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_draft_item_prices');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_draft_item_unlock_rules');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_draft_surface_slots');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shop_slot_presentations');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_get_shop_workspace');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_publish_shop_catalog()');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.shop_money_label');
    expect(migration).toContain("'€' || REPLACE(to_char");
  });

  it('adds the surface validation migration for lower-row real items', () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260510113000_shop_surface_real_items.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_upsert_shop_surface_slot');
    expect(migration).toContain("'physical_reward'::public.shop_item_kind, 'physical_product'::public.shop_item_kind");
    expect(migration).toContain('Unlock cards only accept physical products or rewards');
    expect(migration).toContain('Featured cards only accept digital items');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_publish_shop_catalog()');
    expect(migration).toContain("s.surface_key = 'shop.unlock_cards'");
    expect(migration).toContain("s.surface_key = 'shop.featured_cards'");
  });

  it('adds the publish safety migration for Supabase full-table delete protection', () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260510141000_shop_publish_safe_delete.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_publish_shop_catalog()');
    expect(migration).toContain('DELETE FROM public.shop_item_prices');
    expect(migration).toContain('WHERE true;');
    expect(migration).toContain('DELETE FROM public.shop_item_unlock_rules');
    expect(migration).toContain('DELETE FROM public.shop_surface_slots');
    expect(migration).toContain("DELETE FROM public.shop_slot_presentations");
    expect(migration).toContain("workspace = 'live'::public.shop_workspace");
  });

  it('adds the copy-strip migration so shop descriptions cannot come back from saved rows', () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260510184500_shop_strip_descriptions.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.sanitize_shop_item_copy_fields()');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.sanitize_shop_slot_presentation_copy_fields()');
    expect(migration).toContain('CREATE TRIGGER sanitize_shop_items_copy_fields');
    expect(migration).toContain('CREATE TRIGGER sanitize_shop_draft_items_copy_fields');
    expect(migration).toContain('CREATE TRIGGER sanitize_shop_slot_presentations_copy_fields');
    expect(migration).toContain("description = ''");
    expect(migration).toContain("supporting_text = ''");
    expect(migration).toContain('show_supporting_text = false');
  });

  it('exposes the canonical shop catalog types and RPCs to the frontend', () => {
    const typesFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src/integrations/supabase/types.ts'),
      'utf8',
    );

    expect(typesFile).toContain('shop_items: {');
    expect(typesFile).toContain('shop_item_prices: {');
    expect(typesFile).toContain('shop_item_unlock_rules: {');
    expect(typesFile).toContain('shop_surface_slots: {');
    expect(typesFile).toContain('shop_item_claims: {');
    expect(typesFile).toContain('get_shop_catalog: { Args: never; Returns: Json }');
    expect(typesFile).toContain('admin_upsert_shop_item: {');
    expect(typesFile).toContain('p_payload: Json');
    expect(typesFile).toContain('admin_upsert_shop_surface_slot: {');
    expect(typesFile).toContain('admin_set_shop_item_active: {');
    expect(typesFile).toContain('admin_get_shop_workspace: {');
    expect(typesFile).toContain('admin_publish_shop_catalog: { Args: never; Returns: Json }');
    expect(typesFile).toContain('claim_shop_reward: { Args: { p_item_id: string }; Returns: Json }');
    expect(typesFile).toContain('admin_update_shop_claim: {');
    expect(typesFile).toContain('purchase_shop_wallet_item: { Args: { p_item_id: string }; Returns: Json }');
    expect(typesFile).toContain('shop_item_kind:');
    expect(typesFile).toContain('"coin_pack"');
    expect(typesFile).toContain('"vip_membership"');
    expect(typesFile).toContain('"physical_product"');
    expect(typesFile).toContain('"physical_reward"');
    expect(typesFile).toContain('"action_card"');
    expect(typesFile).toContain('shop_price_audience: "base" | "vip"');
    expect(typesFile).toContain('shop_price_currency: "eur" | "coins"');
    expect(typesFile).toContain('shop_unlock_type: "none" | "level" | "challenge"');
    expect(typesFile).toContain('shop_claim_status:');
    expect(typesFile).toContain('"pending"');
    expect(typesFile).toContain('"approved"');
    expect(typesFile).toContain('"fulfilled"');
    expect(typesFile).toContain('"rejected"');
    expect(typesFile).toContain('"cancelled"');
    expect(typesFile).toContain('shop_workspace: "draft" | "live"');
  });

  it('registers the generic shop checkout function in Supabase config', () => {
    const configFile = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/config.toml'),
      'utf8',
    );
    const checkoutFunction = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/create-shop-checkout/index.ts'),
      'utf8',
    );

    expect(configFile).toContain('[functions.create-shop-checkout]');
    expect(configFile).toContain('verify_jwt = false');
    expect(checkoutFunction).toContain('item.kind !== "coin_pack" && item.kind !== "physical_product"');
    expect(checkoutFunction).toContain('const isVip = Boolean((vipData as { is_vip?: boolean } | null)?.is_vip);');
  });
});
