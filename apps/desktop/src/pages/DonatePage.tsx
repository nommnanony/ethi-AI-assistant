import { useState } from 'react';
import { Heart, Coffee, Star, Zap, Check, ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const API_URL = 'http://localhost:3001';

const donationTiers = [
  {
    id: 'coffee',
    name: 'Buy Me a Coffee',
    amount: 5,
    icon: Coffee,
    color: '#a371f7',
    description: 'Support my work with a small coffee',
  },
  {
    id: 'star',
    name: 'Star Supporter',
    amount: 15,
    icon: Star,
    color: '#58a6ff',
    description: 'Become a star supporter',
    popular: true,
  },
  {
    id: 'zap',
    name: 'Power User',
    amount: 30,
    icon: Zap,
    color: '#3fb950',
    description: 'Power up my development',
  },
];

export function DonatePage() {
  const [searchParams] = useSearchParams();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  const handleDonate = async () => {
    const amount = selectedTier 
      ? donationTiers.find(t => t.id === selectedTier)?.amount 
      : parseInt(customAmount);

    if (!amount || amount < 1) {
      setError('Please select or enter a donation amount');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/payments/donate`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ amount, currency: 'USD' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Payment service unavailable');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Unable to create payment session. Please try again.');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#161b22] border border-[#3fb950] rounded-xl p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#3fb950]/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-[#3fb950]" />
            </div>
            <h2 className="text-2xl font-bold text-[#f0f6fc] mb-2">Thank You!</h2>
            <p className="text-[#8b949e] mb-6">Your support means the world to me!</p>
            <Link 
              to="/chat"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#58a6ff] text-white rounded-lg hover:opacity-90"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Chat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link to="/chat" className="inline-flex items-center gap-2 text-[#8b949e] hover:text-[#f0f6fc]">
            <ArrowLeft className="w-4 h-4" />
            Back to Chat
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#f85149] to-[#a371f7] flex items-center justify-center">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#f0f6fc] mb-2">Support Natively AI</h1>
          <p className="text-[#8b949e] max-w-md mx-auto">
            Help me keep this project alive and growing. Your support keeps the servers running!
          </p>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {donationTiers.map((tier) => {
              const Icon = tier.icon;
              return (
                <button
                  key={tier.id}
                  onClick={() => {
                    setSelectedTier(tier.id);
                    setCustomAmount('');
                    setError(null);
                  }}
                  className={`relative bg-[#0d1117] border rounded-xl p-6 text-left transition-all ${
                    selectedTier === tier.id 
                      ? 'border-[#58a6ff] ring-2 ring-[#58a6ff]/30' 
                      : 'border-[#30363d] hover:border-[#58a6ff]/50'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#58a6ff] text-[#0d1117] text-xs font-medium rounded-full">
                      Popular
                    </div>
                  )}
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${tier.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: tier.color }} />
                  </div>
                  <h3 className="text-lg font-semibold text-[#f0f6fc] mb-1">{tier.name}</h3>
                  <p className="text-2xl font-bold mb-2" style={{ color: tier.color }}>
                    ${tier.amount}
                  </p>
                  <p className="text-sm text-[#8b949e]">{tier.description}</p>
                  {selectedTier === tier.id && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#58a6ff] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 mb-6">
          <label className="block text-sm font-medium text-[#8b949e] mb-2">Or enter custom amount</label>
          <div className="flex items-center gap-3">
            <span className="text-[#8b949e] text-lg">$</span>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedTier(null);
                setError(null);
              }}
              placeholder="Enter amount"
              min="1"
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-[#f0f6fc] placeholder:text-[#6e7681] focus:outline-none focus:border-[#58a6ff]"
            />
          </div>
        </div>

        {error && (
          <div className="bg-[#f85149]/10 border border-[#f85149]/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-[#f85149]">{error}</p>
          </div>
        )}

        {canceled && (
          <div className="bg-[#d29922]/10 border border-[#d29922]/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-[#d29922]">Payment was canceled. You can try again.</p>
          </div>
        )}

        <button
          onClick={handleDonate}
          disabled={isProcessing || (!selectedTier && !customAmount)}
          className="w-full py-4 bg-gradient-to-r from-[#f85149] to-[#a371f7] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Heart className="w-5 h-5" />
              Donate {selectedTier ? `$${donationTiers.find(t => t.id === selectedTier)?.amount}` : customAmount ? `$${customAmount}` : ''}
            </>
          )}
        </button>

        <div className="mt-6 text-center">
          <p className="text-xs text-[#6e7681]">
            Secure payment powered by Stripe • All major cards accepted
          </p>
        </div>
      </div>
    </div>
  );
}
