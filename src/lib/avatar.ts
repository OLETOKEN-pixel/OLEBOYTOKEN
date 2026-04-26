type ProfileAvatarSource = {
  avatar_url?: string | null;
  discord_avatar_url?: string | null;
  username?: string | null;
  discord_display_name?: string | null;
  discord_user_id?: string | null;
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

// Discord's auto-generated default avatar for migrated (no-discriminator) accounts.
// Returns one of 6 colored PNGs based on the user's snowflake.
export function getDiscordDefaultAvatarUrl(discordUserId?: string | null): string | null {
  if (!discordUserId) return null;
  try {
    const idx = Number((BigInt(discordUserId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return null;
  }
}

export function getDiscordAvatarUrl(profile?: ProfileAvatarSource | null): string | null {
  if (isDiscordAvatarUrl(profile?.discord_avatar_url)) return profile.discord_avatar_url;
  if (isDiscordAvatarUrl(profile?.avatar_url)) return profile.avatar_url;
  return getDiscordDefaultAvatarUrl(profile?.discord_user_id);
}

export function getProfileInitial(profile?: ProfileAvatarSource | null): string {
  const label = profile?.discord_display_name || profile?.username || 'U';
  return label.trim().charAt(0).toUpperCase() || 'U';
}
