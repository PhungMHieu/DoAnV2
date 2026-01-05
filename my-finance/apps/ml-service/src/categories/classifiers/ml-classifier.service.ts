import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { CategoryType, DEFAULT_CATEGORY } from '../category.constants';
import type {
  MlClassifierGrpcService,
  PredictResponse,
  HealthResponse,
  ModelInfoResponse,
  TrainResponse,
} from '../../grpc/ml-classifier.interface';

/**
 * ML Classifier Service
 * Kết nối với Python ML API qua gRPC (TF-IDF + SVM)
 */
@Injectable()
export class MlClassifierService implements OnModuleInit {
  private readonly logger = new Logger(MlClassifierService.name);
  private readonly timeoutMs: number = 5000;
  private isAvailable: boolean = false;
  private mlClassifierService: MlClassifierGrpcService;
  private readonly client: ClientGrpc;

  constructor(
    @Inject('ML_GRPC_PACKAGE') client: ClientGrpc,
  ) {
    this.client = client;
  }

  onModuleInit() {
    this.mlClassifierService =
      this.client.getService<MlClassifierGrpcService>('MlClassifier');

    // Check if ML API is available on startup
    this.checkHealth();
  }

  /**
   * Check if ML API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response: HealthResponse = await firstValueFrom(
        this.mlClassifierService.checkHealth({}).pipe(
          timeout(3000),
          catchError((error) => {
            this.logger.warn(`Health check failed: ${error.message}`);
            return of({ status: 'unhealthy', modelLoaded: false });
          }),
        ),
      );

      this.isAvailable = response.status === 'healthy';
      const modelLoaded = response.modelLoaded;

      this.logger.log(
        `ML API health check: ${this.isAvailable ? 'OK' : 'FAILED'}, Model loaded: ${modelLoaded}`,
      );

      return this.isAvailable && modelLoaded;
    } catch (error) {
      this.isAvailable = false;
      this.logger.warn(`ML API not available: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if ML classifier is available
   */
  isModelAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Predict category using ML model
   */
  async predict(
    note: string,
    amount?: number,
  ): Promise<{
    category: CategoryType;
    confidence: number;
    suggestions: Array<{ category: CategoryType; confidence: number }>;
    model: string;
  }> {
    if (!this.isAvailable) {
      this.logger.warn('ML API not available, returning default');
      return {
        category: DEFAULT_CATEGORY,
        confidence: 0,
        suggestions: [],
        model: 'ml-svm-v1-unavailable',
      };
    }

    try {
      const response: PredictResponse = await firstValueFrom(
        this.mlClassifierService.predict({ text: note, amount }).pipe(
          timeout(this.timeoutMs),
          catchError((error) => {
            throw error;
          }),
        ),
      );

      return {
        category: response.category as CategoryType,
        confidence: response.confidence,
        suggestions: response.suggestions.map((s) => ({
          category: s.category as CategoryType,
          confidence: s.confidence,
        })),
        model: response.model || 'ml-svm-v1',
      };
    } catch (error) {
      this.logger.error(`ML prediction failed: ${error.message}`);

      // Check if API became unavailable
      if (
        error.code === 14 || // UNAVAILABLE
        error.code === 4 // DEADLINE_EXCEEDED
      ) {
        this.isAvailable = false;
      }

      return {
        category: DEFAULT_CATEGORY,
        confidence: 0,
        suggestions: [],
        model: 'ml-svm-v1-error',
      };
    }
  }

  /**
   * Batch predict categories
   */
  async batchPredict(
    transactions: Array<{ note: string; amount?: number }>,
  ): Promise<
    Array<{
      category: CategoryType;
      confidence: number;
      suggestions: Array<{ category: CategoryType; confidence: number }>;
      model: string;
    }>
  > {
    if (!this.isAvailable) {
      return transactions.map(() => ({
        category: DEFAULT_CATEGORY,
        confidence: 0,
        suggestions: [],
        model: 'ml-svm-v1-unavailable',
      }));
    }

    try {
      const response = await firstValueFrom(
        this.mlClassifierService
          .batchPredict({
            texts: transactions.map((t) => t.note),
          })
          .pipe(
            timeout(this.timeoutMs * 2),
            catchError((error) => {
              throw error;
            }),
          ),
      );

      return response.predictions.map((p) => ({
        category: p.category as CategoryType,
        confidence: p.confidence,
        suggestions: p.suggestions.map((s) => ({
          category: s.category as CategoryType,
          confidence: s.confidence,
        })),
        model: p.model || 'ml-svm-v1',
      }));
    } catch (error) {
      this.logger.error(`ML batch prediction failed: ${error.message}`);

      return transactions.map(() => ({
        category: DEFAULT_CATEGORY,
        confidence: 0,
        suggestions: [],
        model: 'ml-svm-v1-error',
      }));
    }
  }

  /**
   * Trigger model training
   */
  async trainModel(force: boolean = false): Promise<{
    success: boolean;
    accuracy?: number;
    samples?: number;
    error?: string;
  }> {
    try {
      const result: TrainResponse = await firstValueFrom(
        this.mlClassifierService.train({ force }).pipe(
          timeout(60000), // Training can take longer
          catchError((error) => {
            throw error;
          }),
        ),
      );

      if (result.success) {
        this.isAvailable = true;
        this.logger.log(
          `ML model trained successfully. Accuracy: ${((result.accuracy || 0) * 100).toFixed(2)}%`,
        );
      }

      return {
        success: result.success,
        accuracy: result.accuracy,
        samples: result.samples,
        error: result.error,
      };
    } catch (error) {
      this.logger.error(`ML training failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(): Promise<{
    isAvailable: boolean;
    isTrained: boolean;
    categories?: string[];
    features?: number;
  }> {
    if (!this.isAvailable) {
      return {
        isAvailable: false,
        isTrained: false,
      };
    }

    try {
      const response: ModelInfoResponse = await firstValueFrom(
        this.mlClassifierService.getModelInfo({}).pipe(
          timeout(3000),
          catchError((error) => {
            throw error;
          }),
        ),
      );

      return {
        isAvailable: true,
        isTrained: response.isTrained,
        categories: response.categories,
        features: response.vectorizerFeatures,
      };
    } catch (error) {
      return {
        isAvailable: false,
        isTrained: false,
      };
    }
  }
}
