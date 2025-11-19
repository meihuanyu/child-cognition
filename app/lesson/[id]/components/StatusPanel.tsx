'use client';

import type { RefObject } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import type { Lesson } from '../types';
import type { StatusMeta } from '../hooks/useLessonResource';

interface StatusPanelProps {
  showStatusAlerts: boolean;
  infoMessage: string;
  error: string;
  currentStatus: StatusMeta;
  language: Lesson['language'];
  audioRef: RefObject<HTMLAudioElement>;
  proxiedAudioUrl: string | null;
}

export function StatusPanel({
  showStatusAlerts,
  infoMessage,
  error,
  currentStatus,
  language,
  audioRef,
  proxiedAudioUrl,
}: StatusPanelProps) {
  return (
    <>
      {showStatusAlerts && (
        <div className="space-y-3">
          {infoMessage && (
            <Alert>
              <AlertDescription>{infoMessage}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Alert variant={currentStatus.tone === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>
              <span className="font-medium">课程状态：{currentStatus.label}</span>
              <br />
              {currentStatus.description}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="mb-8 text-center">
        <span className="inline-block px-5 py-2.5 bg-blue-100 text-blue-700 rounded-full text-base font-semibold">
          {language === 'en' ? '🇬🇧 英文片源 → 中文学习' : '🇨🇳 中文片源'}
        </span>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <audio
            ref={audioRef}
            src={proxiedAudioUrl ?? undefined}
            preload="auto"
            controls
            className="w-full mt-6 rounded-lg border border-gray-200"
          />
        </CardContent>
      </Card>
    </>
  );
}

