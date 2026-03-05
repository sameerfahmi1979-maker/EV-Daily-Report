import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  /** When true, render as sub-item (indented) under a parent */
  sub?: boolean;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onClick,
  sub = false,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 py-3 transition-all duration-200
        ${isCollapsed ? 'justify-center px-0' : sub ? 'pl-8 pr-4' : 'px-4'}
        ${
          isActive
            ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
            : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent hover:border-gray-200'
        }
      `}
      title={isCollapsed ? label : undefined}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
    </button>
  );
};
