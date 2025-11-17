/**
 * 火山引擎机器翻译 API 集成
 * 用于将英文字幕翻译成中文
 * 文档: https://www.volcengine.com/docs/4640/65067
 */

import crypto from 'crypto';

// 火山引擎 API 配置
const SERVICE = 'translate';
const VERSION = '2020-06-01';
const REGION = 'cn-north-1';
const HOST = 'open.volcengineapi.com';
const API_ENDPOINT = `https://${HOST}`;
const ACTION = 'TranslateText';

interface VolcEngineConfig {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * 获取火山引擎配置
 */
function getVolcEngineConfig(): VolcEngineConfig | null {
  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VOLCENGINE_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return { accessKeyId, secretAccessKey };
}

/**
 * 生成火山引擎 API v4 签名
 */
function generateSignature(
  config: VolcEngineConfig,
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  body: string
): string {
  // 1. 构建 Canonical Request
  const sortedQuery = Object.keys(query)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');

  const sortedHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
    .join('\n');

  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

  const hashedPayload = crypto
    .createHash('sha256')
    .update(body)
    .digest('hex');

  const canonicalRequest = [
    method,
    path,
    sortedQuery,
    sortedHeaders,
    '',
    signedHeaders,
    hashedPayload,
  ].join('\n');

  // 2. 构建 String to Sign
  const hashedCanonicalRequest = crypto
    .createHash('sha256')
    .update(canonicalRequest)
    .digest('hex');

  const date = headers['X-Date'];
  const credentialScope = `${date.split('T')[0]}/${REGION}/${SERVICE}/request`;

  const stringToSign = [
    'HMAC-SHA256',
    date,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  // 3. 计算签名
  const kDate = crypto
    .createHmac('sha256', config.secretAccessKey)
    .update(date.split('T')[0])
    .digest();

  const kRegion = crypto
    .createHmac('sha256', kDate)
    .update(REGION)
    .digest();

  const kService = crypto
    .createHmac('sha256', kRegion)
    .update(SERVICE)
    .digest();

  const kSigning = crypto
    .createHmac('sha256', kService)
    .update('request')
    .digest();

  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign)
    .digest('hex');

  return signature;
}

const MAX_TEXTS_PER_REQUEST = 10;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * 调用火山引擎翻译 API
 */
async function callVolcEngineAPI(
  config: VolcEngineConfig,
  textList: string[],
  sourceLanguage: string,
  targetLanguage: string
): Promise<string[]> {
  const method = 'POST';
  const path = '/';

  // 构建请求体
  const body = JSON.stringify({
    TextList: textList,
    SourceLanguage: sourceLanguage,
    TargetLanguage: targetLanguage,
  });

  // 构建查询参数
  const query: Record<string, string> = {
    Action: ACTION,
    Version: VERSION,
  };

  // 构建请求头
  const now = new Date();
  const xDate = now.toISOString().replace(/\.\d{3}Z/, 'Z').replace(/[-:]/g, '');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Host': HOST,
    'X-Date': xDate,
  };

  // 生成签名
  const signature = generateSignature(config, method, path, query, headers, body);

  // 构建 Authorization 头
  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');

  const credentialScope = `${xDate.split('T')[0]}/${REGION}/${SERVICE}/request`;
  
  headers['Authorization'] = [
    'HMAC-SHA256',
    `Credential=${config.accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  // 发送请求
  const queryString = Object.keys(query)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');

  const url = `${API_ENDPOINT}${path}?${queryString}`;

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`火山引擎 API 调用失败: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // 检查响应格式
  if (result.ResponseMetadata?.Error) {
    throw new Error(
      `火山引擎 API 错误: ${result.ResponseMetadata.Error.Code} - ${result.ResponseMetadata.Error.Message}`
    );
  }

  if (!result.TranslationList || !Array.isArray(result.TranslationList)) {
    throw new Error('火山引擎 API 返回格式错误');
  }

  // 提取翻译结果
  return result.TranslationList.map((item: any) => item.Translation || '');
}

/**
 * 将英文翻译成中文
 * @param text 英文文本
 * @returns 中文翻译
 */
export async function translateToZh(text: string): Promise<string> {
  try {
    const config = getVolcEngineConfig();

    // 如果没有配置 API，使用简单的占位符
    if (!config) {
      console.log(`翻译（占位符模式）: ${text}`);
      return `[翻译: ${text}]`;
    }

    const results = await callVolcEngineAPI(config, [text], 'en', 'zh');
    return results[0] || text;
  } catch (error: any) {
    console.error('翻译失败:', error);
    // 翻译失败时返回占位符
    return `[翻译失败: ${text}]`;
  }
}

/**
 * 批量翻译（优化性能）
 * @param texts 英文文本数组
 * @returns 中文翻译数组
 */
export async function batchTranslateToZh(texts: string[]): Promise<string[]> {
  try {
    const config = getVolcEngineConfig();

    // 如果没有配置 API，使用简单的占位符
    if (!config) {
      console.log(`批量翻译（占位符模式）: ${texts.length} 条`);
      return texts.map(text => `[翻译: ${text}]`);
    }
    
    const chunks = chunkArray(texts, MAX_TEXTS_PER_REQUEST);
    const translated: string[] = [];

    for (const chunk of chunks) {
      const chunkResults = await callVolcEngineAPI(config, chunk, 'en', 'zh');

      if (chunkResults.length !== chunk.length) {
        console.warn(
          `翻译结果数量不匹配: 期望 ${chunk.length}，实际 ${chunkResults.length}`
        );
        translated.push(
          ...chunk.map((text, i) => chunkResults[i] || `[翻译失败: ${text}]`)
        );
      } else {
        translated.push(...chunkResults);
      }
    }

    return translated;
  } catch (error: any) {
    console.error('批量翻译失败:', error);
    // 翻译失败时返回占位符
    return texts.map(text => `[翻译失败: ${text}]`);
  }
}
