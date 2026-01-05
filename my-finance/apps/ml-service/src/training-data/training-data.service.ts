import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  TrainingDataRecord,
  TrainingDataStats,
  TrainingExportRecord,
} from './training-data.entity';
import { CategoryType, ALL_CATEGORIES } from '../categories/category.constants';

/**
 * Service quản lý training data
 * Lưu trữ trong file JSON (có thể upgrade lên DB sau)
 */
@Injectable()
export class TrainingDataService {
  private readonly logger = new Logger(TrainingDataService.name);
  private readonly dataFilePath: string;
  private records: TrainingDataRecord[] = [];

  constructor() {
    // Lưu data trong thư mục /tmp (writable trong container)
    // hoặc trong data/ nếu chạy local
    const dataDir = process.env.DATA_DIR || '/tmp/ml-data';
    this.dataFilePath = path.join(dataDir, 'training-data.json');
    this.loadData();
  }

  /**
   * Load data từ file
   */
  private loadData(): void {
    try {
      // Tạo thư mục data nếu chưa có
      const dataDir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFilePath)) {
        const content = fs.readFileSync(this.dataFilePath, 'utf-8');
        this.records = JSON.parse(content);
        this.logger.log(`Loaded ${this.records.length} training records`);
      } else {
        this.records = [];
        this.saveData();
        this.logger.log('Created new training data file');
      }
    } catch (error) {
      this.logger.error('Failed to load training data', error);
      this.records = [];
    }
  }

  /**
   * Save data to file
   */
  private saveData(): void {
    try {
      const dataDir = path.dirname(this.dataFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(
        this.dataFilePath,
        JSON.stringify(this.records, null, 2),
        'utf-8',
      );
    } catch (error) {
      this.logger.error('Failed to save training data', error);
    }
  }

  /**
   * Normalize text cho storage
   */
  private normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Log một prediction correction (user sửa category)
   */
  logCorrection(data: {
    text: string;
    amount?: number;
    predictedCategory: CategoryType;
    predictedConfidence: number;
    predictedModel: string;
    correctedCategory: CategoryType;
    userId?: string;
  }): TrainingDataRecord {
    const record: TrainingDataRecord = {
      id: uuidv4(),
      text: data.text,
      amount: data.amount,
      normalizedText: this.normalizeText(data.text),
      predictedCategory: data.predictedCategory,
      predictedConfidence: data.predictedConfidence,
      predictedModel: data.predictedModel,
      correctedCategory: data.correctedCategory,
      isCorrection: data.predictedCategory !== data.correctedCategory,
      userId: data.userId,
      createdAt: new Date(),
      source: 'correction',
    };

    this.records.push(record);
    this.saveData();

    this.logger.log(
      `Logged correction: "${data.text}" - ${data.predictedCategory} → ${data.correctedCategory}`,
    );

    return record;
  }

  /**
   * Log một confirmed prediction (user xác nhận đúng)
   */
  logConfirmed(data: {
    text: string;
    amount?: number;
    confirmedCategory: CategoryType;
    predictedConfidence: number;
    predictedModel: string;
    userId?: string;
  }): TrainingDataRecord {
    const record: TrainingDataRecord = {
      id: uuidv4(),
      text: data.text,
      amount: data.amount,
      normalizedText: this.normalizeText(data.text),
      predictedCategory: data.confirmedCategory,
      predictedConfidence: data.predictedConfidence,
      predictedModel: data.predictedModel,
      correctedCategory: data.confirmedCategory,
      isCorrection: false,
      userId: data.userId,
      createdAt: new Date(),
      source: 'auto',
    };

    this.records.push(record);
    this.saveData();

    this.logger.debug(
      `Logged confirmed: "${data.text}" → ${data.confirmedCategory}`,
    );

    return record;
  }

  /**
   * Get statistics về training data
   */
  getStats(): TrainingDataStats {
    const recordsByCategory: Record<string, number> = {};
    const modelCorrections: Record<string, { total: number; correct: number }> =
      {};

    for (const category of ALL_CATEGORIES) {
      recordsByCategory[category] = 0;
    }

    let corrections = 0;

    for (const record of this.records) {
      // Count by final category
      const finalCategory = record.correctedCategory;
      recordsByCategory[finalCategory] =
        (recordsByCategory[finalCategory] || 0) + 1;

      // Count corrections
      if (record.isCorrection) {
        corrections++;
      }

      // Track model accuracy
      const model = record.predictedModel;
      if (!modelCorrections[model]) {
        modelCorrections[model] = { total: 0, correct: 0 };
      }
      modelCorrections[model].total++;
      if (!record.isCorrection) {
        modelCorrections[model].correct++;
      }
    }

    // Calculate model accuracy
    const modelAccuracy: Record<string, number> = {};
    for (const [model, stats] of Object.entries(modelCorrections)) {
      modelAccuracy[model] =
        stats.total > 0
          ? parseFloat(((stats.correct / stats.total) * 100).toFixed(2))
          : 0;
    }

    return {
      totalRecords: this.records.length,
      recordsByCategory: recordsByCategory as Record<CategoryType, number>,
      correctionRate:
        this.records.length > 0
          ? parseFloat(
              ((corrections / this.records.length) * 100).toFixed(2),
            )
          : 0,
      modelAccuracy,
      lastUpdated: new Date(),
    };
  }

  /**
   * Export data cho ML training
   */
  exportForTraining(options?: {
    minRecordsPerCategory?: number;
    excludeCategories?: CategoryType[];
  }): TrainingExportRecord[] {
    const minRecords = options?.minRecordsPerCategory || 0;
    const excludeCategories = new Set(options?.excludeCategories || []);

    // Count records per category
    const categoryCount: Record<string, number> = {};
    for (const record of this.records) {
      const cat = record.correctedCategory;
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }

    // Filter records
    const exportData: TrainingExportRecord[] = [];

    for (const record of this.records) {
      const category = record.correctedCategory;

      // Skip excluded categories
      if (excludeCategories.has(category)) continue;

      // Skip if category has too few records
      if ((categoryCount[category] || 0) < minRecords) continue;

      exportData.push({
        text: record.text,
        normalizedText: record.normalizedText,
        amount: record.amount,
        category: record.correctedCategory,
      });
    }

    this.logger.log(`Exported ${exportData.length} records for training`);

    return exportData;
  }

  /**
   * Get all records (for debugging/admin)
   */
  getAllRecords(): TrainingDataRecord[] {
    return [...this.records];
  }

  /**
   * Clear all records (for testing)
   */
  clearAllRecords(): void {
    this.records = [];
    this.saveData();
    this.logger.warn('Cleared all training records');
  }

  /**
   * Get record count
   */
  getRecordCount(): number {
    return this.records.length;
  }
}
