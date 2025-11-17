'use client';

import { FlowDiagram, FlowConfig } from '../components/flow-diagram';

const photosynthesisFlow: FlowConfig = {
  nodes: [
    { id: 'photon-capture', label: 'Photon Capture', type: 'start' },
    { id: 'chlorophyll', label: 'Chlorophyll λ a', type: 'process' },
    { id: 'excited-electron', label: 'Excited Electron', type: 'process' },
    { id: 'ps-ii', label: 'PS II', type: 'process' },
    { id: 'water-splitting', label: 'Water Splitting', type: 'process' },
    { id: 'o2-release', label: 'O₂ Release', type: 'process' },
    { id: 'electron-transport', label: 'Electron Transport\nChain (cytochrome b₆f)', type: 'process' },
    { id: 'ps-i', label: 'PS I', type: 'output' },
    { id: 'proton-gradient-1', label: 'Proton\nGradient', type: 'output' },
    { id: 'proton-gradient-2', label: 'Proton\nGradient', type: 'output' },
    { id: 'rv-release', label: 'RV Release', type: 'output' },
  ],
  edges: [
    ['photon-capture', 'chlorophyll'],
    ['chlorophyll', 'excited-electron'],
    ['excited-electron', 'ps-ii'],
    ['ps-ii', 'water-splitting'],
    ['water-splitting', 'o2-release'],
    ['excited-electron', 'electron-transport'],
    ['electron-transport', 'ps-i'],
    ['ps-i', 'proton-gradient-2'],
    ['ps-ii', 'proton-gradient-1'],
    ['proton-gradient-1', 'rv-release'],
  ],
};
 
export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <FlowDiagram config={photosynthesisFlow} />
    </div>
  );
}