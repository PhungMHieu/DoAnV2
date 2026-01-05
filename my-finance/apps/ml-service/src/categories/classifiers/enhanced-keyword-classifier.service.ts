import { Injectable, Logger } from '@nestjs/common';
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

/**
 * Enhanced Keyword Classifier với:
 * - N-gram matching (bigram, trigram)
 * - Keyword weighting
 * - Vietnamese text normalization
 * - Negative keywords
 * - Amount range hints
 */
@Injectable()
export class EnhancedKeywordClassifierService {
  private readonly logger = new Logger(EnhancedKeywordClassifierService.name);

  // Cache normalized keywords để tăng performance
  private normalizedKeywordsCache: Map<CategoryType, string[]> = new Map();
  private ngramKeywordsNormalized: Array<{
    phrase: string;
    category: CategoryType;
    weight: number;
  }> = [];

  constructor() {
    this.initializeCache();
  }

  /**
   * Initialize cache khi service khởi động
   */
  private initializeCache(): void {
    // Cache normalized category keywords
    for (const category of ALL_CATEGORIES) {
      const keywords = CATEGORY_KEYWORDS[category] || [];
      const normalized = keywords.map((k) => this.normalizeText(k));
      this.normalizedKeywordsCache.set(category, normalized);
    }

    // Cache normalized n-gram keywords
    this.ngramKeywordsNormalized = NGRAM_KEYWORDS.map((ng) => ({
      ...ng,
      phrase: this.normalizeText(ng.phrase),
    }));

    this.logger.log(
      `Initialized cache: ${ALL_CATEGORIES.length} categories, ${NGRAM_KEYWORDS.length} n-grams`,
    );
  }

  /**
   * Normalize Vietnamese text
   * - Lowercase
   * - Chuẩn hóa teencode, typos
   * - Giữ dấu tiếng Việt
   * - Loại bỏ ký tự đặc biệt
   */
  private normalizeText(text: string): string {
    if (!text) return '';

    // Chuyển lowercase
    let normalized = text.toLowerCase().trim();

    // Áp dụng Vietnamese normalizations (teencode, typos)
    for (const [from, to] of Object.entries(VIETNAMESE_NORMALIZATIONS)) {
      // Chỉ replace khi là từ độc lập (word boundary)
      const regex = new RegExp(`\\b${this.escapeRegex(from)}\\b`, 'gi');
      normalized = normalized.replace(regex, to);
    }

    // Loại bỏ các ký tự đặc biệt nhưng giữ dấu tiếng Việt
    normalized = normalized.replace(
      /[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi,
      ' ',
    );

    // Loại bỏ khoảng trắng thừa
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check N-gram matches (ưu tiên cao nhất)
   * Trả về best match hoặc null
   */
  private checkNgramMatch(
    text: string,
  ): { category: CategoryType; confidence: number } | null {
    const normalizedText = this.normalizeText(text);

    let bestMatch: { category: CategoryType; confidence: number } | null = null;
    let bestWeight = 0;

    for (const ngram of this.ngramKeywordsNormalized) {
      if (normalizedText.includes(ngram.phrase)) {
        if (ngram.weight > bestWeight) {
          bestWeight = ngram.weight;
          bestMatch = {
            category: ngram.category,
            confidence: Math.min(ngram.weight, 1),
          };
        }
      }
    }

    if (bestMatch) {
      this.logger.debug(
        `N-gram match: "${bestMatch.category}" (${bestMatch.confidence}) for "${text}"`,
      );
    }

    return bestMatch;
  }

  /**
   * Check negative keywords để loại trừ categories
   */
  private getExcludedCategories(text: string): Set<CategoryType> {
    const normalizedText = this.normalizeText(text);
    const excluded = new Set<CategoryType>();

    for (const neg of NEGATIVE_KEYWORDS) {
      const normalizedKeyword = this.normalizeText(neg.keyword);
      if (normalizedText.includes(normalizedKeyword)) {
        neg.excludeFrom.forEach((cat) => excluded.add(cat));
      }
    }

    if (excluded.size > 0) {
      this.logger.debug(`Excluded categories: ${Array.from(excluded).join(', ')}`);
    }

    return excluded;
  }

  /**
   * Get amount-based hints
   */
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

  /**
   * Get keyword weight
   */
  private getKeywordWeight(keyword: string): number {
    const normalizedKeyword = this.normalizeText(keyword);
    return KEYWORD_WEIGHTS[normalizedKeyword] ?? 1.0;
  }

  /**
   * Tính điểm matching cho một category
   */
  private calculateCategoryScore(
    text: string,
    category: CategoryType,
    excludedCategories: Set<CategoryType>,
    amountHints: { likely: Set<CategoryType>; unlikely: Set<CategoryType>; boost: number },
  ): number {
    // Nếu category bị loại trừ bởi negative keywords
    if (excludedCategories.has(category)) {
      return 0;
    }

    // Nếu amount hints cho thấy unlikely
    if (amountHints.unlikely.has(category)) {
      // Giảm 50% score
      return this.calculateBaseScore(text, category) * 0.5;
    }

    let score = this.calculateBaseScore(text, category);

    // Boost nếu amount hints cho thấy likely
    if (amountHints.likely.has(category) && score > 0) {
      score *= amountHints.boost;
    }

    return score;
  }

  /**
   * Tính base score (không có amount hints)
   */
  private calculateBaseScore(text: string, category: CategoryType): number {
    const normalizedText = this.normalizeText(text);
    const keywords = this.normalizedKeywordsCache.get(category) || [];

    if (keywords.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let matchedKeywords = 0;
    let maxKeywordScore = 0;

    const words = normalizedText.split(' ');

    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        matchedKeywords++;

        // Base score từ độ dài keyword
        const lengthBonus = Math.min(keyword.length / 3, 5);

        // Exact match bonus
        const isExactMatch = words.includes(keyword);
        const exactBonus = isExactMatch ? 3 : 1.5;

        // Keyword weight
        const weight = this.getKeywordWeight(keyword);

        const keywordScore = lengthBonus * exactBonus * weight;
        totalScore += keywordScore;
        maxKeywordScore = Math.max(maxKeywordScore, keywordScore);
      }
    }

    if (matchedKeywords === 0) {
      return 0;
    }

    // Average score
    const avgScore = totalScore / matchedKeywords;

    // Coverage bonus
    const coverageBonus = Math.min(matchedKeywords / 5, 1);

    // Final: 60% best + 30% avg + 10% coverage
    const finalScore = maxKeywordScore * 0.6 + avgScore * 0.3 + coverageBonus * 0.1;

    // Normalize về [0, 1]
    return Math.min(finalScore / 10, 1);
  }

  /**
   * Main prediction method
   */
  predict(
    note: string,
    amount?: number,
  ): {
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
    model: string;
  } {
    if (!note || note.trim().length === 0) {
      this.logger.warn('Empty note provided for prediction');
      return {
        category: DEFAULT_CATEGORY,
        confidence: 0.1,
        suggestions: [{ category: DEFAULT_CATEGORY, confidence: 0.1 }],
        model: 'enhanced-keyword-v1',
      };
    }

    // Step 1: Check N-gram match (highest priority)
    const ngramMatch = this.checkNgramMatch(note);
    if (ngramMatch && ngramMatch.confidence >= 0.9) {
      this.logger.debug(`High confidence n-gram match for "${note}"`);
      return {
        category: ngramMatch.category,
        confidence: ngramMatch.confidence,
        suggestions: [
          { category: ngramMatch.category, confidence: ngramMatch.confidence },
        ],
        model: 'enhanced-keyword-v1-ngram',
      };
    }

    // Step 2: Get excluded categories
    const excludedCategories = this.getExcludedCategories(note);

    // Step 3: Get amount hints
    const amountHints = this.getAmountHints(amount);

    // Step 4: Calculate scores for all categories
    const scores = ALL_CATEGORIES.map((category) => ({
      category,
      confidence: this.calculateCategoryScore(
        note,
        category,
        excludedCategories,
        amountHints,
      ),
    }))
      .filter((s) => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    // Step 5: Combine with n-gram match if exists
    if (ngramMatch) {
      // Boost n-gram category trong scores
      const ngramIndex = scores.findIndex((s) => s.category === ngramMatch.category);
      if (ngramIndex >= 0) {
        scores[ngramIndex].confidence = Math.max(
          scores[ngramIndex].confidence,
          ngramMatch.confidence,
        );
        // Re-sort
        scores.sort((a, b) => b.confidence - a.confidence);
      } else {
        scores.unshift(ngramMatch);
      }
    }

    // Step 6: Handle no matches
    if (scores.length === 0 || scores[0].confidence < 0.05) {
      this.logger.debug(`No strong match found for note: "${note}"`);
      return {
        category: DEFAULT_CATEGORY,
        confidence: 0.2,
        suggestions: [
          { category: DEFAULT_CATEGORY, confidence: 0.2 },
          ...scores.slice(0, 2),
        ],
        model: 'enhanced-keyword-v1',
      };
    }

    // Step 7: Normalize confidences
    const totalConfidence = scores.reduce((sum, s) => sum + s.confidence, 0);
    const normalizedScores = scores.map((s) => ({
      category: s.category,
      confidence: parseFloat((s.confidence / totalConfidence).toFixed(4)),
    }));

    const topPrediction = normalizedScores[0];

    this.logger.debug(
      `Predicted "${topPrediction.category}" (${(topPrediction.confidence * 100).toFixed(1)}%) for note: "${note}"`,
    );

    return {
      category: topPrediction.category,
      confidence: topPrediction.confidence,
      suggestions: normalizedScores.slice(0, 5),
      model: 'enhanced-keyword-v1',
    };
  }

  /**
   * Batch prediction
   */
  batchPredict(
    transactions: Array<{ note: string; amount?: number }>,
  ): Array<{
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
    model: string;
  }> {
    return transactions.map((t) => this.predict(t.note, t.amount));
  }
}
