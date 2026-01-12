
import React from 'react';
import { AppNotification } from '../types';

interface NotificationToastProps {
    notification: AppNotification;
    onDismiss: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onDismiss }) => {
    const baseClasses = "flex items-start p-4 w-full max-w-sm bg-gray-800 rounded-lg shadow-lg text-white ring-1 ring-black ring-opacity-5 transition-all";
    const typeClasses = {
        success: 'border-l-4 border-green-500',
        info: 'border-l-4 border-blue-500',
        warning: 'border-l-4 border-yellow-500',
        error: 'border-l-4 border-red-500',
    };
    
    const icons = {
        success: <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
        info: <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
        warning: <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>,
        error: <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>,
    };

    return (
        <div className={`${baseClasses} ${typeClasses[notification.type]}`}>
            <div className="flex-shrink-0 pt-0.5">
                {icons[notification.type]}
            </div>
            <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-semibold text-gray-100">{notification.title}</p>
                <p className="mt-1 text-sm text-gray-300">{notification.message}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
                <button onClick={() => onDismiss(notification.id)} className="inline-flex text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 rounded-md">
                    <span className="sr-only">Close</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


interface NotificationContainerProps {
    notifications: AppNotification[];
    onDismiss: (id: string) => void;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({ notifications, onDismiss }) => {
    return (
        <div aria-live="assertive" className="fixed inset-0 flex items-start px-4 py-20 pointer-events-none sm:p-6 sm:items-start z-[2000]">
            <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
                {notifications.map(notification => (
                    <NotificationToast 
                        key={notification.id}
                        notification={notification}
                        onDismiss={onDismiss}
                    />
                ))}
            </div>
        </div>
    );
};

export default NotificationContainer;
