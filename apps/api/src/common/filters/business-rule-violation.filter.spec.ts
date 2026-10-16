import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { BusinessRuleViolation } from '../errors/business-rule-violation.js';
import { BusinessRuleViolationFilter } from './business-rule-violation.filter.js';

@Controller('violation')
class ViolationController {
  @Get()
  fail(): never {
    throw new BusinessRuleViolation('BR-08', 'qtyIn exceeds the previous good quantity');
  }
}

describe('BusinessRuleViolationFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ViolationController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new BusinessRuleViolationFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps a BusinessRuleViolation to 409 with a stable code and no stack trace', async () => {
    const response = await request(app.getHttpServer()).get('/violation');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: 'BUSINESS_RULE_VIOLATION',
      brId: 'BR-08',
      message: 'qtyIn exceeds the previous good quantity',
    });
  });
});
