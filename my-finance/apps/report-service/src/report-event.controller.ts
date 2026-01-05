import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ReportServiceService } from './report-service.service';
import { TransactionEventDto } from './dto';

@Controller()
export class ReportEventController {
  private readonly logger = new Logger(ReportEventController.name);

  constructor(private readonly reportService: ReportServiceService) {}

  @EventPattern('transaction.created')
  async handleTransactionCreated(@Payload() payload: TransactionEventDto) {
    this.logger.log(`Received transaction.created: ${payload.transactionId}`);
    return this.reportService.handleCreated(payload);
  }

  @EventPattern('transaction.updated')
  async handleTransactionUpdated(@Payload() payload: TransactionEventDto) {
    this.logger.log(`Received transaction.updated: ${payload.transactionId}`);
    return this.reportService.handleUpdated(payload);
  }

  @EventPattern('transaction.deleted')
  async handleTransactionDeleted(@Payload() payload: TransactionEventDto) {
    this.logger.log(`Received transaction.deleted: ${payload.transactionId}`);
    return this.reportService.handleDeleted(payload);
  }
}
