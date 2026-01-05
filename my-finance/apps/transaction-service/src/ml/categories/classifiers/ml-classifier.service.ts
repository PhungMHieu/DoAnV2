import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AxiosError } from 'axios';
import { DEFAULT_CATEGORY } from '../category.constants';

interface PredictResult {
  category: string;
  confidence: number;
}

@Injectable()
export class MlClassifierService implements OnModuleInit {
  private readonly logger = new Logger(MlClassifierService.name);
  private readonly mlApiUrl: string;
  private readonly timeoutMs = 5000;
  private isAvailable = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.mlApiUrl = this.configService.get<string>(
      'ML_API_URL',
      'http://localhost:5000',
    );
  }

  async onModuleInit() {
    await this.checkHealth();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.mlApiUrl}/health`).pipe(
          timeout(3000),
          catchError((error: AxiosError) => {
            throw error;
          }),
        ),
      );

      this.isAvailable = response.data?.status === 'healthy';
      this.logger.log(
        `ML API: ${this.isAvailable ? 'OK' : 'FAILED'}, Model: ${response.data?.model_loaded}`,
      );
      return this.isAvailable && response.data?.model_loaded;
    } catch {
      this.isAvailable = false;
      this.logger.warn(`ML API not available at ${this.mlApiUrl}`);
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
      const response = await firstValueFrom(
        this.httpService
          .post(`${this.mlApiUrl}/predict`, { text: note, amount })
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              throw error;
            }),
          ),
      );

      return {
        category: response.data.category,
        confidence: response.data.confidence,
      };
    } catch (error) {
      this.logger.error(`ML prediction failed: ${error.message}`);
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.isAvailable = false;
      }
      return { category: DEFAULT_CATEGORY, confidence: 0 };
    }
  }
}
