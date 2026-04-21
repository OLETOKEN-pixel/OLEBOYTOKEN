export interface HighlightCardData {
  id: string;
  title: string;
  author: string;
  authorAvatarSrc: string;
  thumbnailSrc: string;
  href: string;
  likeCount: number;
  rank?: number;
  isLiked?: boolean;
  source?: 'figma' | 'uploaded';
}

export type HighlightTab = 'all' | 'month' | 'week';
