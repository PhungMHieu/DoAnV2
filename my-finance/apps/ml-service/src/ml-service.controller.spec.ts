import { Test, TestingModule } from '@nestjs/testing';
import { MlServiceController } from './ml-service.controller';
import { MlServiceService } from './ml-service.service';

describe('MlServiceController', () => {
  let mlServiceController: MlServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MlServiceController],
      providers: [MlServiceService],
    }).compile();

    mlServiceController = app.get<MlServiceController>(MlServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(mlServiceController.getHello()).toBe('Hello World!');
    });
  });
});
