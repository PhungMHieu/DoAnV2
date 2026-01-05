import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeywordClassifierService } from './classifiers/keyword-classifier.service';
import { EnhancedKeywordClassifierService } from './classifiers/enhanced-keyword-classifier.service';
import { EnsembleClassifierService } from './classifiers/ensemble-classifier.service';
import {
  PredictCategoryDto,
  PredictCategoryResponseDto,
} from './dto/predict-category.dto';
import { CategoryType, DEFAULT_CATEGORY } from './category.constants';

/**
 * Stub ML Classifier for when gRPC is not available
 */
interface MlClassifierInterface {
  isModelAvailable(): boolean;
  predict(
    note: string,
    amount?: number,
  ): Promise<{
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
    model: string;
  }>;
  getModelInfo(): Promise<{
    isAvailable: boolean;
    isTrained: boolean;
    categories?: string[];
    features?: number;
  }>;
  trainModel(force?: boolean): Promise<{
    success: boolean;
    accuracy?: number;
    samples?: number;
    error?: string;
  }>;
}

/**
 * Prediction modes:
 * - 'basic': Keyword-based only (original)
 * - 'enhanced': Enhanced keyword with N-gram, weighting, normalization
 * - 'ml': ML model (TF-IDF + SVM) with enhanced keyword fallback
 * - 'ensemble': Ensemble (Keyword + PhoBERT)
 */
type PredictionMode = 'basic' | 'enhanced' | 'ml' | 'ensemble';

/**
 * Service chính cho category prediction
 * Orchestrate các classifiers khác nhau với tiered fallback
 */
@Injectable()
export class CategoryPredictionService {
  private readonly logger = new Logger(CategoryPredictionService.name);
  private readonly predictionMode: PredictionMode;
  private readonly mlConfidenceThreshold: number = 0.6;
  private readonly mlClassifier: MlClassifierInterface;

  constructor(
    private readonly keywordClassifier: KeywordClassifierService,
    private readonly enhancedKeywordClassifier: EnhancedKeywordClassifierService,
    private readonly ensembleClassifier: EnsembleClassifierService,
    private readonly configService: ConfigService,
  ) {
    // Create stub ML classifier (gRPC disabled)
    this.mlClassifier = {
      isModelAvailable: () => false,
      predict: async () => ({
        category: DEFAULT_CATEGORY,
        confidence: 0,
        suggestions: [],
        model: 'ml-unavailable',
      }),
      getModelInfo: async () => ({
        isAvailable: false,
        isTrained: false,
      }),
      trainModel: async () => ({
        success: false,
        error: 'ML gRPC service not configured',
      }),
    };

    // Determine prediction mode from environment
    const usePhoBERT = this.configService.get<string>('USE_PHOBERT') === 'true';
    const useMl = this.configService.get<string>('USE_ML_MODEL') === 'true';
    const useEnhanced =
      this.configService.get<string>('USE_ENHANCED_KEYWORD') !== 'false';

    if (usePhoBERT) {
      this.predictionMode = 'ensemble';
    } else if (useMl) {
      this.predictionMode = 'ml';
    } else if (useEnhanced) {
      this.predictionMode = 'enhanced';
    } else {
      this.predictionMode = 'basic';
    }

    this.logger.log(`Prediction mode: ${this.predictionMode}`);
  }

  /**
   * Predict category cho một transaction
   * Sử dụng tiered approach: ML -> Enhanced Keyword -> Basic Keyword
   */
  async predictCategory(
    dto: PredictCategoryDto,
  ): Promise<PredictCategoryResponseDto> {
    this.logger.debug(`Predicting category for note: "${dto.note}"`);

    switch (this.predictionMode) {
      case 'ensemble':
        return this.predictWithEnsemble(dto);

      case 'ml':
        return this.predictWithMlFallback(dto);

      case 'enhanced':
        return this.predictWithEnhancedKeyword(dto);

      case 'basic':
      default:
        return this.predictWithBasicKeyword(dto);
    }
  }

  /**
   * Tiered prediction: ML first, fallback to Enhanced Keyword
   */
  private async predictWithMlFallback(
    dto: PredictCategoryDto,
  ): Promise<PredictCategoryResponseDto> {
    // Try ML classifier first
    if (this.mlClassifier.isModelAvailable()) {
      const mlResult = await this.mlClassifier.predict(dto.note, dto.amount);

      // If ML confidence is high enough, use it
      if (mlResult.confidence >= this.mlConfidenceThreshold) {
        this.logger.debug(
          `Using ML prediction: ${mlResult.category} (${(mlResult.confidence * 100).toFixed(1)}%)`,
        );
        return {
          category: mlResult.category,
          confidence: mlResult.confidence,
          suggestions: mlResult.suggestions,
          model: mlResult.model,
        };
      }

      // ML confidence too low, enhance with keyword classifier
      const keywordResult = this.enhancedKeywordClassifier.predict(
        dto.note,
        dto.amount,
      );

      // Combine scores (weighted average)
      if (mlResult.category === keywordResult.category) {
        // Both agree - boost confidence
        const combinedConfidence = Math.min(
          mlResult.confidence * 0.6 + keywordResult.confidence * 0.4 + 0.1,
          1,
        );
        return {
          category: mlResult.category,
          confidence: combinedConfidence,
          suggestions: mlResult.suggestions,
          model: 'ml+keyword-combined',
        };
      }

      // Disagree - use the one with higher confidence
      if (mlResult.confidence >= keywordResult.confidence) {
        return {
          category: mlResult.category,
          confidence: mlResult.confidence,
          suggestions: mlResult.suggestions,
          model: mlResult.model,
        };
      } else {
        return {
          category: keywordResult.category,
          confidence: keywordResult.confidence,
          suggestions: keywordResult.suggestions,
          model: keywordResult.model + '-fallback',
        };
      }
    }

    // ML not available, fall back to enhanced keyword
    this.logger.debug('ML not available, using enhanced keyword');
    return this.predictWithEnhancedKeyword(dto);
  }

  /**
   * Predict using basic keyword classifier
   */
  private predictWithBasicKeyword(
    dto: PredictCategoryDto,
  ): PredictCategoryResponseDto {
    const prediction = this.keywordClassifier.predict(dto.note, dto.amount);

    return {
      category: prediction.category,
      confidence: prediction.confidence,
      suggestions: prediction.suggestions.map((s) => ({
        category: s.category,
        confidence: s.confidence,
      })),
      model: 'keyword-matcher-v1',
    };
  }

  /**
   * Predict using enhanced keyword classifier (N-gram, weighting, etc.)
   */
  private predictWithEnhancedKeyword(
    dto: PredictCategoryDto,
  ): PredictCategoryResponseDto {
    const prediction = this.enhancedKeywordClassifier.predict(
      dto.note,
      dto.amount,
    );

    return {
      category: prediction.category,
      confidence: prediction.confidence,
      suggestions: prediction.suggestions.map((s) => ({
        category: s.category,
        confidence: s.confidence,
      })),
      model: prediction.model,
    };
  }

  /**
   * Predict using ensemble (Keyword + PhoBERT)
   */
  private async predictWithEnsemble(
    dto: PredictCategoryDto,
  ): Promise<PredictCategoryResponseDto> {
    const ensemblePrediction = await this.ensembleClassifier.predict(
      dto.note,
      dto.amount,
    );

    return {
      category: ensemblePrediction.category,
      confidence: ensemblePrediction.confidence,
      suggestions: ensemblePrediction.suggestions.map((s) => ({
        category: s.category,
        confidence: s.confidence,
      })),
      model: `ensemble-${ensemblePrediction.metadata.usedModels.join('+')}`,
    };
  }

  /**
   * Batch prediction
   */
  async batchPredictCategories(
    items: PredictCategoryDto[],
  ): Promise<PredictCategoryResponseDto[]> {
    this.logger.log(`Batch predicting ${items.length} categories`);

    // For batch, process each item
    const results = await Promise.all(
      items.map((item) => this.predictCategory(item)),
    );

    return results;
  }

  /**
   * Get ML model info
   */
  async getMlModelInfo(): Promise<{
    isAvailable: boolean;
    isTrained: boolean;
    categories?: string[];
    features?: number;
  }> {
    return this.mlClassifier.getModelInfo();
  }

  /**
   * Trigger ML model training
   */
  async trainMlModel(force: boolean = false): Promise<{
    success: boolean;
    accuracy?: number;
    samples?: number;
    error?: string;
  }> {
    return this.mlClassifier.trainModel(force);
  }
}
