import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..');

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const collectProjectFiles = (relativeDir: string): string[] => {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return collectProjectFiles(relativePath);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [relativePath.replace(/\\/g, '/')];
  });
};

describe('active app brand hygiene', () => {
  it('keeps logged-home sections local and free from anima-hosted runtime assets', () => {
    const files = [
      'src/components/home/sections/LaunchVideoSection.tsx',
      'src/components/home/sections/LiveMatchesSection.tsx',
      'src/components/home/sections/LeaderboardSection.tsx',
      'src/components/home/sections/ChallengesSection.tsx',
      'src/components/home/sections/HighlightsSection.tsx',
    ];

    for (const file of files) {
      const content = readProjectFile(file);
      expect(content).not.toContain('https://c.animaapp.com/');
      expect(content.includes('/active-home/') || content.includes('ACTIVE_HOME_ASSETS')).toBe(true);
    }
  });

  it('removes raw figma-profile asset dependencies from the active profile runtime', () => {
    const content = readProjectFile('src/components/profile/ProfileSettingsView.tsx');

    expect(content).not.toContain('/figma-profile/');
    expect(content).toContain('ProfileAccentTriangles');
    expect(content).toContain('EpicGamesMark');
  });

  it('keeps browser metadata aligned to OleBoy branding assets', () => {
    const html = readProjectFile('index.html');

    expect(html).toContain('<title>OleBoy Token</title>');
    expect(html).toContain('/favicon-oleboy.png');
    expect(html).toContain('/favicon.ico');
    expect(fs.existsSync(path.join(rootDir, 'public', 'favicon.ico'))).toBe(true);
  });

  it('stores active-home svg assets as plain svg files instead of gzip payloads', () => {
    const activeHomeDir = path.join(rootDir, 'public', 'active-home');
    const svgFiles = fs.readdirSync(activeHomeDir).filter((file) => file.endsWith('.svg'));

    expect(svgFiles.length).toBeGreaterThan(0);

    for (const file of svgFiles) {
      const data = fs.readFileSync(path.join(activeHomeDir, file));
      expect(data[0]).not.toBe(0x1f);
      expect(data[1]).not.toBe(0x8b);
      expect(data.toString('utf8', 0, 4)).toContain('<svg');
    }
  });

  it('keeps user avatar rendering Discord-only with no old fallback profile art', () => {
    const runtimeFiles = [
      ...collectProjectFiles('src/components'),
      ...collectProjectFiles('src/pages'),
      ...collectProjectFiles('src/hooks'),
      ...collectProjectFiles('src/contexts'),
      ...collectProjectFiles('src/lib'),
    ];

    for (const file of runtimeFiles) {
      const content = readProjectFile(file);

      expect(content).not.toContain('/figma-assets/tom-pfp.png');
      expect(content).not.toContain('/figma-assets/marv-pfp.png');
      expect(content).not.toContain('PROFILE_PFP_FALLBACK_ASSET');
      expect(content).not.toContain('/src/assets/avatars/');
      expect(content).not.toContain('useAvatarShop');
      expect(content).not.toContain('get_avatar_shop');
      expect(content).not.toContain('get_user_avatars');
      expect(content).not.toContain('purchase_avatar');
      expect(content).not.toContain('equip_avatar');

      if (file !== 'src/lib/avatar.ts') {
        expect(content).not.toContain("'/avatars/");
        expect(content).not.toContain('"/avatars/');
      }

      if (content.includes('AvatarImage')) {
        expect(content).not.toMatch(/<AvatarImage[\s\S]{0,160}src=\{[^}]*\??\.avatar_url\b/);
      }
    }
  });

  it('removes legacy avatar shop assets, dumps, and generated types', () => {
    const removedPaths = [
      'public/avatars',
      'src/assets/avatars',
      'src/hooks/useAvatarShop.ts',
      'public/migration_part1.sql',
      'public/migration_part2.sql',
      'public/migration_part3.sql',
    ];

    for (const removedPath of removedPaths) {
      expect(fs.existsSync(path.join(rootDir, removedPath))).toBe(false);
    }

    const supabaseTypes = readProjectFile('src/integrations/supabase/types.ts');
    const forbiddenTypeFragments = [
      'avatars: {',
      'user_avatars: {',
      'avatar_id:',
      'profiles_avatar_id_fkey',
      'get_avatar_shop',
      'get_user_avatars',
      'purchase_avatar',
      'equip_avatar',
    ];

    for (const fragment of forbiddenTypeFragments) {
      expect(supabaseTypes).not.toContain(fragment);
    }
  });

  it('keeps Stripe Checkout using dashboard dynamic payment methods', () => {
    const content = readProjectFile('supabase/functions/create-checkout/index.ts');

    expect(content).not.toContain('payment_method_types');
    expect(content).not.toContain('automatic_payment_methods');
  });
});
