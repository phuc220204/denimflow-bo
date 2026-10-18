import { AlertCircle, Home } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { i18n } from '../lib/i18n/dictionary';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex h-12 w-12 rounded-full bg-danger-tint text-danger items-center justify-center mb-2">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-text">{i18n.common.notFoundTitle}</h1>
        <p className="text-sm text-text-muted">{i18n.common.notFoundMessage}</p>
        <div className="pt-2">
          <Link to="/">
            <Button variant="primary" className="gap-2">
              <Home className="h-4 w-4" />
              <span>{i18n.common.backHome}</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
