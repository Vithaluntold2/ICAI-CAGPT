import AuthCard from '../AuthCard';
import { useState } from 'react';

export default function AuthCardExample() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  return (
    <AuthCard 
      mode={mode}
      onSubmit={(email, password, name) => {
        console.log('Auth submit:', { email, password, name, mode });
      }}
      onToggleMode={() => setMode(mode === 'login' ? 'register' : 'login')}
    />
  );
}
