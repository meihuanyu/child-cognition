import { playOriginalSegment } from './play-original';

interface SegmentBounds {
  startTime: number | null;
  endTime: number | null;
}

export interface HandlePlayOriginalOptions {
  segment: SegmentBounds | null | undefined;
  proxiedAudioUrl: string | null;
  audioElement: HTMLAudioElement | null;
  fallbackToTTS: () => Promise<void> | void;
}

function isValidBounds(segment: SegmentBounds | null | undefined): segment is Required<SegmentBounds> {
  return (
    !!segment &&
    typeof segment.startTime === 'number' &&
    typeof segment.endTime === 'number' &&
    segment.endTime - segment.startTime > 0
  );
}

export async function handlePlayOriginal({
  segment,
  proxiedAudioUrl,
  audioElement,
  fallbackToTTS,
}: HandlePlayOriginalOptions) {
  if (!isValidBounds(segment)) {
    await fallbackToTTS();
    return;
  }

  if (!audioElement || !proxiedAudioUrl) {
    await fallbackToTTS();
    return;
  }

  const played = await playOriginalSegment({
    proxiedAudioUrl,
    segmentStart: segment.startTime,
    segmentEnd: segment.endTime,
    audioElement,
  });

  if (!played) {
    await fallbackToTTS();
  }
}


