import { Injectable } from '@nestjs/common';
import {
  CATEGORY_KEYWORDS,
  CategoryType,
  DEFAULT_CATEGORY,
  ALL_CATEGORIES,
} from '../category.constants';
import {
  NGRAM_KEYWORDS,
  KEYWORD_WEIGHTS,
  NEGATIVE_KEYWORDS,
  AMOUNT_HINTS,
  VIETNAMESE_NORMALIZATIONS,
} from '../enhanced-keywords.constants';

interface PredictResult {
  category: string;
  confidence: number;
}

@Injectable()
export class EnhancedKeywordClassifierService {
  private normalizedKeywordsCache: Map<CategoryType, string[]> = new Map();
  private ngramKeywordsNormalized: Array<{
    phrase: string;
    category: CategoryType;
    weight: number;
  }> = [];

  constructor() {
    this.initializeCache();
  }

  private initializeCache(): void {
    for (const category of ALL_CATEGORIES) {
      const keywords = CATEGORY_KEYWORDS[category] || [];
      this.normalizedKeywordsCache.set(
        category,
        keywords.map((k) => this.normalizeText(k)),
      );
    }

    this.ngramKeywordsNormalized = NGRAM_KEYWORDS.map((ng) => ({
      ...ng,
      phrase: this.normalizeText(ng.phrase),
    }));
  }

  private normalizeText(text: string): string {
    if (!text) return '';
    let normalized = text.toLowerCase().trim();

    for (const [from, to] of Object.entries(VIETNAMESE_NORMALIZATIONS)) {
      const regex = new RegExp(`\\b${this.escapeRegex(from)}\\b`, 'gi');
      normalized = normalized.replace(regex, to);
    }

    normalized = normalized.replace(
      /[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi,
      ' ',
    );
    return normalized.replace(/\s+/g, ' ').trim();
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private checkNgramMatch(text: string): PredictResult | null {
    const normalizedText = this.normalizeText(text);
    let bestMatch: PredictResult | null = null;
    let bestWeight = 0;

    for (const ngram of this.ngramKeywordsNormalized) {
      if (normalizedText.includes(ngram.phrase) && ngram.weight > bestWeight) {
        bestWeight = ngram.weight;
        bestMatch = {
          category: ngram.category,
          confidence: Math.min(ngram.weight, 1),
        };
      }
    }
    return bestMatch;
  }

  private getExcludedCategories(text: string): Set<CategoryType> {
    const normalizedText = this.normalizeText(text);
    const excluded = new Set<CategoryType>();

    for (const neg of NEGATIVE_KEYWORDS) {
      if (normalizedText.includes(this.normalizeText(neg.keyword))) {
        neg.excludeFrom.forEach((cat) => excluded.add(cat));
      }
    }
    return excluded;
  }

  private getAmountHints(amount?: number): {
    likely: Set<CategoryType>;
    unlikely: Set<CategoryType>;
    boost: number;
  } {
    if (!amount || amount <= 0) {
      return { likely: new Set(), unlikely: new Set(), boost: 1.0 };
    }

    for (const hint of AMOUNT_HINTS) {
      if (amount >= hint.min && amount < hint.max) {
        return {
          likely: new Set(hint.likely),
          unlikely: new Set(hint.unlikely),
          boost: hint.boost,
        };
      }
    }
    return { likely: new Set(), unlikely: new Set(), boost: 1.0 };
  }

  private calculateBaseScore(text: string, category: CategoryType): number {
    const normalizedText = this.normalizeText(text);
    const keywords = this.normalizedKeywordsCache.get(category) || [];
    if (keywords.length === 0) return 0;

    let totalScore = 0;
    let matchedKeywords = 0;
    let maxKeywordScore = 0;
    const words = normalizedText.split(' ');

    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        matchedKeywords++;
        const lengthBonus = Math.min(keyword.length / 3, 5);
        const exactBonus = words.includes(keyword) ? 3 : 1.5;
        const weight = KEYWORD_WEIGHTS[keyword] ?? 1.0;
        const keywordScore = lengthBonus * exactBonus * weight;
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

    // Check N-gram match first
    const ngramMatch = this.checkNgramMatch(note);
    if (ngramMatch && ngramMatch.confidence >= 0.9) {
      return ngramMatch;
    }

    const excludedCategories = this.getExcludedCategories(note);
    const amountHints = this.getAmountHints(amount);

    // Calculate scores
    const scores = ALL_CATEGORIES.map((category) => {
      if (excludedCategories.has(category)) return { category, confidence: 0 };

      let score = this.calculateBaseScore(note, category);
      if (amountHints.unlikely.has(category)) score *= 0.5;
      if (amountHints.likely.has(category) && score > 0) score *= amountHints.boost;

      return { category, confidence: score };
    })
      .filter((s) => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    // Combine with ngram if exists
    if (ngramMatch) {
      const idx = scores.findIndex((s) => s.category === ngramMatch.category);
      if (idx >= 0) {
        scores[idx].confidence = Math.max(scores[idx].confidence, ngramMatch.confidence);
        scores.sort((a, b) => b.confidence - a.confidence);
      } else {
        scores.unshift({ category: ngramMatch.category as CategoryType, confidence: ngramMatch.confidence });
      }
    }

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
