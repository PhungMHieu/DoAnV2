import { Observable } from 'rxjs';

/**
 * Category suggestion
 */
export interface Suggestion {
  category: string;
  confidence: number;
}

/**
 * Predict request
 */
export interface PredictRequest {
  text: string;
  amount?: number;
}

/**
 * Predict response
 */
export interface PredictResponse {
  category: string;
  confidence: number;
  suggestions: Suggestion[];
  model: string;
}

/**
 * Batch predict request
 */
export interface BatchPredictRequest {
  texts: string[];
}

/**
 * Batch predict response
 */
export interface BatchPredictResponse {
  predictions: PredictResponse[];
}

/**
 * Train request
 */
export interface TrainRequest {
  force: boolean;
}

/**
 * Train response
 */
export interface TrainResponse {
  success: boolean;
  accuracy?: number;
  cvMean?: number;
  cvStd?: number;
  samples?: number;
  categories?: number;
  error?: string;
}

/**
 * Health response
 */
export interface HealthResponse {
  status: string;
  modelLoaded: boolean;
}

/**
 * Model info response
 */
export interface ModelInfoResponse {
  isTrained: boolean;
  categories?: string[];
  nCategories?: number;
  vectorizerFeatures?: number;
  modelType?: string;
  kernel?: string;
  message?: string;
}

/**
 * Reload response
 */
export interface ReloadResponse {
  success: boolean;
  isTrained: boolean;
}

/**
 * Empty message
 */
export interface Empty {}

/**
 * gRPC ML Classifier service interface
 */
export interface MlClassifierGrpcService {
  predict(request: PredictRequest): Observable<PredictResponse>;
  batchPredict(request: BatchPredictRequest): Observable<BatchPredictResponse>;
  train(request: TrainRequest): Observable<TrainResponse>;
  checkHealth(request: Empty): Observable<HealthResponse>;
  getModelInfo(request: Empty): Observable<ModelInfoResponse>;
  reloadModel(request: Empty): Observable<ReloadResponse>;
}
