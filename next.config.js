const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  // 将原生模块标记为外部依赖，只在服务端使用
  serverComponentsExternalPackages: ['@node-rs/jieba'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 将 yt-dlp-wrap 标记为外部依赖，避免 webpack 打包
      config.externals.push({
        'yt-dlp-wrap': 'commonjs yt-dlp-wrap',
      });
      // 将 @node-rs/jieba 及其字典模块标记为外部依赖
      config.externals.push({
        '@node-rs/jieba': 'commonjs @node-rs/jieba',
        '@node-rs/jieba/dict': 'commonjs @node-rs/jieba/dict',
      });
      // 使用函数形式处理所有 @node-rs/jieba 相关的导入
      config.externals.push(({ request }, callback) => {
        if (request && (request === '@node-rs/jieba' || request.startsWith('@node-rs/jieba/'))) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
    } else {
      // 客户端构建时，使用 IgnorePlugin 忽略 .node 文件
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /\.node$/,
        })
      );
      // 忽略 @node-rs/jieba 模块
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@node-rs/jieba': false,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig

