import { Module, Global } from '@nestjs/common';
import { GroupWebSocketGateway } from './websocket.gateway';

@Global()
@Module({
  providers: [GroupWebSocketGateway],
  exports: [GroupWebSocketGateway],
})
export class WebSocketCommonModule {}
