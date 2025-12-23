import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MlServiceModule } from '../src/ml-service.module';

describe('ML Service Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MlServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable validation pipes for proper DTO validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /extract-amount', () => {
    it('should extract amount from k notation', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'ăn phở 50k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(50000);
          expect(res.body.confidence).toBeGreaterThan(0.8);
          expect(res.body.method).toBe('regex-k-notation');
          expect(res.body.matchedText).toBeDefined();
        });
    });

    it('should extract amount from Vietnamese words (nghìn)', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'grab về nhà 35 nghìn' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(35000);
          expect(res.body.confidence).toBe(0.9);
          expect(res.body.method).toBe('regex-nghin');
        });
    });

    it('should extract amount from Vietnamese words (triệu)', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'mua laptop 15 triệu' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(15000000);
          expect(res.body.confidence).toBe(0.9);
          expect(res.body.method).toBe('regex-trieu');
        });
    });

    it('should extract complex Vietnamese pattern', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'điện thoại 1 triệu 500 nghìn' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(1500000);
          expect(res.body.confidence).toBe(0.95);
          expect(res.body.method).toBe('regex-complex-vietnamese');
        });
    });

    it('should extract amount from trăm nghìn', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'áo khoác 5 trăm nghìn' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(500000);
          expect(res.body.confidence).toBe(0.9);
          expect(res.body.method).toBe('regex-tram-nghin');
        });
    });

    it('should extract plain number', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'cơm trưa 50000' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(50000);
          expect(res.body.method).toBe('regex-plain-number');
        });
    });

    it('should return 0 when no amount found', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'ăn phở ngon' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(0);
          expect(res.body.confidence).toBe(0.1);
          expect(res.body.method).toBe('not-found');
        });
    });

    it('should return 400 for empty text (validation)', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: '' })
        .expect(400); // ValidationPipe rejects empty strings
    });

    it('should return 400 for missing text field', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({})
        .expect(400);
    });

    it('should handle decimal amounts', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text: 'gửi xe 2.5k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(2500);
          expect(res.body.method).toBe('regex-k-notation');
        });
    });
  });

  describe('POST /predict-category', () => {
    it('should predict food category from Vietnamese text', () => {
      return request(app.getHttpServer())
        .post('/predict-category')
        .send({ note: 'ăn phở', amount: 50000 })
        .expect(201)
        .expect((res) => {
          expect(res.body.category).toBe('food');
          expect(res.body.confidence).toBeGreaterThan(0);
          expect(res.body.suggestions).toBeInstanceOf(Array);
          expect(res.body.model).toBeDefined();
        });
    });

    it('should predict transport category', () => {
      return request(app.getHttpServer())
        .post('/predict-category')
        .send({ note: 'grab về nhà', amount: 35000 })
        .expect(201)
        .expect((res) => {
          expect(res.body.category).toBe('transport');
          expect(res.body.suggestions).toBeInstanceOf(Array);
        });
    });

    it('should predict shopping category', () => {
      return request(app.getHttpServer())
        .post('/predict-category')
        .send({ note: 'mua áo', amount: 200000 })
        .expect(201)
        .expect((res) => {
          expect(res.body.category).toBe('shopping');
        });
    });

    it('should work without amount', () => {
      return request(app.getHttpServer())
        .post('/predict-category')
        .send({ note: 'cafe' })
        .expect(201)
        .expect((res) => {
          expect(res.body.category).toBeDefined();
          expect(res.body.confidence).toBeGreaterThan(0);
        });
    });

    it('should return 400 for missing note field', () => {
      return request(app.getHttpServer())
        .post('/predict-category')
        .send({})
        .expect(400);
    });
  });

  describe('POST /analyze-transaction', () => {
    it('should analyze transaction with k notation', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text: 'ăn phở 50k' })
        .expect(201)
        .expect((res) => {
          // Amount extraction
          expect(res.body.amount).toBe(50000);
          expect(res.body.amountConfidence).toBeGreaterThan(0.8);
          expect(res.body.extractionMethod).toBe('regex-k-notation');
          expect(res.body.matchedText).toBeDefined();

          // Category prediction
          expect(res.body.category).toBe('food');
          expect(res.body.categoryConfidence).toBeGreaterThan(0);
          expect(res.body.suggestions).toBeInstanceOf(Array);
          expect(res.body.model).toBeDefined();
        });
    });

    it('should analyze grab transaction', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text: 'grab về nhà 35 nghìn' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(35000);
          expect(res.body.category).toBe('transport');
        });
    });

    it('should analyze shopping transaction', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text: 'mua áo 200k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(200000);
          expect(res.body.category).toBe('shopping');
        });
    });

    it('should analyze coffee transaction', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text: 'cafe highlands 45k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(45000);
          expect(res.body.category).toBe('food');
        });
    });

    it('should handle text without amount', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text: 'ăn phở ngon' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(0);
          expect(res.body.category).toBe('food');
        });
    });

    it('should analyze complex Vietnamese pattern', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text: 'mua laptop 1 triệu 500 nghìn' })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(1500000);
          expect(res.body.category).toBe('shopping');
          expect(res.body.extractionMethod).toBe('regex-complex-vietnamese');
        });
    });

    it('should return 400 for missing text field', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({})
        .expect(400);
    });

    it('should return 400 for empty text (validation)', () => {
      return request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text: '' })
        .expect(400);
    });
  });

  describe('POST /analyze-multi-transactions', () => {
    it('should analyze multiple transactions separated by period', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'mua tạp dề 50k. ăn phở 90k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(2);
          expect(res.body.transactions).toHaveLength(2);

          // First transaction
          expect(res.body.transactions[0].amount).toBe(50000);
          expect(res.body.transactions[0].category).toBe('shopping');
          expect(res.body.transactions[0].sentence).toContain('tạp dề');

          // Second transaction
          expect(res.body.transactions[1].amount).toBe(90000);
          expect(res.body.transactions[1].category).toBe('food');
          expect(res.body.transactions[1].sentence).toContain('phở');
        });
    });

    it('should analyze transactions separated by comma', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'grab 35k, cafe 45k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(2);
          expect(res.body.transactions[0].amount).toBe(35000);
          expect(res.body.transactions[0].category).toBe('transport');
          expect(res.body.transactions[1].amount).toBe(45000);
          expect(res.body.transactions[1].category).toBe('food');
        });
    });

    it('should analyze transactions separated by "và"', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'mua áo 200k và ăn phở 50k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(2);
          expect(res.body.transactions[0].amount).toBe(200000);
          expect(res.body.transactions[0].category).toBe('shopping');
          expect(res.body.transactions[1].amount).toBe(50000);
          expect(res.body.transactions[1].category).toBe('food');
        });
    });

    it('should analyze transactions separated by "còn"', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'grab 35k còn cafe 40k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(2);
        });
    });

    it('should analyze complex real-world example', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({
          text: 'tôi đi chơi với bạn và đã mua 1 cái tạp dề 50k. Chúng tôi còn ăn phở 90k',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(2);
          expect(res.body.transactions[0].amount).toBe(50000);
          expect(res.body.transactions[1].amount).toBe(90000);
        });
    });

    it('should handle 3+ transactions', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'ăn phở 50k, grab 35k, cafe 45k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(3);
          expect(res.body.transactions).toHaveLength(3);
        });
    });

    it('should ignore sentences without amount', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'hôm nay đi chơi. ăn phở 50k. thật vui' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(1);
          expect(res.body.transactions[0].amount).toBe(50000);
        });
    });

    it('should return 0 transactions for text without amounts', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'hôm nay đi chơi với bạn' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(0);
          expect(res.body.transactions).toHaveLength(0);
        });
    });

    it('should handle mixed separators', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'ăn phở 50k, grab 35k. cafe 45k và mua áo 200k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(4);
        });
    });

    it('should return transaction details', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: 'ăn phở 50k. grab 35k' })
        .expect(201)
        .expect((res) => {
          expect(res.body.transactions[0]).toHaveProperty('sentence');
          expect(res.body.transactions[0]).toHaveProperty('amount');
          expect(res.body.transactions[0]).toHaveProperty('amountConfidence');
          expect(res.body.transactions[0]).toHaveProperty('matchedText');
          expect(res.body.transactions[0]).toHaveProperty('extractionMethod');
          expect(res.body.transactions[0]).toHaveProperty('category');
          expect(res.body.transactions[0]).toHaveProperty('categoryConfidence');
          expect(res.body.transactions[0]).toHaveProperty('suggestions');
          expect(res.body.transactions[0]).toHaveProperty('model');
        });
    });

    it('should return 400 for missing text field', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({})
        .expect(400);
    });

    it('should return 400 for empty text (validation)', () => {
      return request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: '' })
        .expect(400);
    });
  });

  describe('POST /batch-predict-category', () => {
    it('should batch predict categories', () => {
      return request(app.getHttpServer())
        .post('/batch-predict-category')
        .send([
          { note: 'ăn phở', amount: 50000 },
          { note: 'grab về nhà', amount: 35000 },
          { note: 'mua áo', amount: 200000 },
        ])
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveLength(3);
          expect(res.body[0].category).toBe('food');
          expect(res.body[1].category).toBe('transport');
          expect(res.body[2].category).toBe('shopping');
        });
    });

    it('should handle empty array', () => {
      return request(app.getHttpServer())
        .post('/batch-predict-category')
        .send([])
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveLength(0);
        });
    });
  });

  describe('Integration: Full transaction flow', () => {
    it('should handle complete workflow: extract + categorize', async () => {
      const text = 'mua laptop dell 15 triệu 500 nghìn';

      // Step 1: Extract amount
      const amountRes = await request(app.getHttpServer())
        .post('/extract-amount')
        .send({ text })
        .expect(201);

      expect(amountRes.body.amount).toBe(15500000);

      // Step 2: Predict category
      const categoryRes = await request(app.getHttpServer())
        .post('/predict-category')
        .send({ note: text, amount: amountRes.body.amount })
        .expect(201);

      expect(categoryRes.body.category).toBe('shopping');

      // Step 3: Verify combined endpoint gives same result
      const combinedRes = await request(app.getHttpServer())
        .post('/analyze-transaction')
        .send({ text })
        .expect(201);

      expect(combinedRes.body.amount).toBe(amountRes.body.amount);
      expect(combinedRes.body.category).toBe(categoryRes.body.category);
    });

    it('should handle Vietnamese text with various formats in multi-transaction', async () => {
      const complexText =
        'Hôm nay tôi ăn sáng phở 50 nghìn, grab đi làm 35k. Trưa mua cơm văn phòng 45000, cafe chiều 40k. Tối về grab 30 ngàn';

      const res = await request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: complexText })
        .expect(201);

      expect(res.body.count).toBeGreaterThanOrEqual(4);

      // Verify each transaction has all required fields
      res.body.transactions.forEach((tx) => {
        expect(tx.amount).toBeGreaterThan(0);
        expect(tx.category).toBeDefined();
        expect(tx.amountConfidence).toBeGreaterThan(0);
        expect(tx.categoryConfidence).toBeGreaterThan(0);
      });
    });
  });

  describe('Error handling', () => {
    it('should return 400 for invalid JSON', () => {
      return request(app.getHttpServer())
        .post('/extract-amount')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should return 404 for non-existent endpoint', () => {
      return request(app.getHttpServer())
        .post('/non-existent-endpoint')
        .send({ text: 'test' })
        .expect(404);
    });
  });

  describe('Performance', () => {
    it('should handle large text efficiently', async () => {
      const largeText = 'ăn phở 50k. '.repeat(100); // 100 transactions

      const startTime = Date.now();
      const res = await request(app.getHttpServer())
        .post('/analyze-multi-transactions')
        .send({ text: largeText })
        .expect(201);

      const duration = Date.now() - startTime;

      expect(res.body.count).toBeGreaterThan(50); // Should find most transactions
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should process batch predictions quickly', async () => {
      const batchSize = 50;
      const batch = Array.from({ length: batchSize }, (_, i) => ({
        note: `transaction ${i}`,
        amount: 50000 + i * 1000,
      }));

      const startTime = Date.now();
      await request(app.getHttpServer())
        .post('/batch-predict-category')
        .send(batch)
        .expect(201);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });
});
