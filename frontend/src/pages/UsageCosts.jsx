import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Phone, 
  MessageSquare, 
  Mic, 
  Volume2, 
  Brain,
  Calendar,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  BarChart3
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function UsageCosts() {
  const [period, setPeriod] = useState('this_month');
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageData();
  }, [period]);

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      // Fetch summary
      const summaryRes = await axios.get(`${API_URL}/usage/summary?period=${period}`);
      setSummary(summaryRes.data);

      // Fetch daily data for chart
      const dailyRes = await axios.get(`${API_URL}/usage/daily?days=30`);
      setDailyData(dailyRes.data.data);

      // Fetch optimization suggestions
      const optRes = await axios.get(`${API_URL}/usage/cost-optimization`);
      setOptimization(optRes.data);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN').format(num || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading usage data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Usage & Costs</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your API usage and optimize costs
            </p>
          </div>

          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Cost */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8" />
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(summary?.total_cost)}</div>
            <div className="text-purple-100">Total Cost ({summary?.period})</div>
          </div>

          {/* Total Calls */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Phone className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {formatNumber(summary?.total_calls)}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Total Calls</div>
          </div>

          {/* LLM Cost */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Brain className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(summary?.llm?.total_cost)}
            </div>
            <div className="text-gray-600 dark:text-gray-400">LLM Cost</div>
          </div>

          {/* Telephony Cost */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Phone className="w-8 h-8 text-orange-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {formatCurrency(summary?.telephony?.total_cost)}
            </div>
            <div className="text-gray-600 dark:text-gray-400">Telephony Cost</div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* LLM Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">LLM Usage</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Input Tokens</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(summary?.llm?.total_input_tokens)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Output Tokens</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(summary?.llm?.total_output_tokens)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Cached Tokens</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatNumber(summary?.llm?.total_cached_tokens)}
                </span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between items-center">
                <span className="text-gray-900 dark:text-white font-semibold">Total Cost</span>
                <span className="text-xl font-bold text-purple-600">
                  {formatCurrency(summary?.llm?.total_cost)}
                </span>
              </div>
            </div>
          </div>

          {/* STT & TTS Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Mic className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Voice Services</h2>
            </div>
            <div className="space-y-4">
              {/* STT */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Speech-to-Text
                  </span>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatCurrency(summary?.stt?.total_cost)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round((summary?.stt?.total_duration_seconds || 0) / 60)} minutes processed
                </div>
              </div>

              {/* TTS */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Text-to-Speech
                  </span>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatCurrency(summary?.tts?.total_cost)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {formatNumber(summary?.tts?.total_characters)} characters generated
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Optimization Suggestions */}
        {optimization && optimization.suggestions.length > 0 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-6 shadow-lg border-2 border-green-200 dark:border-green-900 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Cost Optimization Suggestions
              </h2>
            </div>

            {/* Savings Summary */}
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Monthly Cost</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(optimization.current_monthly_cost)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Potential Monthly Savings</div>
                  <div className="text-2xl font-bold text-green-600">
                    -{formatCurrency(optimization.potential_monthly_savings)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Annual Savings</div>
                  <div className="text-2xl font-bold text-green-600">
                    -{formatCurrency(optimization.estimated_annual_savings)}
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestions */}
            <div className="space-y-3">
              {optimization.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-green-200 dark:border-green-900"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {suggestion.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {suggestion.recommendation}
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span className="text-red-600">
                          Current: {formatCurrency(suggestion.current_cost)}
                        </span>
                        <span className="text-green-600">
                          New: {formatCurrency(suggestion.estimated_new_cost)}
                        </span>
                        <span className="text-green-600 font-semibold">
                          Save: {formatCurrency(suggestion.savings)}/month
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Cost Trend */}
        {dailyData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Daily Cost Trend</h2>
            </div>
            <div className="space-y-2">
              {dailyData.slice(-14).reverse().map((day, index) => {
                const maxCost = Math.max(...dailyData.map(d => d.cost));
                const barWidth = maxCost > 0 ? (day.cost / maxCost) * 100 : 0;
                
                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(day.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-300 flex items-center px-3"
                        style={{ width: `${Math.max(barWidth, 5)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">
                          {formatCurrency(day.cost)}
                        </span>
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right text-gray-600 dark:text-gray-400">
                      {day.calls} calls
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
