import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, Trash2, Upload, AlertTriangle, DollarSign, Info } from 'lucide-react';
import {
  getNotifications, getUnreadCount, markAsRead,
  markAllAsRead, deleteNotification, Notification,
} from '../lib/notificationService';

const TYPE_STYLES: Record<string, { icon: any; bg: string; text: string }> = {
  upload:          { icon: Upload, bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
  deposit_pending: { icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
  billing:         { icon: DollarSign, bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400' },
  deletion:        { icon: Trash2, bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
  anomaly:         { icon: AlertTriangle, bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
  info:            { icon: Info, bg: 'bg-gray-50 dark:bg-gray-700/30', text: 'text-gray-600 dark:text-gray-400' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadData() {
    const [n, c] = await Promise.all([getNotifications(15), getUnreadCount()]);
    setItems(n);
    setUnread(c);
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    await loadData();
  }

  async function handleMarkRead(id: string) {
    await markAsRead(id);
    await loadData();
  }

  async function handleDelete(id: string) {
    await deleteNotification(id);
    await loadData();
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Bell size={20} className="text-gray-600 dark:text-gray-300" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* Items */}
          <div className="max-h-[340px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No notifications</div>
            ) : (
              items.map(item => {
                const style = TYPE_STYLES[item.type] || TYPE_STYLES.info;
                const IconComp = style.icon;
                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 flex items-start gap-3 transition-colors ${
                      !item.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${style.bg}`}>
                      <IconComp size={14} className={style.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!item.is_read ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                        {item.title}
                      </p>
                      {item.body && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.body}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(item.created_at)}</p>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0">
                      {!item.is_read && (
                        <button onClick={() => handleMarkRead(item.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                          <Check size={12} className="text-blue-500" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        <X size={12} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
