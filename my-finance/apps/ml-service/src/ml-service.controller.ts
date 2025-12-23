import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CategoryPredictionService } from './categories/category-prediction.service';
import {
  PredictCategoryDto,
  PredictCategoryResponseDto,
} from './categories/dto/predict-category.dto';
import { AmountExtractorService } from './amount-extraction/amount-extractor.service';
import {
  ExtractAmountDto,
  ExtractAmountResponseDto,
} from './amount-extraction/dto/extract-amount.dto';
import {
  AnalyzeTransactionDto,
  AnalyzeTransactionResponseDto,
} from './amount-extraction/dto/analyze-transaction.dto';
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

  @Post('predict-category')
  @ApiOperation({
    summary: 'Predict transaction category',
    description: 'Uses AI/ML to predict the category of a transaction based on its description',
  })
  @ApiResponse({
    status: 200,
    description: 'Category predicted successfully',
    type: PredictCategoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  async predictCategory(
    @Body() dto: PredictCategoryDto,
  ): Promise<PredictCategoryResponseDto> {
    return this.categoryPredictionService.predictCategory(dto);
  }

  @Post('batch-predict-category')
  @ApiOperation({
    summary: 'Batch predict transaction categories',
    description: 'Predict categories for multiple transactions at once',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories predicted successfully',
    type: [PredictCategoryResponseDto],
  })
  async batchPredictCategories(
    @Body() dtos: PredictCategoryDto[],
  ): Promise<PredictCategoryResponseDto[]> {
    return this.categoryPredictionService.batchPredictCategories(dtos);
  }

  @Post('extract-amount')
  @ApiOperation({
    summary: 'Extract amount from Vietnamese text',
    description:
      'Parses Vietnamese text to extract transaction amount. ' +
      'Supports plain numbers (50000), k notation (50k), and Vietnamese words (50 nghìn, 1.5 triệu)',
  })
  @ApiResponse({
    status: 200,
    description: 'Amount extracted successfully',
    type: ExtractAmountResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  async extractAmount(
    @Body() dto: ExtractAmountDto,
  ): Promise<ExtractAmountResponseDto> {
    return this.amountExtractorService.extractAmount(dto.text);
  }

  @Post('analyze-transaction')
  @ApiOperation({
    summary: 'Analyze transaction text (extract amount + predict category)',
    description:
      'Combines amount extraction and category prediction in one call. ' +
      'Example: "ăn phở 50k" → amount: 50000, category: "food"',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction analyzed successfully',
    type: AnalyzeTransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  async analyzeTransaction(
    @Body() dto: AnalyzeTransactionDto,
  ): Promise<AnalyzeTransactionResponseDto> {
    // Step 1: Extract amount
    const amountResult = this.amountExtractorService.extractAmount(dto.text);

    // Step 2: Predict category using the extracted text and amount
    const categoryResult = await this.categoryPredictionService.predictCategory({
      note: dto.text,
      amount: amountResult.amount > 0 ? amountResult.amount : undefined,
    });

    // Combine results
    return {
      amount: amountResult.amount,
      amountConfidence: amountResult.confidence,
      matchedText: amountResult.matchedText,
      extractionMethod: amountResult.method,
      category: categoryResult.category,
      categoryConfidence: categoryResult.confidence,
      suggestions: categoryResult.suggestions,
      model: categoryResult.model,
    };
  }

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
    // Split by common Vietnamese sentence delimiters: . , ; và (and), còn (also)
    const sentenceSplitPattern =
      /[.。！!？?;；,，]+\s*|(?:\s+và\s+)|(?:\s+còn\s+)|(?:\s+rồi\s+)|(?:\s+nữa\s+)|(?:\s+thêm\s+)/gi;
    let rawSentences = dto.text.split(sentenceSplitPattern);

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
