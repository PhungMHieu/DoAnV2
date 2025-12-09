import { Test, TestingModule } from '@nestjs/testing';
import { AuthCommonService } from './auth-common.service';

describe('AuthCommonService', () => {
  let service: AuthCommonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthCommonService],
    }).compile();

    service = module.get<AuthCommonService>(AuthCommonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
