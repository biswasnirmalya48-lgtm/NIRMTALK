export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null, auth: any) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

export interface UserProfile {
  userId: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL: string;
  status: 'online' | 'offline';
  lastSeen: any; // Timestamp
  bio?: string;
  phoneNumber?: string;
  blockedUsers?: string[];
  settings?: {
    theme?: 'light' | 'dark' | 'auto';
    accentColor?: string;
    fontSize?: 'small' | 'medium' | 'large';
    chatBubbleStyle?: 'rounded' | 'square';
    chatWallpaper?: string;
    hapticsEnabled?: boolean;
    autoDownloadMedia?: boolean;
    language?: string;
    privacy?: {
      lastSeen?: 'everyone' | 'contacts' | 'nobody';
      profilePhoto?: 'everyone' | 'contacts' | 'nobody';
      whoCanMessage?: 'everyone' | 'contacts';
      whoCanCall?: 'everyone' | 'contacts' | 'nobody';
      readReceipts?: boolean;
    };
  };
}

export interface CallSession {
  id: string; // Document ID of the call
  chatId: string;
  callerId: string;
  calleeId: string;
  type: 'audio' | 'video';
  status: 'calling' | 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed' | 'busy';
  offer?: any;
  answer?: any;
  startedAt?: any;
  endedAt?: any;
  createdAt: any;
}

export interface Chat {
  id: string; // Document ID
  type: 'direct' | 'group';
  name?: string;
  photoURL?: string;
  members: string[]; // array of user IDs
  updatedAt: any;
  lastMessage?: string;
  pinnedMessage?: {
    id: string;
    text: string;
    senderName: string;
  } | null;
  typing?: Record<string, any>; // userId -> timestamp
  readReceipts?: Record<string, string>; // userId -> timestamp ISO string or something (so it can be sent via rules, or just use FieldValue timestamp)
  clearedHistory?: Record<string, any>; // userId -> timestamp
  deletedBy?: Record<string, boolean>; // userId -> true
}

export interface Message {
  id: string; // Document ID
  senderId: string;
  text: string;
  createdAt: any;
  editedAt?: any;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  reactions?: Record<string, string>; // userId -> emoji
  isForwarded?: boolean;
  readBy?: string[]; // userIds who have read this message
  attachment?: {
    type: 'image' | 'video' | 'file' | 'audio' | 'location' | 'contact' | 'poll';
    url?: string; // base64 or blob url
    name?: string;
    size?: number;
    mimeType?: string;
    duration?: number;
    latitude?: number;
    longitude?: number;
    contactName?: string;
    contactPhone?: string;
    pollQuestion?: string;
    pollOptions?: { text: string; votes: string[] }[]; // array of voter IDs
  };
}
