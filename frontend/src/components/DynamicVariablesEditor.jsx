import React from 'react';
import { Plus, X } from 'lucide-react';

// Generic key/value editor for call-time "dynamic variables" — substituted into the agent's
// prompt as {{key}}, with `language` as a reserved key that overrides the agent's spoken
// language for THIS call/test only (e.g. pass language=Hindi to make an English-scripted
// agent answer in Hindi, without touching the agent's saved default or cloning it).
const DynamicVariablesEditor = ({ variables, onChange, compact = false }) => {
    const rows = Object.entries(variables || {});

    const updateRow = (idx, key, value) => {
        const next = rows.map((row, i) => (i === idx ? [key, value] : row));
        onChange(Object.fromEntries(next));
    };
    const addRow = () => onChange({ ...(variables || {}), '': '' });
    const removeRow = (idx) => onChange(Object.fromEntries(rows.filter((_, i) => i !== idx)));

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className={`font-medium text-muted-foreground ${compact ? 'text-[11px]' : 'text-xs'}`}>
                    Dynamic Variables
                </label>
                <button
                    type="button"
                    onClick={addRow}
                    className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                    <Plus className="w-3 h-3" /> Add
                </button>
            </div>

            {rows.length === 0 ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                    Pass <code className="bg-muted px-1 rounded">language</code> = <code className="bg-muted px-1 rounded">Hindi</code> (or any
                    supported language) to make the agent speak in that language for this call only — even if its
                    script is written in English. Any other key becomes <code className="bg-muted px-1 rounded">{'{{key}}'}</code> in the prompt.
                </p>
            ) : (
                rows.map(([key, value], idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                        <input
                            type="text"
                            placeholder="key (e.g. language)"
                            value={key}
                            onChange={(e) => updateRow(idx, e.target.value, value)}
                            className="w-2/5 px-2 py-1.5 text-xs rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                        />
                        <input
                            type="text"
                            placeholder="value (e.g. Hindi)"
                            value={value}
                            onChange={(e) => updateRow(idx, key, e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))
            )}
        </div>
    );
};

export default DynamicVariablesEditor;
