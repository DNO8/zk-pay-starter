declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: unknown,
      wasm: Uint8Array,
      zkey: Uint8Array,
      logger?: unknown,
      witnessOptions?: unknown,
      proverOptions?: {singleThread:boolean},
    ): Promise<{
      proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
      publicSignals: string[];
    }>;
    verify(vkey: unknown, signals: string[], proof: unknown): Promise<boolean>;
  };
}
