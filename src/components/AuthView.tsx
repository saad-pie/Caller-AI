import { useState, type FormEvent } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { firebaseDb } from '../lib/firebaseDb';
import { Phone, Mail, Lock, User, ArrowRight, Loader2, Apple } from 'lucide-react';

export default function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: name });
        
        // Initialize user profile in Firestore
        await firebaseDb.saveUserProfile({
          uid: user.uid,
          name: name,
          email: email,
          number: '',
          credits: 100, // Starting credits
          globalPromptEnabled: false,
          globalPrompt: '',
          privacySettings: {
            shareActivity: true,
            anonymousMode: false
          }
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists, if not create one
      const profile = await firebaseDb.getUserProfile(user.uid);
      if (!profile) {
        await firebaseDb.saveUserProfile({
          uid: user.uid,
          name: user.displayName || 'User',
          email: user.email || '',
          number: '',
          credits: 100,
          globalPromptEnabled: false,
          globalPrompt: '',
          privacySettings: {
            shareActivity: true,
            anonymousMode: false
          }
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white px-6 py-12">
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 rounded-3xl bg-[#0B57D0] flex items-center justify-center shadow-lg mb-6 transform rotate-12">
          <Phone className="w-10 h-10 text-white transform -rotate-12" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Caller AI</h1>
        <p className="text-gray-500 mt-2 text-center">Experience the next generation of calling with native audio AI.</p>
      </div>

      <div className="flex-1 max-w-sm mx-auto w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#0B57D0] focus:ring-4 focus:ring-blue-50 transition-all"
              />
            </div>
          )}
          
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#0B57D0] focus:ring-4 focus:ring-blue-50 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 outline-none focus:border-[#0B57D0] focus:ring-4 focus:ring-blue-50 transition-all"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs px-2 font-medium">{error}</p>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#0B57D0] text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 hover:bg-[#0842a0] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <span className="relative px-4 bg-white text-xs font-bold text-gray-400 uppercase tracking-widest">Or continue with</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center gap-2 border border-gray-200 py-3 rounded-2xl hover:bg-gray-50 transition-colors"
            >
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
              <span className="text-sm font-bold text-gray-700">Google</span>
            </button>
            <button className="flex items-center justify-center gap-2 border border-gray-200 py-3 rounded-2xl hover:bg-gray-50 transition-colors">
              <Apple className="w-5 h-5" />
              <span className="text-sm font-bold text-gray-700">Apple</span>
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-sm text-gray-500 font-medium">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-[#0B57D0] font-bold"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
