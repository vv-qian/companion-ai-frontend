import React from "react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  scriptureReferences?: Array<{
    reference: string;
    text: string;
  }>;
}

const MessageBubble = ({
  message = "Hello, how can I help you with your spiritual journey today?",
  isUser = false,
  timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }),
  scriptureReferences = [],
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

          {scriptureReferences.length > 0 && (
            <div className="mt-2 pt-2 border-t border-opacity-20 border-foreground">
              {scriptureReferences.map((scripture, index) => (
                <div key={index} className="mt-1 text-xs">
                  <span className="font-semibold">{scripture.reference}:</span>
                  <span className="italic"> "{scripture.text}"</span>
                </div>
              ))}
            </div>
          )}

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
