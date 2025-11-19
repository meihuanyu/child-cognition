'use client';

import { ChineseSegment } from '@/components/chinese-segment';
import type { Lesson, SegmentPracticeResults } from '../types';

interface SegmentListProps {
  lesson: Lesson;
  activeSegmentIndex: number;
  segmentPracticeResults: SegmentPracticeResults;
  onSelect: (index: number) => void;
}

export function SegmentList({ lesson, activeSegmentIndex, segmentPracticeResults, onSelect }: SegmentListProps) {
  return (
    <div className="space-y-3">
      {lesson.segments.map((segment, index) => {
        const isActive = index === activeSegmentIndex;
        const segmentResult = segmentPracticeResults[segment.id];

        return (
          <button
            key={segment.id}
            onClick={() => onSelect(index)}
            className={`w-full text-left p-4 md:p-5 rounded-xl transition-all border ${
              segmentResult === 'RETRY'
                ? 'border-red-400 bg-red-50'
                : isActive
                  ? 'border-blue-400 bg-blue-50 shadow-sm'
                  : 'border-transparent bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-base font-semibold text-gray-500 min-w-[2.5rem]">{index + 1}.</span>
              <div className="flex-1">
                {lesson.language === 'en' ? (
                  <>
                    <p className="text-lg font-semibold text-gray-900 leading-relaxed">{segment.originalText}</p>
                    <p className="text-sm text-blue-600 mt-2">{segment.translatedText || '尚未生成中文翻译'}</p>
                  </>
                ) : (
                  <ChineseSegment
                    originalText={segment.originalText}
                    pinyinText={segment.pinyinText}
                    isSelected={isActive}
                  />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

