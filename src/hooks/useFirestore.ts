import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, addDoc, deleteDoc, deleteField, writeBatch, limit, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserProfile, Chat, Message, handleFirestoreError, OperationType } from '../types';

export function useProfiles() {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snap) => {
      const data: Record<string, UserProfile> = {};
      snap.forEach(d => {
        data[d.id] = d.data() as UserProfile;
      });
      setProfiles(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users', auth));
    
    return () => unsub();
  }, []);
  
  return profiles;
}

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  
  useEffect(() => {
    if (!auth.currentUser) return;
    // We get chats where we are a member
    const q = query(
      collection(db, 'chats'), 
      where('members', 'array-contains', auth.currentUser.uid)
    );
    // Note: ordered by updatedAt doesn't work out of the box with array-contains without a composite index
    // We'll sort in memory.
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat));
      data.sort((a, b) => {
        const t1 = getTimestampMillis(a.updatedAt);
        const t2 = getTimestampMillis(b.updatedAt);
        return t2 - t1;
      });
      setChats(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats', auth));
    
    return () => unsub();
  }, []);
  
  return chats;
}

export function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  
  useEffect(() => {
    if (!chatId || !auth.currentUser) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`, auth));
    
    return () => unsub();
  }, [chatId]);
  
  return messages;
}

export async function createDirectChat(otherUserId: string) {
  if (!auth.currentUser) return null;
  const me = auth.currentUser.uid;
  
  // check if exists
  const chatsSnap = await getDocs(query(collection(db, 'chats'), where('members', 'array-contains', me)));
  let existingId = null;
  chatsSnap.forEach(d => {
    const data = d.data() as Chat;
    if (data.type === 'direct' && data.members.includes(otherUserId)) {
      existingId = d.id;
    }
  });
  
  if (existingId) {
    // Re-enable/unhide chat if it was deleted/hidden
    try {
      const chatRef = doc(db, 'chats', existingId);
      await updateDoc(chatRef, {
        [`deletedBy.${me}`]: deleteField()
      });
    } catch (e) {
      // ignore if fail
    }
    return existingId;
  }
  
  try {
    const docRef = doc(collection(db, 'chats'));
    await setDoc(docRef, {
      type: 'direct',
      members: [me, otherUserId],
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch(error) {
    handleFirestoreError(error, OperationType.CREATE, 'chats', auth);
  }
}

export async function createGroupChat(name: string, members: string[]) {
  if (!auth.currentUser) return null;
  const me = auth.currentUser.uid;
  const allMembers = Array.from(new Set([me, ...members]));
  
  try {
    const docRef = doc(collection(db, 'chats'));
    await setDoc(docRef, {
      type: 'group',
      name,
      members: allMembers,
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch(error) {
    handleFirestoreError(error, OperationType.CREATE, 'chats', auth);
  }
}

export async function sendMessage(chatId: string, text: string, type: 'direct' | 'group', chatName?: string, replyTo?: Message['replyTo'], attachment?: Message['attachment']) {
  if (!auth.currentUser) return;
  const textClean = text.trim();
  if(!textClean && !attachment) return;
  
  try {
    const chatRef = doc(db, 'chats', chatId);
    const snap = await getDoc(chatRef);
    
    // Check if other user blocked the current user in direct chats
    if (snap.exists() && type === 'direct') {
       const chatData = snap.data() as Chat;
       const otherUserId = chatData.members.find(m => m !== auth.currentUser?.uid);
       if (otherUserId) {
          const otherUserSnap = await getDoc(doc(db, 'users', otherUserId));
          if (otherUserSnap.exists() && (otherUserSnap.data() as UserProfile).blockedUsers?.includes(auth.currentUser!.uid)) {
             throw new Error("You cannot send messages to this user.");
          }
       }
    }

    const msgRef = doc(collection(db, `chats/${chatId}/messages`));
    const payload: any = {
      senderId: auth.currentUser.uid,
      text: textClean,
      createdAt: serverTimestamp()
    };
    if (replyTo) {
      payload.replyTo = replyTo;
    }
    if (attachment) {
      payload.attachment = attachment;
    }
    await setDoc(msgRef, payload);
    
    const lastMsgText = attachment ? (textClean || `[${attachment.type}]`) : textClean;
    const updatePayload: any = { 
      updatedAt: serverTimestamp(), 
      lastMessage: lastMsgText.substring(0, 50),
      lastMessageSenderId: auth.currentUser.uid 
    };

    if (snap.exists()) {
      const chatData = snap.data();
      const members = chatData.members || [];
      members.forEach((m: string) => {
         if (chatData.deletedBy?.[m]) {
             updatePayload[`deletedBy.${m}`] = deleteField();
         }
      });
    }

    if (type === 'group' && chatName) {
      updatePayload.name = chatName;
    }
    await updateDoc(chatRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`, auth);
  }
}

export async function editMessage(chatId: string, messageId: string, newText: string) {
  if (!auth.currentUser) return;
  try {
    const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
    await updateDoc(msgRef, {
      text: newText.trim(),
      editedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages`, auth);
  }
}

export async function deleteMessage(chatId: string, messageId: string) {
  if (!auth.currentUser) return;
  try {
    const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
    await deleteDoc(msgRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}/messages`, auth);
  }
}

export async function toggleReaction(chatId: string, messageId: string, emoji: string, currentReactions: Record<string, string> = {}) {
  if (!auth.currentUser) return;
  try {
    const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
    const userId = auth.currentUser.uid;
    const newReactions = { ...currentReactions };
    
    if (newReactions[userId] === emoji) {
      delete newReactions[userId];
    } else {
      newReactions[userId] = emoji;
    }
    
    await updateDoc(msgRef, {
      reactions: newReactions
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages`, auth);
  }
}

export async function updateUserProfile(updates: Partial<UserProfile>) {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      ...updates,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'users', auth);
  }
} 

export async function removeMemberFromGroup(chatId: string, memberIds: string[], userIdToRemove: string) {
  if (!auth.currentUser) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const newMembers = memberIds.filter(id => id !== userIdToRemove);
    if (newMembers.length === 0) return; // Cannot be empty
    await updateDoc(chatRef, { members: newMembers, updatedAt: serverTimestamp() });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, 'chats', auth);
  }
}

export async function addMemberToGroup(chatId: string, currentMembers: string[], userIdToAdd: string) {
  if (!auth.currentUser) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    if (!currentMembers.includes(userIdToAdd)) {
       await updateDoc(chatRef, { members: [...currentMembers, userIdToAdd], updatedAt: serverTimestamp() });
    }
  } catch (e) { }
}

export async function updateGroupProfile(chatId: string, name: string, photoURL?: string | null) {
  if (!auth.currentUser) return;
  try {
     const chatRef = doc(db, 'chats', chatId);
     const payload: any = { name, updatedAt: serverTimestamp() };
     if (photoURL !== undefined) {
       payload.photoURL = photoURL === null ? deleteField() : photoURL;
     }
     await updateDoc(chatRef, payload);
  } catch (e) { }
}

export async function setChatTypingStatus(chatId: string, isTyping: boolean) {
  if (!auth.currentUser) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    const userId = auth.currentUser.uid;
    const typingUpdate: any = {};
    if (isTyping) {
      typingUpdate[`typing.${userId}`] = Date.now();
    } else {
      typingUpdate[`typing.${userId}`] = deleteField();
    }
    await updateDoc(chatRef, typingUpdate);
  } catch(e) { }
}

export async function togglePinMessage(chatId: string, message: Message | null, senderName?: string) {
  if (!auth.currentUser) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    if (!message) {
       await updateDoc(chatRef, { pinnedMessage: deleteField() });
    } else {
       await updateDoc(chatRef, { 
         pinnedMessage: { id: message.id, text: message.text, senderName: senderName || 'Unknown' } 
       });
    }
  } catch(e) { }
}

export async function markChatRead(chatId: string) {
  if(!auth.currentUser) return;
  try {
    const userId = auth.currentUser.uid;
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`readReceipts.${userId}`]: new Date().toISOString()
    });

    const userDoc = await getDoc(doc(db, 'users', userId));
    const profile = userDoc.data() as UserProfile;
    // Only broadcast to msg.readBy if privacy allows
    if (profile.settings?.privacy?.readReceipts !== false) {
      const msgsRef = collection(db, `chats/${chatId}/messages`);
    const q = query(msgsRef, orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    
    const batch = writeBatch(db);
    let batchCount = 0;
    
    snap.docs.forEach(d => {
      const data = d.data();
      const readBy = data.readBy || [];
      if (!readBy.includes(userId)) {
        batch.update(d.ref, {
          readBy: arrayUnion(userId)
        });
        batchCount++;
      }
    });
    
    if (batchCount > 0) {
      await batch.commit();
    }
    }
  } catch(e) { }
}

export async function clearChatHistory(chatId: string) {
  if (!auth.currentUser) return;
  try {
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef);
    const snap = await getDocs(q);
    
    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    
    const chatRef = doc(db, 'chats', chatId);
    batch.update(chatRef, {
      lastMessage: deleteField()
    });
    
    await batch.commit();
  } catch(e) {
    handleFirestoreError(e, OperationType.UPDATE, `chats/${chatId}`, auth);
  }
}

export async function deleteChat(chatId: string) {
  if (!auth.currentUser) return;
  try {
    const chatRef = doc(db, 'chats', chatId);
    await deleteDoc(chatRef);
  } catch(e) {
    handleFirestoreError(e, OperationType.DELETE, `chats/${chatId}`, auth);
  }
}

export async function blockUser(userIdToBlock: string) {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      blockedUsers: arrayUnion(userIdToBlock)
    });
  } catch(e) {
    handleFirestoreError(e, OperationType.UPDATE, 'users', auth);
  }
}

export async function unblockUser(userIdToUnblock: string) {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      blockedUsers: arrayRemove(userIdToUnblock)
    });
  } catch(e) {
    handleFirestoreError(e, OperationType.UPDATE, 'users', auth);
  }
}

export async function forwardMessage(chatId: string, message: Message, chatType: 'group'|'direct', chatName?: string) {
  if (!auth.currentUser) return;
  try {
    const msgRef = doc(collection(db, `chats/${chatId}/messages`));
    const payload: any = {
      senderId: auth.currentUser.uid,
      text: message.text,
      createdAt: serverTimestamp(),
      isForwarded: true
    };
    await setDoc(msgRef, payload);
    
    const chatRef = doc(db, 'chats', chatId);
    const updatePayload: any = { updatedAt: serverTimestamp(), lastMessage: message.text.substring(0, 50) };
    if (chatType === 'group' && chatName) {
      updatePayload.name = chatName;
    }
    await updateDoc(chatRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`, auth);
  }
}

export function getTimestampMillis(val: any): number {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') {
    return val.toMillis();
  }
  if (typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  if (typeof val.seconds === 'number') {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === 'number') {
    return val;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}



