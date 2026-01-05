import { CategoryType } from '../categories/category.constants';

/**
 * Entity để lưu trữ training data cho ML model
 * Mỗi record là một transaction đã được user xác nhận category
 */
export interface TrainingDataRecord {
  id: string;

  // Input data
  text: string; // Original transaction text
  amount?: number; // Transaction amount
  normalizedText: string; // Normalized text (lowercase, cleaned)

  // Prediction data
  predictedCategory: CategoryType;
  predictedConfidence: number;
  predictedModel: string; // Model đã predict (keyword-v1, enhanced-v1, etc.)

  // Correction data (từ user)
  correctedCategory: CategoryType;
  isCorrection: boolean; // true nếu user đã sửa

  // Metadata
  userId?: string; // Optional: để track per-user patterns
  createdAt: Date;
  source: 'manual' | 'auto' | 'correction'; // Nguồn dữ liệu
}

/**
 * Statistics về training data
 */
export interface TrainingDataStats {
  totalRecords: number;
  recordsByCategory: Record<CategoryType, number>;
  correctionRate: number; // % predictions bị user sửa
  modelAccuracy: Record<string, number>; // Accuracy per model
  lastUpdated: Date;
}

/**
 * Export format cho ML training
 */
export interface TrainingExportRecord {
  text: string;
  normalizedText: string;
  amount?: number;
  category: CategoryType; // Final category (corrected or confirmed)
}
