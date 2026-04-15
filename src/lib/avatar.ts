type ProfileAvatarSource = {
  avatar_url?: string | null;
  discord_avatar_url?: string | null;
  username?: string | null;
  discord_display_name?: string | null;
};

export function isDiscordAvatarUrl(value?: string | null): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      host === 'cdn.discordapp.com' ||
      host === 'media.discordapp.net' ||
      (host.endsWith('.discordapp.com') && url.pathname.includes('/avatars/'))
    );
  } catch {
    return false;
  }
}

export function getDiscordAvatarUrl(profile?: ProfileAvatarSource | null): string | null {
  if (isDiscordAvatarUrl(profile?.discord_avatar_url)) return profile.discord_avatar_url;
  return isDiscordAvatarUrl(profile?.avatar_url) ? profile.avatar_url : null;
}

export function getProfileInitial(profile?: ProfileAvatarSource | null): string {
  const label = profile?.discord_display_name || profile?.username || 'U';
  return label.trim().charAt(0).toUpperCase() || 'U';
}
