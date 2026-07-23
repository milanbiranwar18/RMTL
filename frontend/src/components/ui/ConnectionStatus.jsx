import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Small inline indicator that reflects whether the user has a key saved in the
 * Integrations vault for a given category+provider. Purely informational — it
 * does not guarantee the call pipeline is already wired to consume that key.
 */
const ConnectionStatus = ({ connected, providerName }) => {
    if (connected) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {providerName} key saved in Integrations
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5" />
            No {providerName} key saved —{' '}
            <Link to="/integrations" className="text-primary hover:underline font-medium">
                add one in Integrations
            </Link>
        </span>
    );
};

export default ConnectionStatus;
