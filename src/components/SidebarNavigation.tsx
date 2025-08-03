import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Search, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface SidebarNavigationProps {
  onConversationSelect?: (conversationId: string) => void;
}

interface Conversation {
  id: string;
  title: string;
  date: string;
  preview: string;
}

const SidebarNavigation = ({
  onConversationSelect = () => {},
}: SidebarNavigationProps) => {
  const { userUUID, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to generate conversation title from first message
  const generateConversationTitle = (firstMessage: string): string => {
    // Take first 50 characters and add ellipsis if longer
    const title =
      firstMessage.length > 50
        ? firstMessage.substring(0, 50) + "..."
        : firstMessage;
    return title;
  };

  // Function to delete a conversation
  const deleteConversation = async (conversationId: string) => {
    if (!userUUID || !isAuthenticated) {
      return;
    }

    try {
      // First get the user's ID from the public.users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userUUID)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user:", userError);
        return;
      }

      // Delete all messages for this conversation first
      const { error: messagesError } = await supabase
        .from("conversation_messages")
        .delete()
        .eq("conversation_id", conversationId);

      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        return;
      }

      // Then delete the conversation
      const { error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", userData.id);

      if (conversationError) {
        console.error("Error deleting conversation:", conversationError);
        return;
      }

      // Update the local state to remove the deleted conversation
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId),
      );
    } catch (err) {
      console.error("Error in deleteConversation:", err);
    }
  };

  // Function to fetch conversations from Supabase
  const fetchConversations = async () => {
    if (!userUUID || !isAuthenticated) {
      setConversations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First get the user's ID from the public.users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userUUID)
        .single();

      if (userError) {
        console.error("Error fetching user:", userError);
        setError("Failed to fetch user data");
        return;
      }

      if (!userData) {
        setConversations([]);
        return;
      }

      // Fetch conversations with their first message for preview
      const { data: conversationsData, error: conversationsError } =
        await supabase
          .from("conversations")
          .select(
            `
          id,
          created_at,
          conversation_messages!inner(
            content,
            role,
            created_at
          )
        `,
          )
          .eq("user_id", userData.id)
          .order("created_at", { ascending: false });

      if (conversationsError) {
        console.error("Error fetching conversations:", conversationsError);
        setError("Failed to fetch conversations");
        return;
      }

      // Process conversations to create the display format
      const processedConversations: Conversation[] = conversationsData.map(
        (conv: any) => {
          // Find the first user message for the title and preview
          const userMessages = conv.conversation_messages
            .filter((msg: any) => msg.role === "user")
            .sort(
              (a: any, b: any) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );

          const firstUserMessage = userMessages[0];
          const title = firstUserMessage
            ? generateConversationTitle(firstUserMessage.content)
            : "New Conversation";

          const preview = firstUserMessage
            ? firstUserMessage.content.substring(0, 100) +
              (firstUserMessage.content.length > 100 ? "..." : "")
            : "No messages yet";

          return {
            id: conv.id,
            title,
            date: new Date(conv.created_at).toLocaleDateString(),
            preview,
          };
        },
      );

      setConversations(processedConversations);
    } catch (err) {
      console.error("Error in fetchConversations:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fetch conversations when user signs in
  useEffect(() => {
    fetchConversations();
  }, [userUUID, isAuthenticated]);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(
    (conversation) =>
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.preview.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="h-full w-full bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search conversations"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="h-full">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-500">
                Loading conversations...
              </span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchConversations}
              >
                Retry
              </Button>
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => (
              <Card
                key={conversation.id}
                className="hover:bg-gray-50 transition-colors group"
              >
                <CardContent className="p-3 relative">
                  <div
                    className="cursor-pointer"
                    onClick={() => {
                      onConversationSelect(conversation.id);
                    }}
                  >
                    <h3 className="font-medium text-gray-800 pr-8">
                      {conversation.title}
                    </h3>
                    <p className="text-xs text-gray-500">{conversation.date}</p>
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {conversation.preview}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conversation.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>
                {isAuthenticated
                  ? "No conversations found"
                  : "Sign in to view conversations"}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SidebarNavigation;
