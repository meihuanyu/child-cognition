'use client';

import { useEffect, useState } from 'react';
import { pinyin } from 'pinyin-pro';

interface ChineseSegmentProps {
  originalText: string;
  pinyinText?: string | null;
}

interface WordSegment {
  word: string;
  pinyin: string;
}

export function ChineseSegment({ originalText, pinyinText }: ChineseSegmentProps) {
  const [segments, setSegments] = useState<WordSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const segmentText = async () => {
      if (!originalText) {
        setSegments([]);
        setIsLoading(false);
        return;
      }

      try {
        // 动态导入jieba-js以避免SSR问题
        const jiebaModule = await import('jieba-js');
        const jieba = jiebaModule.default || jiebaModule;
        
        // 使用jieba-js进行分词
        const words = await jieba.cut(originalText);
        
        // 处理分词结果：保留中文词和标点符号，但分别处理
        const wordSegments: WordSegment[] = [];
        
        for (const word of words) {
          const trimmedWord = word.trim();
          if (trimmedWord.length === 0) continue;
          
          // 检查是否包含中文字符
          if (/[\u4e00-\u9fa5]/.test(trimmedWord)) {
            // 包含中文，生成拼音
            const wordPinyin = pinyin(trimmedWord, {
              toneType: 'symbol',
              type: 'all',
            }) as Array<{ pinyin: string; origin: string }>;
            
            // 将每个字符的拼音连接起来，用空格分隔
            const pinyinStr = wordPinyin
              .map((item) => item.pinyin || item.origin)
              .join(' ');

            wordSegments.push({
              word: trimmedWord,
              pinyin: pinyinStr,
            });
          } else {
            // 纯标点符号或空格，也显示但不生成拼音
            wordSegments.push({
              word: trimmedWord,
              pinyin: '',
            });
          }
        }

        setSegments(wordSegments);
      } catch (error) {
        console.error('分词失败:', error);
        // 如果分词失败，至少显示原文
        setSegments([{ word: originalText, pinyin: pinyinText || '' }]);
      } finally {
        setIsLoading(false);
      }
    };

    segmentText();
  }, [originalText, pinyinText]);

  if (isLoading) {
    return (
      <div className="text-base text-gray-600">
        {originalText}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="text-base text-gray-600">
        {originalText}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 leading-relaxed">
      {segments.map((segment, index) => {
        // 如果是标点符号或没有拼音的词，只显示文字
        if (!segment.pinyin || segment.pinyin.trim().length === 0) {
          return (
            <span key={index} className="text-base font-semibold text-gray-900">
              {segment.word}
            </span>
          );
        }
        
        // 有拼音的词，显示拼音在上，中文在下
        return (
          <div
            key={index}
            className="inline-flex flex-col items-center"
          >
            {/* 拼音在上 */}
            <span className="text-xs text-gray-500 leading-tight mb-0.5">
              {segment.pinyin}
            </span>
            {/* 中文在下 */}
            <span className="text-base font-semibold text-gray-900 leading-tight">
              {segment.word}
            </span>
          </div>
        );
      })}
    </div>
  );
}

