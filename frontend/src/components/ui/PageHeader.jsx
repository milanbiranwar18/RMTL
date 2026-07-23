import React from 'react';

const PageHeader = ({ title, description, icon: Icon, actions }) => (
    <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
                {Icon && <Icon className="w-7 h-7 text-primary" />}
                {title}
            </h1>
            {description && <p className="text-muted-foreground mt-2">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
);

export default PageHeader;
