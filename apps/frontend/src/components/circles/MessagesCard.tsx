import React, { useState } from "react";
import { Card } from "~/components/Card";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";
import {
  useConversations,
  useSendMessage,
  useThread,
} from "~/app/api/messages";
import { MESSAGE_LIMITS } from "@cmucourses/profile";
import { classNames } from "~/app/utils";

export interface OpenConversation {
  profileID: string;
  displayName: string;
  /** You follow each other right now. */
  canSend: boolean;
}

const Thread = ({ open }: { open: OpenConversation }) => {
  const { data: messages = [], isPending } = useThread(open.profileID);
  const send = useSendMessage();
  const [draft, setDraft] = useState("");

  return (
    <div className="mt-3 border-gray-100 border-t pt-3">
      <div className="text-gray-700 text-sm">{open.displayName}</div>
      <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
        {isPending ? (
          <div className="text-gray-400 text-xs">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="text-gray-400 text-xs">No messages yet.</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.messageID}
              className={classNames(
                "max-w-[80%] rounded px-3 py-2 text-sm",
                message.fromMe
                  ? "ml-auto bg-blue-50 text-blue-900"
                  : "bg-gray-50 text-gray-700"
              )}
            >
              <div className="break-words whitespace-pre-wrap">
                {message.body}
              </div>
              <div className="mt-1 text-gray-400 text-xs">
                {new Date(message.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
      {open.canSend ? (
        <div className="mt-3 space-y-2">
          <textarea
            className={`${INPUT_CLASS} w-full`}
            rows={2}
            maxLength={MESSAGE_LIMITS.body}
            placeholder={`Message ${open.displayName}`}
            aria-label={`Message ${open.displayName}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={draft.trim() === "" || send.isPending}
            onClick={() =>
              send.mutate(
                { profileID: open.profileID, body: draft },
                { onSuccess: () => setDraft("") }
              )
            }
          >
            Send
          </button>
        </div>
      ) : (
        <div className="mt-3 text-gray-400 text-xs">
          You can only send messages while you follow each other.
        </div>
      )}
    </div>
  );
};

/** Direct messages: your conversations, and the open thread. Unread counts come from the list. */
const MessagesCard = ({
  open,
  onOpen,
}: {
  open: OpenConversation | null;
  onOpen: (conversation: OpenConversation | null) => void;
}) => {
  const { data: conversations = [], isPending } = useConversations();
  const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  // The list is polled, so its canSend is fresher than what was true when the card was clicked.
  const current = open && {
    ...open,
    canSend:
      conversations.find((c) => c.profileID === open.profileID)?.canSend ??
      open.canSend,
  };

  return (
    <Card>
      <Card.Header>
        Messages{unread > 0 ? ` (${unread} unread)` : ""}
      </Card.Header>
      {isPending ? (
        <div className="mt-2 text-gray-400 text-sm">Loading…</div>
      ) : conversations.length === 0 && !open ? (
        <p className="mt-1 text-gray-400 text-sm">
          Connect with someone who connects back, then use Message on their card
          to start a conversation.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {conversations.map((conversation) => (
            <li key={conversation.profileID}>
              <button
                type="button"
                className={classNames(
                  "flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:bg-gray-50",
                  open?.profileID === conversation.profileID ? "bg-gray-50" : ""
                )}
                onClick={() =>
                  onOpen({
                    profileID: conversation.profileID,
                    displayName: conversation.displayName,
                    canSend: conversation.canSend,
                  })
                }
              >
                <span className="min-w-0">
                  <span
                    className={classNames(
                      "block text-gray-700",
                      conversation.unreadCount > 0 ? "font-bold" : ""
                    )}
                  >
                    {conversation.displayName}
                  </span>
                  <span className="block truncate text-gray-400 text-xs">
                    {conversation.lastMessage.fromMe ? "You: " : ""}
                    {conversation.lastMessage.body}
                  </span>
                </span>
                {conversation.unreadCount > 0 && (
                  <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-blue-800 text-xs">
                    {conversation.unreadCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {current && <Thread key={current.profileID} open={current} />}
    </Card>
  );
};

export default MessagesCard;
