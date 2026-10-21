import { createContext, use, type ReactNode } from 'react';

/**
 * `comfortable` is the public default: roomy, large targets, for someone using the service once
 * or twice a year. `compact` is for an official working a queue all day: the same primitives,
 * tighter. Set once around a screen; the list primitives read it.
 */
export type Density = 'comfortable' | 'compact';

const DensityContext = createContext<Density>('comfortable');

export function DensityProvider({ density, children }: { density: Density; children: ReactNode }) {
  return <DensityContext value={density}>{children}</DensityContext>;
}

export function useDensity(): Density {
  return use(DensityContext);
}
