import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

interface MemberIdResponse {
  memberId: number;
  name: string;
  joined: boolean;
}

@Injectable()
export class GroupClientService {
  private readonly groupServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.groupServiceUrl =
      this.configService.get<string>('GROUP_SERVICE_URL') ||
      'http://localhost:3004';
  }

  /**
   * Get member ID for a user in a specific group
   * Calls: GET /:groupId/my-member-id
   * Note: This method receives userId but group-service uses JWT middleware
   * The calling code should pass the JWT token from the original request
   */
  async getMyMemberId(groupId: string, authToken: string): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<MemberIdResponse>(
          `${this.groupServiceUrl}/${groupId}/my-member-id`,
          {
            headers: {
              Authorization: authToken, // Pass the full Authorization header
            },
          },
        ),
      );

      return response.data.memberId;
    } catch (error: any) {
      console.error(`[GroupClient] Failed to get member ID:`, error.message);
      console.error(`[GroupClient] Error details:`, error.response?.data);
      throw new Error(
        `Unable to get member ID: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Get userId for a specific member ID
   * Returns null if member hasn't joined yet
   */
  async getUserIdFromMemberId(
    groupId: string,
    memberId: number,
  ): Promise<string | null> {
    try {
      console.log(
        `[GroupClient] Fetching userId for memberId=${memberId} from ${this.groupServiceUrl}/members/${memberId}/user-id`,
      );
      const response = await firstValueFrom(
        this.httpService.get<{ userId: string | null }>(
          `${this.groupServiceUrl}/members/${memberId}/user-id`,
        ),
      );
      console.log(
        `[GroupClient] Got userId: ${response.data.userId} for memberId=${memberId}`,
      );
      return response.data.userId;
    } catch (error: any) {
      console.error(
        `[GroupClient] Failed to get userId for memberId=${memberId}:`,
        error.message,
      );
      console.error(`[GroupClient] Error details:`, {
        url: `${this.groupServiceUrl}/members/${memberId}/user-id`,
        status: error.response?.status,
        data: error.response?.data,
      });
      return null;
    }
  }

  /**
   * Get member info by member ID
   */
  async getMemberById(
    groupId: string,
    memberId: number,
  ): Promise<{ id: number; name: string; userId: string | null }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          id: number;
          name: string;
          userId: string | null;
        }>(`${this.groupServiceUrl}/${groupId}/members/${memberId}`),
      );
      return response.data;
    } catch (error: any) {
      console.error(`[GroupClient] Failed to get member by ID:`, error.message);
      throw new Error(
        `Unable to get member: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
