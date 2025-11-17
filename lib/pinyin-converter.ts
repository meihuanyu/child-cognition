import { pinyin } from 'pinyin-pro';

/**
 * pinyin-pro 的 type: 'all' 返回的数据结构
 */
interface PinyinData {
  origin: string;     // 原始字符
  pinyin: string;     // 拼音
  first?: string;     // 声母
  final?: string;     // 韵母
  num?: number;       // 音调数字
  isZh?: boolean;     // 是否是中文
  polyphonic?: string[];  // 多音字
}

/**
 * 将中文文本转换为拼音
 * @param text 中文文本
 * @returns 拼音文本（带声调）
 */
export function convertToPinyin(text: string): string {
  try {
    // pinyin-pro 配置：
    // toneType: 'symbol' - 使用音调符号（如 ā, á, ǎ, à）
    // type: 'all' - 返回详细的拼音数据
    const result = pinyin(text, {
      toneType: 'symbol',
      type: 'all',
    }) as PinyinData[];
    
    // 将 PinyinData[] 转换为字符串
    // 提取每个字符的 pinyin 字段并用空格连接
    const pinyinString = result
      .map(item => item.pinyin || item.origin)
      .join(' ');
    
    return pinyinString;
  } catch (error) {
    console.error('拼音转换失败:', error);
    return text; // 转换失败时返回原文
  }
}

/**
 * 获取简易英文释义（MVP 版本 - 使用简单的词典映射）
 * 生产环境建议使用翻译 API（如 Google Translate, DeepL）
 */
export async function getEnglishMeaning(text: string): Promise<string> {
  // MVP: 简单的词典映射
  const simpleDict: Record<string, string> = {
    '你好': 'Hello',
    '谢谢': 'Thank you',
    '再见': 'Goodbye',
    '早上好': 'Good morning',
    '晚安': 'Good night',
    '对不起': 'Sorry',
    '没关系': 'It\'s okay',
    '我': 'I/Me',
    '你': 'You',
    '他': 'He',
    '她': 'She',
    '我们': 'We',
    '他们': 'They',
    '是': 'Yes/Is',
    '不': 'No/Not',
    '好': 'Good',
    '坏': 'Bad',
    '大': 'Big',
    '小': 'Small',
    '多': 'Many/Much',
    '少': 'Few/Little',
  };

  // 尝试直接匹配
  if (simpleDict[text]) {
    return simpleDict[text];
  }

  // TODO: 集成真实的翻译 API
  // 例如：Google Translate API, DeepL API, 或百度翻译 API
  
  // MVP 阶段返回占位符
  return `[Translation: ${text}]`;
}

/**
 * 批量转换拼音（用于处理多个句子）
 */
export function batchConvertToPinyin(texts: string[]): string[] {
  return texts.map(text => convertToPinyin(text));
}

