import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  isBoilerplate?: boolean;
}

interface UseConversationSyncProps {
  messages: Message[];
  conversationId?: string;
  onConversationIdChange?: (id: string) => void;
}

const isBoilerplateMessage = (m: Message) => m.isBoilerplate;

export const useConversationSync = ({
  messages,
  conversationId,
  onConversationIdChange,
}: UseConversationSyncProps) => {
  const { userUUID, isAuthenticated } = useAuth();

  const currentConversationIdRef = useRef<string | null>(
    conversationId || null,
  );
  const syncedMessageIdsRef = useRef<Set<string>>(new Set());
  const isSyncingRef = useRef(false);
  const isInitializedRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const ensureConversationExists = useCallback(async (): Promise<
    string | null
  > => {
    if (!userUUID || !isAuthenticated) return null;

    if (currentConversationIdRef.current) {
      return currentConversationIdRef.current;
    }

    const { data: newConv, error: convErr } = await supabase
      .from("conversations")
      .insert({ auth_user_id: userUUID })
      .select("id")
      .single();

    if (convErr || !newConv) {
      console.error("Failed to create conversation", convErr);
      return null;
    }

    currentConversationIdRef.current = newConv.id;
    onConversationIdChange?.(newConv.id);
    return newConv.id;
  }, [userUUID, isAuthenticated, onConversationIdChange]);

  const loadSyncedMessages = useCallback(async (convId: string) => {
    const { data: existing } = await supabase
      .from("conversation_messages")
      .select("id")
      .eq("conversation_id", convId);

    syncedMessageIdsRef.current.clear();
    existing?.forEach((m) => syncedMessageIdsRef.current.add(m.id));
  }, []);

  const syncMessages = useCallback(
    async (force = false, targetConversationId?: string) => {
      if (!userUUID || !isAuthenticated) return;
      if (isSyncingRef.current && !force) return;

      // Abort any ongoing sync
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      isSyncingRef.current = true;

      try {
        // Use explicit target conversation ID if provided, otherwise use current
        const convId =
          targetConversationId ||
          currentConversationIdRef.current ||
          (await ensureConversationExists());
        
        if (!convId) return;

        // Double-check we're syncing to the correct conversation
        if (targetConversationId && convId !== targetConversationId) {
          console.warn("Conversation ID mismatch, aborting sync");
          return;
        }

        if (!isInitializedRef.current) {
          await loadSyncedMessages(convId);
          isInitializedRef.current = true;
        }

        const unsynced = messages.filter(
          (m) =>
            !syncedMessageIdsRef.current.has(m.id) && !isBoilerplateMessage(m),
        );

        if (unsynced.length === 0 && !force) return;

        const toInsert = unsynced.map((m) => ({
          id: m.id,
          auth_user_id: userUUID,
          conversation_id: convId,
          role: m.sender,
          content: m.content,
          created_at: m.timestamp.toISOString(),
        }));

        if (toInsert.length > 0) {
          const { error } = await supabase
            .from("conversation_messages")
            .upsert(toInsert, { onConflict: "id" });

          if (error) {
            console.error("Error upserting messages:", error);
            return;
          }

          unsynced.forEach((m) => syncedMessageIdsRef.current.add(m.id));
          console.log(
            `Synced ${toInsert.length} messages to conversation ${convId}`,
          );
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log("Sync aborted");
          return;
        }
        console.error("Error syncing messages", err);
      } finally {
        isSyncingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [
      messages,
      userUUID,
      isAuthenticated,
      ensureConversationExists,
      loadSyncedMessages,
    ],
  );

  useEffect(() => {
    if (!currentConversationIdRef.current && userUUID && isAuthenticated) {
      ensureConversationExists();
    }
  }, [userUUID, isAuthenticated, ensureConversationExists]);

  useEffect(() => {
    if (conversationId !== currentConversationIdRef.current) {
      (async () => {
        // Always sync current messages before switching conversations
        // Pass the OLD conversation ID explicitly to ensure messages go to the right place
        const oldConversationId = currentConversationIdRef.current;
        if (oldConversationId && messages.length > 0) {
          const unsyncedMessages = messages.filter(
            (m) =>
              !syncedMessageIdsRef.current.has(m.id) &&
              !isBoilerplateMessage(m),
          );
          if (unsyncedMessages.length > 0) {
            await syncMessages(true, oldConversationId);
          }
        }

        // Now switch to the new conversation
        currentConversationIdRef.current = conversationId || null;
        isInitializedRef.current = false;
        syncedMessageIdsRef.current.clear();

        if (conversationId) {
          await loadSyncedMessages(conversationId);
          isInitializedRef.current = true;
        }
      })();
    }
  }, [conversationId, messages, syncMessages, loadSyncedMessages]);

  useEffect(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    const unsynced = messages.filter(
      (m) => !syncedMessageIdsRef.current.has(m.id) && !isBoilerplateMessage(m),
    );
    if (unsynced.length === 0) return;

    // Sync immediately for new messages, with a short debounce
    syncTimeoutRef.current = setTimeout(() => {
      syncMessages(false, currentConversationIdRef.current || undefined);
    }, 1000);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [messages, syncMessages]);

  useEffect(() => {
    const handleUnload = () => {
      // Force immediate sync on page unload with explicit conversation ID
      const convId = currentConversationIdRef.current;
      if (convId) {
        syncMessages(true, convId);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Force immediate sync when page becomes hidden with explicit conversation ID
        const convId = currentConversationIdRef.current;
        if (convId) {
          syncMessages(true, convId);
        }
      }
    };

    const handlePageHide = () => {
      // Additional handler for mobile browsers
      const convId = currentConversationIdRef.current;
      if (convId) {
        syncMessages(true, convId);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [syncMessages]);

  const forceSyncMessages = useCallback(() => {
    const convId = currentConversationIdRef.current;
    if (convId) {
      syncMessages(true, convId);
    }
  }, [syncMessages]);

  return {
    syncMessages: forceSyncMessages,
    conversationId: currentConversationIdRef.current,
  };
};