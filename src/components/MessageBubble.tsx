import React from "react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
}

const MessageBubble = ({
  message = "Hello, how can I help you with your spiritual journey today?",
  isUser = false,
  timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }),
}: MessageBubbleProps) => {
  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl p-4 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted rounded-tl-none",
        )}
      >
        <div className="flex flex-col">
          <p className="text-sm">{message}</p>

          <div
            className={cn(
              "text-xs mt-1 self-end opacity-70",
              isUser ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {timestamp}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
