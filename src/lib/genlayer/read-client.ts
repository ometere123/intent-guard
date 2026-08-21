import { createAccount, createClient } from "genlayer-js";
import { chain, GENLAYER_ENDPOINT } from "./config";

/**
 * A throwaway-account client for views. Reads need an account present but never
 * a signature, so nothing here touches the user's wallet.
 */
export function createReadClient() {
  return createClient({ chain, endpoint: GENLAYER_ENDPOINT, account: createAccount() });
}
