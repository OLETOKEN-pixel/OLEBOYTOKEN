import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Admin UX visual contract', () => {
  it('removes blur and glass styles from the shared admin shell and admin overlays', () => {
    const files = [
      'src/components/admin/AdminShell.tsx',
      'src/components/admin/GlobalSearchBar.tsx',
      'src/components/admin/DeleteUserDialog.tsx',
    ].map((relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'));

    files.forEach((content) => {
      expect(content).not.toContain('glass-overlay');
      expect(content).not.toContain('backdrop-blur');
    });
  });

  it('wires admin match detail to the shared public ready scene with the admin overlay tabs', () => {
    const publicMatchFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/MatchDetail.tsx'), 'utf8');
    const adminMatchFile = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/AdminMatchDetail.tsx'), 'utf8');

    expect(publicMatchFile).toContain('export function ReadyLobbyScreen');
    expect(publicMatchFile).toContain('variant="figmaReady"');
    expect(adminMatchFile).toContain('<ReadyLobbyScreen');
    expect(adminMatchFile).toContain('viewerIsAdmin');
    expect(adminMatchFile).toContain('showUserActions={false}');
    expect(adminMatchFile).toContain('chatIsAdmin');
    expect(adminMatchFile).toContain("'moderation' | 'proofs' | 'finance'");
  });
});
