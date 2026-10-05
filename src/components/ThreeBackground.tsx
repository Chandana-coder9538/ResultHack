import React from 'react';
import { BackgroundScene } from './BackgroundScene';

export interface Props {
  className?: string;
}

/**
 * ThreeBackground Wrapper Component
 * Provides the fixed full-screen animated 3D "Campus of Results" scene with glowing globe,
 * floating graduation caps, books, certificates, bar-chart columns, and constellation network.
 */
export const ThreeBackground: React.FC<Props> = ({ className }) => {
  return <BackgroundScene className={className} />;
};

export { BackgroundScene };
