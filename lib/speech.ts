/**
 * Web Speech API 工具函数
 * 用于文本转语音 (TTS) 和语音识别 (ASR)
 */

/**
 * 播放文本语音（TTS）
 * @param text 要朗读的文本
 * @param lang 语言代码 ('zh-CN' 或 'en-US')
 */
export function speakText(text: string, lang: 'zh-CN' | 'en-US' = 'zh-CN'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('浏览器不支持语音合成'));
      return;
    }

    // 停止当前正在播放的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // 语速稍慢，适合儿童学习
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(event);

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * 开始语音识别（ASR）
 * @param lang 语言代码 ('zh-CN' 或 'en-US')
 * @param onResult 识别结果回调
 * @param onError 错误回调
 */
export function startSpeechRecognition(
  lang: 'zh-CN' | 'en-US' = 'zh-CN',
  onResult: (transcript: string) => void,
  onError?: (error: string) => void
): SpeechRecognition | null {
  // 检查浏览器支持
  const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    onError?.('浏览器不支持语音识别');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.interimResults = false; // 只返回最终结果
  recognition.maxAlternatives = 1;
  recognition.continuous = false; // 单次识别

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event) => {
    console.error('语音识别错误:', event.error);
    onError?.(event.error);
  };

  recognition.onend = () => {
    console.log('语音识别结束');
  };

  try {
    recognition.start();
    return recognition;
  } catch (error) {
    console.error('启动语音识别失败:', error);
    onError?.('启动语音识别失败');
    return null;
  }
}

/**
 * 停止语音识别
 */
export function stopSpeechRecognition(recognition: SpeechRecognition | null) {
  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.error('停止语音识别失败:', error);
    }
  }
}

/**
 * 检查浏览器是否支持 Web Speech API
 */
export function checkSpeechSupport() {
  const hasSpeechSynthesis = 'speechSynthesis' in window;
  const hasSpeechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  return {
    synthesis: hasSpeechSynthesis,
    recognition: hasSpeechRecognition,
    fullSupport: hasSpeechSynthesis && hasSpeechRecognition,
  };
}

export {
  createSherpaRecognizer,
  preloadSherpaAssets,
  type SherpaRecognizer,
  type SherpaRecognizerCallbacks,
  type SherpaRecognizerOptions,
} from './sherpa-asr';

