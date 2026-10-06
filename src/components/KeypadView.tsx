import { Plus, Delete, X, Home, LayoutGrid, Phone, Users, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { type ViewState } from '../App';

interface KeypadViewProps {
  onNavigate: (view: ViewState) => void;
  onCall: (number: string) => void;
}

export default function KeypadView({ onNavigate, onCall }: KeypadViewProps) {
  const [number, setNumber] = useState('');

  const handleKeyPress = (num: string) => {
    setNumber(prev => prev + num);
  };

  const handleDelete = () => {
    setNumber(prev => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (number.length > 0) {
      onCall(number);
    }
  };

  const handleMagicCall = () => {
    onCall('MAGIC_AI_ROULETTE');
  };

  const keys = [
    { num: '1', sub: 'oo' },
    { num: '2', sub: 'ABC' },
    { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' },
    { num: '5', sub: 'JKL' },
    { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' },
    { num: '8', sub: 'TUV' },
    { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' },
    { num: '0', sub: '+' },
    { num: '#', sub: '' },
  ];

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#f3f6fb] to-white relative overflow-hidden">
      {/* Visual background element */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
      
      <div className="flex-1 flex flex-col justify-center pb-[100px] relative z-10">
        
        {/* Number Display Area */}
        <div className="h-16 flex flex-col items-center justify-center relative px-8 mb-4 mt-4">
          <div className="text-[36px] font-light text-gray-900 tracking-wider text-center shrink min-w-0 pr-10 overflow-hidden text-ellipsis whitespace-nowrap h-12 flex items-center">
            {number || <span className="text-gray-300 opacity-50">Enter a number</span>}
          </div>
          {number && (
            <button 
              onClick={handleDelete}
              className="absolute right-8 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-3 rounded-full transition-colors active:scale-95"
            >
              <Delete className="w-6 h-6" />
            </button>
          )}
          {number === '*AI' && (
             <span className="text-xs text-[#0B57D0] font-bold tracking-widest mt-1 animate-pulse">
               MAGIC AI DIAL ENABLED
             </span>
          )}
        </div>

        {/* Keypad Grid */}
        <div className="px-6 mb-6">
          <div className="grid grid-cols-3 gap-x-6 gap-y-3 max-w-[280px] mx-auto">
            {keys.map((key) => (
              <button
                key={key.num}
                onClick={() => handleKeyPress(key.num)}
                className="w-[72px] h-[72px] mx-auto bg-white/80 backdrop-blur-sm rounded-full flex flex-col items-center justify-center active:bg-blue-50 active:scale-95 transition-all shadow-sm border border-gray-100 hover:shadow-md focus:outline-none"
              >
                <span className="text-3xl font-light text-gray-800 leading-none mb-0.5">{key.num}</span>
                {key.sub && <span className="text-[9px] uppercase text-gray-400 font-bold leading-none tracking-widest">{key.sub}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Call Actions */}
        <div className="flex flex-col justify-center items-center gap-4 mb-2">
          <button 
            onClick={handleCall}
            disabled={number.length === 0}
            className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${number.length > 0 ? 'bg-[#34A853] hover:bg-[#2d9648]' : 'bg-[#e0e0e0] opacity-50'}`}
          >
            <Phone className="w-8 h-8 text-white fill-current" />
          </button>
          
          {/* Magic Roulette Button - Extra Billion Dollar Feature */}
          <button 
            onClick={handleMagicCall}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 hover:border-blue-200 rounded-full text-xs font-bold text-[#0B57D0] transition-transform active:scale-95"
          >
            <Sparkles className="w-4 h-4" /> Surprise Me
          </button>
        </div>
      </div>
    </div>
  );
}

