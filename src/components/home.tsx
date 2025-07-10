import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import ChatInterface from "./ChatInterface";
import SidebarNavigation from "./SidebarNavigation";
import LoginPage from "./LoginPage";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  scriptures?: { reference: string; text: string }[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [loadedMessages, setLoadedMessages] = useState<Message[] | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(
    null,
  );

  const chatInterfaceRef = useRef<{
    loadConversation: (conversationId: string, messages: Message[]) => void;
  } | null>(null);

  const { user, userUUID, loading, error, isAuthenticated, signOut } =
    useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading CompanionAI...</p>
      </div>
    );
  }

  if (!loading && !isAuthenticated) {
    return <LoginPage />;
  }

  const loadPastConversation = async (conversationId: string) => {
    if (!userUUID || !isAuthenticated) return;

    setLoadingConversation(true);
    setConversationError(null);

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userUUID)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user:", userError);
        setConversationError("Could not fetch user data. Please try again.");
        return;
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error("Error fetching messages:", messagesError);
        setConversationError("Could not fetch conversation messages.");
        return;
      }

      const messages: Message[] = messagesData.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.role as "user" | "ai",
        timestamp: new Date(msg.created_at),
      }));

      setSelectedConversationId(conversationId);
      setLoadedMessages(messages);
      setActiveTab("chat");

      setTimeout(() => {
        if (chatInterfaceRef.current) {
          chatInterfaceRef.current.loadConversation(conversationId, messages);
        } else {
          console.warn("chatInterfaceRef.current is null!");
        }
      }, 0);
    } catch (err) {
      console.error("Unexpected error:", err);
      setConversationError("Unexpected error loading conversation.");
    } finally {
      setLoadingConversation(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">
          Error initializing authentication: {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">CompanionAI</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">{user && user.email}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto p-4 flex flex-col md:flex-row gap-6 overflow-hidden">
        <Card className="flex-1 min-h-0 overflow-hidden shadow-md">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="mx-6 mt-2 bg-blue-50">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="history">Conversation History</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 p-0 overflow-hidden">
              {loadingConversation ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">
                    Loading conversation...
                  </span>
                </div>
              ) : (
                <ChatInterface
                  ref={chatInterfaceRef}
                  selectedConversationId={selectedConversationId}
                  loadedMessages={loadedMessages}
                />
              )}
              {conversationError && (
                <div className="text-center text-red-600 mt-2">
                  {conversationError}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex-1 p-6 overflow-auto">
              <SidebarNavigation onConversationSelect={loadPastConversation} />
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-4 px-6 text-center text-sm text-gray-500">
        <p>
          "For where two or three gather in my name, there am I with them." —
          Matthew 18:20
        </p>
      </footer>
    </div>
  );
}
