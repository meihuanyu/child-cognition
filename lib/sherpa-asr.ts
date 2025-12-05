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
  recognizerConfig?: Record<string, unknown>;
}

export interface SherpaRecognizer {
  recognize: (audioData: Float32Array, sampleRate: number) => Promise<string>;
  dispose: () => void;
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
  const targetSampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;

  let status: SherpaStatus = 'idle';
  let recognizer: SherpaOnlineRecognizer | null = null;
  let preparePromise: Promise<void> | null = null;
  let disposed = false;

  const notifyStatus = (next: SherpaStatus, detail?: string) => {
    status = next;
    callbacks.onStatus?.(next, detail);
  };

  const ensureRecognizer = async () => {
    if (recognizer) {
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

  const recognize = async (audioData: Float32Array, sampleRate: number): Promise<string> => {
    if (disposed) {
      throw new Error('Sherpa ASR 已销毁，无法识别');
    }

    try {
      await ensureRecognizer();
      
      if (!recognizer) {
        throw new Error('识别器未初始化');
      }

      const stream = recognizer.createStream();
      
      // 重采样到目标采样率
      const processedSamples = downsampleBuffer(audioData, sampleRate, targetSampleRate);
      
      // 分批送入音频数据
      const chunkSize = 1600; // 100ms at 16kHz
      for (let i = 0; i < processedSamples.length; i += chunkSize) {
        const chunk = processedSamples.slice(i, Math.min(i + chunkSize, processedSamples.length));
        stream.acceptWaveform(targetSampleRate, chunk);
        
        while (recognizer.isReady(stream)) {
          recognizer.decode(stream);
        }
        
        const partial = recognizer.getResult(stream)?.text ?? '';
        if (partial) {
          callbacks.onPartial?.(partial);
        }
      }

      // Paraformer 模型需要尾部填充
      if (hasParaformerModel(recognizer)) {
        const tailPaddings = new Float32Array(targetSampleRate);
        stream.acceptWaveform(targetSampleRate, tailPaddings);
        while (recognizer.isReady(stream)) {
          recognizer.decode(stream);
        }
      }

      stream.inputFinished();
      
      while (recognizer.isReady(stream)) {
        recognizer.decode(stream);
      }

      const finalResult = recognizer.getResult(stream)?.text ?? '';
      
      if (finalResult) {
        callbacks.onFinal?.(finalResult);
      }

      return finalResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      notifyStatus('error', err.message);
      callbacks.onError?.(err);
      throw err;
    }
  };

  const dispose = () => {
    if (disposed) {
      return;
    }
    recognizer?.free();
    recognizer = null;
    disposed = true;
    notifyStatus('idle');
  };

  return {
    recognize,
    dispose,
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

