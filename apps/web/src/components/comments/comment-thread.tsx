'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { commentsApi } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import CommentItem from './comment-item';
import CommentForm from './comment-form';

interface Props {
  entityType: string;
  entityId: string;
}

export default function CommentThread({ entityType, entityId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, countRes] = await Promise.all([
        commentsApi.list(entityType, entityId),
        commentsApi.count(entityType, entityId),
      ]);
      setComments(listRes.data);
      setCount(countRes.data.count);
    } catch {
      toast.error('فشل تحميل التعليقات');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleCreate = async (body: string) => {
    try {
      await commentsApi.create({ entityType, entityId, body });
      toast.success('تم إضافة التعليق');
      await fetchComments();
    } catch {
      toast.error('فشل إضافة التعليق');
    }
  };

  const handleReply = async (parentId: string, body: string) => {
    try {
      await commentsApi.create({ entityType, entityId, body, parentId });
      toast.success('تم إضافة الردّ');
      setReplyingTo(null);
      await fetchComments();
    } catch {
      toast.error('فشل إضافة الردّ');
    }
  };

  const handleEdit = async (id: string, body: string) => {
    try {
      await commentsApi.update(id, { body });
      toast.success('تم تعديل التعليق');
      await fetchComments();
    } catch {
      toast.error('فشل تعديل التعليق');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await commentsApi.delete(id);
      toast.success('تم حذف التعليق');
      await fetchComments();
    } catch {
      toast.error('فشل حذف التعليق');
    }
  };

  const handleReplyClick = (id: string) => {
    setReplyingTo(id);
  };

  return (
    <div className="glass rounded-xl border border-white/10 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <MessageCircle className="h-5 w-5 text-brand-300" />
        <h3 className="text-sm font-semibold text-white">التعليقات</h3>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500/20 px-1.5 text-[11px] font-medium text-brand-300">
          {count}
        </span>
      </div>

      {/* New comment form */}
      <div className="mb-6">
        <CommentForm onSubmit={handleCreate} placeholder="اكتب تعليقك..." />
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
          <MessageCircle className="h-10 w-10" />
          <p className="text-sm">لا توجد تعليقات بعد</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id || ''}
              currentUserRole={user?.role || ''}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReply={handleReplyClick}
              onReplySubmit={handleReply}
              onReplyCancel={() => setReplyingTo(null)}
              replyingTo={replyingTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}
