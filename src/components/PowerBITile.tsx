import { ReactNode } from 'react';

interface Props {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  span?: 1 | 2 | 3;
}

export default function PowerBITile({ title, icon, children, className = '', span = 1 }: Props) {
  const colSpan = span === 2 ? 'md:col-span-2' : span === 3 ? 'md:col-span-3' : '';
  return (
    <div className={`bg-[#2a2a3e] border border-[#3a3a4e] rounded-lg overflow-hidden ${colSpan} ${className}`}>
      <div className="px-4 py-2.5 border-b border-[#3a3a4e] flex items-center gap-2">
        {icon && <span className="text-[#8888a0]">{icon}</span>}
        <h3 className="text-xs font-semibold text-[#c0c0d0] uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
