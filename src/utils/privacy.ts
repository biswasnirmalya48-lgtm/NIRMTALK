import { UserProfile, Chat } from '../types';

export const isContact = (userId: string, targetId: string, chats: Chat[]) => {
  if (userId === targetId) return true;
  return chats.some(chat => 
    chat.type === 'direct' && chat.members.includes(userId) && chat.members.includes(targetId)
  );
};

export const canViewProfilePhoto = (viewerId: string, targetProfile: UserProfile, chats: Chat[]) => {
  if (viewerId === targetProfile.userId) return true;
  const setting = targetProfile.settings?.privacy?.profilePhoto || 'everyone';
  if (setting === 'nobody') return false;
  if (setting === 'contacts') return isContact(viewerId, targetProfile.userId, chats);
  return true;
};

export const canViewLastSeen = (viewerId: string, targetProfile: UserProfile, chats: Chat[]) => {
  if (viewerId === targetProfile.userId) return true;
  const setting = targetProfile.settings?.privacy?.lastSeen || 'everyone';
  if (setting === 'nobody') return false;
  if (setting === 'contacts') return isContact(viewerId, targetProfile.userId, chats);
  return true;
};

export const canMessage = (initiatorId: string, targetProfile: UserProfile, chats: Chat[]) => {
  if (initiatorId === targetProfile.userId) return true;
  // If they already have a chat, we allow messaging regardless? 
  // Let's assume privacy applies to new & existing chats, but usually it only restricts *who can start*
  const setting = targetProfile.settings?.privacy?.whoCanMessage || 'everyone';
  if (setting === 'everyone') return true;
  if (setting === 'contacts') return isContact(initiatorId, targetProfile.userId, chats);
  return true;
};

export const canCall = (callerId: string, targetProfile: UserProfile, chats: Chat[]) => {
  if (callerId === targetProfile.userId) return true;
  const setting = targetProfile.settings?.privacy?.whoCanCall || 'everyone';
  if (setting === 'nobody') return false;
  if (setting === 'contacts') return isContact(callerId, targetProfile.userId, chats);
  return true;
};

export const canSendReadReceipts = (userProfile: UserProfile | undefined) => {
  if (!userProfile) return true; // default true
  const setting = userProfile.settings?.privacy?.readReceipts;
  return setting !== false; // defaults to true if undefined
};

export const getProfilePhoto = (viewerId: string, targetProfile: UserProfile | undefined, chats: Chat[]) => {
  if (!targetProfile) return '';
  return canViewProfilePhoto(viewerId, targetProfile, chats) ? targetProfile.photoURL : '';
}
