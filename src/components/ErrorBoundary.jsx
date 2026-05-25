import React from 'react';
import { useTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <ErrorBoundaryContent error={this.state.error} />;
        }
        return this.props.children;
    }
}

const ErrorBoundaryContent = ({ error }) => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 20, color: 'red', background: 'white' }}>
      <h2>{t('errors.somethingWentWrong')}</h2>
      <details style={{ whiteSpace: 'pre-wrap' }}>
        {error && error.toString()}
      </details>
      <button onClick={() => window.location.reload()}>
        {t('errors.reload')}
      </button>
    </div>
  );
};

export default ErrorBoundary;
