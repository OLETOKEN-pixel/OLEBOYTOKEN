type ProfileAvatarSource = {
  discord_avatar_url?: string | null;
  username?: string | null;
  discord_display_name?: string | null;
};

export function getDiscordAvatarUrl(profile?: ProfileAvatarSource | null): string | null {
  return profile?.discord_avatar_url || null;
}

export function getProfileInitial(profile?: ProfileAvatarSource | null): string {
  const label = profile?.discord_display_name || profile?.username || 'U';
  return label.trim().charAt(0).toUpperCase() || 'U';
}
