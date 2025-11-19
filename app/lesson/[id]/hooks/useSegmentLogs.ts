'use client';

import { useCallback, useState } from 'react';
import type { StudyLogEntry } from '../types';

export function useSegmentLogs(userId: string) {
  const [segmentLogs, setSegmentLogs] = useState<Record<string, StudyLogEntry | null>>({});
  const [logsLoadingSegmentId, setLogsLoadingSegmentId] = useState<string | null>(null);
  const [logsError, setLogsError] = useState('');

  const fetchSegmentLogs = useCallback(
    async (segmentId: string) => {
      if (!segmentId) return;
      setLogsError('');
      setLogsLoadingSegmentId(segmentId);
      try {
        const response = await fetch(`/api/study-logs/${segmentId}?userId=${userId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '获取朗读记录失败');
        }
        setSegmentLogs((prev) => ({
          ...prev,
          [segmentId]: data.log ?? null,
        }));
      } catch (err: any) {
        setLogsError(err?.message || '获取朗读记录失败');
      } finally {
        setLogsLoadingSegmentId(null);
      }
    },
    [userId]
  );

  const updateSegmentLog = useCallback((segmentId: string, log: StudyLogEntry | null) => {
    if (!segmentId) return;
    setSegmentLogs((prev) => ({
      ...prev,
      [segmentId]: log,
    }));
  }, []);

  return {
    segmentLogs,
    logsError,
    logsLoadingSegmentId,
    fetchSegmentLogs,
    updateSegmentLog,
  };
}

