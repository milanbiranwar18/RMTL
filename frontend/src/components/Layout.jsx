import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Phone, Workflow, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Layout = ({ children }) => {
    const location = useLocation();

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Agents', path: '/agents' },
        { icon: Phone, label: 'Call History', path: '/calls' },
        { icon: Workflow, label: 'Workflows', path: '/workflows' },
        { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    ];

    // If we're on the workflow builder, we might want to hide the global navigation
    // entirely or keep it minimal, but first let's just make it a top-nav.
    const isWorkflowBuilder = location.pathname.includes('/workflows/new') || location.pathname.match(/\/workflows\/\d+/);

    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col h-screen overflow-hidden">
            {/* Top Navigation */}
            {!isWorkflowBuilder && (
            <header className="border-b border-border bg-card shrink-0">
                <div className="flex items-center justify-between px-4 py-2 border-border">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <Phone className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <span className="font-bold text-xl tracking-tight">RMVox</span>
                        </div>
                        
                        <nav className="flex items-center gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;

                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                                            isActive
                                                ? "bg-primary/10 text-primary border border-primary/20"
                                                : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {user && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground font-medium">{user.name}</span>
                                <button
                                    onClick={logout}
                                    className="p-1.5 hover:bg-destructive/10 text-destructive rounded-md transition-colors flex items-center gap-1 text-sm font-medium"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Logout</span>
                                </button>
                            </div>
                        )}
                        <ThemeToggle />
                    </div>
                </div>
            </header>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-background">
                <div className={cn(
                    "mx-auto h-full",
                    isWorkflowBuilder ? "w-full p-0" : "max-w-7xl p-8"
                )}>
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
