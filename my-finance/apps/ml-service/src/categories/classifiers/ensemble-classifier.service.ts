import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { KeywordClassifierService } from './keyword-classifier.service';
import { CategoryType } from '../category.constants';

interface PhoBERTResponse {
  category: string;
  confidence: number;
  suggestions: Array<{ category: string; confidence: number }>;
  model: string;
}

/**
 * Ensemble Classifier combining Keyword + PhoBERT models
 * Strategy: Weighted voting based on confidence scores
 */
@Injectable()
export class EnsembleClassifierService {
  private readonly logger = new Logger(EnsembleClassifierService.name);
  private readonly phobertServiceUrl: string;
  private readonly usePhoBERT: boolean;

  // Ensemble weights
  private readonly KEYWORD_WEIGHT = 0.3; // 30% weight for keyword-based
  private readonly PHOBERT_WEIGHT = 0.7; // 70% weight for PhoBERT

  constructor(
    private readonly keywordClassifier: KeywordClassifierService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.phobertServiceUrl =
      this.configService.get<string>('PHOBERT_SERVICE_URL') ||
      'http://localhost:8000';

    // Check if PhoBERT service should be used
    this.usePhoBERT =
      this.configService.get<string>('USE_PHOBERT') === 'true' || false;

    this.logger.log(
      `Ensemble mode: ${this.usePhoBERT ? 'Keyword + PhoBERT' : 'Keyword only'}`,
    );
  }

  /**
   * Predict using ensemble of classifiers
   */
  async predict(
    note: string,
    amount?: number,
  ): Promise<{
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
    metadata: {
      usedModels: string[];
      keywordScore?: number;
      phobertScore?: number;
    };
  }> {
    // Always get keyword prediction (fallback)
    const keywordPrediction = this.keywordClassifier.predict(note, amount);

    // If PhoBERT not enabled, return keyword result
    if (!this.usePhoBERT) {
      return {
        ...keywordPrediction,
        metadata: {
          usedModels: ['keyword-matcher-v1'],
          keywordScore: keywordPrediction.confidence,
        },
      };
    }

    // Try to get PhoBERT prediction
    try {
      const phobertPrediction = await this.getPhoBERTPrediction(note);

      // Ensemble predictions
      const ensemble = this.ensemblePredictions(
        keywordPrediction,
        phobertPrediction,
      );

      return {
        ...ensemble,
        metadata: {
          usedModels: ['keyword-matcher-v1', 'phobert-base-v1'],
          keywordScore: keywordPrediction.confidence,
          phobertScore: phobertPrediction.confidence,
        },
      };
    } catch (error) {
      this.logger.warn(
        `PhoBERT prediction failed, falling back to keyword: ${error.message}`,
      );

      // Fallback to keyword
      return {
        ...keywordPrediction,
        metadata: {
          usedModels: ['keyword-matcher-v1'],
          keywordScore: keywordPrediction.confidence,
        },
      };
    }
  }

  /**
   * Call PhoBERT service for prediction
   */
  private async getPhoBERTPrediction(note: string): Promise<PhoBERTResponse> {
    const response = await firstValueFrom(
      this.httpService.post<PhoBERTResponse>(
        `${this.phobertServiceUrl}/predict`,
        { note },
        { timeout: 5000 },
      ),
    );

    return response.data;
  }

  /**
   * Ensemble multiple predictions using weighted voting
   */
  private ensemblePredictions(
    keywordPred: {
      category: CategoryType;
      confidence: number;
      suggestions: Array<{ category: CategoryType; confidence: number }>;
    },
    phobertPred: PhoBERTResponse,
  ): {
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
  } {
    // Build score map for all categories
    const categoryScores = new Map<string, number>();

    // Add keyword scores (weighted)
    for (const suggestion of keywordPred.suggestions) {
      const score = suggestion.confidence * this.KEYWORD_WEIGHT;
      categoryScores.set(
        suggestion.category,
        (categoryScores.get(suggestion.category) || 0) + score,
      );
    }

    // Add PhoBERT scores (weighted)
    for (const suggestion of phobertPred.suggestions) {
      const score = suggestion.confidence * this.PHOBERT_WEIGHT;
      categoryScores.set(
        suggestion.category,
        (categoryScores.get(suggestion.category) || 0) + score,
      );
    }

    // Convert to sorted array
    const sortedCategories = Array.from(categoryScores.entries())
      .map(([category, score]) => ({
        category: category as CategoryType,
        confidence: score,
      }))
      .sort((a, b) => b.confidence - a.confidence);

    // Normalize confidence scores to sum to 1
    const totalScore = sortedCategories.reduce(
      (sum, item) => sum + item.confidence,
      0,
    );
    const normalizedSuggestions = sortedCategories
      .map((item) => ({
        category: item.category,
        confidence: parseFloat((item.confidence / totalScore).toFixed(4)),
      }))
      .slice(0, 5); // Top 5

    return {
      category: normalizedSuggestions[0].category,
      confidence: normalizedSuggestions[0].confidence,
      suggestions: normalizedSuggestions,
    };
  }

  /**
   * Batch prediction with ensemble
   */
  async batchPredict(
    transactions: Array<{ note: string; amount?: number }>,
  ): Promise<
    Array<{
      category: CategoryType;
      confidence: number;
      suggestions: Array<{ category: CategoryType; confidence: number }>;
      metadata: {
        usedModels: string[];
        keywordScore?: number;
        phobertScore?: number;
      };
    }>
  > {
    // For batch, we'll do sequential predictions
    // In production, could parallelize or use batch endpoints
    const results: Array<{
      category: CategoryType;
      confidence: number;
      suggestions: Array<{ category: CategoryType; confidence: number }>;
      metadata: {
        usedModels: string[];
        keywordScore?: number;
        phobertScore?: number;
      };
    }> = [];

    for (const transaction of transactions) {
      const prediction = await this.predict(
        transaction.note,
        transaction.amount,
      );
      results.push({
        category: prediction.category,
        confidence: prediction.confidence,
        suggestions: prediction.suggestions,
        metadata: prediction.metadata,
      });
    }

    return results;
  }

  /**
   * Health check for PhoBERT service
   */
  async checkPhoBERTHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.phobertServiceUrl}/health`, {
          timeout: 2000,
        }),
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
