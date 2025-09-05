import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const USDC_CONTRACT_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const RUSD_CONTRACT_ADDRESS =
  "0x10b5Be494C2962A7B318aFB63f0Ee30b959D000b";
