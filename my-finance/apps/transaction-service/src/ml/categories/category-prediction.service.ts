import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeywordClassifierService } from './classifiers/keyword-classifier.service';
import { EnhancedKeywordClassifierService } from './classifiers/enhanced-keyword-classifier.service';
import { MlClassifierService } from './classifiers/ml-classifier.service';

type PredictionMode = 'basic' | 'enhanced' | 'ml';

@Injectable()
export class CategoryPredictionService {
  private readonly logger = new Logger(CategoryPredictionService.name);
  private readonly predictionMode: PredictionMode;
  private readonly mlConfidenceThreshold = 0.6;

  constructor(
    private readonly keywordClassifier: KeywordClassifierService,
    private readonly enhancedKeywordClassifier: EnhancedKeywordClassifierService,
    private readonly mlClassifier: MlClassifierService,
    private readonly configService: ConfigService,
  ) {
    const useMl = this.configService.get<string>('USE_ML_MODEL') === 'true';
    const useEnhanced =
      this.configService.get<string>('USE_ENHANCED_KEYWORD') !== 'false';

    if (useMl) {
      this.predictionMode = 'ml';
    } else if (useEnhanced) {
      this.predictionMode = 'enhanced';
    } else {
      this.predictionMode = 'basic';
    }

    this.logger.log(`Prediction mode: ${this.predictionMode}`);
  }

  async predictCategory(note: string, amount?: number): Promise<string> {
    switch (this.predictionMode) {
      case 'ml':
        return this.predictWithMlFallback(note, amount);
      case 'enhanced':
        return this.enhancedKeywordClassifier.predict(note, amount).category;
      case 'basic':
      default:
        return this.keywordClassifier.predict(note, amount).category;
    }
  }

  private async predictWithMlFallback(
    note: string,
    amount?: number,
  ): Promise<string> {
    if (this.mlClassifier.isModelAvailable()) {
      const mlResult = await this.mlClassifier.predict(note, amount);

      if (mlResult.confidence >= this.mlConfidenceThreshold) {
        return mlResult.category;
      }

      const keywordResult = this.enhancedKeywordClassifier.predict(note, amount);
      return mlResult.confidence >= keywordResult.confidence
        ? mlResult.category
        : keywordResult.category;
    }

    return this.enhancedKeywordClassifier.predict(note, amount).category;
  }
}
