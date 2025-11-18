import { NextRequest, NextResponse } from 'next/server';
import { pinyin } from 'pinyin-pro';

interface WordSegment {
  word: string;
  pinyin: string;
}

// 延迟初始化jieba实例（使用默认字典）
let jiebaInstance: any | null = null;

async function getJieba() {
  if (!jiebaInstance) {
    try {
      // 动态导入 @node-rs/jieba 模块，避免在路由注册时初始化失败
      const { Jieba } = await import('@node-rs/jieba');
      const { dict } = await import('@node-rs/jieba/dict');
      jiebaInstance = Jieba.withDict(dict);
    } catch (error) {
      console.error('初始化 jieba 失败:', error);
      throw new Error('分词模块初始化失败，请稍后重试');
    }
  }
  return jiebaInstance;
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    console.log("text", text)
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的文本' },
        { status: 400 }
      );
    }

    // 获取jieba实例（动态导入）
    const jieba = await getJieba();
    
    // 使用@node-rs/jieba进行分词
    // 第二个参数hmm=false表示不使用HMM模型（更精确的分词）
    const words = jieba.cut(text, false);
    // 处理分词结果：保留中文词和标点符号，但分别处理
    const wordSegments: WordSegment[] = [];

    for (const word of words) {
      const trimmedWord = word.trim();
      if (trimmedWord.length === 0) continue;

      // 检查是否包含中文字符
      if (/[\u4e00-\u9fa5]/.test(trimmedWord)) {
        // 包含中文，生成拼音
        const wordPinyin = pinyin(trimmedWord, {
          toneType: 'symbol',
          type: 'all',
        }) as Array<{ pinyin: string; origin: string }>;

        // 将每个字符的拼音连接起来，用空格分隔
        const pinyinStr = wordPinyin
          .map((item) => item.pinyin || item.origin)
          .join(' ');

        wordSegments.push({
          word: trimmedWord,
          pinyin: pinyinStr,
        });
      } else {
        // 纯标点符号或空格，也显示但不生成拼音
        wordSegments.push({
          word: trimmedWord,
          pinyin: '',
        });
      }
    }

    return NextResponse.json({
      success: true,
      segments: wordSegments,
    });
  } catch (error: any) {
    console.error('分词失败:', error);
    return NextResponse.json(
      {
        error: '分词失败',
        message: error.message || '未知错误',
      },
      { status: 500 }
    );
  }
}

