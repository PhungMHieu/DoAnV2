import { Injectable, Logger } from '@nestjs/common';
import {
  CATEGORY_KEYWORDS,
  CategoryType,
  DEFAULT_CATEGORY,
  ALL_CATEGORIES,
} from '../category.constants';

/**
 * Keyword-based classifier
 * Phiên bản đơn giản sử dụng keyword matching để bootstrap hệ thống
 * Sau này sẽ thay bằng ML model (PhoBERT, etc.)
 */
@Injectable()
export class KeywordClassifierService {
  private readonly logger = new Logger(KeywordClassifierService.name);

  /**
   * Normalize Vietnamese text cho việc matching
   * - Chuyển về lowercase
   * - Loại bỏ dấu tiếng Việt (optional)
   * - Loại bỏ ký tự đặc biệt
   */
  private normalizeText(text: string): string {
    if (!text) return '';

    // Chuyển lowercase
    let normalized = text.toLowerCase().trim();

    // Loại bỏ các ký tự đặc biệt nhưng giữ dấu tiếng Việt
    normalized = normalized.replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, ' ');

    // Loại bỏ khoảng trắng thừa
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Tính điểm matching cho một category dựa trên keywords
   */
  private calculateCategoryScore(text: string, category: CategoryType): number {
    const normalizedText = this.normalizeText(text);
    const keywords = CATEGORY_KEYWORDS[category];

    if (!keywords || keywords.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let matchedKeywords = 0;
    let maxKeywordScore = 0;

    for (const keyword of keywords) {
      const normalizedKeyword = this.normalizeText(keyword);

      if (normalizedText.includes(normalizedKeyword)) {
        matchedKeywords++;

        // Tính điểm dựa trên độ dài keyword (keyword dài hơn = specific hơn = điểm cao hơn)
        const keywordLength = normalizedKeyword.length;
        const lengthBonus = Math.min(keywordLength / 3, 5); // max bonus = 5x

        // Exact match vs substring
        const words = normalizedText.split(' ');
        const isExactMatch = words.includes(normalizedKeyword);
        const exactBonus = isExactMatch ? 3 : 1.5;

        const keywordScore = lengthBonus * exactBonus;
        totalScore += keywordScore;
        maxKeywordScore = Math.max(maxKeywordScore, keywordScore);
      }
    }

    // Nếu không có match nào
    if (matchedKeywords === 0) {
      return 0;
    }

    // Base score từ average của matched keywords
    const avgScore = totalScore / matchedKeywords;

    // Bonus nếu match nhiều keywords (nhưng không quá phụ thuộc vào coverage)
    const coverageBonus = Math.min(matchedKeywords / 5, 1); // Tối đa khi match 5+ keywords

    // Final score: 60% từ best match, 30% từ average, 10% từ coverage
    const finalScore = (maxKeywordScore * 0.6) + (avgScore * 0.3) + (coverageBonus * 0.1);

    // Normalize về [0, 1]
    return Math.min(finalScore / 10, 1);
  }

  /**
   * Predict category từ transaction note
   */
  predict(note: string, amount?: number): {
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
  } {
    if (!note || note.trim().length === 0) {
      this.logger.warn('Empty note provided for prediction');
      return {
        category: DEFAULT_CATEGORY,
        confidence: 0.1,
        suggestions: [{ category: DEFAULT_CATEGORY, confidence: 0.1 }],
      };
    }

    // Tính điểm cho tất cả categories
    const scores = ALL_CATEGORIES.map((category) => ({
      category,
      confidence: this.calculateCategoryScore(note, category),
    }))
      .filter(s => s.confidence > 0) // Chỉ giữ categories có match
      .sort((a, b) => b.confidence - a.confidence); // Sort theo confidence

    // Nếu không có match nào
    if (scores.length === 0 || scores[0].confidence < 0.05) {
      this.logger.debug(`No strong match found for note: "${note}"`);
      return {
        category: DEFAULT_CATEGORY,
        confidence: 0.2,
        suggestions: [
          { category: DEFAULT_CATEGORY, confidence: 0.2 },
          ...scores.slice(0, 2),
        ],
      };
    }

    // Normalize confidences để tổng = 1
    const totalConfidence = scores.reduce((sum, s) => sum + s.confidence, 0);
    const normalizedScores = scores.map(s => ({
      category: s.category,
      confidence: parseFloat((s.confidence / totalConfidence).toFixed(4)),
    }));

    // Lấy top category
    const topPrediction = normalizedScores[0];

    this.logger.debug(
      `Predicted "${topPrediction.category}" (${(topPrediction.confidence * 100).toFixed(1)}%) for note: "${note}"`,
    );

    return {
      category: topPrediction.category,
      confidence: topPrediction.confidence,
      suggestions: normalizedScores.slice(0, 5), // Top 5 suggestions
    };
  }

  /**
   * Batch prediction cho nhiều transactions
   */
  batchPredict(
    transactions: Array<{ note: string; amount?: number }>,
  ): Array<{
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
  }> {
    return transactions.map((t) => this.predict(t.note, t.amount));
  }
}
