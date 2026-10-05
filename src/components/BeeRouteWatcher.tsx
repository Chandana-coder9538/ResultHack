import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBee, routeMessages, tabMessages } from '../context/BeeContext';

interface BeeRouteWatcherProps {
  currentTab?: string;
}

export const BeeRouteWatcher: React.FC<BeeRouteWatcherProps> = ({ currentTab }) => {
  const location = useLocation();
  const { say } = useBee();
  const previousPathRef = useRef<string>('');
  const previousTabRef = useRef<string | undefined>(undefined);

  // Watch route changes
  useEffect(() => {
    const currentPath = location.pathname;
    if (previousPathRef.current === currentPath) return;
    previousPathRef.current = currentPath;

    // Match exact or prefix
    const matchedKey = Object.keys(routeMessages).find((key) => {
      if (key === '/') return currentPath === '/';
      return currentPath.startsWith(key);
    });

    if (matchedKey && routeMessages[matchedKey]) {
      const config = routeMessages[matchedKey];
      // On dashboard route, let tab watcher handle if tab is present
      if (currentPath === '/department/dashboard' && currentTab && tabMessages[currentTab]) {
        return;
      }
      say(config.message, config.mood, 4200);
    }
  }, [location.pathname, say, currentTab]);

  // Watch dashboard tab changes
  useEffect(() => {
    if (location.pathname !== '/department/dashboard') return;
    if (!currentTab) return;
    if (previousTabRef.current === currentTab) return;
    previousTabRef.current = currentTab;

    if (tabMessages[currentTab]) {
      const config = tabMessages[currentTab];
      say(config.message, config.mood, 4000);
    }
  }, [currentTab, location.pathname, say]);

  return null;
};
