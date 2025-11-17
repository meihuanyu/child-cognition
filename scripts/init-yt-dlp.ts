import { initYtDlp } from '../lib/youtube';

async function main() {
  try {
    await initYtDlp();
    console.log('yt-dlp 初始化完成');
    process.exit(0);
  } catch (error) {
    console.error('yt-dlp 初始化失败:', error);
    process.exit(1);
  }
}

void main();

