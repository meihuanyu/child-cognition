'use client';

import { Loader2, RefreshCcw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Lesson, Segment } from '../types';

interface PracticeActionBarProps {
  lesson: Lesson;
  currentSegment: Segment | null;
  showTranslationButton: boolean;
  isSegmenting: boolean;
  isTranslating: boolean;
  onSegmentLesson: () => void | Promise<void>;
  onTranslateLesson: () => void | Promise<void>;
  onPlayOriginal: () => void | Promise<void>;
}

export function PracticeActionBar({
  lesson,
  currentSegment,
  showTranslationButton,
  isSegmenting,
  isTranslating,
  onSegmentLesson,
  onTranslateLesson,
  onPlayOriginal,
}: PracticeActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-white/80 backdrop-blur-sm shadow-lg">
      <div className="container mx-auto px-4 py-4 flex flex-wrap gap-3 justify-center items-center">
        <Button
          variant="outline"
          onClick={() => {
            onSegmentLesson();
          }}
          disabled={isSegmenting || ['PENDING', 'PROCESSING'].includes(lesson.status)}
          className="px-5 py-5 text-base font-semibold"
        >
          {isSegmenting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              正在分段...
            </>
          ) : (
            <>
              <RefreshCcw className="w-4 h-4 mr-2" />
              分段
            </>
          )}
        </Button>

        {showTranslationButton && (
          <Button
            variant="outline"
            onClick={() => {
              onTranslateLesson();
            }}
            disabled={
              isTranslating ||
              lesson.segments.length === 0 ||
              ['PENDING', 'PROCESSING', 'SEGMENTING'].includes(lesson.status)
            }
            className="px-5 py-5 text-base font-semibold"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在翻译...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                翻译
              </>
            )}
          </Button>
        )}

        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            onPlayOriginal();
          }}
          disabled={!currentSegment}
          className="px-8 py-5 text-lg font-semibold"
        >
          <Volume2 className="w-5 h-5 mr-2" />
          示范
        </Button>

        {/* 跟读按钮已迁移至 CurrentSegmentCard */}
      </div>
    </div>
  );
}

