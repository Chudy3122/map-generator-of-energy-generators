// src/hooks/useColorblindMode.ts
import { useState, useEffect } from 'react';

export const useColorblindMode = () => {
  const [colorblindMode, setColorblindMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('colorblindMode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('colorblindMode', colorblindMode.toString());
  }, [colorblindMode]);

  const toggleColorblindMode = () => {
    setColorblindMode(prev => !prev);
  };

  return {
    colorblindMode,
    toggleColorblindMode
  };
};