import { isProductionNode } from './production-guard';

export function isPaymentSimulationAllowed(): boolean {
  if (isProductionNode()) return false;
  return process.env.PAYMENT_SIMULATION_INSTANT === 'true';
}
