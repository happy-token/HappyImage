import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import { parseChangelog } from './src/lib/release'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function readAppVersion() {
    try {
        const version = readFileSync(join(projectRoot, 'VERSION'), 'utf-8').trim()
        return version || '0.0.0'
    } catch {
        return '0.0.0'
    }
}

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || readAppVersion()
let appReleases = '[]'
try {
    appReleases = JSON.stringify(parseChangelog(readFileSync(join(projectRoot, 'CHANGELOG.md'), 'utf-8')))
} catch {}

const nextConfig: NextConfig = {
    output: 'standalone',
    allowedDevOrigins: ['127.0.0.1'],
    async headers() {
        const securityHeaders = [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ]
        // HTML pages: allow CDN to store, but always revalidate.
        // max-age=0 forces browser revalidation on every navigation;
        // stale-while-revalidate lets the CDN serve stale while refreshing in background.
        const pageCacheHeaders = [
            {
                key: 'Cache-Control',
                value: 'public, max-age=0, must-revalidate, stale-while-revalidate=300',
            },
        ]
        // SSG pages (gallery detail, etc.): longer CDN cache with swr.
        // These pages are pre-rendered and only change on redeploy.
        const staticCacheHeaders = [
            {
                key: 'Cache-Control',
                value: 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        ]
        return [
            {
                // Static generated pages: cache at CDN level
                source: '/gallery/:id',
                headers: [...securityHeaders, ...staticCacheHeaders],
            },
            {
                // All other pages: revalidate every time
                source: '/((?!api|_next).*)',
                headers: [...securityHeaders, ...pageCacheHeaders],
            },
            {
                // Security headers on everything else (API, _next)
                source: '/:path*',
                headers: securityHeaders,
            },
        ]
    },
    env: {
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
        NEXT_PUBLIC_APP_VERSION: appVersion,
        NEXT_PUBLIC_APP_RELEASES: appReleases,
    },
    images: {
        unoptimized: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
}

if (process.env.HAPPYIMAGE_OPENNEXT_DEV === 'true') {
    void import('@opennextjs/cloudflare').then((m) => m.initOpenNextCloudflareForDev())
}

export default nextConfig
