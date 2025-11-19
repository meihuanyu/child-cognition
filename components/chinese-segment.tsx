'use client';

import { useCallback, useEffect, useState } from 'react';
import { speakText } from '@/lib/speech';
import { Button } from '@/components/ui/button';

interface ChineseSegmentProps {
  originalText: string;
  pinyinText?: string | null;
  isSelected?: boolean;
}

interface WordSegment {
  word: string;
  pinyin: string;
}

export function ChineseSegment({ originalText, pinyinText, isSelected = false }: ChineseSegmentProps) {
  const [segments, setSegments] = useState<WordSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const handleSpeak = useCallback((text: string) => {
    if (!text) {
      return;
    }

    speakText(text).catch((error) => {
      console.error('朗读失败:', error);
    });
  }, []);

  const handleSegment = useCallback(async () => {
    if (!originalText) {
      setSegments([]);
      return;
    }

    setIsLoading(true);
    try {
      // 调用后端API进行分词
      const response = await fetch('/api/segment-chinese', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: originalText }),
      });

      if (!response.ok) {
        throw new Error('分词请求失败');
      }

      const data = await response.json();
      if (data.success && data.segments) {
        setSegments(data.segments);
      } else {
        throw new Error(data.error || '分词失败');
      }
    } catch (error) {
      console.error('分词失败:', error);
      // 如果分词失败，至少显示原文
      setSegments([{ word: originalText, pinyin: pinyinText || '' }]);
    } finally {
      setIsLoading(false);
    }
  }, [originalText, pinyinText]);

  useEffect(() => {
    if (!isSelected || !originalText) {
      return;
    }

    if (segments.length === 0 && !isLoading) {
      handleSegment();
    }
  }, [handleSegment, isLoading, isSelected, originalText, segments.length]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="text-base text-gray-600">
          {originalText}
        </div>
        <div className="text-sm text-gray-500">分词中...</div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-base text-gray-600">
          {originalText}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 1. 移除了 gap-x-3，改为手动控制间距以实现更自然的标点跟随 */}
      <div className="flex flex-wrap items-end gap-y-2 leading-relaxed">
        {segments.map((segment, index) => {
          const isPunctuation = !segment.pinyin || segment.pinyin.trim().length === 0;

          // 预判下一个片段是否为标点
          const nextSegment = segments[index + 1];
          const isNextPunctuation = nextSegment && (!nextSegment.pinyin || nextSegment.pinyin.trim().length === 0);

          // 动态计算 margin-right
          // 如果当前不是标点，但下一个是标点，则 margin 极小(mr-0.5)或为0，让标点紧贴前文
          // 否则，给予正常的阅读间距(mr-3)
          const marginClass = (!isPunctuation && isNextPunctuation) ? "mr-0.5" : "mr-3";

          // 标点符号渲染
          if (isPunctuation) {
            return (
              <span
                key={index}
                className={`text-base font-semibold text-gray-900 ${marginClass}`}
              >
                {segment.word}
              </span>
            );
          }

          // 拼音文字渲染
          return (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => handleSpeak(segment.word)}
              aria-label={`朗读 ${segment.word}`}
              className={`h-auto min-h-0 px-1 py-0 inline-flex flex-col items-center text-center text-base font-semibold text-gray-900 ${marginClass}`}
            >
              <ruby className="flex flex-col items-center leading-tight">
                <rt className="text-xs font-normal text-gray-500 tracking-wide mt-0.5">
                  {segment.pinyin}
                </rt>
                {segment.word}
              </ruby>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

