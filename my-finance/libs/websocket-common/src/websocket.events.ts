// WebSocket Event Constants for Group and Group Expense realtime updates

// User Events (for personal notifications)
export const USER_EVENTS = {
  // Server -> Client events
  ADDED_TO_GROUP: 'user:added_to_group',
  GROUP_INVITATION: 'user:group_invitation',
  INVITATION_CANCELLED: 'user:invitation_cancelled',

  // Client -> Server events
  JOIN_USER_ROOM: 'user:join_room',
  LEAVE_USER_ROOM: 'user:leave_room',
} as const;

// Invitation Events (for group room notifications)
export const INVITATION_EVENTS = {
  // Server -> Client events (to group room)
  INVITATION_ACCEPTED: 'invitation:accepted',
  INVITATION_REJECTED: 'invitation:rejected',
} as const;

// Group Events
export const GROUP_EVENTS = {
  // Server -> Client events
  MEMBER_JOINED: 'group:member_joined',
  MEMBER_LEFT: 'group:member_left',
  MEMBER_ADDED: 'group:member_added',
  MEMBER_REMOVED: 'group:member_removed',
  OWNERSHIP_TRANSFERRED: 'group:ownership_transferred',
  GROUP_UPDATED: 'group:updated',
  GROUP_DELETED: 'group:deleted',

  // Client -> Server events
  JOIN_GROUP_ROOM: 'group:join_room',
  LEAVE_GROUP_ROOM: 'group:leave_room',
} as const;

// Group Expense Events
export const EXPENSE_EVENTS = {
  // Server -> Client events
  EXPENSE_CREATED: 'expense:created',
  EXPENSE_UPDATED: 'expense:updated',
  EXPENSE_DELETED: 'expense:deleted',
  SHARE_MARKED_PAID: 'expense:share_paid',
  DEBTS_UPDATED: 'expense:debts_updated',

  // Client -> Server events
  JOIN_EXPENSE_ROOM: 'expense:join_room',
  LEAVE_EXPENSE_ROOM: 'expense:leave_room',
} as const;

// Event Payload Types
export interface GroupMemberEventPayload {
  groupId: string;
  memberId: string;
  memberName: string;
  userId?: string | null;
  action: 'joined' | 'left' | 'added' | 'removed';
  timestamp: Date;
}

export interface GroupOwnershipEventPayload {
  groupId: string;
  previousOwnerId: string;
  newOwnerId: string;
  newOwnerMemberId: string;
  newOwnerName: string;
  timestamp: Date;
}

export interface GroupUpdatedEventPayload {
  groupId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

export interface GroupDeletedEventPayload {
  groupId: string;
  deletedByUserId: string;
  timestamp: Date;
}

export interface ExpenseCreatedEventPayload {
  groupId: string;
  expense: {
    id: string;
    title: string;
    amount: string;
    category?: string;
    paidByMemberId: string;
    paidByMemberName?: string;
    splitType: 'equal' | 'exact' | 'percent';
    createdAt: Date;
  };
  shares: Array<{
    id: string;
    memberId: string;
    memberName?: string;
    amount: string;
    isPaid: boolean;
  }>;
  createdByUserId: string;
  timestamp: Date;
}

export interface ExpenseUpdatedEventPayload {
  groupId: string;
  expenseId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}

export interface ExpenseDeletedEventPayload {
  groupId: string;
  expenseId: string;
  deletedByUserId: string;
  timestamp: Date;
}

export interface ShareMarkedPaidEventPayload {
  groupId: string;
  expenseId: string;
  shareId: string;
  memberId: string;
  memberName?: string;
  amount: string;
  paidByMemberId: string;
  paidByMemberName?: string;
  paidAt: Date;
  timestamp: Date;
}

export interface DebtsUpdatedEventPayload {
  groupId: string;
  memberId: string;
  totalOwed: string;
  totalOwedToMe: string;
  timestamp: Date;
}

// User Event Payloads
export interface UserAddedToGroupEventPayload {
  userId: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  memberId: string;
  memberName: string;
  addedByUserId: string;
  addedByMemberName?: string;
  timestamp: Date;
}

// Invitation Event Payloads
export interface GroupInvitationEventPayload {
  invitationId: number;
  userId: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  suggestedMemberName: string;
  invitedByUserId: string;
  invitedByMemberName?: string;
  expiresAt?: Date;
  timestamp: Date;
}

export interface InvitationCancelledEventPayload {
  invitationId: number;
  userId: string;
  groupId: string;
  groupName: string;
  cancelledByUserId: string;
  timestamp: Date;
}

export interface InvitationAcceptedEventPayload {
  invitationId: number;
  groupId: string;
  memberId: string;
  memberName: string;
  userId: string;
  timestamp: Date;
}

export interface InvitationRejectedEventPayload {
  invitationId: number;
  groupId: string;
  userId: string;
  suggestedMemberName: string;
  timestamp: Date;
}
