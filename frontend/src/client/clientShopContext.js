import { createContext, useContext } from 'react';

export const ClientShopContext = createContext(null);

export function useClientShop() {
  const v = useContext(ClientShopContext);
  if (!v) {
    throw new Error('useClientShop must be used within ClientShopContext.Provider');
  }
  return v;
}
