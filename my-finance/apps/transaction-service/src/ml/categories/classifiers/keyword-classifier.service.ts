import { Injectable } from '@nestjs/common';
import {
  CATEGORY_KEYWORDS,
  CategoryType,
  DEFAULT_CATEGORY,
  ALL_CATEGORIES,
} from '../category.constants';

interface PredictResult {
  category: string;
  confidence: number;
}

@Injectable()
export class KeywordClassifierService {
  private normalizeText(text: string): string {
    if (!text) return '';
    let normalized = text.toLowerCase().trim();
    normalized = normalized.replace(
      /[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi,
      ' ',
    );
    return normalized.replace(/\s+/g, ' ').trim();
  }

  private calculateCategoryScore(text: string, category: CategoryType): number {
    const normalizedText = this.normalizeText(text);
    const keywords = CATEGORY_KEYWORDS[category];
    if (!keywords || keywords.length === 0) return 0;

    let totalScore = 0;
    let matchedKeywords = 0;
    let maxKeywordScore = 0;

    for (const keyword of keywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      if (normalizedText.includes(normalizedKeyword)) {
        matchedKeywords++;
        const lengthBonus = Math.min(normalizedKeyword.length / 3, 5);
        const words = normalizedText.split(' ');
        const exactBonus = words.includes(normalizedKeyword) ? 3 : 1.5;
        const keywordScore = lengthBonus * exactBonus;
        totalScore += keywordScore;
        maxKeywordScore = Math.max(maxKeywordScore, keywordScore);
      }
    }

    if (matchedKeywords === 0) return 0;

    const avgScore = totalScore / matchedKeywords;
    const coverageBonus = Math.min(matchedKeywords / 5, 1);
    return Math.min((maxKeywordScore * 0.6 + avgScore * 0.3 + coverageBonus * 0.1) / 10, 1);
  }

  predict(note: string, amount?: number): PredictResult {
    if (!note?.trim()) {
      return { category: DEFAULT_CATEGORY, confidence: 0.1 };
    }

    const scores = ALL_CATEGORIES.map((category) => ({
      category,
      confidence: this.calculateCategoryScore(note, category),
    }))
      .filter((s) => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    if (scores.length === 0 || scores[0].confidence < 0.05) {
      return { category: DEFAULT_CATEGORY, confidence: 0.2 };
    }

    const total = scores.reduce((sum, s) => sum + s.confidence, 0);
    return {
      category: scores[0].category,
      confidence: scores[0].confidence / total,
    };
  }
}
