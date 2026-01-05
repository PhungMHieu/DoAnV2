import { Injectable, Logger } from '@nestjs/common';
import { VietnameseNormalizer } from './utils/vietnamese-normalizer';

@Injectable()
export class AmountExtractorService {
  private readonly logger = new Logger(AmountExtractorService.name);

  /**
   * Extract amount from Vietnamese text
   * Returns the amount as a number (0 if not found)
   */
  extractAmount(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    const normalized = VietnameseNormalizer.normalizeForAmountExtraction(text);

    // Try extraction strategies in order (most specific first)
    const amount =
      this.extractComplexVietnamese(normalized) ||
      this.extractTrieu(normalized) ||
      this.extractNghin(normalized) ||
      this.extractKNotation(normalized) ||
      this.extractPlainNumber(normalized);

    if (amount > 0) {
      this.logger.debug(`Extracted ${amount} from: "${text}"`);
    }

    return amount;
  }

  /** Extract "X triệu Y nghìn" -> X,Y00,000 */
  private extractComplexVietnamese(text: string): number {
    const pattern =
      /(\d+(?:[.,]\d+)?)\s*(?:trieu|triệu)\s+(\d+(?:[.,]\d+)?)\s*(?:nghin|nghìn|ngan|ngàn)/gi;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      const millions = parseFloat(match[1].replace(',', '.'));
      const thousands = parseFloat(match[2].replace(',', '.'));
      return this.validate(millions * 1000000 + thousands * 1000);
    }
    return 0;
  }

  /** Extract "X triệu" -> X,000,000 */
  private extractTrieu(text: string): number {
    const pattern = /(\d+(?:[.,]\d+)?)\s*(?:trieu|triệu)/gi;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      const value = parseFloat(match[1].replace(',', '.'));
      return this.validate(value * 1000000);
    }
    return 0;
  }

  /** Extract "X nghìn" or "X trăm nghìn" */
  private extractNghin(text: string): number {
    // Try "trăm nghìn" first (hundreds of thousands)
    const tramNghinPattern =
      /(\d+)\s*(?:tram|trăm)\s*(?:nghin|nghìn|ngan|ngàn)/gi;
    let matches = Array.from(text.matchAll(tramNghinPattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      return this.validate(parseInt(match[1]) * 100000);
    }

    // Try simple "nghìn"
    const nghinPattern = /(\d+(?:[.,]\d+)?)\s*(?:nghin|nghìn|ngan|ngàn)/gi;
    matches = Array.from(text.matchAll(nghinPattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      const value = parseFloat(match[1].replace(',', '.'));
      return this.validate(value * 1000);
    }
    return 0;
  }

  /** Extract "Xk" -> X,000 */
  private extractKNotation(text: string): number {
    const pattern = /(\d+(?:[.,]\d+)?)\s*k\b/gi;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      const value = parseFloat(match[1].replace(',', '.'));
      return this.validate(value * 1000);
    }
    return 0;
  }

  /** Extract plain numbers (4+ digits) */
  private extractPlainNumber(text: string): number {
    const pattern = /(\d{1,3}(?:[.,]\d{3})+|\d{4,})/g;
    const matches = Array.from(text.matchAll(pattern));

    if (matches.length > 0) {
      const match = matches[matches.length - 1];
      const amountStr = match[1].replace(/[.,]/g, '');
      return this.validate(parseInt(amountStr));
    }
    return 0;
  }

  /** Validate amount is in reasonable range */
  private validate(amount: number): number {
    if (isNaN(amount) || !isFinite(amount) || amount < 1 || amount > 999999999) {
      return 0;
    }
    return Math.round(amount);
  }
}
