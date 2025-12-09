import { Test, TestingModule } from '@nestjs/testing';
import { RedisCommonService } from './redis-common.service';

describe('RedisCommonService', () => {
  let service: RedisCommonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisCommonService],
    }).compile();

    service = module.get<RedisCommonService>(RedisCommonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
