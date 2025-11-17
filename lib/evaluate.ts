import levenshtein from 'fast-levenshtein';

/**
 * 评分算法 - 比较原文和用户跟读的相似度
 * 返回三档反馈: "GOOD" | "OK" | "RETRY"
 */
export function evaluateTranscript(
  original: string,
  userTranscript: string
): "GOOD" | "OK" | "RETRY" {
  // 如果用户没有输入或识别失败
  if (!userTranscript || userTranscript.trim() === "") {
    return "RETRY";
  }

  // 标准化文本（去除空格、标点，转小写）
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, "") // 保留中文、英文、数字
      .replace(/\s+/g, "");
  };

  const normalizedOriginal = normalizeText(original);
  const normalizedUser = normalizeText(userTranscript);

  // 完全匹配
  if (normalizedOriginal === normalizedUser) {
    return "GOOD";
  }

  // 计算 Levenshtein 距离
  const distance = levenshtein.get(normalizedOriginal, normalizedUser);
  const maxLength = Math.max(normalizedOriginal.length, normalizedUser.length);
  
  // 相似度百分比
  const similarity = maxLength > 0 ? (1 - distance / maxLength) * 100 : 0;

  // 根据相似度返回评级
  if (similarity >= 70) {
    return "GOOD";
  } else if (similarity >= 30) {
    return "OK";
  } else {
    return "RETRY";
  }
}

/**
 * 获取反馈文本和表情
 */
export function getFeedbackMessage(rating: "GOOD" | "OK" | "RETRY") {
  switch (rating) {
    case "GOOD":
      return {
        emoji: "👍",
        title: "很棒！",
        message: "你读得非常好！继续保持！",
        color: "text-green-600",
      };
    case "OK":
      return {
        emoji: "🙂",
        title: "不错！",
        message: "再来一次，你会更好的！",
        color: "text-yellow-600",
      };
    case "RETRY":
      return {
        emoji: "🔁",
        title: "再试一次",
        message: "让老师再示范一遍吧！",
        color: "text-blue-600",
      };
  }
}

