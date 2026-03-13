// =============================================
// notificationService.ts
// CRUD for notifications + helper to create
// =============================================
import { supabase } from './supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.error(error); return []; }
  return (data || []) as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

export async function markAsRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllAsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase.from('notifications').delete().eq('id', id);
}

export async function createNotification(input: {
  type: string;
  title: string;
  body?: string;
  metadata?: Record<string, any>;
  targetUserId?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = input.targetUserId || user?.id;
  if (!userId) return;

  await supabase.from('notifications').insert([{
    user_id: userId,
    type: input.type,
    title: input.title,
    body: input.body || '',
    metadata: input.metadata || {},
  }]);
}
