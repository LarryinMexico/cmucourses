import React, { useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { COMMENT_LIMITS, type CirclePost } from "@cmucourses/profile";
import {
  useAddComment,
  useDeleteComment,
  usePostComments,
} from "~/app/api/social";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "~/components/profile/fields";

/** A post's comments. Anyone can read them; writing needs following the author. */
const PostComments = ({ post }: { post: CirclePost }) => {
  const [draft, setDraft] = useState("");
  const {
    data: comments = [],
    isPending,
    isError,
    refetch,
  } = usePostComments(post.postID, true);
  const add = useAddComment();
  const remove = useDeleteComment();
  const canWrite = post.following && !post.isMine;

  const submit = () => {
    if (draft.trim() === "") return;
    add.mutate(
      { postId: post.postID, body: draft },
      { onSuccess: () => setDraft("") }
    );
  };

  return (
    <div className="mt-3 space-y-3 border-gray-100 border-t pt-3">
      {isError ? (
        <div className="text-gray-500 text-sm">
          Couldn&apos;t load comments.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      ) : isPending ? (
        <div className="text-gray-400 text-xs">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="text-gray-400 text-xs">No comments yet.</div>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.commentID} className="flex gap-2 text-sm">
              <div className="min-w-0 flex-1 rounded bg-gray-50 px-3 py-2">
                <div className="text-gray-700 text-xs font-semibold">
                  {comment.authorName}
                  <span className="ml-2 font-normal text-gray-400">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words text-gray-700">
                  {comment.body}
                </div>
              </div>
              {comment.canDelete && (
                <button
                  type="button"
                  aria-label="Delete comment"
                  title="Delete comment"
                  className="h-fit shrink-0 rounded p-1 text-gray-400 hover:bg-gray-50"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate({
                      postId: post.postID,
                      commentID: comment.commentID,
                    })
                  }
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <div className="flex items-end gap-2">
          <textarea
            className={`${INPUT_CLASS} flex-1`}
            rows={1}
            maxLength={COMMENT_LIMITS.body}
            placeholder="Write a comment… (Enter to post)"
            aria-label={`Comment on ${post.author.displayName}'s schedule`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={draft.trim() === "" || add.isPending}
            onClick={submit}
          >
            Post
          </button>
        </div>
      ) : (
        !post.isMine && (
          <div className="text-gray-400 text-xs">
            Follow {post.author.displayName} to comment.
          </div>
        )
      )}
    </div>
  );
};

export default PostComments;
