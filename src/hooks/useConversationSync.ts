import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  scriptures?: { reference: string; text: string }[];
}

interface UseConversationSyncProps {
  messages: Message[];
  conversationId?: string;
  onConversationIdChange?: (id: string) => void;
}

const isBoilerplateMessage = (message: Message) => message.isBoilerplate;

export const useConversationSync = ({
  messages,
  conversationId,
  onConversationIdChange,
}: UseConversationSyncProps) => {
  const { userUUID, isAuthenticated } = useAuth();
  const lastSyncedCountRef = useRef(0);
  const currentConversationIdRef = useRef<string | null>(
    conversationId || null,
  );
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const syncedMessageIdsRef = useRef<Set<string>>(new Set());
  const isSyncingRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Create or get conversation ID
  const ensureConversationExists = useCallback(async (): Promise<
    string | null
  > => {
    if (!userUUID || !isAuthenticated) return null;

    // If we already have a conversation ID, return it
    if (currentConversationIdRef.current) {
      return currentConversationIdRef.current;
    }

    try {
      // First, ensure user exists in public.users table
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userUUID)
        .limit(1)
        .single();

      if (!existingUser) {
        // Create user in public.users table
        const { error: userError } = await supabase
          .from("users")
          .insert({ auth_user_id: userUUID });

        if (userError) {
          console.error("Error creating user:", userError);
          return null;
        }
      }

      // Create new conversation
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
          user_id:
            existingUser?.id ||
            (
              await supabase
                .from("users")
                .select("id")
                .eq("auth_user_id", userUUID)
                .single()
            ).data?.id,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Error creating conversation:", error);
        return null;
      }

      currentConversationIdRef.current = conversation.id;
      onConversationIdChange?.(conversation.id);
      return conversation.id;
    } catch (error) {
      console.error("Error ensuring conversation exists:", error);
      return null;
    }
  }, [userUUID, isAuthenticated, onConversationIdChange]);

  // Initialize synced message IDs from database
  const initializeSyncedMessages = useCallback(async () => {
    if (!userUUID || !isAuthenticated) return;
    if (isInitializedRef.current) return;

    try {
      const conversationId = await ensureConversationExists();
      if (!conversationId) return;

      // Get all message IDs that exist in the database for current messages
      const messageIds = messages.map((m) => m.id);
      if (messageIds.length === 0) {
        isInitializedRef.current = true;
        return;
      }

      const { data: existingMessages } = await supabase
        .from("conversation_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .in("id", messageIds);

      // Mark existing messages as synced
      if (existingMessages) {
        existingMessages.forEach((msg) => {
          syncedMessageIdsRef.current.add(msg.id);
        });
      }

      isInitializedRef.current = true;
      console.log(
        `Initialized ${existingMessages?.length || 0} synced messages`,
      );
    } catch (error) {
      console.error("Error initializing synced messages:", error);
      // Still mark as initialized to prevent infinite retries
      isInitializedRef.current = true;
    }
  }, [userUUID, isAuthenticated, messages, ensureConversationExists]);

  // Sync messages to Supabase
  const syncMessages = useCallback(
    async (force = false) => {
      if (!userUUID || !isAuthenticated || messages.length === 0) return;
      if (isSyncingRef.current && !force) return; // Prevent concurrent syncs

      // Initialize synced messages if not done yet
      if (!isInitializedRef.current) {
        await initializeSyncedMessages();
      }

      // Filter out messages that have already been synced
      const messagesToSync = messages.filter(
        (message) =>
          !syncedMessageIdsRef.current.has(message.id) &&
          !isBoilerplateMessage(message),
      );

      if (messagesToSync.length === 0 && !force) return;

      isSyncingRef.current = true;

      try {
        const realMessagesExist = messages.some(
          (msg) => !isBoilerplateMessage(msg),
        );

        if (!realMessagesExist) {
          // nothing meaningful to sync yet; skip creating conversation
          return;
        }

        const conversationId = await ensureConversationExists();
        if (!conversationId) return;

        // Get user ID from public.users table
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("auth_user_id", userUUID)
          .single();

        if (!user) {
          console.error("User not found in public.users table");
          return;
        }

        const messageIds = messagesToSync.map((m) => m.id);

        const { data: existingMessages, error: existingError } = await supabase
          .from("conversation_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .in("id", messageIds);

        if (existingError) {
          console.error("Error checking existing messages:", existingError);
          isSyncingRef.current = false;
          return;
        }

        const existingMessageIds = new Set(
          existingMessages?.map((m) => m.id) || [],
        );

        // Always mark existing ones as synced
        existingMessageIds.forEach((id) => syncedMessageIdsRef.current.add(id));

        const newMessagesToSync = messagesToSync.filter(
          (message) => !existingMessageIds.has(message.id),
        );

        if (newMessagesToSync.length === 0) {
          console.log("No new messages to sync; all already present.");
          lastSyncedCountRef.current = messages.length;
          isSyncingRef.current = false;
          return;
        }

        const messagesToUpsert = newMessagesToSync.map((message) => ({
          id: message.id,
          user_id: user.id,
          conversation_id: conversationId,
          role: message.sender,
          content: message.content,
          created_at: message.timestamp.toISOString(),
        }));

        const { error: upsertError } = await supabase
          .from("conversation_messages")
          .upsert(messagesToUpsert, { onConflict: "id" });

        if (upsertError) {
          console.error("Error upserting messages:", upsertError);
        } else {
          newMessagesToSync.forEach((message) => {
            syncedMessageIdsRef.current.add(message.id);
          });
          lastSyncedCountRef.current = messages.length;
          console.log(
            `Upserted ${messagesToUpsert.length} new messages to Supabase`,
          );
        }
      } catch (error) {
        console.error("Error in syncMessages:", error);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [
      messages,
      userUUID,
      isAuthenticated,
      ensureConversationExists,
      initializeSyncedMessages,
    ],
  );

  // Initialize synced messages when messages change or conversation changes
  useEffect(() => {
    if (
      userUUID &&
      isAuthenticated &&
      messages.length > 0 &&
      !isInitializedRef.current &&
      (conversationId || currentConversationIdRef.current)
    ) {
      initializeSyncedMessages();
    }
  }, [
    messages,
    userUUID,
    isAuthenticated,
    conversationId,
    initializeSyncedMessages,
  ]);

  // Reset initialization when user changes or when conversation changes
  useEffect(() => {
    if (conversationId !== currentConversationIdRef.current) {
      // Force sync current messages before switching conversations
      if (currentConversationIdRef.current && messages.length > 0) {
        syncMessages(true);
      }

      // Reset state for new conversation
      isInitializedRef.current = false;
      syncedMessageIdsRef.current.clear();
      lastSyncedCountRef.current = 0;
      currentConversationIdRef.current = conversationId || null;
    }
  }, [userUUID, conversationId, messages, syncMessages]);

  // Reset when user changes
  useEffect(() => {
    isInitializedRef.current = false;
    syncedMessageIdsRef.current.clear();
    lastSyncedCountRef.current = 0;
    currentConversationIdRef.current = null;
  }, [userUUID]);

  // Sync every 5 messages
  useEffect(() => {
    const unsyncedMessages = messages.filter(
      (message) => !syncedMessageIdsRef.current.has(message.id),
    );

    if (unsyncedMessages.length >= 5) {
      syncMessages();
    }
  }, [messages, syncMessages]);

  // Debounced sync for smaller batches
  useEffect(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Sync after 30 seconds of inactivity if there are unsynced messages
    const unsyncedMessages = messages.filter(
      (message) => !syncedMessageIdsRef.current.has(message.id),
    );

    if (unsyncedMessages.length > 0 && unsyncedMessages.length < 5) {
      syncTimeoutRef.current = setTimeout(() => {
        syncMessages();
      }, 30000);
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [messages, syncMessages]);

  // Sync on page unload/navigation away
  useEffect(() => {
    const handleBeforeUnload = () => {
      const unsyncedMessages = messages.filter(
        (message) => !syncedMessageIdsRef.current.has(message.id),
      );
      if (unsyncedMessages.length > 0) {
        // Force immediate sync on page unload
        syncMessages(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        const unsyncedMessages = messages.filter(
          (message) => !syncedMessageIdsRef.current.has(message.id),
        );
        if (unsyncedMessages.length > 0) {
          syncMessages(true);
        }
      }
    };

    const handleBeforeSignOut = () => {
      syncMessages(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeSignOut", handleBeforeSignOut);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeSignOut", handleBeforeSignOut);
    };
  }, [messages, userUUID, syncMessages]);

  // Manual sync function
  const forceSyncMessages = useCallback(() => {
    syncMessages(true);
  }, [syncMessages]);

  return {
    syncMessages: forceSyncMessages,
    conversationId: currentConversationIdRef.current,
  };
};
