export const siteConfig = {
  brandName: 'Taz Elite',
  publicName: 'Taz',
  title: 'U.S. Army Air Defense Battle Management Systems Operator, Software Developer, Technology Entrepreneur, Gamer, and Content Creator',
  email: import.meta.env.CONTACT_EMAIL || 'taz@kruigerlabsllc.com',
  responseTime: '24–72 hours',
  description: 'Explore the experience, projects, technology work, gaming content, and creator platforms of Taz Elite, a software developer, U.S. Army service member, technology entrepreneur, and founder of Kruiger Labs.',
  socials: {
    discord: 'https://discord.gg/T3AeBNQdXp',
    twitch: 'https://www.twitch.tv/tazeliteplays',
    tiktok: 'https://www.tiktok.com/@tazeliteplays?_r=1&_t=ZT-98GkY5Reag1',
    youtube: 'https://youtube.com/@tazelite-plays',
    instagram: import.meta.env.INSTAGRAM_PROFILE_URL || 'https://www.instagram.com/adamkober_/',
    kruigerLabs: 'https://kruigerlabsllc.com'
  },
  routes: {
    gameHosting: '/cloudnord',
    vpn: '/vpn'
  },
  brand: {
    logo: '/images/brand/taz-elite-logo.png',
    logoSmall: '/images/brand/taz-elite-logo-128.webp',
    logoMedium: '/images/brand/taz-elite-logo-256.webp',
    logoLarge: '/images/brand/taz-elite-logo-512.webp'
  },
  integrations: {
    discordUserId: '1000470631688712243',
    discordInviteCode: 'T3AeBNQdXp',
    twitchLogin: 'tazeliteplays',
    youtubeChannelId: 'UCe2cGb8qKK-guxCtA7GZOEg',
    tiktokUsername: 'tazeliteplays'
  }
} as const;

export const navigation = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Experience', href: '/experience' },
  { label: 'Projects', href: '/projects' },
  { label: 'Discord', href: '/discord' },
  { label: 'Twitch', href: '/twitch' },
  { label: 'TikTok', href: '/tiktok' },
  { label: 'YouTube', href: '/youtube' },
  { label: 'Instagram', href: '/instagram' },
  { label: 'Contact', href: '/contact' },
  { label: 'Game Hosting', href: siteConfig.routes.gameHosting, service: true },
  { label: 'VPN', href: siteConfig.routes.vpn, service: true }
] as const;
