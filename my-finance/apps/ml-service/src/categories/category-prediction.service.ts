import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeywordClassifierService } from './classifiers/keyword-classifier.service';
import { EnsembleClassifierService } from './classifiers/ensemble-classifier.service';
import { PredictCategoryDto, PredictCategoryResponseDto } from './dto/predict-category.dto';

/**
 * Service chính cho category prediction
 * Orchestrate các classifiers khác nhau
 */
@Injectable()
export class CategoryPredictionService {
  private readonly logger = new Logger(CategoryPredictionService.name);
  private readonly useEnsemble: boolean;

  constructor(
    private readonly keywordClassifier: KeywordClassifierService,
    private readonly ensembleClassifier: EnsembleClassifierService,
    private readonly configService: ConfigService,
  ) {
    // Check if ensemble mode is enabled
    this.useEnsemble =
      this.configService.get<string>('USE_PHOBERT') === 'true' || false;

    this.logger.log(
      `Prediction mode: ${this.useEnsemble ? 'Ensemble (Keyword + PhoBERT)' : 'Keyword only'}`,
    );
  }

  /**
   * Predict category cho một transaction
   * Phase 1: Keyword-based
   * Phase 2: Ensemble (Keyword + PhoBERT)
   */
  async predictCategory(dto: PredictCategoryDto): Promise<PredictCategoryResponseDto> {
    this.logger.log(`Predicting category for note: "${dto.note}"`);

    // Use ensemble if enabled, otherwise use keyword only
    if (this.useEnsemble) {
      const ensemblePrediction = await this.ensembleClassifier.predict(
        dto.note,
        dto.amount,
      );

      return {
        category: ensemblePrediction.category,
        confidence: ensemblePrediction.confidence,
        suggestions: ensemblePrediction.suggestions.map(s => ({
          category: s.category,
          confidence: s.confidence,
        })),
        model: `ensemble-${ensemblePrediction.metadata.usedModels.join('+')}`,
      };
    } else {
      // Phase 1: Keyword classifier only
      const prediction = this.keywordClassifier.predict(dto.note, dto.amount);

      return {
        category: prediction.category,
        confidence: prediction.confidence,
        suggestions: prediction.suggestions.map(s => ({
          category: s.category,
          confidence: s.confidence,
        })),
        model: 'keyword-matcher-v1',
      };
    }
  }

  /**
   * Batch prediction
   */
  async batchPredictCategories(
    items: PredictCategoryDto[],
  ): Promise<PredictCategoryResponseDto[]> {
    this.logger.log(`Batch predicting ${items.length} categories`);

    if (this.useEnsemble) {
      // Use ensemble for batch
      const predictions = await this.ensembleClassifier.batchPredict(
        items.map(item => ({ note: item.note, amount: item.amount })),
      );

      return predictions.map(prediction => ({
        category: prediction.category,
        confidence: prediction.confidence,
        suggestions: prediction.suggestions.map(s => ({
          category: s.category,
          confidence: s.confidence,
        })),
        model: `ensemble-${prediction.metadata.usedModels.join('+')}`,
      }));
    } else {
      // Use keyword only
      const predictions = this.keywordClassifier.batchPredict(
        items.map(item => ({ note: item.note, amount: item.amount })),
      );

      return predictions.map(prediction => ({
        category: prediction.category,
        confidence: prediction.confidence,
        suggestions: prediction.suggestions.map(s => ({
          category: s.category,
          confidence: s.confidence,
        })),
        model: 'keyword-matcher-v1',
      }));
    }
  }
}
