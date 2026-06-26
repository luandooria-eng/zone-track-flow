/**
 * Product classification helpers for water and gas products
 * These functions classify products based on their names, accounting for
 * various naming conventions used in the system.
 */

// Water product indicators - includes brand names and common terms
const WATER_INDICATORS = [
  // Common terms
  'água', 'agua', 'water', 'mineral',
  // Liters/volume indicators (usually water)
  '20l', '20 l', '20 litros', '10l', '10 l',
  // Common water brands in Brazil
  'são cristóvão', 'sao cristovao', 'cristóvão', 'cristovao',
  'indaiá', 'indaia',
  'crystal', 'bonafont', 'minalba', 'petrópolis', 'petropolis',
  'lindoya', 'santa bárbara', 'santa barbara',
  // Container terms
  'galão', 'galao', 'garrafão', 'garrafao', 'vasilhame',
];

// Gas product indicators
const GAS_INDICATORS = [
  'gás', 'gas', 'glp', 'botijão', 'botijao',
  'p13', 'p-13', 'p45', 'p-45', 'p20', 'p-20',
  '13kg', '45kg', '20kg',
  'ultragaz', 'liquigás', 'liquigas', 'supergasbras', 'nacional gás', 'nacional gas',
  'consigaz', 'copagaz', 'fogás', 'fogas',
];

/**
 * Check if a product name indicates a water product
 */
export function isWaterProduct(productName: string | null | undefined): boolean {
  if (!productName) return false;
  const name = productName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const originalLower = productName.toLowerCase();
  
  return WATER_INDICATORS.some(indicator => {
    const normalizedIndicator = indicator.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return name.includes(normalizedIndicator) || originalLower.includes(indicator);
  });
}

/**
 * Check if a product name indicates a gas product
 */
export function isGasProduct(productName: string | null | undefined): boolean {
  if (!productName) return false;
  const name = productName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const originalLower = productName.toLowerCase();
  
  return GAS_INDICATORS.some(indicator => {
    const normalizedIndicator = indicator.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return name.includes(normalizedIndicator) || originalLower.includes(indicator);
  });
}

/**
 * Classify a product by its name
 * Returns 'water', 'gas', or 'other'
 */
export function classifyProduct(productName: string | null | undefined): 'water' | 'gas' | 'other' {
  if (isWaterProduct(productName)) return 'water';
  if (isGasProduct(productName)) return 'gas';
  return 'other';
}
