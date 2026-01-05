import { CategoryType, CATEGORIES } from './category.constants';

/**
 * N-gram keywords với priority cao hơn single keywords
 * Format: { phrase: string, category: CategoryType, weight: number }
 */
export const NGRAM_KEYWORDS: Array<{
  phrase: string;
  category: CategoryType;
  weight: number;
}> = [
  // ============ FOOD - Trigrams & Bigrams ============
  { phrase: 'grab food', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'grabfood', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'shopee food', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'shopeefood', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'bee food', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'beefood', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'go food', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'gofood', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'now food', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'ship đồ ăn', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'order đồ ăn', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'đặt đồ ăn', category: CATEGORIES.FOOD, weight: 1.0 },
  { phrase: 'ăn sáng', category: CATEGORIES.FOOD, weight: 0.95 },
  { phrase: 'ăn trưa', category: CATEGORIES.FOOD, weight: 0.95 },
  { phrase: 'ăn tối', category: CATEGORIES.FOOD, weight: 0.95 },
  { phrase: 'ăn vặt', category: CATEGORIES.FOOD, weight: 0.95 },
  { phrase: 'ăn uống', category: CATEGORIES.FOOD, weight: 0.95 },
  { phrase: 'đi ăn', category: CATEGORIES.FOOD, weight: 0.95 },
  { phrase: 'đi cafe', category: CATEGORIES.FOOD, weight: 0.9 },
  { phrase: 'đi cà phê', category: CATEGORIES.FOOD, weight: 0.9 },
  { phrase: 'uống cafe', category: CATEGORIES.FOOD, weight: 0.9 },
  { phrase: 'uống cà phê', category: CATEGORIES.FOOD, weight: 0.9 },
  { phrase: 'trà sữa', category: CATEGORIES.FOOD, weight: 0.95 },
  { phrase: 'bữa ăn', category: CATEGORIES.FOOD, weight: 0.9 },
  { phrase: 'gọi món', category: CATEGORIES.FOOD, weight: 0.9 },
  { phrase: 'mua đồ ăn', category: CATEGORIES.FOOD, weight: 0.95 },

  // ============ TRANSPORTATION ============
  { phrase: 'grab car', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'grabcar', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'grab bike', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'grabbike', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'be car', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'be bike', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'xanh sm', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'đổ xăng', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'tiền xăng', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'gửi xe', category: CATEGORIES.TRANSPORTATION, weight: 0.95 },
  { phrase: 'đậu xe', category: CATEGORIES.TRANSPORTATION, weight: 0.95 },
  { phrase: 'phí gửi xe', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'tiền gửi xe', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'vé xe', category: CATEGORIES.TRANSPORTATION, weight: 0.95 },
  { phrase: 'vé tàu', category: CATEGORIES.TRANSPORTATION, weight: 0.9 },
  { phrase: 'đi xe', category: CATEGORIES.TRANSPORTATION, weight: 0.85 },
  { phrase: 'bảo dưỡng xe', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'sửa xe', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'rửa xe', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'bảo hiểm xe', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'phí cầu đường', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },
  { phrase: 'phí cao tốc', category: CATEGORIES.TRANSPORTATION, weight: 1.0 },

  // ============ TRAVEL ============
  { phrase: 'vé máy bay', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'đặt phòng', category: CATEGORIES.TRAVEL, weight: 0.95 },
  { phrase: 'book phòng', category: CATEGORIES.TRAVEL, weight: 0.95 },
  { phrase: 'tiền khách sạn', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'tiền hotel', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'đi du lịch', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'tour du lịch', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'vietnam airlines', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'viet jet', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'vietjet', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'bamboo airways', category: CATEGORIES.TRAVEL, weight: 1.0 },
  { phrase: 'pacific airlines', category: CATEGORIES.TRAVEL, weight: 1.0 },

  // ============ SHOPPING ============
  { phrase: 'mua quần áo', category: CATEGORIES.SHOPPING, weight: 1.0 },
  { phrase: 'mua giày', category: CATEGORIES.SHOPPING, weight: 1.0 },
  { phrase: 'mua áo', category: CATEGORIES.SHOPPING, weight: 0.95 },
  { phrase: 'mua váy', category: CATEGORIES.SHOPPING, weight: 1.0 },
  { phrase: 'ăn mặc', category: CATEGORIES.SHOPPING, weight: 1.0 },
  { phrase: 'thời trang', category: CATEGORIES.SHOPPING, weight: 1.0 },
  { phrase: 'mỹ phẩm', category: CATEGORIES.SHOPPING, weight: 1.0 },
  { phrase: 'nước hoa', category: CATEGORIES.SHOPPING, weight: 1.0 },

  // ============ HOUSEWARE ============
  { phrase: 'mua điện thoại', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'mua laptop', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'mua máy tính', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'điện máy xanh', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'thế giới di động', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'fpt shop', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'nguyễn kim', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'máy giặt', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'máy lạnh', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'điều hòa', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'tủ lạnh', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'nồi chiên', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'air fryer', category: CATEGORIES.HOUSEWARE, weight: 1.0 },
  { phrase: 'máy hút bụi', category: CATEGORIES.HOUSEWARE, weight: 1.0 },

  // ============ HOME ============
  { phrase: 'tiền nhà', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'tiền trọ', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'thuê nhà', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'thuê phòng', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'sửa nhà', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'mua nội thất', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'đồ nội thất', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'thợ sửa', category: CATEGORIES.HOME, weight: 0.9 },
  { phrase: 'thợ điện', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'thợ nước', category: CATEGORIES.HOME, weight: 1.0 },
  { phrase: 'dọn nhà', category: CATEGORIES.HOME, weight: 0.95 },
  { phrase: 'giúp việc', category: CATEGORIES.HOME, weight: 1.0 },

  // ============ UTILITIES ============
  { phrase: 'tiền điện', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'tiền nước', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'tiền mạng', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'tiền internet', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'tiền wifi', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'hóa đơn điện', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'hóa đơn nước', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'cước điện thoại', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'nạp điện thoại', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'nạp tiền điện thoại', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'gói cước', category: CATEGORIES.UTILITIES, weight: 0.95 },
  { phrase: 'phí chung cư', category: CATEGORIES.UTILITIES, weight: 1.0 },
  { phrase: 'phí quản lý', category: CATEGORIES.UTILITIES, weight: 0.9 },

  // ============ HEALTH ============
  { phrase: 'khám bệnh', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'khám tổng quát', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'đi khám', category: CATEGORIES.HEALTH, weight: 0.95 },
  { phrase: 'mua thuốc', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'tiền thuốc', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'nhà thuốc', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'bệnh viện', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'phòng khám', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'nha khoa', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'làm răng', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'chữa răng', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'tiêm vaccine', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'chích ngừa', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'xét nghiệm', category: CATEGORIES.HEALTH, weight: 1.0 },
  { phrase: 'bảo hiểm y tế', category: CATEGORIES.HEALTH, weight: 1.0 },

  // ============ EDUCATION ============
  { phrase: 'học phí', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'tiền học', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'đóng học', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'khóa học', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'mua sách', category: CATEGORIES.EDUCATION, weight: 0.95 },
  { phrase: 'tiền sách', category: CATEGORIES.EDUCATION, weight: 0.95 },
  { phrase: 'gia sư', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'học tiếng anh', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'học ngoại ngữ', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'thi ielts', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'thi toeic', category: CATEGORIES.EDUCATION, weight: 1.0 },
  { phrase: 'luyện thi', category: CATEGORIES.EDUCATION, weight: 1.0 },

  // ============ ENTERTAINMENT ============
  { phrase: 'xem phim', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'đi xem phim', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'vé phim', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'vé cgv', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'đi karaoke', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'hát karaoke', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'chơi game', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'nạp game', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'vé concert', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'đi spa', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },
  { phrase: 'đi massage', category: CATEGORIES.ENTERTAINMENT, weight: 1.0 },

  // ============ PERSONAL ============
  { phrase: 'cắt tóc', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'làm tóc', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'làm nail', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'làm móng', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'đi gym', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'tập gym', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'phí gym', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'tập yoga', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'mua quà', category: CATEGORIES.PERSONAL, weight: 0.95 },
  { phrase: 'quà sinh nhật', category: CATEGORIES.PERSONAL, weight: 1.0 },
  { phrase: 'quà tặng', category: CATEGORIES.PERSONAL, weight: 0.95 },

  // ============ FAMILY ============
  { phrase: 'tiền con', category: CATEGORIES.FAMILY, weight: 0.95 },
  { phrase: 'cho con', category: CATEGORIES.FAMILY, weight: 0.9 },
  { phrase: 'mua cho con', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'tiền bỉm', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'mua bỉm', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'mua tã', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'sữa bột', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'mua sữa cho bé', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'đồ chơi', category: CATEGORIES.FAMILY, weight: 0.9 },
  { phrase: 'biếu bố mẹ', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'cho bố mẹ', category: CATEGORIES.FAMILY, weight: 0.95 },
  { phrase: 'tiền chu cấp', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'tiền hiếu hỉ', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'đám cưới', category: CATEGORIES.FAMILY, weight: 1.0 },
  { phrase: 'đám giỗ', category: CATEGORIES.FAMILY, weight: 1.0 },

  // ============ INVESTMENT ============
  { phrase: 'mua cổ phiếu', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'bán cổ phiếu', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'đầu tư', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'chứng khoán', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'gửi tiết kiệm', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'tiền tiết kiệm', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'mua vàng', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'mua bitcoin', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'mua crypto', category: CATEGORIES.INVESTMENT, weight: 1.0 },
  { phrase: 'nạp binance', category: CATEGORIES.INVESTMENT, weight: 1.0 },

  // ============ DONATION & CHARITY ============
  { phrase: 'quyên góp', category: CATEGORIES.DONATION, weight: 1.0 },
  { phrase: 'ủng hộ', category: CATEGORIES.DONATION, weight: 0.95 },
  { phrase: 'cứu trợ', category: CATEGORIES.DONATION, weight: 1.0 },
  { phrase: 'tặng cho quỹ', category: CATEGORIES.DONATION, weight: 1.0 },
  { phrase: 'cho quỹ', category: CATEGORIES.DONATION, weight: 0.95 },
  { phrase: 'quỹ từ thiện', category: CATEGORIES.DONATION, weight: 1.0 },
  { phrase: 'quỹ vì trẻ em', category: CATEGORIES.DONATION, weight: 1.0 },
  { phrase: 'quỹ trẻ em', category: CATEGORIES.DONATION, weight: 1.0 },
  { phrase: 'quỹ hỗ trợ', category: CATEGORIES.DONATION, weight: 1.0 },
  { phrase: 'đóng góp', category: CATEGORIES.DONATION, weight: 0.95 },
  { phrase: 'từ thiện', category: CATEGORIES.CHARITY, weight: 1.0 },
  { phrase: 'thiện nguyện', category: CATEGORIES.CHARITY, weight: 1.0 },
  { phrase: 'giúp đỡ người nghèo', category: CATEGORIES.CHARITY, weight: 1.0 },
  { phrase: 'vì trẻ em', category: CATEGORIES.CHARITY, weight: 0.95 },
  { phrase: 'vì người nghèo', category: CATEGORIES.CHARITY, weight: 0.95 },

  // ============ INCOME ============
  { phrase: 'nhận lương', category: CATEGORIES.INCOME, weight: 1.0 },
  { phrase: 'tiền lương', category: CATEGORIES.INCOME, weight: 1.0 },
  { phrase: 'lương tháng', category: CATEGORIES.INCOME, weight: 1.0 },
  { phrase: 'tiền thưởng', category: CATEGORIES.INCOME, weight: 1.0 },
  { phrase: 'nhận thưởng', category: CATEGORIES.INCOME, weight: 1.0 },
  { phrase: 'hoàn tiền', category: CATEGORIES.INCOME, weight: 1.0 },
  { phrase: 'được hoàn', category: CATEGORIES.INCOME, weight: 0.95 },
  { phrase: 'nhận tiền', category: CATEGORIES.INCOME, weight: 0.9 },
  { phrase: 'chuyển khoản đến', category: CATEGORIES.INCOME, weight: 0.95 },
  { phrase: 'nhận chuyển khoản', category: CATEGORIES.INCOME, weight: 0.95 },
];

/**
 * Keyword weights - Một số keyword quan trọng hơn
 * Default weight = 1.0
 */
export const KEYWORD_WEIGHTS: Record<string, number> = {
  // High weight - Rất specific
  grabfood: 1.5,
  shopeefood: 1.5,
  'grab food': 1.5,
  'shopee food': 1.5,
  grabcar: 1.5,
  grabbike: 1.5,
  vietjet: 1.5,
  'vietnam airlines': 1.5,
  netflix: 1.3,
  spotify: 1.3,
  lazada: 1.3,
  shopee: 1.2,
  tiki: 1.3,
  cgv: 1.4,
  lotte: 1.2,
  vinmec: 1.5,
  pharmacity: 1.4,
  'long châu': 1.4,
  udemy: 1.4,
  coursera: 1.4,
  binance: 1.5,
  bitcoin: 1.5,
  ethereum: 1.5,

  // Medium weight - Khá specific
  phở: 1.2,
  lẩu: 1.2,
  'trà sữa': 1.3,
  cafe: 1.1,
  'cà phê': 1.1,
  taxi: 1.2,
  xăng: 1.3,
  thuốc: 1.2,
  'bệnh viện': 1.3,
  'học phí': 1.3,
  'tiền nhà': 1.4,
  'tiền điện': 1.4,
  'tiền nước': 1.4,

  // Low weight - Quá chung chung
  mua: 0.5,
  tiền: 0.4,
  trả: 0.4,
  đi: 0.3,
  ăn: 0.7,
  uống: 0.6,
  làm: 0.4,
};

/**
 * Negative keywords - Loại trừ category khi gặp từ này
 * Format: { keyword: string, excludeFrom: CategoryType[] }
 */
export const NEGATIVE_KEYWORDS: Array<{
  keyword: string;
  excludeFrom: CategoryType[];
}> = [
  // "ăn mặc" không phải food
  { keyword: 'ăn mặc', excludeFrom: [CATEGORIES.FOOD] },
  // "grab food" không phải transportation
  { keyword: 'grab food', excludeFrom: [CATEGORIES.TRANSPORTATION] },
  { keyword: 'grabfood', excludeFrom: [CATEGORIES.TRANSPORTATION] },
  { keyword: 'shopee food', excludeFrom: [CATEGORIES.TRANSPORTATION] },
  { keyword: 'shopeefood', excludeFrom: [CATEGORIES.TRANSPORTATION] },
  // "xe đẩy" (stroller) không phải transportation
  { keyword: 'xe đẩy', excludeFrom: [CATEGORIES.TRANSPORTATION] },
  { keyword: 'xe đồ chơi', excludeFrom: [CATEGORIES.TRANSPORTATION] },
  // "bánh xe" không phải food
  { keyword: 'bánh xe', excludeFrom: [CATEGORIES.FOOD] },
  // "sữa rửa mặt" không phải family (sữa bột)
  { keyword: 'sữa rửa mặt', excludeFrom: [CATEGORIES.FAMILY] },
  { keyword: 'sữa tắm', excludeFrom: [CATEGORIES.FAMILY] },
  // "điện thoại" trong context bill khác với mua điện thoại
  { keyword: 'cước điện thoại', excludeFrom: [CATEGORIES.HOUSEWARE] },
  { keyword: 'nạp điện thoại', excludeFrom: [CATEGORIES.HOUSEWARE] },
];

/**
 * Amount range hints - Gợi ý category dựa trên amount
 * Format: { min: number, max: number, likely: CategoryType[], unlikely: CategoryType[] }
 */
export const AMOUNT_HINTS: Array<{
  min: number;
  max: number;
  likely: CategoryType[];
  unlikely: CategoryType[];
  boost: number; // Boost confidence cho likely categories
}> = [
  // Rất nhỏ (< 50k) - Thường là food, transportation nhỏ
  {
    min: 0,
    max: 50000,
    likely: [CATEGORIES.FOOD, CATEGORIES.TRANSPORTATION],
    unlikely: [
      CATEGORIES.HOME,
      CATEGORIES.INVESTMENT,
      CATEGORIES.TRAVEL,
      CATEGORIES.HOUSEWARE,
    ],
    boost: 1.1,
  },
  // Nhỏ (50k - 200k) - Food, transportation, personal
  {
    min: 50000,
    max: 200000,
    likely: [
      CATEGORIES.FOOD,
      CATEGORIES.TRANSPORTATION,
      CATEGORIES.PERSONAL,
      CATEGORIES.ENTERTAINMENT,
    ],
    unlikely: [CATEGORIES.HOME, CATEGORIES.INVESTMENT, CATEGORIES.TRAVEL],
    boost: 1.05,
  },
  // Trung bình (200k - 1tr) - Utilities, shopping, health
  {
    min: 200000,
    max: 1000000,
    likely: [
      CATEGORIES.UTILITIES,
      CATEGORIES.SHOPPING,
      CATEGORIES.HEALTH,
      CATEGORIES.EDUCATION,
    ],
    unlikely: [],
    boost: 1.05,
  },
  // Lớn (1tr - 5tr) - Home, education, travel
  {
    min: 1000000,
    max: 5000000,
    likely: [
      CATEGORIES.HOME,
      CATEGORIES.EDUCATION,
      CATEGORIES.TRAVEL,
      CATEGORIES.HOUSEWARE,
      CATEGORIES.HEALTH,
    ],
    unlikely: [CATEGORIES.FOOD],
    boost: 1.1,
  },
  // Rất lớn (> 5tr) - Home, investment, travel
  {
    min: 5000000,
    max: Infinity,
    likely: [
      CATEGORIES.HOME,
      CATEGORIES.INVESTMENT,
      CATEGORIES.TRAVEL,
      CATEGORIES.HOUSEWARE,
    ],
    unlikely: [CATEGORIES.FOOD, CATEGORIES.TRANSPORTATION],
    boost: 1.15,
  },
];

/**
 * Vietnamese text normalization mappings
 * Chuẩn hóa các cách viết khác nhau về một dạng
 */
export const VIETNAMESE_NORMALIZATIONS: Record<string, string> = {
  // Teencode & abbreviations
  k: 'không',
  ko: 'không',
  'k0': 'không',
  dc: 'được',
  đc: 'được',
  vs: 'với',
  j: 'gì',
  z: 'vậy',
  r: 'rồi',
  m: 'mình',
  b: 'bạn',
  a: 'anh',
  e: 'em',
  cf: 'cafe',
  'cà fê': 'cà phê',
  coffe: 'coffee',
  cofee: 'coffee',

  // Common typos
  grap: 'grab',
  grabs: 'grab',
  shoppee: 'shopee',
  lazda: 'lazada',
  netfix: 'netflix',
  spotifi: 'spotify',

  // Variations
  'hoá đơn': 'hóa đơn',
  'điện thoai': 'điện thoại',
  'tien': 'tiền',
  'an': 'ăn',
  'uong': 'uống',
  'di': 'đi',
  'xe om': 'xe ôm',
  'ca phe': 'cà phê',
  'tra sua': 'trà sữa',
};
