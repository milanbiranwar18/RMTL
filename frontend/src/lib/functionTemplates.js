// Prebuilt starting points for the Custom Function node — picking one just pre-fills the form
// fields below (name/method/url/headers/body/outputs), everything stays fully editable
// afterwards. Both of these are genuinely functional as-is (not fake placeholders):
// - Weather Lookup needs no API key at all (Open-Meteo's free public API).
// - Slack Notification only needs the user's own Incoming Webhook URL, which is itself just a
//   plain dynamic variable (`{{slack_webhook_url}}`) — no secrets hardcoded into the flow.
const FUNCTION_TEMPLATES = [
    {
        id: 'blank',
        label: 'Blank (start from scratch)',
        data: {},
    },
    {
        id: 'weather',
        label: 'Get Current Weather (Open-Meteo — no API key needed)',
        data: {
            name: 'get_weather',
            description: "Looks up the current weather for a city's coordinates.",
            method: 'GET',
            url: 'https://api.open-meteo.com/v1/forecast?latitude={{latitude}}&longitude={{longitude}}&current_weather=true',
            headers: [],
            body: '',
            timeoutSeconds: 10,
            outputs: [
                { variable: 'temperature_c', path: 'current_weather.temperature' },
                { variable: 'windspeed_kmh', path: 'current_weather.windspeed' },
            ],
        },
    },
    {
        id: 'slack',
        label: 'Send Slack Notification (Incoming Webhook)',
        data: {
            name: 'notify_slack',
            description: 'Posts a message to a Slack channel via an Incoming Webhook URL.',
            method: 'POST',
            url: '{{slack_webhook_url}}',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"text": "{{message}}"}',
            timeoutSeconds: 10,
            outputs: [],
        },
    },
];

export default FUNCTION_TEMPLATES;
