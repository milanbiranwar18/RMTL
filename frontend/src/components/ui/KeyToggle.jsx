import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Globe, AlertCircle, Info } from 'lucide-react';

/**
 * "Platform Key vs My Own Key" toggle — used everywhere an agent picks a per-provider API key
 * (LLM / Voice / Transcription tabs across AgentForm, AgentSettings, AgentSettingsPanel).
 *
 * Default ("Platform Key") means: use whichever key this account already has resolved for this
 * provider — the user's own saved Integrations credential if they connected one, otherwise the
 * backend's built-in default key (see services/key_resolver.py). Nothing to fill in, nothing
 * marked "optional" — it Just Works until the user explicitly asks to override it with their own
 * key for this one agent.
 */
const KeyToggle = ({ label, ownKey, onChange, placeholder, connected, sharedKeyNote }) => {
    const useOwn = !!ownKey && ownKey !== '';
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <div className="flex rounded-md overflow-hidden border border-border text-xs shrink-0">
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className={`px-2 py-0.5 transition-colors ${!useOwn ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                        Use Default
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange(' ')}
                        className={`px-2 py-0.5 transition-colors border-l border-border ${useOwn ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    >
                        My Own Key
                    </button>
                </div>
            </div>

            {useOwn ? (
                <input
                    type="password"
                    className="w-full px-2.5 py-1.5 text-xs rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                    value={ownKey.trim()}
                    onChange={(e) => onChange(e.target.value || ' ')}
                    placeholder={placeholder}
                    autoComplete="off"
                />
            ) : connected ? (
                <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Using your saved Integrations key
                </p>
            ) : (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
                    <Globe className="w-3 h-3 shrink-0" /> Using the platform's default key (if configured).{' '}
                    <Link to="/integrations" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">
                        <AlertCircle className="w-3 h-3" /> Connect your own in Integrations
                    </Link>
                </p>
            )}

            {sharedKeyNote && (
                <p className="text-[11px] text-muted-foreground/80 flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" /> {sharedKeyNote}
                </p>
            )}
        </div>
    );
};

export default KeyToggle;
