import { Test, TestingModule } from '@nestjs/testing';
import { EventCategoriesService } from './event-categories.service';

describe('EventCategoriesService', () => {
  let service: EventCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventCategoriesService],
    }).compile();

    service = module.get<EventCategoriesService>(EventCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
