import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Unified stat card used across Dashboard/Analytics.
 * `iconClassName` must be a literal Tailwind class string (e.g. "bg-blue-500/10 text-blue-500")
 * so the JIT scanner can pick it up — never build it dynamically.
 */
const StatCard = ({ icon: Icon, label, value, hint, iconClassName, trend, className }) => (
    <div
        className={cn(
            'bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all',
            className
        )}
    >
        <div className="flex items-center justify-between">
            <div
                className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    iconClassName || 'bg-primary/10 text-primary'
                )}
            >
                {Icon && <Icon className="w-5 h-5" />}
            </div>
            {trend && (
                <span
                    className={cn(
                        'text-xs font-semibold',
                        trend.direction === 'down' ? 'text-red-500' : 'text-green-500'
                    )}
                >
                    {trend.direction === 'down' ? '▼' : '▲'} {trend.value}
                </span>
            )}
        </div>
        <div className="mt-4">
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            {hint && <p className="text-xs text-muted-foreground/70 mt-1.5">{hint}</p>}
        </div>
    </div>
);

export default StatCard;
