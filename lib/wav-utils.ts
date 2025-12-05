

import audioDecode from 'audio-decode';
import toWav from 'audiobuffer-to-wav';
/**
 * 获取 WAV 文件信息
 */
export function getWavDuration(arrayBuffer: ArrayBuffer) {
    // 转换为 DataView 以便读取数据
    const view = new DataView(arrayBuffer);
    
    
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    
    if (wave !== 'WAVE') {
      throw new Error('Invalid WAV file: WAVE header not found');
    }
    
    // 查找格式块
    let offset = 12;
    let format;
    while (offset < view.byteLength) {
      const chunk = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      
      if (chunk === 'fmt ') {
        format = {
          chunkSize: view.getUint32(offset + 4, true),
          audioFormat: view.getUint16(offset + 8, true),
          numChannels: view.getUint16(offset + 10, true),
          sampleRate: view.getUint32(offset + 12, true),
          byteRate: view.getUint32(offset + 16, true),
          blockAlign: view.getUint16(offset + 20, true),
          bitsPerSample: view.getUint16(offset + 22, true)
        };
        break;
      }
      offset += 8 + view.getUint32(offset + 4, true);
    }
    
    if (!format) {
      throw new Error('Invalid WAV file: Format chunk not found');
    }
    
    // 查找数据块
    offset = 12;
    let dataSize = 0;
    while (offset < view.byteLength) {
      const chunk = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      
      if (chunk === 'data') {
        dataSize = view.getUint32(offset + 4, true);
        break;
      }
      offset += 8 + view.getUint32(offset + 4, true);
    }
    
    if (!dataSize) {
      throw new Error('Invalid WAV file: Data chunk not found');
    }
    
    // 计算持续时间（秒）
    const duration = dataSize / format.byteRate;
    
    return {
      duration,           // 持续时间（秒）
      sampleRate: format.sampleRate,    // 采样率
      channels: format.numChannels,     // 声道数
      bitDepth: format.bitsPerSample   // 位深度
    };
  }

/**
 * 将音频文件转换为 WAV 格式（16kHz, 单声道）
 * 使用 audio-decode 和 audiobuffer-to-wav
 */
export async function convertToWav(inputBuffer: Buffer): Promise<Buffer> {
  try {
    
    console.log('开始解码音频文件...');
    
    // 解码音频（支持 MP3, M4A, FLAC, OGG 等）
    const audioBuffer = await audioDecode(inputBuffer);
    
    console.log(`音频信息: ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}声道, ${audioBuffer.duration.toFixed(2)}秒`);
    
    // 重采样到 16kHz 单声道
    const targetSampleRate = 16000;
    const resampledBuffer = resampleAudioBuffer(audioBuffer, targetSampleRate);
    
    console.log(`重采样完成: ${resampledBuffer.sampleRate}Hz, ${resampledBuffer.numberOfChannels}声道`);
    
    // 转换为 WAV
    const wavArrayBuffer = toWav(resampledBuffer);
    const wavBuffer = Buffer.from(wavArrayBuffer);
    
    console.log(`WAV 转换完成，大小: ${(wavBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    return wavBuffer;
    
  } catch (error: any) {
    console.error('音频转换失败:', error);
    throw new Error(`音频转换失败: ${error.message}`);
  }
}

/**
 * 重采样音频并转换为单声道
 */
function resampleAudioBuffer(
  audioBuffer: any,
  targetSampleRate: number
): any {
  const originalSampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  
  // 如果已经是目标采样率和单声道，直接返回
  if (originalSampleRate === targetSampleRate && numberOfChannels === 1) {
    return audioBuffer;
  }
  
  // 计算新的长度
  const sampleRateRatio = targetSampleRate / originalSampleRate;
  const newLength = Math.round(audioBuffer.length * sampleRateRatio);
  
  // 创建新的 AudioBuffer（单声道）
  const offlineContext = {
    sampleRate: targetSampleRate,
    length: newLength,
    numberOfChannels: 1
  };
  
  // 简单的重采样实现
  const newData = new Float32Array(newLength);
  
  // 如果是多声道，先混合为单声道
  let sourceData: Float32Array;
  if (numberOfChannels === 1) {
    sourceData = audioBuffer.getChannelData(0);
  } else {
    // 混合所有声道
    const channel0 = audioBuffer.getChannelData(0);
    const channel1 = audioBuffer.getChannelData(1);
    sourceData = new Float32Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      sourceData[i] = (channel0[i] + channel1[i]) / 2;
    }
  }
  
  // 线性插值重采样
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i / sampleRateRatio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, sourceData.length - 1);
    const t = srcIndex - srcIndexFloor;
    
    newData[i] = sourceData[srcIndexFloor] * (1 - t) + sourceData[srcIndexCeil] * t;
  }
  
  // 返回类似 AudioBuffer 的对象
  return {
    sampleRate: targetSampleRate,
    length: newLength,
    duration: newLength / targetSampleRate,
    numberOfChannels: 1,
    getChannelData: (channel: number) => {
      if (channel !== 0) {
        throw new Error('Only mono audio is supported');
      }
      return newData;
    }
  };
}

/**
 * 检查是否为 WAV 格式
 */
export function isWavFormat(arrayBuffer: ArrayBuffer): boolean {
  if (arrayBuffer.byteLength < 12) {
    return false;
  }
  
  const view = new DataView(arrayBuffer);
  
  // 检查 RIFF 头
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  
  // 检查 WAVE 标识
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  
  return riff === 'RIFF' && wave === 'WAVE';
}

/**
 * 创建 WAV 文件头
 */
export function createWavHeader(
  audioData: Float32Array,
  sampleRate: number = 16000,
  numChannels: number = 1
): ArrayBuffer {
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioData.length * bytesPerSample;
  const headerSize = 44;
  const fileSize = headerSize + dataSize - 8;
  
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);
  
  // RIFF 头
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt 子块
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt 块大小
  view.setUint16(20, 1, true); // 音频格式 (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data 子块
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // 写入音频数据（转换为 16 位 PCM）
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }
  
  return buffer;
}

/**
 * 辅助函数：写入字符串
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}