import { Injectable } from '@nestjs/common';

@Injectable()
export class MlServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
