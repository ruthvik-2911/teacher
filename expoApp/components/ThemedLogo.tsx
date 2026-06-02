import React from 'react';
import { Image, ImageProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemedLogo(props: Omit<ImageProps, 'source'>) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const source = isDark 
    ? require('@/assets/images/3_20260423_125948_0002.png')
    : require('@/assets/images/1_20260423_125948_0000.png');

  return (
    <Image 
      {...props} 
      source={source} 
    />
  );
}
