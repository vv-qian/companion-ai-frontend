import React, { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";

import { useAuth } from "@/contexts/AuthContext";
import { useConversationSync } from "@/hooks/useConversationSync";
import Markdown from "markdown-to-jsx";
import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_SERVER_URL;

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  response_id?: string;
}

interface MessageBubbleProps {
  message: Message;
}

// Inline MessageBubble component since there seems to be an issue with importing it
const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isBot = message.sender === "ai";

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isBot ? "bg-blue-50 text-gray-800" : "bg-blue-600 text-white"
        }`}
      >
        <div className="text-sm prose prose-sm max-w-none">
          {isBot ? (
            <Markdown
              options={{
                overrides: {
                  p: {
                    component: (props) => (
                      <p className="mb-2 last:mb-0" {...props} />
                    ),
                  },
                  h1: {
                    component: (props) => (
                      <h1 className="text-lg font-bold mb-2" {...props} />
                    ),
                  },
                  h2: {
                    component: (props) => (
                      <h2 className="text-base font-bold mb-2" {...props} />
                    ),
                  },
                  h3: {
                    component: (props) => (
                      <h3 className="text-sm font-bold mb-1" {...props} />
                    ),
                  },
                  ul: {
                    component: (props) => (
                      <ul className="list-disc list-inside mb-2" {...props} />
                    ),
                  },
                  ol: {
                    component: (props) => (
                      <ol
                        className="list-decimal list-inside mb-2"
                        {...props}
                      />
                    ),
                  },
                  li: {
                    component: (props) => <li className="mb-1" {...props} />,
                  },
                  strong: {
                    component: (props) => (
                      <strong className="font-semibold" {...props} />
                    ),
                  },
                  em: {
                    component: (props) => <em className="italic" {...props} />,
                  },
                  code: {
                    component: (props) => (
                      <code
                        className="bg-blue-100 px-1 py-0.5 rounded text-xs"
                        {...props}
                      />
                    ),
                  },
                  blockquote: {
                    component: (props) => (
                      <blockquote
                        className="border-l-2 border-blue-300 pl-2 italic"
                        {...props}
                      />
                    ),
                  },
                },
              }}
            >
              {message.content}
            </Markdown>
          ) : (
            <div className="text-white text-sm">{message.content}</div>
          )}
        </div>

        <div className="text-xs mt-1 opacity-70 text-right">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
};

interface ChatInterfaceProps {
  className?: string;
  selectedConversationId?: string | null;
  loadedMessages?: Message[] | null;
}

const ChatInterface = React.forwardRef<
  { loadConversation: (conversationId: string, messages: Message[]) => void },
  ChatInterfaceProps
>(({ className = "", selectedConversationId, loadedMessages }, ref) => {
  const { userUUID } = useAuth();

  // Default welcome message
  const getDefaultMessages = (): Message[] => [
    {
      id: crypto.randomUUID(),
      content:
        "Welcome to Companion AI. How may I assist you on your faith journey today?",
      sender: "ai",
      timestamp: new Date(),
      isBoilerplate: true,
    },
  ];

  const [messages, setMessages] = useState<Message[]>(getDefaultMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    selectedConversationId || null,
  );
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Initialize conversation sync - always call with consistent parameters
  const { syncMessages } = useConversationSync({
    messages,
    conversationId: conversationId ?? undefined,
    onConversationIdChange: setConversationId,
  });

  // Function to load a past conversation
  const loadConversation = React.useCallback(
    (newConversationId: string, newMessages: Message[]) => {
      setIsLoadingConversation(true);

      // Force sync current messages before switching
      syncMessages();

      // Update conversation state
      setConversationId(newConversationId);
      console.log("newConversationId: ", newConversationId);
      setMessages(newMessages);

      // Clear localStorage for current user and save new messages
      if (userUUID) {
        localStorage.setItem(
          `companionai-messages-${userUUID}`,
          JSON.stringify(newMessages),
        );
      }

      setIsLoadingConversation(false);
    },
    [userUUID, syncMessages],
  );

  // Expose loadConversation function via ref
  React.useImperativeHandle(
    ref,
    () => ({
      loadConversation,
    }),
    [loadConversation],
  );

  // Trigger scrollToBottom when messages or isLoadingConversation changes
  useEffect(() => {
    if (!isLoadingConversation) {
      scrollToBottom();
    }
  }, [messages, isLoadingConversation]);

  // Load messages from localStorage on component mount (only if no conversation is being loaded)
  useEffect(() => {
    if (
      userUUID &&
      !messagesLoaded &&
      !selectedConversationId &&
      !loadedMessages
    ) {
      try {
        const savedMessages = localStorage.getItem(
          `companionai-messages-${userUUID}`,
        );
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          // Convert timestamp strings back to Date objects
          const loadedMessages = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(loadedMessages);
        }
      } catch (error) {
        console.error("Error loading messages from localStorage:", error);
      }
      setMessagesLoaded(true);
    } else if (selectedConversationId && loadedMessages) {
      // If a conversation is being loaded from props, use those messages
      setMessages(loadedMessages);
      setConversationId(selectedConversationId);
      setMessagesLoaded(true);
    } else if (!selectedConversationId && !loadedMessages && !messagesLoaded) {
      setMessagesLoaded(true);
    }
  }, [userUUID, messagesLoaded, selectedConversationId, loadedMessages]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (userUUID && messagesLoaded) {
      try {
        localStorage.setItem(
          `companionai-messages-${userUUID}`,
          JSON.stringify(messages),
        );
      } catch (error) {
        console.error("Error saving messages to localStorage:", error);
      }
    }
  }, [messages, userUUID, messagesLoaded]);

  // Load input message from localStorage on component mount
  useEffect(() => {
    if (userUUID) {
      try {
        const savedInput = localStorage.getItem(
          `companionai-input-${userUUID}`,
        );
        if (savedInput) {
          setInputMessage(savedInput);
        }
      } catch (error) {
        console.error("Error loading input from localStorage:", error);
      }
    }
  }, [userUUID]);

  // Save input message to localStorage whenever it changes
  useEffect(() => {
    if (userUUID) {
      try {
        localStorage.setItem(`companionai-input-${userUUID}`, inputMessage);
      } catch (error) {
        console.error("Error saving input to localStorage:", error);
      }
    }
  }, [inputMessage, userUUID]);

  // Initialize backend client
  const client = axios.create({
    baseURL: backendUrl,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isLoading) return;

    // Add user message
    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      content: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };
    setInputMessage("");
    // Clear the saved input since message is being sent
    if (userUUID) {
      localStorage.removeItem(`companionai-input-${userUUID}`);
    }
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    // Send request to LLM
    const simplified_messages = messages
      .map(({ content, sender }) => ({
        content,
        sender,
      }))
      .slice(-20);

    // Get the previous response_id from the last AI message
    const lastAiMessage = messages
      .filter((m) => m.sender === "ai" && !m.isBoilerplate)
      .slice(-1)[0];
    const previous_response_id = lastAiMessage?.response_id || null;

    try {
      const response = await client.post("/query", {
        user_input: newUserMessage.content,
        message_history: simplified_messages,
        previous_response_id: previous_response_id,
      });

      const botResponse: Message = {
        id: crypto.randomUUID(),
        content: response.data.response,
        sender: "ai",
        timestamp: new Date(),
        response_id: response.data.response_id || null,
      };

      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error("Error calling Qdrant API:", error);
      // Add error message to chat
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content:
          "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`flex flex-col h-full bg-white ${className}`}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading conversation...</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-blue-50 text-gray-800">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Seeking guidance...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {/* Sentinel div */}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              isLoading
                ? "Waiting for response..."
                : "Type your message here..."
            }
            className="flex-1"
            disabled={isLoading}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <Button
            onClick={handleSendMessage}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
});

ChatInterface.displayName = "ChatInterface";

export default ChatInterface;
