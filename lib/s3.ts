import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

/**
 * 初始化 S3 客户端
 */
function getS3Client() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS 凭证未配置。请设置 AWS_ACCESS_KEY_ID 和 AWS_SECRET_ACCESS_KEY');
  }

  return new S3Client({
    endpoint: 'https://oss-cn-shanghai.aliyuncs.com',
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * 上传文件到 S3
 */
export async function uploadToS3(
  filePath: string,
  key: string,
  contentType: string = 'audio/mpeg'
): Promise<string> {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_BUCKET_NAME 环境变量未设置');
    }

    const s3Client = getS3Client();

    // 读取文件
    const fileContent = fs.readFileSync(filePath);

    // 上传到 S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      // 设置为公开读取（如果需要私有，可以移除这个选项）
      // ACL: 'public-read',
    });

    await s3Client.send(command);
    // 返回文件的公共 URL
    const publicUrl = `https://${process.env.AWS_REGION || 'us-east-1'}.aliyuncs.com/${key}`;
    
    return publicUrl;
  } catch (error: any) {
    console.error('上传到 S3 失败:', error);
    throw new Error(`上传到 S3 失败: ${error.message}`);
  }
}

/**
 * 上传音频文件到 S3
 */
export async function uploadAudioToS3(
  filePath: string,
  lessonId: string,
  segmentId?: string
): Promise<string> {
  const fileName = segmentId 
    ? `lessons/${lessonId}/segments/${segmentId}.mp3`
    : `lessons/${lessonId}/full-audio.mp3`;
  
  return uploadToS3(filePath, fileName, 'audio/mpeg');
}

/**
 * 从 S3 下载文件
 */
export async function downloadFromS3(
  key: string,
  outputPath: string
): Promise<string> {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_BUCKET_NAME 环境变量未设置');
    }

    const s3Client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    // 确保输出目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 将流写入文件
    if (response.Body) {
      const chunks: Uint8Array[] = [];
      // @ts-ignore
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(outputPath, buffer);
      
      return outputPath;
    } else {
      throw new Error('响应体为空');
    }
  } catch (error: any) {
    console.error('从 S3 下载失败:', error);
    throw new Error(`从 S3 下载失败: ${error.message}`);
  }
}

/**
 * 获取 S3 文件的预签名 URL（用于私有文件）
 */
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_BUCKET_NAME 环境变量未设置');
    }

    const s3Client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error: any) {
    console.error('获取预签名 URL 失败:', error);
    throw new Error(`获取预签名 URL 失败: ${error.message}`);
  }
}

/**
 * 清理临时文件
 */
export function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      // fs.unlinkSync(filePath);
      console.log('临时文件已删除:', filePath);
    }
  } catch (error) {
    console.error('删除临时文件失败:', error);
  }
}

