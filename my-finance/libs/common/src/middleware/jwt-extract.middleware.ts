import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Utility function to extract user ID directly from JWT token
 * @param authHeader Authorization header (Bearer token)
 * @returns User ID (sub claim) or null if not found
 */
export function extractUserIdFromToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.decode(token) as { sub?: string; email?: string };
    return decoded?.sub || null;
  } catch (error) {
    console.warn('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Utility function to extract user ID from request object
 * @param req Express request object
 * @returns User ID or null
 */
export function getUserIdFromRequest(req: Request): string | null {
  // First check if x-user-id already exists in headers
  const existingUserId = req.headers['x-user-id'] as string;
  if (existingUserId) {
    return existingUserId;
  }

  // Extract from Authorization header
  return extractUserIdFromToken(req.headers['authorization']);
}

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

    // Extract user ID and set as header
    const userId = extractUserIdFromToken(req.headers['authorization']);
    if (userId) {
      req.headers['x-user-id'] = userId;
    }

    next();
  }
}
