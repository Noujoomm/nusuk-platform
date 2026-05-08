import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma.module';
import { TextEnhancerController } from './text-enhancer.controller';
import { TextEnhancerService } from './text-enhancer.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [TextEnhancerController],
  providers: [TextEnhancerService],
  exports: [TextEnhancerService],
})
export class TextEnhancerModule {}
