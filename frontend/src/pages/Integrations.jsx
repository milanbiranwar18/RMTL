import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    KeyRound,
    Star,
    ExternalLink,
    Trash2,
    Loader2,
    X,
    CheckCircle2,
    Plug,
    PhoneCall,
    Search,
    Copy,
    Check,
} from 'lucide-react';
import client from '../api/client';
import { cn } from '../lib/utils';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';

// "Voice" merges the old separate Speech-to-Text / Text-to-Speech tabs into one — most agents
// pick both from the same vendor (Deepgram, Sarvam), and a few vendors (Sarvam, OpenAI) sell one
// account key that covers LLM + STT + TTS entirely. Splitting BYOK connection into 4 tabs meant
// asking for the identical key up to 3 times; grouping by "what does this vendor let you do" and
// merging same-id entries across stt/tts fixes that without losing the STT-vs-TTS distinction
// (still shown per-card via badges — Deepgram/Sarvam do both, ElevenLabs/Cartesia are TTS-only,
// AssemblyAI is STT-only).
const CATEGORY_TABS = [
    { id: 'llm', label: 'LLM' },
    { id: 'voice', label: 'Voice' },
    { id: 'telephony', label: 'Telephony' },
];

const CATEGORY_BLURB = {
    llm: 'The language model that thinks for your agent and decides what to say or which tool to call.',
    voice: 'Speech-to-Text transcribes the caller in real time; Text-to-Speech turns your agent\u2019s reply back into audio. Providers that offer both (Deepgram, Sarvam) only need connecting once here \u2014 pick either side for each agent independently in its Voice tab.',
    telephony: 'Connects your agent to real phone numbers to make and receive calls.',
};

const CAPABILITY_LABEL = { stt: 'Speech-to-Text', tts: 'Text-to-Speech' };

// Merge same-id provider entries across stt/tts into one card, remembering every category
// (each becomes its own Integration row server-side) each one applies to.
function mergeVoiceProviders(catalog) {
    const byId = new Map();
    for (const cat of ['stt', 'tts']) {
        for (const p of catalog?.[cat] || []) {
            if (!byId.has(p.id)) byId.set(p.id, { ...p, categories: [] });
            byId.get(p.id).categories.push(cat);
        }
    }
    return Array.from(byId.values());
}

export default function Integrations() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [catalog, setCatalog] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [activeTab, setActiveTab] = useState('llm');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingProvider, setEditingProvider] = useState(null); // { category, provider info }
    const [savingProviderId, setSavingProviderId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const loadAll = async () => {
        setError('');
        try {
            const [catalogRes, integrationsRes] = await Promise.all([
                client.get('/integrations/catalog'),
                client.get('/integrations/'),
            ]);
            setCatalog(catalogRes.data);
            setIntegrations(integrationsRes.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to load integrations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const savedByKey = useMemo(() => {
        const map = {};
        for (const integration of integrations) {
            map[`${integration.category}:${integration.provider}`] = integration;
        }
        return map;
    }, [integrations]);

    // Deep link support — other pages (Agent forms, the Calling tab) link here as
    // `/integrations?open=telephony:exotel` so "where do I set up Exotel?" is a single click
    // away instead of "go find it yourself on this page".
    useEffect(() => {
        if (!catalog) return;
        const open = searchParams.get('open');
        if (!open) return;
        const [category, providerId] = open.split(':');
        const tab = category === 'stt' || category === 'tts' ? 'voice' : category;
        const providerList = tab === 'voice' ? mergeVoiceProviders(catalog) : (catalog[category] || []);
        const provider = providerList.find((p) => p.id === providerId);
        if (provider) {
            setActiveTab(tab);
            const categories = provider.categories || [category];
            setEditingProvider({
                categories,
                provider,
                savedEntries: categories.map((c) => savedByKey[`${c}:${providerId}`]).filter(Boolean),
            });
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('open');
            return next;
        }, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalog]);

    const handleSave = async (categories, providerId, credentials) => {
        setSavingProviderId(providerId);
        setError('');
        try {
            let last = null;
            for (const category of categories) {
                const res = await client.post('/integrations/', { category, provider: providerId, credentials });
                last = res.data;
                setIntegrations((prev) => {
                    const others = prev.filter((i) => !(i.category === category && i.provider === providerId));
                    return [...others, res.data];
                });
            }
            setEditingProvider(null);
            return last;
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save credentials');
        } finally {
            setSavingProviderId(null);
        }
    };

    const handleDelete = async (savedEntries) => {
        const entries = Array.isArray(savedEntries) ? savedEntries : [savedEntries];
        if (entries.length === 0) return;
        if (!window.confirm(`Remove the ${entries[0].provider} key? Agents using it will stop working until you add a new key.`)) {
            return;
        }
        setDeletingId(entries[0].id);
        try {
            await Promise.all(entries.map((integration) => client.delete(`/integrations/${integration.id}`)));
            const ids = new Set(entries.map((e) => e.id));
            setIntegrations((prev) => prev.filter((i) => !ids.has(i.id)));
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to remove integration');
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading integrations...</div>;
    }

    const providers = activeTab === 'voice' ? mergeVoiceProviders(catalog) : (catalog?.[activeTab] || []);

    return (
        <div className="space-y-8">
            <PageHeader
                icon={KeyRound}
                title="Integrations"
                description="Bring your own API keys for every provider. Your keys are encrypted at rest and never shown again after saving."
            />

            {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* Category tabs */}
            <div className="flex items-center gap-1 border-b border-border">
                {CATEGORY_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                            activeTab === tab.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <p className="text-sm text-muted-foreground -mt-4">{CATEGORY_BLURB[activeTab]}</p>

            {/* Provider cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providers.map((provider) => {
                    const categories = provider.categories || [activeTab];
                    const savedEntries = categories.map((c) => savedByKey[`${c}:${provider.id}`]).filter(Boolean);
                    const saved = savedEntries[0];
                    return (
                        <ProviderCard
                            key={provider.id}
                            categories={categories}
                            provider={provider}
                            saved={saved}
                            connected={savedEntries.length > 0}
                            onConnect={() => setEditingProvider({ categories, provider, savedEntries })}
                            onDelete={savedEntries.length > 0 ? () => handleDelete(savedEntries) : undefined}
                            deleting={saved && deletingId === saved.id}
                        >
                            {activeTab === 'telephony' && provider.id === 'twilio' && saved && (
                                <TwilioNumberSearch onBought={loadAll} />
                            )}
                        </ProviderCard>
                    );
                })}
            </div>

            {editingProvider && (
                <CredentialModal
                    categories={editingProvider.categories}
                    provider={editingProvider.provider}
                    saved={editingProvider.savedEntries?.[0]}
                    saving={savingProviderId === editingProvider.provider.id}
                    onCancel={() => setEditingProvider(null)}
                    onSave={(credentials) => handleSave(editingProvider.categories, editingProvider.provider.id, credentials)}
                />
            )}
        </div>
    );
}

function ProviderCard({ provider, categories, saved, connected, onConnect, onDelete, deleting, children }) {
    return (
        <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{provider.name}</h3>
                        {provider.recommended && (
                            <Badge variant="primary" icon={Star}>Recommended</Badge>
                        )}
                        {connected && (
                            <Badge variant="success" icon={CheckCircle2}>Connected</Badge>
                        )}
                        {categories?.length > 1 && categories.map((c) => (
                            <Badge key={c} variant="neutral">{CAPABILITY_LABEL[c] || c}</Badge>
                        ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{provider.description}</p>
                    {provider.shares_key_with && (
                        <p className="text-xs text-primary/80 mt-1">
                            One key here covers this everywhere it's offered (LLM, Speech-to-Text and/or
                            Text-to-Speech) — no need to connect it again elsewhere.
                        </p>
                    )}
                </div>
            </div>

            {saved && (
                <div className="text-xs font-mono bg-muted rounded-md p-2 space-y-1">
                    {Object.entries(saved.masked_credentials).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                            <span className="text-muted-foreground">{key}</span>
                            <span>{value}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-2 mt-auto pt-1">
                <button
                    onClick={onConnect}
                    className="text-sm font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                    {saved ? 'Update key' : 'Connect'}
                </button>
                {saved && (
                    <button
                        onClick={onDelete}
                        disabled={deleting}
                        className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Remove
                    </button>
                )}
                {provider.docs_url && (
                    <a
                        href={provider.docs_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1"
                    >
                        Get key <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </div>

            {children}
        </div>
    );
}

function TwilioNumberSearch({ onBought }) {
    const [open, setOpen] = useState(false);
    const [country, setCountry] = useState('US');
    const [areaCode, setAreaCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [buyingNumber, setBuyingNumber] = useState(null);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    const search = async () => {
        setLoading(true);
        setError('');
        setResults(null);
        try {
            const params = { country };
            if (areaCode.trim()) params.area_code = areaCode.trim();
            const res = await client.get('/telephony/twilio/available-numbers', { params });
            setResults(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Number search failed');
        } finally {
            setLoading(false);
        }
    };

    const buy = async (phoneNumber) => {
        setBuyingNumber(phoneNumber);
        setError('');
        try {
            await client.post('/telephony/twilio/buy-number', { phone_number: phoneNumber });
            setResults(null);
            setOpen(false);
            if (onBought) onBought();
        } catch (err) {
            setError(err.response?.data?.detail || 'Number purchase failed');
        } finally {
            setBuyingNumber(null);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="text-sm font-medium px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors flex items-center gap-1.5 w-fit"
            >
                <PhoneCall className="w-3.5 h-3.5" /> Search &amp; buy a number
            </button>
        );
    }

    return (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Search Twilio numbers</p>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    placeholder="Country (e.g. US, IN, GB)"
                    className="w-28 px-2 py-1.5 text-xs rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                    type="text"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    placeholder="Area code (optional)"
                    className="flex-1 px-2 py-1.5 text-xs rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                    onClick={search}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Search
                </button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            {results && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {results.length === 0 && <p className="text-xs text-muted-foreground">No numbers found — try a different country/area code.</p>}
                    {results.map((n) => (
                        <div key={n.phone_number} className="flex items-center justify-between text-xs bg-background rounded-md px-2.5 py-1.5 border border-border">
                            <div>
                                <span className="font-mono font-medium">{n.phone_number}</span>
                                {n.locality && <span className="text-muted-foreground ml-2">{n.locality}</span>}
                            </div>
                            <button
                                onClick={() => buy(n.phone_number)}
                                disabled={buyingNumber === n.phone_number}
                                className="px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                                {buyingNumber === n.phone_number && <Loader2 className="w-3 h-3 animate-spin" />}
                                Buy
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ExotelStreamUrlBox() {
    const [data, setData] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        client.get('/telephony/exotel/stream-url').then((res) => setData(res.data)).catch(() => setData({ configured: false }));
    }, []);

    const copy = () => {
        if (!data?.url) return;
        navigator.clipboard?.writeText(data.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    if (!data) return null;

    return (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-xs space-y-2">
            <p className="font-semibold">One-time Exotel Flow setup</p>
            {data.configured ? (
                <>
                    <p className="text-muted-foreground">
                        In Exotel's App Bazaar, build a Flow with a <strong>Voicebot Applet</strong> pointed at this
                        exact URL (same URL for every agent — Exotel's own call ID routes each call automatically),
                        then paste that Flow's App ID below.
                    </p>
                    <div className="flex items-center gap-1.5">
                        <code className="flex-1 bg-background border border-border rounded px-2 py-1.5 font-mono text-[11px] truncate">
                            {data.url}
                        </code>
                        <button
                            type="button"
                            onClick={copy}
                            className="p-1.5 rounded-md border border-border hover:bg-accent shrink-0"
                            title="Copy"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </>
            ) : (
                <p className="text-yellow-600 dark:text-yellow-400">{data.message || 'Backend PUBLIC_BASE_URL is not configured yet — ask an admin to set it before this will work.'}</p>
            )}
            <a
                href="https://developer.exotel.com/docs/agentstream/stream-voicebot-applet"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            >
                Full Exotel Voicebot Applet docs <ExternalLink className="w-3 h-3" />
            </a>
        </div>
    );
}

function CredentialModal({ categories, provider, saved, saving, onCancel, onSave }) {
    const [values, setValues] = useState(() => {
        const initial = {};
        for (const field of provider.fields) {
            initial[field.key] = '';
        }
        return initial;
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
            <div
                className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Plug className="w-5 h-5" />
                        {saved ? 'Update' : 'Connect'} {provider.name}
                    </h2>
                    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    {categories?.length > 1 ? (
                        <>Covers: <span className="capitalize">{categories.map((c) => CAPABILITY_LABEL[c] || c).join(' + ')}</span></>
                    ) : (
                        <>Category: <span className="capitalize">{categories?.[0]}</span></>
                    )}
                    {saved ? ' — entering new values will replace the existing key.' : ''}
                </p>

                {provider.id === 'exotel' && (
                    <div className="mb-4">
                        <ExotelStreamUrlBox />
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    {provider.fields.map((field) => (
                        <div key={field.key}>
                            <label className="text-sm font-medium block mb-1">{field.label}</label>
                            {field.type === 'textarea' ? (
                                <textarea
                                    required
                                    rows={6}
                                    value={values[field.key]}
                                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                                    placeholder={saved ? '•••••••••••• (unchanged)' : `Paste ${field.label.toLowerCase()}`}
                                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-xs font-mono outline-none focus:ring-2 focus:ring-ring resize-y"
                                />
                            ) : (
                                <input
                                    type={field.type === 'password' ? 'password' : 'text'}
                                    required
                                    value={values[field.key]}
                                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                                    placeholder={saved ? '••••••••••••' : `Enter ${field.label.toLowerCase()}`}
                                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
                                />
                            )}
                        </div>
                    ))}

                    <div className="flex items-center gap-2 pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save key
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="text-sm font-medium px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
