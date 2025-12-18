import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Middleware to extract user ID from JWT token
 * Used when Kong has already validated the JWT
 * This middleware extracts the 'sub' claim and sets it as x-user-id header
 */
@Injectable()
export class JwtExtractMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // If x-user-id already exists (from direct call or testing), skip
    if (req.headers['x-user-id']) {
      return next();
    }

    // Try to extract from Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // Decode without verification (Kong already verified)
        const decoded = jwt.decode(token) as { sub?: string; email?: string };
        if (decoded && decoded.sub) {
          req.headers['x-user-id'] = decoded.sub;
        }
      } catch (error) {
        // Token decode failed, continue without x-user-id
        console.warn('Failed to decode JWT:', error.message);
      }
    }

    next();
  }
}
