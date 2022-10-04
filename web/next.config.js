/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  pageExtensions: ['page.js', 'page.jsx'],
  swcMinify: true,
  experimental: {
    browsersListForSwc: true,
    legacyBrowsers: false,
    images: { allowFutureImage: true },
  },
}

module.exports = nextConfig
