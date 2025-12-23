import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface PredictCategoryRequest {
  note: string;
  amount?: number;
}

interface PredictCategoryResponse {
  category: string;
  confidence: number;
  suggestions: Array<{ category: string; confidence: number }>;
  model: string;
}

interface ExtractAmountResponse {
  amount: number;
  confidence: number;
  matchedText?: string;
  method: string;
}

/**
 * Client để gọi ML Service
 */
@Injectable()
export class MlClientService {
  private readonly logger = new Logger(MlClientService.name);
  private readonly mlServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.mlServiceUrl =
      this.configService.get<string>('ML_SERVICE_URL') ||
      'http://localhost:3005';
  }

  /**
   * Gọi ML service để predict category
   */
  async predictCategory(
    note: string,
    amount?: number,
  ): Promise<PredictCategoryResponse> {
    try {
      const payload: PredictCategoryRequest = { note, amount };

      this.logger.debug(
        `Calling ML service at ${this.mlServiceUrl}/predict-category`,
      );

      const response = await firstValueFrom(
        this.httpService.post<PredictCategoryResponse>(
          `${this.mlServiceUrl}/predict-category`,
          payload,
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to predict category from ML service: ${error.message}`,
      );

      // Fallback: trả về category mặc định
      return {
        category: 'other',
        confidence: 0.1,
        suggestions: [{ category: 'other', confidence: 0.1 }],
        model: 'fallback',
      };
    }
  }

  /**
   * Batch predict categories
   */
  async batchPredictCategories(
    items: PredictCategoryRequest[],
  ): Promise<PredictCategoryResponse[]> {
    try {
      this.logger.debug(
        `Batch predicting ${items.length} categories from ML service`,
      );

      const response = await firstValueFrom(
        this.httpService.post<PredictCategoryResponse[]>(
          `${this.mlServiceUrl}/batch-predict-category`,
          items,
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to batch predict categories: ${error.message}`,
      );

      // Fallback: trả về category mặc định cho tất cả
      return items.map(() => ({
        category: 'other',
        confidence: 0.1,
        suggestions: [{ category: 'other', confidence: 0.1 }],
        model: 'fallback',
      }));
    }
  }

  /**
   * Extract amount from Vietnamese text
   */
  async extractAmount(text: string): Promise<ExtractAmountResponse> {
    try {
      this.logger.debug(
        `Calling ML service to extract amount from: "${text}"`,
      );

      const response = await firstValueFrom(
        this.httpService.post<ExtractAmountResponse>(
          `${this.mlServiceUrl}/extract-amount`,
          { text },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to extract amount from ML service: ${error.message}`,
      );

      // Fallback: return 0
      return {
        amount: 0,
        confidence: 0.1,
        method: 'fallback',
      };
    }
  }
}
