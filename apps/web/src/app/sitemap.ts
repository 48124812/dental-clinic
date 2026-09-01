import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dental-clinic-web.onrender.com';
  return ['/', '/doctors', '/services', '/appointments/new', '/appointments/lookup'].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: 'weekly', priority: path === '/' ? 1 : 0.7 }));
}
