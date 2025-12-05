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

export {
  createSherpaRecognizer,
  preloadSherpaAssets,
  type SherpaRecognizer,
  type SherpaRecognizerCallbacks,
  type SherpaRecognizerOptions,
} from './sherpa-asr';

