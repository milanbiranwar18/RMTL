import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Accordion-style section used throughout the docked Global/Node Settings panel — lets rarely
// touched groups (Transcription, Calling, ...) start collapsed so the panel isn't one long
// scroll, while frequently touched ones (LLM, Voice) can default open.
const CollapsibleSection = ({ title, defaultOpen = true, children }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section className="space-y-3">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between group"
            >
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                    {title}
                </h4>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="space-y-3">{children}</div>}
        </section>
    );
};

export default CollapsibleSection;
