import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { DEFAULT_CATEGORY } from '../category.constants';
import type {
  MlClassifierGrpcService,
  PredictResponse,
  HealthResponse,
} from '../../../grpc/ml/ml-classifier.interface';

interface PredictResult {
  category: string;
  confidence: number;
}

@Injectable()
export class MlClassifierService implements OnModuleInit {
  private readonly logger = new Logger(MlClassifierService.name);
  private readonly timeoutMs = 5000;
  private isAvailable = false;
  private mlClassifierService: MlClassifierGrpcService;

  constructor(
    @Inject('ML_GRPC_PACKAGE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.mlClassifierService =
      this.client.getService<MlClassifierGrpcService>('MlClassifier');

    // Check if ML API is available on startup
    this.checkHealth();
  }

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
        `ML API (gRPC): ${this.isAvailable ? 'OK' : 'FAILED'}, Model loaded: ${modelLoaded}`,
      );

      return this.isAvailable && modelLoaded;
    } catch (error) {
      this.isAvailable = false;
      this.logger.warn(`ML API not available via gRPC: ${error.message}`);
      return false;
    }
  }

  isModelAvailable(): boolean {
    return this.isAvailable;
  }

  async predict(note: string, amount?: number): Promise<PredictResult> {
    if (!this.isAvailable) {
      return { category: DEFAULT_CATEGORY, confidence: 0 };
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
        category: response.category,
        confidence: response.confidence,
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

      return { category: DEFAULT_CATEGORY, confidence: 0 };
    }
  }
}
