/**
 * Danh sách categories chuẩn trong hệ thống
 * Đồng bộ với categories được sử dụng trong Transaction và Report services
 */
export const CATEGORIES = {
  // Thu nhập
  INCOME: 'income',

  // Chi tiêu
  FOOD: 'food',
  TRANSPORT: 'transport',
  ENTERTAINMENT: 'entertainment',
  SHOPPING: 'shopping',
  HEALTHCARE: 'healthcare',
  EDUCATION: 'education',
  BILLS: 'bills',
  HOUSING: 'housing',
  PERSONAL: 'personal',
  OTHER: 'other',
} as const;

export type CategoryType = typeof CATEGORIES[keyof typeof CATEGORIES];

/**
 * Keyword mapping cho từng category
 * Sử dụng để bootstrap classifier trước khi có ML model
 */
export const CATEGORY_KEYWORDS: Record<CategoryType, string[]> = {
  [CATEGORIES.INCOME]: [
    // Tiếng Việt
    'lương', 'thưởng', 'thu nhập', 'tiền lãi', 'cổ tức', 'nhận tiền',
    'thu', 'trả lương', 'được trả', 'kiếm được', 'tiền về',
    // Tiếng Anh
    'salary', 'bonus', 'income', 'interest', 'dividend', 'receive',
    'earn', 'paid', 'payment received', 'refund',
  ],

  [CATEGORIES.FOOD]: [
    // Tiếng Việt - Đồ ăn
    'ăn', 'cơm', 'phở', 'bún', 'bánh', 'mì', 'quán', 'nhà hàng',
    'cafe', 'cà phê', 'trà sữa', 'ăn sáng', 'ăn trưa', 'ăn tối',
    'buffet', 'bữa ăn', 'gọi món', 'ship đồ ăn', 'grabfood', 'shopeefood',
    'beeFood', 'gofood', 'food', 'order', 'đồ ăn', 'thức ăn',
    'lẩu', 'nướng', 'gà rán', 'pizza', 'burger', 'sushi',
    'highlands', 'starbucks', 'kfc', 'lotteria', 'jollibee',
    // Cửa hàng/vendor
    'coopmart', 'vinmart', 'circle k', 'ministop', 'gs25', 'family mart',
  ],

  [CATEGORIES.TRANSPORT]: [
    // Tiếng Việt - Đi lại
    'grab', 'uber', 'be', 'taxi', 'xe ôm', 'xe buýt', 'bus',
    'xăng', 'dầu', 'đổ xăng', 'xe', 'gửi xe', 'đậu xe', 'parking',
    'vé xe', 'vé tàu', 'vé máy bay', 'flight', 'bay', 'tàu',
    'bảo dưỡng xe', 'sửa xe', 'rửa xe', 'đi lại', 'di chuyển',
    // Apps
    'grabcar', 'grabbike', 'be bike', 'be car', 'gojek',
  ],

  [CATEGORIES.ENTERTAINMENT]: [
    // Tiếng Việt - Giải trí
    'vui chơi', 'giải trí', 'xem phim', 'cinema', 'rap', 'cgv', 'lotte',
    'galaxy', 'game', 'netflix', 'spotify', 'youtube premium',
    'karaoke', 'bar', 'club', 'du lịch', 'travel', 'tour',
    'khách sạn', 'hotel', 'resort', 'vé', 'ticket', 'concert',
    'sự kiện', 'event', 'show', 'biểu diễn', 'spa', 'massage',
  ],

  [CATEGORIES.SHOPPING]: [
    // Tiếng Việt - Mua sắm
    'mua', 'shopping', 'quần áo', 'giày', 'dép', 'áo', 'đồ',
    'thời trang', 'fashion', 'phụ kiện', 'túi', 'balo', 'ví',
    'mỹ phẩm', 'cosmetic', 'nước hoa', 'perfume', 'son', 'lipstick',
    'lazada', 'shopee', 'tiki', 'sendo', 'zalora',
    'uniqlo', 'zara', 'h&m', 'adidas', 'nike', 'converse',
    'điện thoại', 'laptop', 'macbook', 'iphone', 'samsung',
    'điện tử', 'electronics', 'thegioididong', 'fpt shop',
  ],

  [CATEGORIES.HEALTHCARE]: [
    // Tiếng Việt - Sức khỏe
    'bác sĩ', 'doctor', 'khám bệnh', 'bệnh viện', 'hospital',
    'phòng khám', 'clinic', 'thuốc', 'medicine', 'nhà thuốc',
    'pharmacy', 'pharmacity', 'long châu', 'an khang',
    'xét nghiệm', 'test', 'chích ngừa', 'vaccine', 'tiêm',
    'răng', 'nha khoa', 'dental', 'mắt', 'kính', 'glasses',
    'bảo hiểm y tế', 'health insurance',
  ],

  [CATEGORIES.EDUCATION]: [
    // Tiếng Việt - Giáo dục
    'học', 'study', 'học phí', 'tuition', 'trường', 'school',
    'khóa học', 'course', 'lớp', 'class', 'giáo trình', 'sách',
    'book', 'udemy', 'coursera', 'edx', 'skillshare',
    'ielts', 'toeic', 'tiếng anh', 'english', 'ngoại ngữ',
    'đào tạo', 'training', 'workshop', 'seminar', 'hội thảo',
  ],

  [CATEGORIES.BILLS]: [
    // Tiếng Việt - Hóa đơn định kỳ
    'hóa đơn', 'bill', 'điện', 'nước', 'electricity', 'water',
    'internet', 'wifi', 'điện thoại', 'phone bill', 'mobile',
    'viettel', 'mobifone', 'vinaphone', 'vnpt', 'fpt',
    'cáp', 'cable', 'truyền hình', 'tv', 'netflix', 'spotify',
    'phí', 'fee', 'service charge', 'phí dịch vụ', 'phí quản lý',
  ],

  [CATEGORIES.HOUSING]: [
    // Tiếng Việt - Nhà ở
    'nhà', 'house', 'rent', 'thuê nhà', 'tiền nhà', 'tiền trọ',
    'phòng trọ', 'apartment', 'chung cư', 'căn hộ',
    'sửa chữa', 'repair', 'bảo trì', 'maintenance', 'sơn',
    'nội thất', 'furniture', 'đồ dùng', 'ikea', 'nhà xinh',
    'đèn', 'quạt', 'máy lạnh', 'tủ', 'giường', 'bàn', 'ghế',
  ],

  [CATEGORIES.PERSONAL]: [
    // Tiếng Việt - Cá nhân
    'cắt tóc', 'haircut', 'salon', 'nail', 'móng', 'wax',
    'gym', 'fitness', 'yoga', 'thể thao', 'sport', 'bơi',
    'quà', 'gift', 'tặng', 'từ thiện', 'charity', 'donate',
    'birthday', 'sinh nhật', 'kỷ niệm', 'anniversary',
  ],

  [CATEGORIES.OTHER]: [
    // Fallback
    'khác', 'other', 'misc', 'miscellaneous', 'other expenses',
  ],
};

/**
 * Danh sách tất cả categories để suggest cho user
 */
export const ALL_CATEGORIES: CategoryType[] = Object.values(CATEGORIES);

/**
 * Categories mặc định khi không predict được
 */
export const DEFAULT_CATEGORY: CategoryType = CATEGORIES.OTHER;
