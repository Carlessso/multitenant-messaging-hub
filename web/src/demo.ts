export interface DemoTenant {
  id: string;
  name: string;
  description: string;
  apiKey: string;
}

export const DEMO_TENANTS: DemoTenant[] = [
  {
    id: 'loja-x',
    name: 'Loja X',
    description: 'Clothing store',
    apiKey: 'hub_dev_loja-x',
  },
  {
    id: 'padaria-do-joao',
    name: 'Padaria do João',
    description: 'Neighborhood bakery',
    apiKey: 'hub_dev_padaria-do-joao',
  },
];
