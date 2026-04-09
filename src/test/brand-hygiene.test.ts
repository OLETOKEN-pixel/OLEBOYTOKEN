import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..', '..');

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

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
});
