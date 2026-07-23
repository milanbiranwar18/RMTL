import React from 'react';
import { cn } from '../../lib/utils';

// Every variant is opacity-derived from the accent color itself, so it stays legible
// in both light and dark mode without a separate `dark:` override per variant.
const VARIANTS = {
    success: 'bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400',
    warning: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400',
    danger: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400',
    info: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    neutral: 'bg-muted text-muted-foreground border-border',
    primary: 'bg-primary/10 text-primary border-primary/20',
};

const Badge = ({ variant = 'neutral', icon: Icon, children, className }) => (
    <span
        className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap',
            VARIANTS[variant] || VARIANTS.neutral,
            className
        )}
    >
        {Icon && <Icon className="w-3 h-3" />}
        {children}
    </span>
);

export default Badge;
