type AudioSegmentState = {
  rafId: number | null;
  intervalId: number | null;
  onTimeUpdate?: () => void;
  onEnded?: () => void;
};

const SEGMENT_STATE_KEY = '__segmentPlaybackState';

const PRECISE_EPSILON = 0.002; // 2ms 容差，提升边界对齐精度

function normalizeSrc(src: string) {
  try {
    const url = new URL(src, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}

function cleanupSegmentState(audio: HTMLAudioElement) {
  const state = (audio as any)[SEGMENT_STATE_KEY] as AudioSegmentState | undefined;
  if (!state) return;

  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
  }
  if (state.intervalId !== null) {
    clearInterval(state.intervalId);
  }
  if (state.onTimeUpdate) {
    audio.removeEventListener('timeupdate', state.onTimeUpdate);
  }
  if (state.onEnded) {
    audio.removeEventListener('ended', state.onEnded);
  }

  (audio as any)[SEGMENT_STATE_KEY] = undefined;
}

function attachSegmentState(audio: HTMLAudioElement, endTime: number, startTime: number) {
  cleanupSegmentState(audio);

  const state: AudioSegmentState = { intervalId: null, rafId: null };
  const shouldStop = () => audio.currentTime + PRECISE_EPSILON >= endTime;
  const stopPlayback = () => {
    cleanupSegmentState(audio);
    audio.pause();
    audio.currentTime = Math.min(endTime, audio.duration || endTime);
  };

  state.onTimeUpdate = () => {
    if (shouldStop()) {
      stopPlayback();
    }
  };

  state.onEnded = stopPlayback;

  audio.addEventListener('timeupdate', state.onTimeUpdate);
  audio.addEventListener('ended', state.onEnded);

  const segmentDuration = Math.max(endTime - startTime, 0);

  if (segmentDuration <= 1.5) {
    const preciseLoop = () => {
      if (shouldStop()) {
        stopPlayback();
        return;
      }
      state.rafId = requestAnimationFrame(preciseLoop);
    };
    state.rafId = requestAnimationFrame(preciseLoop);
  } else {
    state.intervalId = window.setInterval(() => {
      if (shouldStop()) {
        stopPlayback();
      }
    }, 40);
  }

  (audio as any)[SEGMENT_STATE_KEY] = state;
}

async function waitForMetadata(audio: HTMLAudioElement) {
  if (audio.readyState >= 1 && audio.duration) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('音频加载失败'));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('音频加载超时'));
    }, 5000);

    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('error', handleError);
      clearTimeout(timeout);
    };

    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('error', handleError);
  });
}

async function seekTo(audio: HTMLAudioElement, startTime: number) {
  await new Promise<void>((resolve, reject) => {
    let resolved = false;

    const finalize = (handler: () => void) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      handler();
    };

    const handleSeeked = () => finalize(resolve);
    const handleError = () => finalize(() => reject(new Error('音频定位失败')));

    const fallbackTimeout = window.setTimeout(() => finalize(resolve), 150);

    const cleanup = () => {
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('error', handleError);
      clearTimeout(fallbackTimeout);
    };

    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('error', handleError);
    audio.currentTime = Math.max(startTime, 0);
  });
}

function syncAudioSource(audio: HTMLAudioElement, proxiedAudioUrl: string) {
  const normalizedTarget = proxiedAudioUrl;
  const currentSrc = audio.src ? normalizeSrc(audio.src) : '';

  if (!audio.src || currentSrc !== normalizedTarget) {
    audio.pause();
    audio.src = proxiedAudioUrl;
    audio.preload = 'auto';
    audio.load();
  }
}

export interface PlayOriginalSegmentOptions {
  proxiedAudioUrl: string | null;
  segmentStart: number | null;
  segmentEnd: number | null;
  audioElement: HTMLAudioElement | null;
}

/**
 * 播放课程原声片段，命中返回 true，否则返回 false 以便外层回退到 TTS。
 */
export async function playOriginalSegment({
  proxiedAudioUrl,
  segmentStart,
  segmentEnd,
  audioElement,
}: PlayOriginalSegmentOptions): Promise<boolean> {
  if (!proxiedAudioUrl || segmentStart === null || segmentEnd === null) {
    return false;
  }

  if (segmentEnd <= segmentStart) {
    return false;
  }

  const audio = audioElement;

  if (!audio) {
    return false;
  }

  try {
    cleanupSegmentState(audio);
    syncAudioSource(audio, proxiedAudioUrl);
    await waitForMetadata(audio);
    await seekTo(audio, segmentStart);
    attachSegmentState(audio, segmentEnd, segmentStart);

    await audio.play();

    return true;
  } catch (error) {
    console.error('[playOriginalSegment] 播放失败', error);
    if (audio) {
      cleanupSegmentState(audio);
    }
    return false;
  }
}

