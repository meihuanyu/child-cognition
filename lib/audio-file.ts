/**
 * 音频文件识别模块 - 后端 API 版本
 * 通过调用后端 API 进行音频识别
 */

import { SubtitleSegment } from './segmentation';

export interface AudioFileRecognitionResult {
  text: string;
  duration: number;
  segments: SubtitleSegment[];
  audioUrl?: string;
}

/**
 * 从音频文件识别文本（流式版本）
 * 通过后端 API 进行识别，实时返回进度
 * 
 * @param audioFile 音频文件
 * @param _options 选项（保留以兼容旧接口）
 * @param onProgress 进度回调
 */
export async function recognizeAudioFile(
  audioFile: File,
  _options: { assetsBaseUrl?: string } = {},
  onProgress?: (progress: number, status: string) => void
): Promise<AudioFileRecognitionResult> {
  const startTime = Date.now();
  
  try {
    // 验证文件大小（限制 50MB）
    const maxSize = 50 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      throw new Error('文件太大，请选择小于 50MB 的音频文件');
    }
    
    onProgress?.(5, '准备上传音频文件...');
    
    // 创建 FormData
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    // 发送请求到后端（流式）
    const response = await fetch('/api/audio/recognize', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('上传失败');
    }
    
    // 读取流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }
    
    const decoder = new TextDecoder();
    const segments: SubtitleSegment[] = [];
    let currentText = '';
    let audioUrl = '';
    let progress = 10;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // 解析 SSE 格式数据
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        try {
          const data = JSON.parse(line.slice(6));
          
          // 处理不同类型的事件
          switch (data.type) {
            case 'status':
              onProgress?.(progress, data.message);
              progress = Math.min(progress + 10, 80);
              break;
              
            case 'recognizing':
              // 识别中的临时结果
              onProgress?.(progress, `识别中: ${data.text.substring(0, 20)}...`);
              break;
              
            case 'segment':
              // 识别完成的片段
              segments.push({
                text: data.text,
                startTime: data.startTime,
                endTime: data.endTime
              });
              currentText += data.text;
              progress = Math.min(progress + 5, 90);
              onProgress?.(progress, `已识别 ${segments.length} 个片段`);
              break;
              
            case 'audioUrl':
              // 接收音频 URL
              audioUrl = data.url;
              onProgress?.(95, '音频上传完成');
              break;
              
            case 'done':
              // 完成
              onProgress?.(100, '识别完成');
              break;
              
            case 'error':
              throw new Error(data.message || '识别失败');
          }
        } catch (e) {
          // 忽略解析错误
          console.warn('解析 SSE 数据失败:', e);
        }
      }
    }
    
    const processDuration = (Date.now() - startTime) / 1000;
    
    if (segments.length === 0) {
      throw new Error('未识别到任何文本');
    }
    
    return {
      text: currentText || '未识别到文本',
      duration: processDuration,
      segments,
      audioUrl: audioUrl || undefined
    };
    
  } catch (error) {
    console.error('音频识别失败:', error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * 获取音频文件的时长
 * 用于显示预览信息
 */
export async function getAudioDuration(audioFile: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(audioFile);
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取音频文件'));
    });
    
    audio.src = url;
  });
}
