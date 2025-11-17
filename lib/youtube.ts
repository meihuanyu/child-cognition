import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs';
import path from 'path';
// @ts-ignore - node-webvtt 没有类型定义
import webvtt from 'node-webvtt';
import { cleanupTempFile } from './s3';
import { type SubtitleSegment } from './segmentation';

// yt-dlp 二进制文件路径
const ytDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp.exe');
let ytDlp: YTDlpWrap;

/**
 * 初始化 yt-dlp（如果需要则下载）
 */
async function initYtDlp() {
  if (ytDlp) return ytDlp;

  try {
    // 检查是否已存在 yt-dlp 二进制文件
    if (fs.existsSync(ytDlpPath)) {
      ytDlp = new YTDlpWrap(ytDlpPath);
      return ytDlp;
    }

    // 如果不存在，则下载
    console.log('正在下载 yt-dlp...');
    const binDir = path.dirname(ytDlpPath);
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    await YTDlpWrap.downloadFromGithub(ytDlpPath);
    console.log('yt-dlp 下载完成');

    ytDlp = new YTDlpWrap(ytDlpPath);
    return ytDlp;
  } catch (error) {
    console.error('初始化 yt-dlp 失败:', error);
    // 如果下载失败，尝试使用系统已安装的 yt-dlp
    ytDlp = new YTDlpWrap();
    return ytDlp;
  }
}

/**
 * 从 YouTube URL 提取视频 ID
 */
export function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * 解析 SRT 字幕格式（增强版，包含时间戳）
 */
function parseSRT(content: string): VTTParseResult {
  const segments: SubtitleSegment[] = [];

  // SRT 格式：
  // 1
  // 00:00:00,000 --> 00:00:02,000
  // 文本内容
  //
  // 2
  // 00:00:02,000 --> 00:00:04,000
  // 更多文本

  const lines = content.split('\n');
  let currentText = '';
  let currentStartTime = 0;
  let currentEndTime = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过序号
    if (/^\d+$/.test(line)) {
      continue;
    }

    // 解析时间戳行 (SRT 使用逗号: "00:00:00,000 --> 00:00:02,000")
    if (line.includes('-->')) {
      const timeMatch = line.match(/(\S+)\s*-->\s*(\S+)/);
      if (timeMatch) {
        // SRT 使用逗号，需要转换为点号
        const startTimeStr = timeMatch[1].replace(',', '.');
        const endTimeStr = timeMatch[2].replace(',', '.');
        currentStartTime = parseTimeToSeconds(startTimeStr);
        currentEndTime = parseTimeToSeconds(endTimeStr);
      }
      continue;
    }

    // 累积文本内容
    if (line) {
      currentText += (currentText ? ' ' : '') + line;
    } else if (currentText) {
      // 空行表示一个字幕段结束
      segments.push({
        text: currentText.trim(),
        startTime: currentStartTime,
        endTime: currentEndTime,
      });
      currentText = '';
    }
  }

  // 添加最后一段文本
  if (currentText) {
    segments.push({
      text: currentText.trim(),
      startTime: currentStartTime,
      endTime: currentEndTime,
    });
  }

  // SRT 没有语言信息，默认使用英文
  return {
    language: 'en',
    segments: segments.filter(s => s.text.length > 0),
  };
}


/**
 * VTT 解析结果接口
 */
export interface VTTParseResult {
  language: string;  // 'en' 或 'zh'
  segments: SubtitleSegment[];
}

/**
 * 将时间戳转换为秒
 * @param timeString 格式: "00:00:03.680" 或 "00:03.680"
 */
function parseTimeToSeconds(timeString: string): number {
  const parts = timeString.split(':');
  let hours = 0, minutes = 0, seconds = 0;

  if (parts.length === 3) {
    // HH:MM:SS.mmm
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    seconds = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS.mmm
    minutes = parseInt(parts[0], 10);
    seconds = parseFloat(parts[1]);
  } else {
    // SS.mmm
    seconds = parseFloat(parts[0]);
  }

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * 解析 VTT 字幕格式（使用 node-webvtt 库）
 */
function parseVTT(content: string): VTTParseResult {
  let language = 'en'; // 默认英文

  try {
    // 使用 node-webvtt 解析，启用元数据解析和非严格模式
    const parsed = webvtt.parse(content, { meta: true, strict: false });

    if (!parsed.valid && parsed.errors) {
      console.warn('VTT 解析警告:', parsed.errors);
    }

    // 从元数据中提取语言信息
    if (parsed.meta && parsed.meta.Language) {
      const lang = parsed.meta.Language.toLowerCase();
      language = lang.includes('zh') || lang.includes('cn') ? 'zh' : 'en';
    }

    // 将 cues 转换为 SubtitleSegment 格式
    const segments: SubtitleSegment[] = parsed.cues.map((cue: any) => ({
      text: cue.text.trim(),
      startTime: cue.start,
      endTime: cue.end,
    }));

    return {
      language,
      segments: segments.filter(s => s.text.length > 0),
    };
  } catch (error: any) {
    console.error('VTT 解析失败:', error);
    // 如果解析失败，返回空结果
    return {
      language: 'en',
      segments: [],
    };
  }
}

/**
 * 一次性下载 YouTube 内容（音频、字幕、元数据）
 * 使用单个 yt-dlp 命令完成所有下载，避免重复请求
 */
export async function downloadYouTubeContent(
  url: string,
  outputAudioPath: string
): Promise<{
  audioPath: string;
  title: string;
  language: string;
  subtitles: SubtitleSegment[];
  description?: string;
  thumbnail?: string;
}> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('无效的 YouTube URL');
    }

    // 初始化 yt-dlp
    const dlp = await initYtDlp();

    // 确保输出目录存在
    const baseDir = path.dirname(outputAudioPath);
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // 创建以视频 ID 命名的子文件夹
    const dir = path.join(baseDir, videoId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 使用 yt-dlp 默认文件命名（视频标题）
    const outputPath = path.join(dir, '%(title)s.%(ext)s');

    // 一次性下载音频和字幕（使用最简洁的命令）
    await dlp.execPromise([
      url,
      '--write-subs',
      '--extract-audio',
      '--audio-format', 'mp3',
      '-o', outputPath,
    ]);

    // 默认使用视频 ID 作为标题
    let title = videoId;
    let description = '';
    let thumbnail = '';

    // 查找生成的音频文件
    const files = fs.readdirSync(dir);
    console.log("files", files)
    const audioFile = files.find(f => f.endsWith('.mp3'));

    if (!audioFile) {
      throw new Error('音频文件下载失败');
    }

    const audioPath = path.join(dir, audioFile);

    // 从文件名提取标题
    const fileBaseName = path.basename(audioFile, '.mp3');
    if (fileBaseName) {
      title = fileBaseName;
    }

    // 读取字幕文件（可能是 .vtt 或 .srt）
    let subtitles: SubtitleSegment[] = [];
    let language = 'en'; // 默认英文
    const subtitleFiles = files.filter(f =>
      (f.endsWith('.vtt') || f.endsWith('.srt'))
    );

    if (subtitleFiles.length > 0) {
      const subtitlePath = path.join(dir, subtitleFiles[0]);
      const subtitleContent = fs.readFileSync(subtitlePath, 'utf-8');

      // 根据文件扩展名选择解析方法
      let parseResult: VTTParseResult;
      if (subtitleFiles[0].endsWith('.srt')) {
        parseResult = parseSRT(subtitleContent);
      } else {
        parseResult = parseVTT(subtitleContent);
      }

      subtitles = parseResult.segments;
      language = parseResult.language;

      // 清理字幕文件
      cleanupTempFile(subtitlePath);
    }

    return {
      audioPath,
      title,
      language,
      subtitles,
      description,
      thumbnail,
    };
  } catch (error: any) {
    console.error('下载 YouTube 内容失败:', error);
    throw new Error(`下载失败: ${error.message}`);
  }
}

