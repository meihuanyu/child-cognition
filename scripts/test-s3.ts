/**
 * S3 上传下载测试脚本
 * 
 * 运行方式:
 * npx tsx scripts/test-s3.ts
 */

// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { uploadToS3, downloadFromS3, getPresignedUrl } from '../lib/s3';

async function main() {
  console.log('=== S3 上传下载测试 ===\n');

  // 1. 创建测试文件
  console.log('1. 创建测试文件...');
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const testFilePath = path.join(tempDir, 'test.txt');
  const testContent = `测试文件\n创建时间: ${new Date().toISOString()}\n这是一个 S3 上传下载测试`;
  fs.writeFileSync(testFilePath, testContent, 'utf-8');
  console.log(`✅ 测试文件已创建: ${testFilePath}\n`);

  // 2. 上传到 S3
  console.log('2. 上传文件到 S3...');
  const s3Key = `test/test-${Date.now()}.txt`;
  try {
    const uploadUrl = await uploadToS3(testFilePath, s3Key, 'text/plain');
    console.log(`✅ 上传成功!`);
    console.log(`   S3 Key: ${s3Key}`);
    console.log(`   URL: ${uploadUrl}\n`);

    // 3. 获取预签名 URL
    console.log('3. 获取预签名 URL...');
    const presignedUrl = await getPresignedUrl(s3Key, 3600);
    console.log(`✅ 预签名 URL 已生成（1小时有效）:`);
    console.log(`   ${presignedUrl}\n`);

    // 4. 从 S3 下载
    console.log('4. 从 S3 下载文件...');
    const downloadPath = path.join(tempDir, 'downloaded-test.txt');
    await downloadFromS3(s3Key, downloadPath);
    console.log(`✅ 下载成功: ${downloadPath}\n`);

    // 5. 验证内容
    console.log('5. 验证下载内容...');
    const downloadedContent = fs.readFileSync(downloadPath, 'utf-8');
    if (downloadedContent === testContent) {
      console.log('✅ 内容验证成功！上传和下载的内容一致\n');
    } else {
      console.log('❌ 内容验证失败！上传和下载的内容不一致\n');
    }

    // 6. 显示文件内容
    console.log('6. 下载的文件内容:');
    console.log('-------------------');
    console.log(downloadedContent);
    console.log('-------------------\n');

    // 清理本地文件
    console.log('7. 清理本地临时文件...');
    fs.unlinkSync(testFilePath);
    fs.unlinkSync(downloadPath);
    console.log('✅ 本地临时文件已清理\n');

    console.log('=== 测试完成 ===');
    console.log(`注意: S3 上的文件 (${s3Key}) 未删除，如需删除请手动操作`);

  } catch (error: any) {
    console.error('❌ 测试失败:', error.message);
    
    // 清理文件
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    process.exit(1);
  }
}

// 运行测试
main().catch(console.error);

