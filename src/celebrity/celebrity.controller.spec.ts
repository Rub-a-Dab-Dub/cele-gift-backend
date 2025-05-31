import { Test, TestingModule } from '@nestjs/testing';
import { CelebrityController } from './celebrity.controller';
import { CelebrityService } from './services/celebrity.service';

describe('CelebrityController', () => {
  let controller: CelebrityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CelebrityController],
      providers: [CelebrityService],
    }).compile();

    controller = module.get<CelebrityController>(CelebrityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
