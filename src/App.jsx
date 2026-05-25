import React, { useEffect, useState } from 'react';
import ControlPanel from './components/ControlPanel';
import CameraView from './components/CameraView';

function App() {
    const [view, setView] = useState('control');
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const windowType = params.get('window');
        if (windowType) {
            setView(windowType);
        }
    }, []);

    if (view === 'camera') {
        return <CameraView />;
    }

    return <ControlPanel />;
}

export default App;
