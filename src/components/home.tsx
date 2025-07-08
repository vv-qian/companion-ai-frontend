import React, { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
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
  const chatInterfaceRef = useRef<{
    loadConversation: (conversationId: string, messages: Message[]) => void;
  } | null>(null);
  const { user, userUUID, loading, error, isAuthenticated, signOut } =
    useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing CompanionAI...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!loading && !isAuthenticated) {
    return <LoginPage onAuthSuccess={() => window.location.reload()} />;
  }

  // Function to load past conversation messages
  const loadPastConversation = async (conversationId: string) => {
    if (!userUUID || !isAuthenticated) return;

    try {
      // Get user ID from public.users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userUUID)
        .single();

      if (userError || !userData) {
        console.error("Error fetching user:", userError);
        return;
      }

      // Fetch messages for the selected conversation
      const { data: messagesData, error: messagesError } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error("Error fetching messages:", messagesError);
        return;
      }

      // Convert database messages to Message format
      const messages: Message[] = messagesData.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.role as "user" | "ai",
        timestamp: new Date(msg.created_at),
      }));

      // Load the conversation in ChatInterface
      if (chatInterfaceRef.current) {
        chatInterfaceRef.current.loadConversation(conversationId, messages);
      }

      // Switch to chat tab
      setActiveTab("chat");
      setSelectedConversationId(conversationId);
      setLoadedMessages(messages);
    } catch (error) {
      console.error("Error loading past conversation:", error);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            Error initializing authentication: {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 border-b">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-blue-600"
            >
              <path d="M12 6v12m-8-6h16" />
            </svg>
            <h1 className="text-xl font-semibold text-gray-800">CompanionAI</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Guided by faith, powered by AI {user && `• ${user.email}`}
            </div>
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6">
        <Card className="flex-1 h-[700px] overflow-hidden shadow-md border-blue-100">
          <Tabs defaultValue="chat" className="h-full flex flex-col">
            <TabsList className="mx-6 mt-2 bg-blue-50">
              <TabsTrigger value="chat" onClick={() => setActiveTab("chat")}>
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="history"
                onClick={() => setActiveTab("history")}
              >
                Conversation History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 p-0 overflow-hidden">
              <ChatInterface
                ref={chatInterfaceRef}
                selectedConversationId={selectedConversationId}
                loadedMessages={loadedMessages}
              />
            </TabsContent>

            <TabsContent value="history" className="flex-1 p-6 overflow-auto">
              <SidebarNavigation onConversationSelect={loadPastConversation} />
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-4 px-6 text-center text-sm text-gray-500">
        <div className="max-w-7xl mx-auto">
          <p>
            "For where two or three gather in my name, there am I with them." —
            Matthew 18:20
          </p>
        </div>
      </footer>
    </div>
  );
}
