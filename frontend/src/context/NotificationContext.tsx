import React, { useEffect, useState } from "react";

export type NotificationType = "success" | "error" | "warning" | "info";

export type Notification = {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
};

const NotificationContext = React.createContext<{
  notify: (type: NotificationType, message: string, duration?: number) => void;
}>({
  notify: () => {},
});

export const useNotification = () => React.useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const notify = (type: NotificationType, message: string, duration = 4000) => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={(id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }} />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC<{
  notifications: Notification[];
  onRemove: (id: string) => void;
}> = ({ notifications, onRemove }) => {
  return (
    <div className="notification-container">
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onClose={() => onRemove(n.id)}
        />
      ))}
    </div>
  );
};

const NotificationItem: React.FC<{
  notification: Notification;
  onClose: () => void;
}> = ({ notification, onClose }) => {
  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(onClose, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration, onClose]);

  return (
    <div className="notification" data-type={notification.type}>
      <span>{notification.message}</span>
      <button type="button" className="notification-close" onClick={onClose} aria-label="Закрыть">
        ✕
      </button>
    </div>
  );
};
