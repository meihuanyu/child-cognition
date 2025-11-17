import pinyin from 'pinyin';

/**
 * 将中文文本转换为拼音
 * @param text 中文文本
 * @returns 拼音文本（带声调）
 */
export function convertToPinyin(text: string): string {
  try {
    // pinyin 库配置：
    // style: pinyin.STYLE_TONE - 带声调的拼音
    // heteronym: false - 不显示多音字
    const result = pinyin(text, {
      style: pinyin.STYLE_TONE,
      heteronym: false,
    });
    
    // 将二维数组转换为字符串，用空格分隔
    return result.map(item => item[0]).join(' ');
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

