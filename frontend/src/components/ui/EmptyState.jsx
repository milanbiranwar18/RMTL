import React from 'react';
import { cn } from '../../lib/utils';

const EmptyState = ({ icon: Icon, title, description, action, className }) => (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
        {Icon && (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-muted-foreground" />
            </div>
        )}
        <h3 className="font-semibold text-base">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

export default EmptyState;
