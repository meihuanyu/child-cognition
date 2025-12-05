'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Youtube, Upload } from 'lucide-react';
import { recognizeAudioFile } from '@/lib/audio-file';

export default function CreateLessonPage() {
  const router = useRouter();
  // const [sourceUrl, setSourceUrl] = useState('https://www.youtube.com/watch?v=mRj1RKh4xyY');
  const [sourceUrl, setSourceUrl] = useState('https://www.youtube.com/watch?v=A_DwH0vpiwU&t=8s');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [serviceStatus, setServiceStatus] = useState<{
    configured: boolean;
    message?: string;
    checked: boolean;
    azure?: { configured: boolean; region?: string };
    audioConverter?: { type: string; description: string };
  }>({ configured: false, checked: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // MVP: 使用固定的用户 ID（生产环境应使用 NextAuth）
  const DEMO_USER_ID = 'demo-user-001';

  // 检查服务状态
  const checkServiceStatus = useCallback(async () => {
    if (serviceStatus.checked) return;
    
    try {
      const response = await fetch('/api/audio/status');
      const data = await response.json();
      setServiceStatus({
        configured: data.configured,
        message: data.message,
        checked: true,
        azure: data.azure,
        audioConverter: data.audioConverter
      });
      
      if (!data.configured) {
        setError(data.message || '服务未就绪');
      }
    } catch (err) {
      console.error('检查服务状态失败:', err);
      setServiceStatus({
        configured: false,
        message: '无法连接到服务器',
        checked: true
      });
    }
  }, [serviceStatus.checked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 验证 URL
      if (!sourceUrl.includes('youtube.com') && !sourceUrl.includes('youtu.be')) {
        setError('请输入有效的 YouTube 链接');
        setIsLoading(false);
        return;
      }

      // 调用 API 创建课程
      const response = await fetch('/api/lessons/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceUrl,
          userId: DEMO_USER_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建课程失败');
      }

      // 跳转到课程详情页
      router.push(`/lesson/${data.lessonId}`);
    } catch (err: any) {
      setError(err.message || '创建课程失败，请重试');
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 验证文件类型
      if (!file.type.startsWith('audio/')) {
        setError('请选择音频文件（MP3、WAV等）');
        return;
      }
      
      // 验证文件大小（50MB）
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('文件太大，请选择小于 50MB 的音频文件');
        return;
      }
      
      setSelectedFile(file);
      setError('');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      setError('请选择音频文件');
      return;
    }

    setError('');
    setIsLoading(true);
    setUploadProgress(0);
    setUploadStatus('准备上传...');

    try {
      // 使用 Azure Speech SDK 识别音频
      setUploadStatus('正在上传音频到服务器...');
      
      const result = await recognizeAudioFile(
        selectedFile,
        {},
        (progress, status) => {
          setUploadProgress(progress);
          setUploadStatus(status);
        }
      );

      if (!result.text || result.text === '未识别到文本') {
        throw new Error('未能识别到有效文本，请确保音频清晰且包含语音内容');
      }

      setUploadStatus('创建课程...');
      
      console.log('识别结果:', result);
      console.log('片段数量:', result.segments?.length);
      
      // 调用 API 创建课程（使用识别的文本和片段）
      const response = await fetch('/api/lessons/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: result.text,
          segments: result.segments, // 包含时间戳的片段
          userId: DEMO_USER_ID,
          sourceType: 'audio',
          fileName: selectedFile.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建课程失败');
      }

      // 跳转到课程详情页
      router.push(`/lesson/${data.lessonId}`);
    } catch (err: any) {
      console.error('音频处理失败:', err);
      
      let errorMessage = err.message || '处理音频文件失败，请重试';
      
      // 提供更友好的错误提示
      if (errorMessage.includes('AZURE_SPEECH')) {
        errorMessage = '服务器未配置 Azure Speech Service。请联系管理员配置 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION 环境变量。';
      } else if (errorMessage.includes('网络') || errorMessage.includes('fetch')) {
        errorMessage = '网络错误，请检查网络连接后重试。';
      }
      
      setError(errorMessage);
      setIsLoading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-2">
              创建新课程
            </CardTitle>
            <CardDescription className="text-base">
              选择 YouTube 视频链接或上传音频文件来生成学习材料
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="youtube" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="youtube" className="flex items-center gap-2">
                  <Youtube className="w-4 h-4" />
                  YouTube 视频
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  上传音频
                </TabsTrigger>
              </TabsList>

              <TabsContent value="youtube" className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="sourceUrl" className="text-base">
                      YouTube 视频链接
                    </Label>
                    <Input
                      id="sourceUrl"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      disabled={isLoading}
                      className="text-base"
                      required
                    />
                    <p className="text-sm text-gray-500">
                      支持标准 YouTube 链接和短链接（youtu.be）
                    </p>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">
                      📝 处理流程说明
                    </h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>提取视频字幕或音频内容</li>
                      <li>自动分段并生成拼音标注</li>
                      <li>添加简易英文释义</li>
                      <li>生成互动学习界面</li>
                    </ol>
                    <p className="text-xs text-blue-700 mt-2">
                      ⏱️ 处理时间约 1-3 分钟，请耐心等待
                    </p>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full text-lg"
                    disabled={isLoading || !sourceUrl}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        正在创建课程...
                      </>
                    ) : (
                      '🚀 开始生成课程'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="audio" className="space-y-6" onClick={checkServiceStatus}>
                <div className="space-y-6">
                  {/* 服务状态提示 */}
                  {serviceStatus.checked && !serviceStatus.configured && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <div className="space-y-2">
                          <div className="font-semibold">{serviceStatus.message}</div>
                          <div className="text-xs mt-2">
                            请参考 <code className="bg-red-100 px-1 rounded">AZURE_SPEECH_SETUP.md</code> 和{' '}
                            <code className="bg-red-100 px-1 rounded">README_AUDIO.md</code> 文档进行配置
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {serviceStatus.checked && serviceStatus.configured && (
                    <Alert className="bg-green-50 border-green-200">
                      <AlertDescription>
                        <div className="text-green-800 space-y-1">
                          <div className="font-semibold">✅ Azure Speech Service 已就绪</div>
                          <div className="text-xs space-y-1">
                            {serviceStatus.azure?.configured && (
                              <div>📍 区域: {serviceStatus.azure.region}</div>
                            )}
                            {serviceStatus.audioConverter && (
                              <div>🎵 音频转换: {serviceStatus.audioConverter.type}</div>
                            )}
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="audioFile" className="text-base">
                      选择音频文件
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="audioFile"
                        type="file"
                        accept="audio/*"
                        onChange={handleFileChange}
                        disabled={isLoading}
                        className="text-base"
                        ref={fileInputRef}
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      支持 MP3、WAV、M4A 等音频格式，最大 50MB
                    </p>
                    {selectedFile && (
                      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-green-900">
                          ✅ 已选择文件
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          📄 {selectedFile.name}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          💾 大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          {' • '}
                          📝 类型: {selectedFile.type || '未知'}
                        </p>
                      </div>
                    )}
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {uploadStatus && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{uploadStatus}</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-900 mb-2">
                      🎤 音频识别说明
                    </h4>
                    <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside">
                      <li>使用 Azure Speech SDK 进行云端语音识别</li>
                      <li>自动识别音频中的中文内容（支持多语言）</li>
                      <li>获取精确的时间戳和分句结果</li>
                      <li>自动生成拼音和英文释义</li>
                      <li>创建互动学习界面</li>
                    </ol>
                    <p className="text-xs text-purple-700 mt-2">
                      ⏱️ 识别速度快，通常几十秒即可完成
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    className="w-full text-lg"
                    onClick={handleFileUpload}
                    disabled={isLoading || !selectedFile}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {uploadStatus || '处理中...'}
                      </>
                    ) : (
                      '🎵 上传并识别音频'
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Demo Links */}
            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-gray-600 mb-3">
                💡 没有合适的视频？试试这些示例：
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                  className="text-sm text-blue-600 hover:underline block"
                  disabled={isLoading}
                >
                  示例 1: 儿童中文学习视频
                </button>
                <button
                  type="button"
                  onClick={() => setSourceUrl('https://www.youtube.com/watch?v=example123')}
                  className="text-sm text-blue-600 hover:underline block"
                  disabled={isLoading}
                >
                  示例 2: 英文跟读练习
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

