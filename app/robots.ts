import { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://contourmapstudio.com';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/order/', '/checkout/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
