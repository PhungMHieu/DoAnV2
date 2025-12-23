/**
 * Utility for normalizing Vietnamese text
 * Removes diacritics for easier pattern matching
 */
export class VietnameseNormalizer {
  private static readonly DIACRITICS_MAP: Record<string, string> = {
    'à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ': 'a',
    'è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ': 'e',
    'ì|í|ị|ỉ|ĩ': 'i',
    'ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ': 'o',
    'ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ': 'u',
    'ỳ|ý|ỵ|ỷ|ỹ': 'y',
    'đ': 'd',
    'À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ': 'A',
    'È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ': 'E',
    'Ì|Í|Ị|Ỉ|Ĩ': 'I',
    'Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ': 'O',
    'Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ': 'U',
    'Ỳ|Ý|Ỵ|Ỷ|Ỹ': 'Y',
    'Đ': 'D',
  };

  /**
   * Remove Vietnamese diacritics
   * Example: "nghìn" -> "nghin", "triệu" -> "trieu"
   */
  static removeDiacritics(text: string): string {
    let normalized = text;

    for (const [pattern, replacement] of Object.entries(
      this.DIACRITICS_MAP,
    )) {
      const regex = new RegExp(pattern, 'g');
      normalized = normalized.replace(regex, replacement);
    }

    return normalized;
  }

  /**
   * Normalize for amount extraction
   * - Remove diacritics
   * - Lowercase for consistency
   * - Normalize whitespace
   * - Keep numbers and basic punctuation
   */
  static normalizeForAmountExtraction(text: string): string {
    // Remove diacritics
    let normalized = this.removeDiacritics(text);

    // Lowercase
    normalized = normalized.toLowerCase();

    // Normalize whitespace (multiple spaces to single space)
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }
}
