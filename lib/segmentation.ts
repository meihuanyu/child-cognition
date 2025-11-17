/**
 * 字幕片段接口
 */
export interface SubtitleSegment {
  text: string;
  startTime: number;  // 秒
  endTime: number;    // 秒
}

/**
 * 判断文本是否是一个完整的句子（基于语言）
 */
function isCompleteSentence(text: string, language: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // 根据语言判断句子结束标志
  if (language === 'zh' || language === 'zh-cn' || language === 'zh-tw') {
    // 中文：以。！？结尾表示完整句子
    return /[。！？]$/.test(trimmed);
  } else {
    // 英文：以. ! ?结尾表示完整句子
    // 但要排除缩写（如 Mr., Dr. 等）
    // 简单判断：如果以点结尾且长度很短，可能是缩写
    if (trimmed.endsWith('.') && trimmed.length < 5) {
      return false;
    }
    return /[.!?]$/.test(trimmed);
  }
}

/**
 * 清理文本：移除换行符，标准化空格
 */
function cleanText(text: string): string {
  return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 合并相邻的片段为完整句子（基于语言信息）
 */
export async function segmentTextsWithNLP(
  segments: SubtitleSegment[],
  language?: string
): Promise<SubtitleSegment[]> {
  if (segments.length === 0) {
    return segments;
  }

  const result: SubtitleSegment[] = [];
  const detectedLanguage = language || 'en';

  let currentGroup: SubtitleSegment[] = [];
  let currentText = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const cleanedText = cleanText(segment.text);

    if (cleanedText.length === 0) {
      continue; // 跳过空文本
    }

    // 将当前片段添加到当前组
    currentGroup.push(segment);
    
    // 构建合并后的文本
    if (currentText) {
      currentText += ' ' + cleanedText;
    } else {
      currentText = cleanedText;
    }

    // 检查是否构成完整句子
    const isComplete = isCompleteSentence(currentText, detectedLanguage);
    
    // 判断是否应该结束当前合并：
    // 1. 当前文本是完整句子（以句号、问号、感叹号结尾）
    // 2. 或者是最后一个片段
    const isLast = i === segments.length - 1;
    const shouldEnd = isComplete || isLast;

    if (shouldEnd && currentGroup.length > 0) {
      // 合并当前组的所有片段
      const mergedText = currentText.trim();
      
      if (mergedText.length > 0) {
        result.push({
          text: mergedText,
          startTime: currentGroup[0].startTime,
          endTime: currentGroup[currentGroup.length - 1].endTime,
        });
      }

      // 重置
      currentGroup = [];
      currentText = '';
    }
  }

  return result;
}

