import React from 'react';

interface SidebarSectionProps {
  title?: string;
  isCollapsed: boolean;
  children: React.ReactNode;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  isCollapsed,
  children,
}) => {
  return (
    <div className="py-2">
      {title && !isCollapsed && (
        <div className="px-4 py-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title}
          </h3>
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
};
