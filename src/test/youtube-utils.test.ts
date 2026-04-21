import { describe, expect, it } from 'vitest';
import { extractYouTubeVideoId, formatVoteCount, truncateHighlightTitle } from '@/lib/youtube';

describe('youtube highlight helpers', () => {
  it('extracts ids from youtu.be links', () => {
    expect(extractYouTubeVideoId('https://youtu.be/HxRTrHyWB0Y?si=test')).toBe('HxRTrHyWB0Y');
  });

  it('extracts ids from watch URLs', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=K5MZeXFPsGc&t=12s')).toBe('K5MZeXFPsGc');
  });

  it('extracts ids from shorts and embed URLs', () => {
    expect(extractYouTubeVideoId('https://youtube.com/shorts/4xv3O_VrW0M')).toBe('4xv3O_VrW0M');
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/CtK-fV6TsBY')).toBe('CtK-fV6TsBY');
  });

  it('rejects invalid URLs', () => {
    expect(extractYouTubeVideoId('https://example.com/watch?v=HxRTrHyWB0Y')).toBeNull();
    expect(extractYouTubeVideoId('not a youtube url')).toBeNull();
  });

  it('truncates long titles and formats vote counts', () => {
    expect(truncateHighlightTitle('This title is much too long for the upload preview', 28)).toBe('This title is much too long...');
    expect(formatVoteCount(655)).toBe('655');
    expect(formatVoteCount(5300)).toBe('5,3k');
  });
});
