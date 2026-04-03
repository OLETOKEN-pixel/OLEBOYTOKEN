import type { Match } from '@/types';
import { PLATFORM_FEE } from '@/types';

export function formatMatchTitle(match: Match): string {
  const rawMode = String(match.mode ?? '').trim();
  const size = Number(match.team_size ?? 1);
  const sizeTag = size > 1 ? ` ${size}V${size}` : '';

  if (rawMode.length === 0) {
    return `MATCH${sizeTag}`;
  }

  return `${rawMode.toUpperCase()}${sizeTag}`;
}

export function formatFirstTo(match: Match): string {
  const firstTo = Number(match.first_to ?? 5);
  return `${firstTo}+2`;
}

export function formatPlatform(platform: Match['platform']): string {
  if (platform === 'Console') {
    return 'PS5';
  }

  return String(platform ?? 'ALL').toUpperCase();
}

export function formatPrize(match: Match): string {
  const entryFee = Number(match.entry_fee ?? 0);
  const totalPot = entryFee * Math.max(Number(match.team_size ?? 1), 1) * 2;
  return (totalPot * (1 - PLATFORM_FEE)).toFixed(2);
}

export function formatEntryFee(match: Match): string {
  return Number(match.entry_fee ?? 0).toFixed(2);
}

export function formatTimeLeft(expiresAt: string, now: number): string {
  const expiresAtMs = new Date(expiresAt).getTime();
  const diff = expiresAtMs - now;

  if (!Number.isFinite(expiresAtMs) || diff <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
