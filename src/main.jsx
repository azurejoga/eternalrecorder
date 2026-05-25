import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './locales/i18n'
import { I18nProvider } from './contexts/I18nContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <I18nProvider>
                <App />
            </I18nProvider>
        </ErrorBoundary>
    </React.StrictMode>,
)
