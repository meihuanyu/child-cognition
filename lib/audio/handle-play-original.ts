import { playOriginalSegment } from './play-original';

interface SegmentBounds {
  startTime: number | null;
  endTime: number | null;
}

export interface HandlePlayOriginalOptions {
  segment: SegmentBounds | null | undefined;
  proxiedAudioUrl: string | null;
  audioElement: HTMLAudioElement | null;
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
}: HandlePlayOriginalOptions) {
  if (!isValidBounds(segment)) {
    console.warn('缺少有效的片段时间范围，无法播放原音频');
    return;
  }

  if (!audioElement || !proxiedAudioUrl) {
    console.warn('缺少音频元素或音频地址，无法播放原音频');
    return;
  }

  await playOriginalSegment({
    proxiedAudioUrl,
    segmentStart: segment.startTime,
    segmentEnd: segment.endTime,
    audioElement,
  });
}


