import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ReportServiceService } from './report-service.service';

@Controller()
export class ReportEventController {
  private readonly logger = new Logger(ReportEventController.name);
  
  constructor(private readonly reportService: ReportServiceService) {}

  @EventPattern('transaction.created')
  async handleTransactionCreated(@Payload() payload: any) {
    this.logger.log('Received transaction.created event:', JSON.stringify(payload));
    
    try {
      const result = await this.reportService.handleCreated(payload);
      this.logger.log('Successfully processed transaction.created event');
      return result;
    } catch (error) {
      this.logger.error('Error processing transaction.created event:', error);
      throw error;
    }
  }

  @EventPattern('transaction.updated')
  async handleTransactionUpdated(@Payload() payload: any) {
    this.logger.log('Received transaction.updated event:', JSON.stringify(payload));
    
    try {
      const result = await this.reportService.handleUpdated(payload);
      this.logger.log('Successfully processed transaction.updated event');
      return result;
    } catch (error) {
      this.logger.error('Error processing transaction.updated event:', error);
      throw error;
    }
  }

  @EventPattern('transaction.deleted')
  async handleTransactionDeleted(@Payload() payload: any) {
    this.logger.log('Received transaction.deleted event:', JSON.stringify(payload));
    
    try {
      const result = await this.reportService.handleDeleted(payload);
      this.logger.log('Successfully processed transaction.deleted event');
      return result;
    } catch (error) {
      this.logger.error('Error processing transaction.deleted event:', error);
      throw error;
    }
  }
}