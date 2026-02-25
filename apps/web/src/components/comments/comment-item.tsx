'use client';

import { useState } from 'react';
import { Reply, Pencil, Trash2 } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import CommentForm from './comment-form';

interface Props {
  comment: any;
  currentUserId: string;
  currentUserRole: string;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onReply: (id: string) => void;
  onReplySubmit: (parentId: string, body: string) => Promise<void>;
  onReplyCancel: () => void;
  replyingTo: string | null;
  depth?: number;
}

const avatarColors = [
  'bg-brand-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function CommentItem({
  comment,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
  onReply,
  onReplySubmit,
  onReplyCancel,
  replyingTo,
  depth = 0,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  const isAuthor = comment.author?.id === currentUserId;
  const isAdmin = currentUserRole === 'admin';
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdmin;
  const authorName = comment.author?.nameAr || comment.author?.name || 'مجهول';

  const handleEdit = async (body: string) => {
    await onEdit(comment.id, body);
    setIsEditing(false);
  };

  const depthMargin = depth > 0 ? `mr-${Math.min(depth, 3) * 6}` : '';

  return (
    <div className={cn(depthMargin)}>
      <div
        className={cn(
          'group rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10',
          depth > 0 && 'border-r-2 border-r-brand-500/40'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
              getAvatarColor(authorName)
            )}
          >
            {authorName.charAt(0)}
          </div>

          {/* Author info */}
          <div className="flex flex-1 items-center gap-2">
            <span className="text-sm font-semibold text-white">{authorName}</span>
            <span className="text-[11px] text-gray-400">
              {formatDateTime(comment.createdAt)}
            </span>
            {comment.isEdited && (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
                تم التعديل
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        {isEditing ? (
          <div className="mt-3">
            <CommentForm
              onSubmit={handleEdit}
              initialValue={comment.body}
              onCancel={() => setIsEditing(false)}
              autoFocus
            />
          </div>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">
            {comment.body}
          </p>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="mt-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {depth < 3 && (
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Reply className="h-3.5 w-3.5" />
                ردّ
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" />
                تعديل
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reply form */}
      {replyingTo === comment.id && (
        <div className="mr-6 mt-2">
          <CommentForm
            onSubmit={(body) => onReplySubmit(comment.id, body)}
            placeholder="اكتب ردّك..."
            onCancel={onReplyCancel}
            autoFocus
          />
        </div>
      )}

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {comment.replies.map((reply: any) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onEdit={onEdit}
              onDelete={onDelete}
              onReply={onReply}
              onReplySubmit={onReplySubmit}
              onReplyCancel={onReplyCancel}
              replyingTo={replyingTo}
              depth={Math.min(depth + 1, 3)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
