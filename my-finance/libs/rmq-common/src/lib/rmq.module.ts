// libs/rmq-common/src/lib/rmq.module.ts
import { DynamicModule, Module } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

export interface RmqClientOptions {
  name: string; // token
  queue: string;
}

@Module({})
export class RmqModule {
  static register(clientOptions: RmqClientOptions): DynamicModule {
    return {
      module: RmqModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: clientOptions.name,
          useFactory: (configService: ConfigService) => {
            const rmqUrl = configService.get<string>('RABBITMQ_URL');
            return ClientProxyFactory.create({
              transport: Transport.RMQ,
              options: {
                urls: [rmqUrl],
                queue: clientOptions.queue,
                queueOptions: { durable: true },
              },
            } as any);
          },
          inject: [ConfigService],
        },
      ],
      exports: [clientOptions.name],
    };
  }
}
