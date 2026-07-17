import React, { useState } from 'react';
import FileUpload from './FileUpload';
import ImportHistory from './ImportHistory';

interface ImportPageProps {
  onNavigateToBilling: () => void;
}

export default function ImportPage({ onNavigateToBilling }: ImportPageProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleImportComplete() {
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <div className="space-y-8">
      <FileUpload onImportComplete={handleImportComplete} onNavigateToBilling={onNavigateToBilling} />

      <div className="border-t border-gray-200 pt-8">
        <ImportHistory refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
