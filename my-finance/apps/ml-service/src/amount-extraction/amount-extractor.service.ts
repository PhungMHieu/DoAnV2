import { Injectable, Logger } from '@nestjs/common';
import { ExtractAmountResponseDto } from './dto/extract-amount.dto';
import { VietnameseNormalizer } from './utils/vietnamese-normalizer';

@Injectable()
export class AmountExtractorService {
  private readonly logger = new Logger(AmountExtractorService.name);

  /**
   * Extract amount from Vietnamese text
   * Supports multiple formats: plain numbers, k notation, Vietnamese words
   */
  extractAmount(text: string): ExtractAmountResponseDto {
    if (!text || text.trim().length === 0) {
      return { amount: 0, confidence: 0.1, method: 'empty-text' };
    }

    // Normalize text (remove diacritics, lowercase, normalize whitespace)
    const normalized = VietnameseNormalizer.normalizeForAmountExtraction(text);

    // Try extraction strategies in order of confidence (most specific first)
    const strategies = [
      () => this.extractComplexVietnamese(normalized),
      () => this.extractTrieu(normalized),
      () => this.extractNghin(normalized),
      () => this.extractKNotation(normalized),
      () => this.extractPlainNumber(normalized),
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result.amount > 0) {
        this.logger.debug(
          `Extracted ${result.amount} using ${result.method} from: "${text}"`,
        );
        return result;
      }
    }

    // No amount found
    this.logger.debug(`No amount found in: "${text}"`);
    return { amount: 0, confidence: 0.1, method: 'not-found' };
  }

  /**
   * Extract complex Vietnamese patterns: "1 triệu 500 nghìn"
   * Example: "mua laptop 1 triệu 500 nghìn" -> 1,500,000
   */
  private extractComplexVietnamese(text: string): ExtractAmountResponseDto {
    // Pattern: X triệu Y nghìn
    const pattern =
      /(\d+(?:[.,]\d+)?)\s*(?:trieu|triệu)\s+(\d+(?:[.,]\d+)?)\s*(?:nghin|nghìn|ngan|ngàn)/gi;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1]; // Use rightmost match
      const millions = parseFloat(match[1].replace(',', '.'));
      const thousands = parseFloat(match[2].replace(',', '.'));
      const amount = millions * 1000000 + thousands * 1000;

      return {
        amount: this.validateAmount(amount),
        confidence: 0.95,
        matchedText: match[0],
        method: 'regex-complex-vietnamese',
      };
    }

    return { amount: 0, confidence: 0, method: 'no-match' };
  }

  /**
   * Extract triệu (millions)
   * Example: "mua điện thoại 15 triệu" -> 15,000,000
   */
  private extractTrieu(text: string): ExtractAmountResponseDto {
    const pattern = /(\d+(?:[.,]\d+)?)\s*(?:trieu|triệu)/gi;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1]; // Use rightmost match
      const value = parseFloat(match[1].replace(',', '.'));
      const amount = value * 1000000;

      return {
        amount: this.validateAmount(amount),
        confidence: 0.9,
        matchedText: match[0],
        method: 'regex-trieu',
      };
    }

    return { amount: 0, confidence: 0, method: 'no-match' };
  }

  /**
   * Extract nghìn/ngàn (thousands) and trăm nghìn (hundreds of thousands)
   * Examples:
   * - "ăn sáng 50 nghìn" -> 50,000
   * - "áo khoác 5 trăm nghìn" -> 500,000
   */
  private extractNghin(text: string): ExtractAmountResponseDto {
    // First, try "trăm nghìn" pattern (hundreds of thousands)
    const tramNghinPattern =
      /(\d+)\s*(?:tram|trăm)\s*(?:nghin|nghìn|ngan|ngàn)/gi;
    let matches = Array.from(text.matchAll(tramNghinPattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      const value = parseInt(match[1]);
      const amount = value * 100000;

      return {
        amount: this.validateAmount(amount),
        confidence: 0.9,
        matchedText: match[0],
        method: 'regex-tram-nghin',
      };
    }

    // Try simple "nghìn" pattern
    const nghinPattern = /(\d+(?:[.,]\d+)?)\s*(?:nghin|nghìn|ngan|ngàn)/gi;
    matches = Array.from(text.matchAll(nghinPattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      const value = parseFloat(match[1].replace(',', '.'));
      const amount = value * 1000;

      return {
        amount: this.validateAmount(amount),
        confidence: 0.9,
        matchedText: match[0],
        method: 'regex-nghin',
      };
    }

    return { amount: 0, confidence: 0, method: 'no-match' };
  }

  /**
   * Extract k/K notation: 50k, 1.5K
   * Examples:
   * - "grab 50k" -> 50,000
   * - "cafe 35K" -> 35,000
   * - "gửi xe 2.5k" -> 2,500
   */
  private extractKNotation(text: string): ExtractAmountResponseDto {
    const pattern = /(\d+(?:[.,]\d+)?)\s*k\b/gi;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1]; // Use rightmost match
      const value = parseFloat(match[1].replace(',', '.'));
      const amount = value * 1000;

      return {
        amount: this.validateAmount(amount),
        confidence: 0.85,
        matchedText: match[0],
        method: 'regex-k-notation',
      };
    }

    return { amount: 0, confidence: 0, method: 'no-match' };
  }

  /**
   * Extract plain numbers (fallback)
   * Match numbers with at least 3 digits to avoid matching years, etc.
   * Examples:
   * - "ăn phở 50000" -> 50,000
   * - "mua áo 1.500.000" -> 1,500,000
   */
  private extractPlainNumber(text: string): ExtractAmountResponseDto {
    // Match numbers with at least 3 digits
    const pattern = /\b(\d{3,}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\b/g;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      // Use rightmost number
      const match = matches[matches.length - 1];
      const amountStr = match[1].replace(/[.,]/g, ''); // Remove all separators
      const amount = parseInt(amountStr);

      return {
        amount: this.validateAmount(amount),
        confidence: 0.7,
        matchedText: match[0],
        method: 'regex-plain-number',
      };
    }

    return { amount: 0, confidence: 0, method: 'no-match' };
  }

  /**
   * Validate amount is in reasonable range
   * Returns 0 if amount is invalid
   */
  private validateAmount(amount: number): number {
    // Check for invalid values
    if (isNaN(amount) || !isFinite(amount)) {
      return 0;
    }

    // Minimum amount: 0.01
    if (amount < 0.01) {
      return 0;
    }

    // Maximum amount: ~1 billion (999,999,999)
    if (amount > 999999999) {
      return 0;
    }

    // Round to 2 decimals
    return Math.round(amount * 100) / 100;
  }
}
