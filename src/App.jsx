import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import useProjectStore from './store/useProjectStore';
import SetupScreen from './components/SetupScreen';
import Canvas from './components/Canvas';

export default function App() {
  const screen = useProjectStore((s) => s.screen);
  const initProject = useProjectStore((s) => s.initProject);
  const loadProject = useProjectStore((s) => s.loadProject);

  if (screen === 'setup') {
    return <SetupScreen onInit={initProject} onImport={loadProject} />;
  }

  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
