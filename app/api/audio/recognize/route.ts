import { NextRequest } from 'next/server';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { convertToWav } from '@/lib/wav-utils';

/**
 * POST /api/audio/recognize
 * 流式返回音频识别结果
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      let tempFilePath: string | null = null;
      let wavFilePath: string | null = null;

      // 发送数据的辅助函数
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 1. 获取并验证文件
        const formData = await request.formData();
        const file = formData.get('audio') as File;

        if (!file || !file.type.startsWith('audio/')) {
          send({ error: '无效的音频文件' });
          controller.close();
          return;
        }

        if (file.size > 50 * 1024 * 1024) {
          send({ error: '文件太大，限制 50MB' });
          controller.close();
          return;
        }

        send({ type: 'status', message: '上传成功，准备转换...' });

        // 2. 保存并转换为 WAV
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = file.name.split('.').pop() || 'mp3';
        tempFilePath = join(tmpdir(), `audio-${Date.now()}.${ext}`);
        await writeFile(tempFilePath, buffer);

        send({ type: 'status', message: '转换音频格式...' });
        
        const originalBuffer = await readFile(tempFilePath);
        const wavBuffer = await convertToWav(originalBuffer);
        wavFilePath = join(tmpdir(), `audio-${Date.now()}.wav`);
        await writeFile(wavFilePath, wavBuffer);

        send({ type: 'status', message: '开始识别...' });

        // 3. 流式识别
        await recognizeStream(wavFilePath, send);

        send({ type: 'done' });
        controller.close();

      } catch (error: any) {
        send({ type: 'error', message: error.message });
        controller.close();
      } finally {
        // 清理临时文件
        if (tempFilePath) await unlink(tempFilePath).catch(() => {});
        if (wavFilePath) await unlink(wavFilePath).catch(() => {});
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * 流式识别音频
 */
async function recognizeStream(audioPath: string, send: (data: any) => void) {
  const sdk = require('microsoft-cognitiveservices-speech-sdk');
  
  const subscriptionKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {
    throw new Error('请配置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION');
  }

  // 配置 Azure Speech
  const speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, region);
  speechConfig.speechRecognitionLanguage = 'zh-CN';
  speechConfig.outputFormat = sdk.OutputFormat.Detailed;

  const audioConfig = sdk.AudioConfig.fromWavFileInput(
    require('fs').readFileSync(audioPath)
  );

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  return new Promise<void>((resolve, reject) => {
    // 识别中（实时部分结果）
    recognizer.recognizing = (_: any, e: any) => {
      if (e.result.text) {
        send({
          type: 'recognizing',
          text: e.result.text
        });
      }
    };

    // 识别完成（每句话）
    recognizer.recognized = (_: any, e: any) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
        const startTime = e.result.offset / 10000000;
        const duration = e.result.duration / 10000000;
        
        send({
          type: 'segment',
          text: e.result.text.trim(),
          startTime: Number(startTime.toFixed(2)),
          endTime: Number((startTime + duration).toFixed(2))
        });
      }
    };

    // 错误处理
    recognizer.canceled = (_: any, e: any) => {
      if (e.reason === sdk.CancellationReason.Error) {
        recognizer.close();
        reject(new Error(e.errorDetails));
      }
    };

    // 会话结束
    recognizer.sessionStopped = () => {
      recognizer.close();
      resolve();
    };

    // 开始识别
    recognizer.startContinuousRecognitionAsync(
      () => console.log('识别已开始'),
      (err: any) => {
        recognizer.close();
        reject(new Error(err));
      }
    );

    // 5分钟超时
    setTimeout(() => {
      recognizer.stopContinuousRecognitionAsync();
    }, 300000);
  });
}

export const runtime = 'nodejs';
export const maxDuration = 300;

