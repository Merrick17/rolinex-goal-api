import { Module } from '@nestjs/common';
import { CapabilitiesService } from './capabilities.service';

@Module({
  providers: [CapabilitiesService],
  exports: [CapabilitiesService],
})
export class PlatformModule {}
