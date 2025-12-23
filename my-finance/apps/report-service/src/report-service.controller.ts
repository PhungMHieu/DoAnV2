import { Controller, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiQuery,
  ApiBearerAuth,
  ApiParam
} from '@nestjs/swagger';
import { ReportServiceService } from './report-service.service';
import { getUserIdFromRequest } from '@app/common/middleware/jwt-extract.middleware';
import type { Request } from 'express';
@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller()
export class ReportServiceController {
  constructor(private readonly reportService: ReportServiceService) {}

  private getUserId(req: Request): string {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new UnauthorizedException('Missing or invalid JWT token');
    }
    return userId;
  }

  @Get('transactions/summary')
  @ApiOperation({ 
    summary: 'Get monthly transaction summary',
    description: 'Retrieves monthly summary including income, expenses by category, and account balance'
  })
  @ApiQuery({
    name: 'monthYear',
    description: 'Month and year in MM/YYYY format',
    example: '12/2024',
    required: true
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string', example: '12/2024' },
        currency: { type: 'string', example: 'VND' },
        data: {
          type: 'object',
          example: {
            'food': 150000,
            'transport': 80000,
            'entertainment': 120000,
            'income': 1000000
          }
        },
        totals: {
          type: 'object',
          properties: {
            expense: { type: 'number', example: 350000 },
            income: { type: 'number', example: 1000000 },
            balance: { type: 'number', example: 2500000 }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid monthYear format' })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async getSummary(
    @Req() req: Request,
    @Query('monthYear') monthYear: string,
  ) {
    const userId = this.getUserId(req);
    return this.reportService.getMonthlySummary(userId, monthYear);
  }

  @Get('stats/line')
  @ApiOperation({ 
    summary: 'Get line chart statistics',
    description: 'Retrieves daily cumulative expense data for current month and previous month comparison'
  })
  @ApiQuery({
    name: 'monthYear',
    description: 'Month and year in MM/YYYY format',
    example: '12/2024',
    required: true
  })
  @ApiResponse({
    status: 200,
    description: 'Line chart data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        currentMonth: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'number', example: 15 },
              total: { type: 'number', example: 125000 }
            }
          }
        },
        previousMonth: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'number', example: 15 },
              total: { type: 'number', example: 105000 }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid monthYear format' })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async getLine(
    @Req() req: Request,
    @Query('monthYear') monthYear: string,
  ) {
    const userId = this.getUserId(req);
    return this.reportService.getLineStats(userId, monthYear);
  }

  @Get('stats/pie')
  @ApiOperation({ 
    summary: 'Get pie chart statistics',
    description: 'Retrieves expense breakdown by category for pie chart visualization'
  })
  @ApiQuery({
    name: 'monthYear',
    description: 'Month and year in MM/YYYY format',
    example: '12/2024',
    required: true
  })
  @ApiResponse({
    status: 200,
    description: 'Pie chart data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string', example: '12/2024' },
        currency: { type: 'string', example: 'VND' },
        data: {
          type: 'object',
          example: {
            'food': 150000,
            'transport': 80000,
            'entertainment': 120000
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid monthYear format' })
  @ApiResponse({ status: 401, description: 'Missing x-user-id header' })
  async getPie(
    @Req() req: Request,
    @Query('monthYear') monthYear: string,
  ) {
    const userId = this.getUserId(req);
    return this.reportService.getPieStats(userId, monthYear);
  }
}