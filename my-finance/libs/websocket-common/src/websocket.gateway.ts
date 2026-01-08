import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import {
  USER_EVENTS,
  GROUP_EVENTS,
  EXPENSE_EVENTS,
  INVITATION_EVENTS,
  GroupMemberEventPayload,
  GroupOwnershipEventPayload,
  GroupUpdatedEventPayload,
  GroupDeletedEventPayload,
  ExpenseCreatedEventPayload,
  ExpenseUpdatedEventPayload,
  ExpenseDeletedEventPayload,
  ShareMarkedPaidEventPayload,
  DebtsUpdatedEventPayload,
  UserAddedToGroupEventPayload,
  GroupInvitationEventPayload,
  InvitationCancelledEventPayload,
  InvitationAcceptedEventPayload,
  InvitationRejectedEventPayload,
} from './websocket.events';

export interface JoinRoomPayload {
  groupId: string;
  userId?: string;
}

export interface JoinUserRoomPayload {
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/groups',
})
export class GroupWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GroupWebSocketGateway.name);
  private userSocketMap = new Map<string, Set<string>>(); // userId -> Set of socketIds

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up user socket mapping
    for (const [userId, sockets] of this.userSocketMap.entries()) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSocketMap.delete(userId);
      }
    }
  }

  @SubscribeMessage(GROUP_EVENTS.JOIN_GROUP_ROOM)
  handleJoinGroupRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomName = this.getGroupRoomName(payload.groupId);
    client.join(roomName);

    // Track user socket mapping
    if (payload.userId) {
      if (!this.userSocketMap.has(payload.userId)) {
        this.userSocketMap.set(payload.userId, new Set());
      }
      this.userSocketMap.get(payload.userId)?.add(client.id);
    }

    this.logger.log(
      `Client ${client.id} joined room: ${roomName} (userId: ${payload.userId || 'anonymous'})`,
    );

    return { success: true, room: roomName };
  }

  @SubscribeMessage(GROUP_EVENTS.LEAVE_GROUP_ROOM)
  handleLeaveGroupRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomName = this.getGroupRoomName(payload.groupId);
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left room: ${roomName}`);
    return { success: true, room: roomName };
  }

  @SubscribeMessage(EXPENSE_EVENTS.JOIN_EXPENSE_ROOM)
  handleJoinExpenseRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomName = this.getExpenseRoomName(payload.groupId);
    client.join(roomName);
    this.logger.log(`Client ${client.id} joined expense room: ${roomName}`);
    return { success: true, room: roomName };
  }

  @SubscribeMessage(EXPENSE_EVENTS.LEAVE_EXPENSE_ROOM)
  handleLeaveExpenseRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomName = this.getExpenseRoomName(payload.groupId);
    client.leave(roomName);
    this.logger.log(`Client ${client.id} left expense room: ${roomName}`);
    return { success: true, room: roomName };
  }

  // ========== User Room Handlers ==========

  @SubscribeMessage(USER_EVENTS.JOIN_USER_ROOM)
  handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinUserRoomPayload,
  ) {
    const roomName = this.getUserRoomName(payload.userId);
    client.join(roomName);

    // Track user socket mapping
    if (!this.userSocketMap.has(payload.userId)) {
      this.userSocketMap.set(payload.userId, new Set());
    }
    this.userSocketMap.get(payload.userId)?.add(client.id);

    this.logger.log(`Client ${client.id} joined user room: ${roomName}`);
    return { success: true, room: roomName };
  }

  @SubscribeMessage(USER_EVENTS.LEAVE_USER_ROOM)
  handleLeaveUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinUserRoomPayload,
  ) {
    const roomName = this.getUserRoomName(payload.userId);
    client.leave(roomName);

    // Remove from user socket mapping
    const sockets = this.userSocketMap.get(payload.userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSocketMap.delete(payload.userId);
      }
    }

    this.logger.log(`Client ${client.id} left user room: ${roomName}`);
    return { success: true, room: roomName };
  }

  // Helper methods to get room names
  private getGroupRoomName(groupId: string): string {
    return `group:${groupId}`;
  }

  private getExpenseRoomName(groupId: string): string {
    return `expense:${groupId}`;
  }

  private getUserRoomName(userId: string): string {
    return `user:${userId}`;
  }

  // ========== Group Events Emission Methods ==========

  emitMemberJoined(payload: GroupMemberEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(GROUP_EVENTS.MEMBER_JOINED, payload);
    this.logger.debug(`Emitted ${GROUP_EVENTS.MEMBER_JOINED} to ${roomName}`);
  }

  emitMemberLeft(payload: GroupMemberEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(GROUP_EVENTS.MEMBER_LEFT, payload);
    this.logger.debug(`Emitted ${GROUP_EVENTS.MEMBER_LEFT} to ${roomName}`);
  }

  emitMemberAdded(payload: GroupMemberEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(GROUP_EVENTS.MEMBER_ADDED, payload);
    this.logger.debug(`Emitted ${GROUP_EVENTS.MEMBER_ADDED} to ${roomName}`);
  }

  emitMemberRemoved(payload: GroupMemberEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(GROUP_EVENTS.MEMBER_REMOVED, payload);
    this.logger.debug(`Emitted ${GROUP_EVENTS.MEMBER_REMOVED} to ${roomName}`);
  }

  emitOwnershipTransferred(payload: GroupOwnershipEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(GROUP_EVENTS.OWNERSHIP_TRANSFERRED, payload);
    this.logger.debug(
      `Emitted ${GROUP_EVENTS.OWNERSHIP_TRANSFERRED} to ${roomName}`,
    );
  }

  emitGroupUpdated(payload: GroupUpdatedEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(GROUP_EVENTS.GROUP_UPDATED, payload);
    this.logger.debug(`Emitted ${GROUP_EVENTS.GROUP_UPDATED} to ${roomName}`);
  }

  emitGroupDeleted(payload: GroupDeletedEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(GROUP_EVENTS.GROUP_DELETED, payload);
    this.logger.debug(`Emitted ${GROUP_EVENTS.GROUP_DELETED} to ${roomName}`);
  }

  // ========== Expense Events Emission Methods ==========

  emitExpenseCreated(payload: ExpenseCreatedEventPayload) {
    const roomName = this.getExpenseRoomName(payload.groupId);
    this.server.to(roomName).emit(EXPENSE_EVENTS.EXPENSE_CREATED, payload);
    this.logger.debug(
      `Emitted ${EXPENSE_EVENTS.EXPENSE_CREATED} to ${roomName}`,
    );
  }

  emitExpenseUpdated(payload: ExpenseUpdatedEventPayload) {
    const roomName = this.getExpenseRoomName(payload.groupId);
    this.server.to(roomName).emit(EXPENSE_EVENTS.EXPENSE_UPDATED, payload);
    this.logger.debug(
      `Emitted ${EXPENSE_EVENTS.EXPENSE_UPDATED} to ${roomName}`,
    );
  }

  emitExpenseDeleted(payload: ExpenseDeletedEventPayload) {
    const roomName = this.getExpenseRoomName(payload.groupId);
    this.server.to(roomName).emit(EXPENSE_EVENTS.EXPENSE_DELETED, payload);
    this.logger.debug(
      `Emitted ${EXPENSE_EVENTS.EXPENSE_DELETED} to ${roomName}`,
    );
  }

  emitShareMarkedPaid(payload: ShareMarkedPaidEventPayload) {
    const roomName = this.getExpenseRoomName(payload.groupId);
    this.server.to(roomName).emit(EXPENSE_EVENTS.SHARE_MARKED_PAID, payload);
    this.logger.debug(
      `Emitted ${EXPENSE_EVENTS.SHARE_MARKED_PAID} to ${roomName}`,
    );
  }

  emitDebtsUpdated(payload: DebtsUpdatedEventPayload) {
    const roomName = this.getExpenseRoomName(payload.groupId);
    this.server.to(roomName).emit(EXPENSE_EVENTS.DEBTS_UPDATED, payload);
    this.logger.debug(
      `Emitted ${EXPENSE_EVENTS.DEBTS_UPDATED} to ${roomName}`,
    );
  }

  // Emit to specific user across all their connected sockets
  emitToUser(userId: string, event: string, payload: unknown) {
    const sockets = this.userSocketMap.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, payload);
      }
      this.logger.debug(
        `Emitted ${event} to user ${userId} (${sockets.size} sockets)`,
      );
    }
  }

  // ========== User Events Emission Methods ==========

  /**
   * Emit event to notify a user they were added to a group
   * This sends to the user's personal room (user:{userId})
   */
  emitUserAddedToGroup(payload: UserAddedToGroupEventPayload) {
    const roomName = this.getUserRoomName(payload.userId);
    this.server.to(roomName).emit(USER_EVENTS.ADDED_TO_GROUP, payload);
    this.logger.debug(
      `Emitted ${USER_EVENTS.ADDED_TO_GROUP} to ${roomName} for group ${payload.groupId}`,
    );
  }

  // ========== Invitation Events Emission Methods ==========

  /**
   * Emit invitation to a user's personal room
   */
  emitGroupInvitation(payload: GroupInvitationEventPayload) {
    const roomName = this.getUserRoomName(payload.userId);
    this.server.to(roomName).emit(USER_EVENTS.GROUP_INVITATION, payload);
    this.logger.debug(
      `Emitted ${USER_EVENTS.GROUP_INVITATION} to ${roomName} for group ${payload.groupId}`,
    );
  }

  /**
   * Emit invitation cancelled to a user's personal room
   */
  emitInvitationCancelled(payload: InvitationCancelledEventPayload) {
    const roomName = this.getUserRoomName(payload.userId);
    this.server.to(roomName).emit(USER_EVENTS.INVITATION_CANCELLED, payload);
    this.logger.debug(
      `Emitted ${USER_EVENTS.INVITATION_CANCELLED} to ${roomName} for group ${payload.groupId}`,
    );
  }

  /**
   * Emit invitation accepted to group room (so all members know)
   */
  emitInvitationAccepted(payload: InvitationAcceptedEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(INVITATION_EVENTS.INVITATION_ACCEPTED, payload);
    this.logger.debug(
      `Emitted ${INVITATION_EVENTS.INVITATION_ACCEPTED} to ${roomName}`,
    );
  }

  /**
   * Emit invitation rejected to group room (so inviter knows)
   */
  emitInvitationRejected(payload: InvitationRejectedEventPayload) {
    const roomName = this.getGroupRoomName(payload.groupId);
    this.server.to(roomName).emit(INVITATION_EVENTS.INVITATION_REJECTED, payload);
    this.logger.debug(
      `Emitted ${INVITATION_EVENTS.INVITATION_REJECTED} to ${roomName}`,
    );
  }
}
