import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoryPredictionService } from './categories/category-prediction.service';
import { AmountExtractorService } from './amount-extraction/amount-extractor.service';
import {
  AnalyzeMultiTransactionsDto,
  AnalyzeMultiTransactionsResponseDto,
  TransactionResult,
} from './amount-extraction/dto/analyze-multi-transactions.dto';

@ApiTags('ML Predictions')
@Controller()
export class MlServiceController {
  constructor(
    private readonly categoryPredictionService: CategoryPredictionService,
    private readonly amountExtractorService: AmountExtractorService,
  ) {}

  @Post('analyze-multi-transactions')
  @ApiOperation({
    summary: 'Analyze text containing multiple transactions',
    description:
      'Splits complex text into multiple transactions and analyzes each separately. ' +
      'Example: "mua tạp dề 50k. ăn phở 90k" → 2 transactions',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions analyzed successfully',
    type: AnalyzeMultiTransactionsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  async analyzeMultiTransactions(
    @Body() dto: AnalyzeMultiTransactionsDto,
  ): Promise<AnalyzeMultiTransactionsResponseDto> {
    // Step 1: Split text into sentences
    let rawSentences: string[] = [];

    // Split by newlines first (handles \n, \r\n, \r)
    const lineBreakPattern = /\r?\n/;
    const lines = dto.text.split(lineBreakPattern);

    // Then split each line by other delimiters
    const delimiterPattern =
      /[.。！!？?;；,，]+\s*|(?:\s+và\s+)|(?:\s+còn\s+)|(?:\s+rồi\s+)|(?:\s+nữa\s+)|(?:\s+thêm\s+)/gi;

    for (const line of lines) {
      if (line.trim().length > 0) {
        const segments = line.split(delimiterPattern);
        rawSentences.push(...segments);
      }
    }

    // Clean and filter empty sentences
    rawSentences = rawSentences
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Step 2: Analyze each sentence
    const transactions: TransactionResult[] = [];

    for (const sentence of rawSentences) {
      // Extract amount
      const amountResult = this.amountExtractorService.extractAmount(sentence);

      // Only include sentences that have an amount
      if (amountResult.amount > 0) {
        // Predict category
        const categoryResult = 
          await this.categoryPredictionService.predictCategory({
            note: sentence,
            amount: amountResult.amount,
          });

        transactions.push({
          sentence,
          amount: amountResult.amount,
          amountConfidence: amountResult.confidence,
          matchedText: amountResult.matchedText,
          extractionMethod: amountResult.method,
          category: categoryResult.category,
          categoryConfidence: categoryResult.confidence,
          suggestions: categoryResult.suggestions,
          model: categoryResult.model,
        });
      }
    }

    return {
      count: transactions.length,
      transactions,
    };
  }
}
