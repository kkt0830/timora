import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './app/App';
import { isDesktop } from './services/backend';
import './styles.css';

// Hash routes keep deep links/reload inside the bundled Desktop index.html.
const Router = isDesktop ? HashRouter : BrowserRouter;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Router><App /></Router></React.StrictMode>,
);
