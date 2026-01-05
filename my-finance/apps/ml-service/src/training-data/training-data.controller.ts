import { Controller, Post, Get, Delete, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TrainingDataService } from './training-data.service';
import {
  LogPredictionCorrectionDto,
  LogConfirmedPredictionDto,
  TrainingDataStatsResponseDto,
  TrainingDataExportResponseDto,
} from './dto/training-data.dto';
import { CategoryType } from '../categories/category.constants';

@ApiTags('Training Data')
@Controller('training-data')
export class TrainingDataController {
  constructor(private readonly trainingDataService: TrainingDataService) {}

  @Post('log-correction')
  @ApiOperation({
    summary: 'Log a prediction correction',
    description:
      'Log when user corrects the predicted category. Used for training ML model.',
  })
  @ApiResponse({
    status: 201,
    description: 'Correction logged successfully',
  })
  logCorrection(@Body() dto: LogPredictionCorrectionDto) {
    const record = this.trainingDataService.logCorrection({
      text: dto.text,
      amount: dto.amount,
      predictedCategory: dto.predictedCategory as CategoryType,
      predictedConfidence: dto.predictedConfidence,
      predictedModel: 'enhanced-keyword-v1', // Default, có thể pass từ client
      correctedCategory: dto.correctedCategory as CategoryType,
      userId: dto.userId,
    });

    return {
      success: true,
      id: record.id,
      message: 'Correction logged successfully',
    };
  }

  @Post('log-confirmed')
  @ApiOperation({
    summary: 'Log a confirmed prediction',
    description:
      'Log when user confirms the predicted category is correct. Used for training ML model.',
  })
  @ApiResponse({
    status: 201,
    description: 'Confirmation logged successfully',
  })
  logConfirmed(@Body() dto: LogConfirmedPredictionDto) {
    const record = this.trainingDataService.logConfirmed({
      text: dto.text,
      amount: dto.amount,
      confirmedCategory: dto.confirmedCategory as CategoryType,
      predictedConfidence: dto.predictedConfidence,
      predictedModel: 'enhanced-keyword-v1',
      userId: dto.userId,
    });

    return {
      success: true,
      id: record.id,
      message: 'Confirmation logged successfully',
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get training data statistics',
    description:
      'Get statistics about collected training data including record counts, correction rate, and model accuracy.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: TrainingDataStatsResponseDto,
  })
  getStats(): TrainingDataStatsResponseDto {
    return this.trainingDataService.getStats();
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export training data',
    description:
      'Export training data in format suitable for ML model training.',
  })
  @ApiQuery({
    name: 'minRecordsPerCategory',
    required: false,
    type: Number,
    description: 'Minimum records per category to include',
  })
  @ApiResponse({
    status: 200,
    description: 'Data exported successfully',
    type: TrainingDataExportResponseDto,
  })
  exportData(
    @Query('minRecordsPerCategory') minRecords?: string,
  ): TrainingDataExportResponseDto {
    const data = this.trainingDataService.exportForTraining({
      minRecordsPerCategory: minRecords ? parseInt(minRecords, 10) : undefined,
    });

    return {
      count: data.length,
      data: data.map((d) => ({
        text: d.text,
        normalizedText: d.normalizedText,
        amount: d.amount,
        category: d.category,
      })),
    };
  }

  @Get('count')
  @ApiOperation({
    summary: 'Get total record count',
    description: 'Get the total number of training records collected.',
  })
  @ApiResponse({
    status: 200,
    description: 'Count retrieved successfully',
  })
  getCount() {
    return {
      count: this.trainingDataService.getRecordCount(),
    };
  }

  @Delete('clear')
  @ApiOperation({
    summary: 'Clear all training data',
    description:
      'Clear all collected training data. USE WITH CAUTION - this cannot be undone!',
  })
  @ApiResponse({
    status: 200,
    description: 'Data cleared successfully',
  })
  clearData() {
    this.trainingDataService.clearAllRecords();
    return {
      success: true,
      message: 'All training data cleared',
    };
  }
}
