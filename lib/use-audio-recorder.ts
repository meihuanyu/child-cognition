'use client';

import { useCallback, useRef, useState } from 'react';

interface RecorderOptions {
  mimeType?: string;
}

export interface RecorderStopResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

const DEFAULT_MIME_TYPE = 'audio/webm;codecs=opus';

export function useAudioRecorder(options: RecorderOptions = {}) {
  const desiredMime = options.mimeType || DEFAULT_MIME_TYPE;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimestampRef = useRef<number>(0);

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && !!navigator?.mediaDevices?.getUserMedia;

  const cleanup = useCallback(() => {
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startTimestampRef.current = 0;
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('当前浏览器暂不支持录音功能');
      return false;
    }

    if (isRecording) {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: desiredMime });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimestampRef.current = performance.now();
      setError(null);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(event.error?.message || '录音发生错误');
        cleanup();
      };

      recorder.start();
      setIsRecording(true);
      return true;
    } catch (err: any) {
      console.error('启动录音失败:', err);
      setError(err?.message || '无法访问麦克风');
      cleanup();
      return false;
    }
  }, [cleanup, desiredMime, isRecording, isSupported]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      cleanup();
      return Promise.resolve<RecorderStopResult | null>(null);
    }

    return new Promise<RecorderStopResult | null>((resolve, reject) => {
      recorder.onstop = () => {
        try {
          const duration = Math.max(performance.now() - startTimestampRef.current, 0);
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || desiredMime });
          cleanup();
          resolve({
            blob,
            mimeType: blob.type || recorder.mimeType || desiredMime,
            durationMs: Math.round(duration),
          });
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      recorder.onerror = (event) => {
        console.error('停止录音时出错:', event.error);
        cleanup();
        reject(event.error);
      };

      recorder.stop();
    });
  }, [cleanup, desiredMime]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanup();
    }
  }, [cleanup]);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
    isSupported,
    error,
  };
}


