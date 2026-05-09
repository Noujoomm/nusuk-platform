import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EnhanceTextDto } from './dto/enhance-text.dto';
import { TextEnhancerService } from './text-enhancer.service';

/**
 * POST /api/text-enhancer/enhance
 *   - Diagnose, enhance, write audit log (accepted=false), return result.
 *   - 20 calls/hour/user (the global throttler ttl=60s/limit=100 wouldn't
 *     bite this on its own, but we want this endpoint specifically to
 *     resist abuse — Anthropic calls are real money).
 *
 * PATCH /api/text-enhancer/audit/:id/accept
 *   - Flips the existing audit row to accepted=true. Idempotent.
 *   - Caller must own the row; foreign auditId returns 404.
 *
 * Same auth roles as voice-fill: admin / pm / track_lead. Employees
 * don't author reports through this UI today, so they don't need it.
 */
@Controller('text-enhancer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TextEnhancerController {
  constructor(private readonly service: TextEnhancerService) {}

  @Post('enhance')
  @Roles('admin', 'pm', 'track_lead')
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  enhance(
    @Body() body: EnhanceTextDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.enhance({
      text: body.text,
      trackId: body.trackId,
      fieldContext: body.fieldContext,
      userId: user.id,
    });
  }

  @Patch('audit/:id/accept')
  @Roles('admin', 'pm', 'track_lead')
  accept(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.accept(id, user.id);
  }
}
