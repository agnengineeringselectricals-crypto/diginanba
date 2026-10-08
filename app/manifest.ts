import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DigiNanba',
    short_name: 'DigiNanba',
    description: 'A global marketplace for practical digital products.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8fb',
    theme_color: '#5b4df6',
  };
}
