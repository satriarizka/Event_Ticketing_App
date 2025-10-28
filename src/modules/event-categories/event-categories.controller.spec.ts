import { Test, TestingModule } from '@nestjs/testing';
import { EventCategoriesController } from './event-categories.controller';

describe('EventCategoriesController', () => {
  let controller: EventCategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventCategoriesController],
    }).compile();

    controller = module.get<EventCategoriesController>(EventCategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
