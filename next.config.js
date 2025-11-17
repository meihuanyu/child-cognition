/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 将 yt-dlp-wrap 标记为外部依赖，避免 webpack 打包
      config.externals.push({
        'yt-dlp-wrap': 'commonjs yt-dlp-wrap',
      });
    }
    return config;
  },
}

module.exports = nextConfig

