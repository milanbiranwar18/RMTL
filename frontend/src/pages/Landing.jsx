import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Phone, 
  Zap, 
  Globe, 
  Lock, 
  ArrowRight, 
  Check, 
  MessageSquare, 
  Mic, 
  Volume2,
  Brain,
  BarChart3,
  Users,
  Workflow,
  Shield,
  DollarSign,
  Star,
  Menu,
  X
} from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">RMVox</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
              <a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Get Started Free
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-purple-500/20">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-gray-300 hover:text-white py-2">Features</a>
              <a href="#pricing" className="block text-gray-300 hover:text-white py-2">Pricing</a>
              <a href="#about" className="block text-gray-300 hover:text-white py-2">About</a>
              <button
                onClick={() => navigate('/login')}
                className="w-full text-left text-gray-300 hover:text-white py-2"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="w-full px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Get Started Free
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 mb-8">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Voice AI Platform - Build Once, Deploy Everywhere</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Build Powerful Voice AI
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              In Minutes, Not Months
            </span>
          </h1>

          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            Create, deploy, and scale intelligent voice agents with the most flexible platform. 
            Support for multiple LLMs, voice providers, and telephony services - all with your own API keys.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/50 flex items-center justify-center gap-2"
            >
              Start Building Free
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white text-lg font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20 flex items-center justify-center gap-2"
            >
              View Demo
              <Phone className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <div className="text-3xl font-bold text-white mb-2">10+</div>
              <div className="text-gray-400">LLM Models</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <div className="text-3xl font-bold text-white mb-2">15+</div>
              <div className="text-gray-400">Voice Providers</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <div className="text-3xl font-bold text-white mb-2">5+</div>
              <div className="text-gray-400">Telephony Services</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <div className="text-3xl font-bold text-white mb-2">100%</div>
              <div className="text-gray-400">Your Keys</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Build Voice AI
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Powerful features that give you complete control over your voice AI agents
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Multi-LLM Support</h3>
              <p className="text-gray-400 mb-4">
                Choose from GPT-4o, Claude Sonnet, Gemini Flash, Sarvam, and more. Switch models anytime.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full">GPT</span>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full">Claude</span>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-full">Gemini</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/20 hover:border-blue-500/40 transition-all">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6">
                <Mic className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Premium Voice Quality</h3>
              <p className="text-gray-400 mb-4">
                ElevenLabs, OpenAI, Sarvam, Google, Azure - crystal clear voice synthesis for your agents.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">ElevenLabs</span>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">Sarvam</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-sm rounded-2xl p-8 border border-green-500/20 hover:border-green-500/40 transition-all">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-6">
                <Phone className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Multi-Telephony</h3>
              <p className="text-gray-400 mb-4">
                Connect via Twilio, Exotel, Telnyx, Plivo, or Vonage. Make and receive calls globally.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">Twilio</span>
                <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">Exotel</span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm rounded-2xl p-8 border border-orange-500/20 hover:border-orange-500/40 transition-all">
              <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mb-6">
                <Workflow className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Visual Workflow Builder</h3>
              <p className="text-gray-400 mb-4">
                Drag-and-drop workflow builder with 16+ node types. Create complex call flows visually.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-400" />
                  Logic & Branching
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-orange-400" />
                  WhatsApp & SMS
                </li>
              </ul>
            </div>

            {/* Feature 5 */}
            <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl p-8 border border-pink-500/20 hover:border-pink-500/40 transition-all">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Advanced Analytics</h3>
              <p className="text-gray-400 mb-4">
                AI-powered transcripts, summaries, sentiment analysis, and call scoring for every conversation.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-pink-400" />
                  Auto Transcription
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-pink-400" />
                  Sentiment Analysis
                </li>
              </ul>
            </div>

            {/* Feature 6 */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-sm rounded-2xl p-8 border border-indigo-500/20 hover:border-indigo-500/40 transition-all">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-6">
                <DollarSign className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Cost Transparency</h3>
              <p className="text-gray-400 mb-4">
                Real-time cost tracking and AI-powered optimization suggestions. Save up to 80% on API costs.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400" />
                  Usage Dashboard
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-indigo-400" />
                  Cost Optimization
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* BYOK Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-3xl p-12 border border-purple-500/30">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/30 rounded-full text-purple-300 mb-4">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Bring Your Own Keys (BYOK)</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Your Data, Your Keys, Your Control
              </h2>
              <p className="text-gray-300 mb-6">
                Unlike other platforms, we never touch your API keys or charge markup. Use your own credentials 
                from OpenAI, Anthropic, Google, and more. You pay providers directly at cost.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  No markup on API costs - pay providers directly
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  Encrypted credential storage
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  Switch providers anytime without lock-in
                </li>
              </ul>
            </div>
            <div className="flex-shrink-0">
              <div className="w-64 h-64 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/50">
                <Shield className="w-32 h-32 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Pay only for what you use. No hidden fees, no markup on API costs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
              <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">₹0</span>
                <span className="text-gray-400">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Up to 100 calls/month</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>3 agents</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Basic analytics</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>BYOK support</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/register')}
                className="w-full px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all border border-white/20"
              >
                Get Started
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl p-8 border-2 border-purple-500 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-full">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">₹999</span>
                <span className="text-gray-400">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Unlimited calls</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Unlimited agents</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Custom integrations</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/register')}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
              >
                Start Free Trial
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
              <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">Custom</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>White-label solution</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Dedicated support</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>SLA guarantee</span>
                </li>
                <li className="flex items-start gap-3 text-gray-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Custom deployment</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/register')}
                className="w-full px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all border border-white/20"
              >
                Contact Sales
              </button>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-400">
              + Your own API costs (no markup) - typically ₹20-50 per call depending on providers
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Build Your Voice AI?
          </h2>
          <p className="text-xl text-gray-300 mb-10">
            Join hundreds of developers building the future of voice AI. Get started in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/50 flex items-center justify-center gap-2"
            >
              Start Building Free
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white text-lg font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-purple-500/20 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">RMVox</span>
              </div>
              <p className="text-gray-400 text-sm">
                The most flexible voice AI platform for developers.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white text-sm">Features</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white text-sm">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">API Reference</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#about" className="text-gray-400 hover:text-white text-sm">About</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Security</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2026 RMVox. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
