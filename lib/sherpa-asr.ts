type SherpaStatus = 'idle' | 'loading' | 'ready' | 'recording' | 'error';

export interface SherpaRecognizerCallbacks {
  onPartial?(text: string): void;
  onFinal?(text: string): void;
  onStatus?(status: SherpaStatus, detail?: string): void;
  onError?(error: Error): void;
}

export interface SherpaRecognizerOptions {
  assetsBaseUrl?: string;
  sampleRate?: number;
  bufferSize?: number;
  recognizerConfig?: Record<string, unknown>;
}

export interface SherpaRecognizer {
  start: () => Promise<boolean>;
  stop: () => void;
  dispose: () => void;
  isRecording: () => boolean;
  getStatus: () => SherpaStatus;
}

interface SherpaOnlineRecognizer {
  config?: {
    modelConfig?: {
      paraformer?: {
        encoder?: string;
      };
    };
  };
  createStream(): SherpaOnlineStream;
  free(): void;
  isReady(stream: SherpaOnlineStream): boolean;
  decode(stream: SherpaOnlineStream): void;
  getResult(stream: SherpaOnlineStream): { text?: string };
  isEndpoint(stream: SherpaOnlineStream): boolean;
  reset(stream: SherpaOnlineStream): void;
}

interface SherpaOnlineStream {
  acceptWaveform(sampleRate: number, samples: Float32Array): void;
  inputFinished(): void;
}

interface LoadSherpaModuleOptions {
  assetsBaseUrl: string;
  onStatus?: (status: string) => void;
}

const DEFAULT_BASE_URL = '/sherpa';
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_BUFFER_SIZE = 4096;
type WindowWithSherpa = Window & {
  createOnlineRecognizer?: (Module: any, config?: Record<string, unknown>) => SherpaOnlineRecognizer;
  __childCognitionSherpaModulePromise?: Promise<any>;
  __childCognitionSherpaModule?: any;
};

export async function preloadSherpaAssets(options: SherpaRecognizerOptions = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedBase = normalizeBaseUrl(options.assetsBaseUrl ?? DEFAULT_BASE_URL);
  await loadSherpaModule({
    assetsBaseUrl: normalizedBase,
    onStatus: () => undefined,
  });
}

export function createSherpaRecognizer(
  options: SherpaRecognizerOptions = {},
  callbacks: SherpaRecognizerCallbacks = {}
): SherpaRecognizer {
  if (typeof window === 'undefined') {
    throw new Error('Sherpa ASR 只能在浏览器环境使用');
  }

  const browserWindow = window as WindowWithSherpa;
  const normalizedBase = normalizeBaseUrl(options.assetsBaseUrl ?? DEFAULT_BASE_URL);
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE;

  let status: SherpaStatus = 'idle';
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let mediaSource: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let recognizer: SherpaOnlineRecognizer | null = null;
  let recognizerStream: SherpaOnlineStream | null = null;
  let lastPartial = '';
  let preparePromise: Promise<void> | null = null;
  let disposed = false;

  const notifyStatus = (next: SherpaStatus, detail?: string) => {
    status = next;
    callbacks.onStatus?.(next, detail);
  };

  const ensureRecognizer = async () => {
    if (recognizer) {
      if (!recognizerStream) {
        recognizerStream = recognizer.createStream();
      }
      return;
    }

    if (!preparePromise) {
      notifyStatus('loading', '准备加载 Sherpa ONNX 资源');
      preparePromise = loadSherpaModule({
        assetsBaseUrl: normalizedBase,
        onStatus: (detail) => callbacks.onStatus?.('loading', detail),
      })
        .then((Module) => {
          if (disposed) {
            return;
          }
          const factory = browserWindow.createOnlineRecognizer;
          if (!factory) {
            throw new Error('未找到 createOnlineRecognizer，确认 sherpa 脚本是否成功加载');
          }
          recognizer = factory(Module, options.recognizerConfig);
          recognizerStream = recognizer.createStream();
          notifyStatus('ready', 'Sherpa ONNX 初始化完成');
        })
        .catch((error: Error) => {
          notifyStatus('error', error.message);
          callbacks.onError?.(error);
          throw error;
        });
    }

    await preparePromise;
  };

  const handleAudioProcess = (event: AudioProcessingEvent) => {
    if (!recognizer || !recognizerStream) {
      return;
    }

    try {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      const copiedSamples = new Float32Array(inputBuffer.length);
      copiedSamples.set(inputBuffer);
      const processedSamples = downsampleBuffer(
        copiedSamples,
        event.inputBuffer.sampleRate,
        sampleRate
      );

      recognizerStream.acceptWaveform(sampleRate, processedSamples);

      while (recognizer.isReady(recognizerStream)) {
        recognizer.decode(recognizerStream);
      }

      let result = recognizer.getResult(recognizerStream)?.text ?? '';

      if (hasParaformerModel(recognizer)) {
        const tailPaddings = new Float32Array(sampleRate);
        recognizerStream.acceptWaveform(sampleRate, tailPaddings);
        while (recognizer.isReady(recognizerStream)) {
          recognizer.decode(recognizerStream);
        }
        result = recognizer.getResult(recognizerStream)?.text ?? result;
      }

      if (result && result !== lastPartial) {
        lastPartial = result;
        callbacks.onPartial?.(result);
      }

      if (recognizer.isEndpoint(recognizerStream)) {
        flushFinalResult();
        recognizer.reset(recognizerStream);
      }
    } catch (error) {
      console.error('Sherpa ASR 处理音频数据失败', error);
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const flushFinalResult = () => {
    if (!recognizer || !recognizerStream) {
      return;
    }
    const result = recognizer.getResult(recognizerStream)?.text ?? '';
    const finalText = result || lastPartial;

    if (finalText) {
      callbacks.onFinal?.(finalText);
    }

    lastPartial = '';
  };

  const start = async () => {
    if (disposed) {
      throw new Error('Sherpa ASR 已销毁，无法重新启动');
    }

    if (status === 'recording') {
      return true;
    }

    try {
      await ensureRecognizer();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持麦克风录制');
      }

      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext({ sampleRate });
      mediaSource = audioContext.createMediaStreamSource(mediaStream);

      const numberOfInputChannels = 1;
      const numberOfOutputChannels = 1;
      if (audioContext.createScriptProcessor) {
        processor = audioContext.createScriptProcessor(
          bufferSize,
          numberOfInputChannels,
          numberOfOutputChannels
        );
      } else {
        processor = (audioContext as any).createJavaScriptNode?.(
          bufferSize,
          numberOfInputChannels,
          numberOfOutputChannels
        );
      }

      if (!processor) {
        throw new Error('创建 ScriptProcessor 失败，浏览器可能不支持');
      }

      processor.onaudioprocess = handleAudioProcess;
      mediaSource.connect(processor);
      processor.connect(audioContext.destination);

      notifyStatus('recording');
      return true;
    } catch (error) {
      notifyStatus('error', error instanceof Error ? error.message : String(error));
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      cleanupMedia();
      return false;
    }
  };

  const stop = () => {
    if (status !== 'recording') {
      return;
    }

    if (recognizerStream) {
      recognizerStream.inputFinished();
      flushFinalResult();
      recognizer?.reset(recognizerStream);
    }

    cleanupMedia();
    notifyStatus('ready');
  };

  const dispose = () => {
    if (disposed) {
      return;
    }
    stop();
    recognizer?.free();
    recognizer = null;
    recognizerStream = null;
    disposed = true;
    notifyStatus('idle');
  };

  const cleanupMedia = () => {
    processor?.disconnect();
    mediaSource?.disconnect();
    processor = null;
    mediaSource = null;

    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;

    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => undefined);
    }
    audioContext = null;
  };

  return {
    start,
    stop,
    dispose,
    isRecording: () => status === 'recording',
    getStatus: () => status,
  };
}

async function loadSherpaModule(options: LoadSherpaModuleOptions): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('无法在非浏览器环境加载 Sherpa 模块');
  }

  const browserWindow = window as WindowWithSherpa;

  if (browserWindow.__childCognitionSherpaModulePromise) {
    return browserWindow.__childCognitionSherpaModulePromise;
  }

  const module: any = browserWindow.__childCognitionSherpaModule ?? {};
  const baseUrl = normalizeBaseUrl(options.assetsBaseUrl);

  module.locateFile = (path: string) => {
    if (/^https?:\/\//.test(path)) {
      return path;
    }
    return `${baseUrl}/${path}`;
  };

  module.setStatus = (status: string) => {
    options.onStatus?.(status);
  };

  browserWindow.__childCognitionSherpaModule = module;
  (browserWindow as any).Module = module;

  const helperUrl = `${baseUrl}/sherpa-onnx-asr.js`;
  const wasmMainUrl = `${baseUrl}/sherpa-onnx-wasm-main-asr.js`;

  const readyPromise = new Promise((resolve, reject) => {
    module.onRuntimeInitialized = () => resolve(module);
    module.onAbort = (reason: unknown) => reject(new Error(String(reason)));
  });

  browserWindow.__childCognitionSherpaModulePromise = (async () => {
    await loadScript(helperUrl);
    await loadScript(wasmMainUrl);
    return await readyPromise;
  })();

  return browserWindow.__childCognitionSherpaModulePromise;
}

const scriptCache = new Map<string, Promise<void>>();

function loadScript(src: string) {
  if (scriptCache.has(src)) {
    return scriptCache.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`加载脚本失败: ${src}`));
    document.head.appendChild(script);
  });

  scriptCache.set(src, promise);
  return promise;
}

function normalizeBaseUrl(url: string) {
  if (!url) {
    return DEFAULT_BASE_URL;
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, targetSampleRate: number) {
  if (targetSampleRate === inputSampleRate) {
    return buffer;
  }
  const sampleRateRatio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }
    result[offsetResult] = accum / Math.max(count, 1);
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function hasParaformerModel(recognizer: SherpaOnlineRecognizer) {
  return Boolean(recognizer.config?.modelConfig?.paraformer?.encoder);
}

