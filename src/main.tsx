import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './app/App';
import { isAndroid, isNative } from './services/runtime';
import { installNativeBack } from './services/native-back';
import './styles.css';

// Native routes stay inside the bundled index.html on both Windows and Android.
const Router = isNative ? HashRouter : BrowserRouter;
if (isAndroid) {
  document.documentElement.dataset.platform = 'android'; installNativeBack(window);
  const resize = () => document.documentElement.style.setProperty('--visual-viewport-height', `${window.visualViewport?.height ?? window.innerHeight}px`);
  window.visualViewport?.addEventListener('resize', resize); resize();
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Router><App /></Router></React.StrictMode>,
);
