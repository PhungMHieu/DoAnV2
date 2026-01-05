// import { Test, TestingModule } from '@nestjs/testing';
// import { AmountExtractorService } from './amount-extractor.service';

// describe('AmountExtractorService', () => {
//   let service: AmountExtractorService;

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [AmountExtractorService],
//     }).compile();

//     service = module.get<AmountExtractorService>(AmountExtractorService);
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('Plain numbers', () => {
//     it('should extract plain number', () => {
//       const result = service.extractAmount('ăn phở 50000');
//       expect(result.amount).toBe(50000);
//       expect(result.confidence).toBeGreaterThan(0.6);
//       expect(result.method).toBe('regex-plain-number');
//     });

//     it('should extract with thousand separator (dot)', () => {
//       const result = service.extractAmount('mua áo 1.500.000');
//       expect(result.amount).toBe(1500000);
//       expect(result.method).toBe('regex-plain-number');
//     });

//     it('should extract with thousand separator (comma)', () => {
//       const result = service.extractAmount('laptop 25,000,000');
//       expect(result.amount).toBe(25000000);
//       expect(result.method).toBe('regex-plain-number');
//     });

//     it('should use rightmost number when multiple', () => {
//       const result = service.extractAmount('chuyển từ 100000 thành 50000');
//       expect(result.amount).toBe(50000);
//     });

//     it('should ignore 2-digit numbers like years', () => {
//       const result = service.extractAmount('năm 24 mua xe');
//       expect(result.amount).toBe(0);
//       expect(result.method).toBe('not-found');
//     });
//   });

//   describe('k/K notation', () => {
//     it('should extract 50k', () => {
//       const result = service.extractAmount('grab 50k');
//       expect(result.amount).toBe(50000);
//       expect(result.method).toBe('regex-k-notation');
//       expect(result.confidence).toBe(0.85);
//     });

//     it('should extract 35K (uppercase)', () => {
//       const result = service.extractAmount('cafe 35K');
//       expect(result.amount).toBe(35000);
//       expect(result.method).toBe('regex-k-notation');
//     });

//     it('should extract decimal k notation', () => {
//       const result = service.extractAmount('gửi xe 2.5k');
//       expect(result.amount).toBe(2500);
//       expect(result.method).toBe('regex-k-notation');
//     });

//     it('should extract k notation with comma', () => {
//       const result = service.extractAmount('tiền tip 1,5k');
//       expect(result.amount).toBe(1500);
//     });

//     it('should prefer k notation over plain number', () => {
//       const result = service.extractAmount('2024 năm nay grab 50k');
//       expect(result.amount).toBe(50000);
//       expect(result.method).toBe('regex-k-notation');
//     });
//   });

//   describe('Vietnamese words - nghìn/ngàn', () => {
//     it('should extract "nghìn" with diacritics', () => {
//       const result = service.extractAmount('ăn sáng 50 nghìn');
//       expect(result.amount).toBe(50000);
//       expect(result.method).toBe('regex-nghin');
//       expect(result.confidence).toBe(0.9);
//     });

//     it('should extract "nghin" without diacritics', () => {
//       const result = service.extractAmount('com trua 50 nghin');
//       expect(result.amount).toBe(50000);
//       expect(result.method).toBe('regex-nghin');
//     });

//     it('should extract "ngàn" variant', () => {
//       const result = service.extractAmount('cafe 35 ngàn');
//       expect(result.amount).toBe(35000);
//     });

//     it('should extract "ngan" without diacritics', () => {
//       const result = service.extractAmount('tra sua 45 ngan');
//       expect(result.amount).toBe(45000);
//     });

//     it('should extract decimal nghìn', () => {
//       const result = service.extractAmount('gửi xe 2.5 nghìn');
//       expect(result.amount).toBe(2500);
//     });
//   });

//   describe('Vietnamese words - triệu', () => {
//     it('should extract "triệu" with diacritics', () => {
//       const result = service.extractAmount('mua điện thoại 15 triệu');
//       expect(result.amount).toBe(15000000);
//       expect(result.method).toBe('regex-trieu');
//       expect(result.confidence).toBe(0.9);
//     });

//     it('should extract "trieu" without diacritics', () => {
//       const result = service.extractAmount('laptop 25 trieu');
//       expect(result.amount).toBe(25000000);
//     });

//     it('should extract decimal triệu', () => {
//       const result = service.extractAmount('máy tính bảng 7.5 triệu');
//       expect(result.amount).toBe(7500000);
//     });

//     it('should extract triệu with comma decimal', () => {
//       const result = service.extractAmount('tai nghe 2,5 triệu');
//       expect(result.amount).toBe(2500000);
//     });
//   });

//   describe('Vietnamese words - trăm nghìn', () => {
//     it('should extract "trăm nghìn" with diacritics', () => {
//       const result = service.extractAmount('áo khoác 5 trăm nghìn');
//       expect(result.amount).toBe(500000);
//       expect(result.method).toBe('regex-tram-nghin');
//       expect(result.confidence).toBe(0.9);
//     });

//     it('should extract "tram nghin" without diacritics', () => {
//       const result = service.extractAmount('giay 8 tram nghin');
//       expect(result.amount).toBe(800000);
//     });

//     it('should extract "trăm ngàn"', () => {
//       const result = service.extractAmount('quần jean 7 trăm ngàn');
//       expect(result.amount).toBe(700000);
//     });
//   });

//   describe('Complex Vietnamese patterns', () => {
//     it('should extract "triệu nghìn" combination', () => {
//       const result = service.extractAmount('laptop 1 triệu 500 nghìn');
//       expect(result.amount).toBe(1500000);
//       expect(result.method).toBe('regex-complex-vietnamese');
//       expect(result.confidence).toBe(0.95);
//     });

//     it('should extract "triệu nghin" without diacritics', () => {
//       const result = service.extractAmount('may tinh 2 trieu 300 nghin');
//       expect(result.amount).toBe(2300000);
//     });

//     it('should extract complex with decimals', () => {
//       const result = service.extractAmount('điện thoại 10.5 triệu 200 nghìn');
//       expect(result.amount).toBe(10700000);
//     });

//     it('should prefer complex pattern over simple triệu', () => {
//       const result = service.extractAmount('mua laptop 1 triệu 500 nghìn');
//       expect(result.amount).toBe(1500000);
//       expect(result.method).toBe('regex-complex-vietnamese');
//     });
//   });

//   describe('Edge cases', () => {
//     it('should return 0 for empty text', () => {
//       const result = service.extractAmount('');
//       expect(result.amount).toBe(0);
//       expect(result.confidence).toBe(0.1);
//       expect(result.method).toBe('empty-text');
//     });

//     it('should return 0 for whitespace only', () => {
//       const result = service.extractAmount('   ');
//       expect(result.amount).toBe(0);
//       expect(result.method).toBe('empty-text');
//     });

//     it('should return 0 when no number found', () => {
//       const result = service.extractAmount('ăn phở ngon');
//       expect(result.amount).toBe(0);
//       expect(result.method).toBe('not-found');
//     });

//     it('should return 0 when no number found (Vietnamese only)', () => {
//       const result = service.extractAmount('hôm nay đi chơi vui');
//       expect(result.amount).toBe(0);
//     });

//     it('should handle text with only unit words', () => {
//       const result = service.extractAmount('nghìn triệu tỷ');
//       expect(result.amount).toBe(0);
//     });
//   });

//   describe('Amount validation', () => {
//     it('should return 0 for amount less than 0.01', () => {
//       // This would require special test setup as regex won't match such small values
//       const result = service.extractAmount('0.001');
//       expect(result.amount).toBe(0);
//     });

//     it('should return 0 for amount exceeding 999,999,999', () => {
//       const result = service.extractAmount('mua nhà 9999999999');
//       expect(result.amount).toBe(0);
//     });

//     it('should accept amount at upper boundary', () => {
//       const result = service.extractAmount('999999999');
//       expect(result.amount).toBe(999999999);
//     });

//     it('should round to 2 decimals', () => {
//       const result = service.extractAmount('1.555 triệu');
//       // 1.555 * 1000000 = 1555000, should round correctly
//       expect(result.amount).toBe(1555000);
//     });
//   });

//   describe('Real-world examples', () => {
//     it('should extract from common food transaction', () => {
//       const result = service.extractAmount('ăn phở bò tài chín 50k');
//       expect(result.amount).toBe(50000);
//     });

//     it('should extract from grab/taxi transaction', () => {
//       const result = service.extractAmount('grab về nhà 35 nghìn');
//       expect(result.amount).toBe(35000);
//     });

//     it('should extract from shopping transaction', () => {
//       const result = service.extractAmount('mua áo thun uniqlo 2 trăm nghìn');
//       expect(result.amount).toBe(200000);
//     });

//     it('should extract from coffee transaction', () => {
//       const result = service.extractAmount('highlands cà phê sữa đá 45k');
//       expect(result.amount).toBe(45000);
//     });

//     it('should extract from electronics purchase', () => {
//       const result = service.extractAmount(
//         'mua iphone 15 pro max 25 triệu 500 nghìn',
//       );
//       expect(result.amount).toBe(25500000);
//     });

//     it('should extract from rent payment', () => {
//       const result = service.extractAmount('tiền thuê nhà tháng 12 5.5 triệu');
//       expect(result.amount).toBe(5500000);
//     });

//     it('should extract from utilities', () => {
//       const result = service.extractAmount('điện nước tháng 11: 850k');
//       expect(result.amount).toBe(850000);
//     });

//     it('should extract with mixed Vietnamese and English', () => {
//       const result = service.extractAmount('starbucks latte size venti 120k');
//       expect(result.amount).toBe(120000);
//     });
//   });

//   describe('Priority and confidence', () => {
//     it('should use higher confidence method when multiple matches', () => {
//       // "50k" should win over plain "50" because k notation has higher specificity
//       const result = service.extractAmount('từ 50 lên 50k');
//       expect(result.amount).toBe(50000);
//       expect(result.method).toBe('regex-k-notation');
//     });

//     it('should prefer Vietnamese words over k notation', () => {
//       const result = service.extractAmount('50k hoặc 60 nghìn');
//       expect(result.amount).toBe(60000);
//       expect(result.method).toBe('regex-nghin');
//     });

//     it('should prefer triệu over nghìn', () => {
//       const result = service.extractAmount('100 nghìn hoặc 1.5 triệu');
//       expect(result.amount).toBe(1500000);
//       expect(result.method).toBe('regex-trieu');
//     });

//     it('should prefer complex pattern over simple patterns', () => {
//       const result = service.extractAmount('1 triệu hoặc 1 triệu 200 nghìn');
//       expect(result.amount).toBe(1200000);
//       expect(result.method).toBe('regex-complex-vietnamese');
//     });
//   });

//   describe('Matched text tracking', () => {
//     it('should return matched text for k notation', () => {
//       const result = service.extractAmount('grab 50k');
//       expect(result.matchedText).toBeDefined();
//       expect(result.matchedText).toContain('50');
//       expect(result.matchedText).toContain('k');
//     });

//     it('should return matched text for Vietnamese words', () => {
//       const result = service.extractAmount('ăn phở 50 nghìn');
//       expect(result.matchedText).toBeDefined();
//     });

//     it('should not have matched text when no match', () => {
//       const result = service.extractAmount('ăn phở ngon');
//       expect(result.matchedText).toBeUndefined();
//     });
//   });
// });
