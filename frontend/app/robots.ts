import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/projects/', '/analysis/'], // Protect private paths
        },
        sitemap: 'https://sra-xi.vercel.app/sitemap.xml',
    }
}
