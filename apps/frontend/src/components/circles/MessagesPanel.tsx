import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { MESSAGE_LIMITS } from "@cmucourses/profile";
import {
  useConversations,
  useSendMessage,
  useThread,
  type ThreadMessage,
} from "~/app/api/messages";
import { classNames } from "~/app/utils";

export interface OpenConversation {
  profileID: string;
  displayName: string;
  /** You follow each other right now (as far as the page knows). */
  canSend: boolean;
}

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const Bubble = ({
  message,
  onRetry,
}: {
  message: ThreadMessage;
  onRetry: () => void;
}) => (
  <div
    className={classNames(
      "flex flex-col",
      message.fromMe ? "items-end" : "items-start"
    )}
  >
    <div
      className={classNames(
        "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
        message.fromMe
          ? "nightwind-prevent bg-blue-600 text-white"
          : "bg-gray-100 text-gray-800",
        message.status === "sending" ? "opacity-60" : ""
      )}
    >
      {message.body}
    </div>
    <div className="mt-0.5 text-gray-400 text-[11px]">
      {message.status === "sending" ? (
        "Sending…"
      ) : message.status === "failed" ? (
        <span className="text-red-600">
          Not sent{message.error ? ` · ${message.error}` : ""} ·{" "}
          <button type="button" className="underline" onClick={onRetry}>
            Retry
          </button>
        </span>
      ) : (
        clock(message.createdAt)
      )}
    </div>
  </div>
);

const Thread = ({
  open,
  onBack,
}: {
  open: OpenConversation;
  onBack: () => void;
}) => {
  const {
    data: messages = [],
    isPending,
    isError,
    refetch,
  } = useThread(open.profileID);
  const send = useSendMessage();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Newest message in view whenever the thread opens or a message arrives.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, open.profileID]);
  useEffect(() => {
    inputRef.current?.focus();
  }, [open.profileID]);

  const submit = (body: string, tempID = `temp-${Date.now()}`) => {
    if (body.trim() === "") return;
    send.mutate({ profileID: open.profileID, body, tempID });
    setDraft("");
  };

  let lastDay = "";
  return (
    <div className="flex h-[32rem] flex-col">
      <div className="flex items-center gap-2 border-gray-100 border-b pb-2">
        <button
          type="button"
          aria-label="Back to conversations"
          className="rounded p-1 text-gray-500 hover:bg-gray-50 md:hidden"
          onClick={onBack}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="text-gray-800 font-semibold">{open.displayName}</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto py-3 pr-1">
        {isError ? (
          <div className="text-gray-500 text-sm">
            Couldn&apos;t load messages.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        ) : isPending ? (
          <div className="text-gray-400 text-sm">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="mt-8 text-center text-gray-400 text-sm">
            No messages yet. Say hi to {open.displayName}!
          </div>
        ) : (
          messages.map((message) => {
            const day = dayLabel(message.createdAt);
            const divider = day !== lastDay;
            lastDay = day;
            return (
              <React.Fragment key={message.messageID}>
                {divider && (
                  <div className="py-1 text-center text-gray-400 text-[11px]">
                    {day}
                  </div>
                )}
                <Bubble
                  message={message}
                  onRetry={() => submit(message.body, message.messageID)}
                />
              </React.Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      {open.canSend ? (
        <div className="flex items-end gap-2 border-gray-100 border-t pt-2">
          <textarea
            ref={inputRef}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-gray-200 bg-transparent px-3 py-2 text-gray-800 text-sm"
            rows={1}
            maxLength={MESSAGE_LIMITS.body}
            placeholder={`Message ${open.displayName}`}
            aria-label={`Message ${open.displayName}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter is a new line; never while an IME is composing.
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit(draft);
              }
            }}
          />
          <button
            type="button"
            aria-label="Send"
            className="nightwind-prevent rounded-full bg-blue-600 p-2 text-white disabled:opacity-40"
            disabled={draft.trim() === ""}
            onClick={() => submit(draft)}
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="border-gray-100 border-t pt-2 text-gray-500 text-xs">
          You can message students who follow you back. You can still read this
          conversation.
        </div>
      )}
    </div>
  );
};

/** Direct messages: your conversations on the left, the open one on the right (one at a time on phones). */
const MessagesPanel = ({
  open,
  onOpen,
}: {
  open: OpenConversation | null;
  onOpen: (conversation: OpenConversation | null) => void;
}) => {
  const {
    data: conversations = [],
    isPending,
    isError,
    refetch,
  } = useConversations();
  // The polled list knows better than the card that opened it whether sending is still allowed.
  const current = open && {
    ...open,
    canSend:
      conversations.find((c) => c.profileID === open.profileID)?.canSend ??
      open.canSend,
  };
  const listed =
    current && !conversations.some((c) => c.profileID === current.profileID);

  return (
    <div className="bg-white border-gray-100 grid grid-cols-1 gap-4 rounded border p-4 md:grid-cols-[16rem_1fr]">
      <div
        className={classNames(
          "md:border-gray-100 md:border-r md:pr-3",
          current ? "hidden md:block" : ""
        )}
      >
        <div className="mb-2 text-gray-700 font-semibold">Chats</div>
        {isError ? (
          <div className="text-gray-500 text-sm">
            Couldn&apos;t load conversations.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        ) : isPending ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : conversations.length === 0 && !listed ? (
          <p className="text-gray-400 text-sm">
            No conversations yet. Open a student who follows you back and press
            Message.
          </p>
        ) : (
          <ul className="space-y-1">
            {listed && (
              <li className="rounded bg-gray-50 px-2 py-2 text-gray-800 text-sm">
                {current.displayName} (new)
              </li>
            )}
            {conversations.map((conversation) => (
              <li key={conversation.profileID}>
                <button
                  type="button"
                  className={classNames(
                    "flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-gray-50",
                    current?.profileID === conversation.profileID
                      ? "bg-gray-50"
                      : ""
                  )}
                  onClick={() =>
                    onOpen({
                      profileID: conversation.profileID,
                      displayName: conversation.displayName,
                      canSend: conversation.canSend,
                    })
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={classNames(
                        "block truncate text-gray-800 text-sm",
                        conversation.unreadCount > 0 ? "font-bold" : ""
                      )}
                    >
                      {conversation.displayName}
                    </span>
                    <span className="block truncate text-gray-500 text-xs">
                      {conversation.lastMessage.fromMe ? "You: " : ""}
                      {conversation.lastMessage.body}
                    </span>
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="nightwind-prevent shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-white text-xs">
                      {conversation.unreadCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={classNames(current ? "" : "hidden md:block")}>
        {current ? (
          <Thread
            key={current.profileID}
            open={current}
            onBack={() => onOpen(null)}
          />
        ) : (
          <div className="flex h-full min-h-[12rem] items-center justify-center text-gray-400 text-sm">
            Pick a conversation.
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPanel;
