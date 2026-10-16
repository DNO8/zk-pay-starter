#![no_std]
//! On-chain UltraHonk verifier wrapper.
//!
//! Vendored from NethermindEth/rs-soroban-ultrahonk (MIT OR Apache-2.0),
//! originally yugocabrio/rs-soroban-ultrahonk. See vendor/ultrahonk-soroban-verifier
//! and CREDITS.md. Do not edit the verifier crate. Do not vendor tornado_classic.

use soroban_sdk::{contract, contracterror, contractimpl, symbol_short, Bytes, Env, Symbol};
use ultrahonk_soroban_verifier::{UltraHonkVerifier, VkLoadError, PROOF_BYTES};

#[contract]
pub struct UltraHonkVerifierContract;

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    VkInvalidLength = 1,
    VkInvalidParameters = 2,
    ProofParseError = 3,
    VerificationFailed = 4,
    VkNotSet = 5,
    AlreadyInitialized = 6,
    VkInvalidPoint = 7,
}

fn map_vk(e: VkLoadError) -> Error {
    match e {
        VkLoadError::WrongLength => Error::VkInvalidLength,
        VkLoadError::InvalidParameters => Error::VkInvalidParameters,
        VkLoadError::InvalidPoint => Error::VkInvalidPoint,
    }
}

#[contractimpl]
impl UltraHonkVerifierContract {
    fn key_vk() -> Symbol {
        symbol_short!("vk")
    }

    /// Store the VK once at deploy. It is immutable afterwards.
    pub fn __constructor(env: Env, vk_bytes: Bytes) -> Result<(), Error> {
        if env.storage().instance().has(&Self::key_vk()) {
            return Err(Error::AlreadyInitialized);
        }
        let _ = UltraHonkVerifier::new(&env, &vk_bytes).map_err(map_vk)?;
        env.storage().instance().set(&Self::key_vk(), &vk_bytes);
        Ok(())
    }

    pub fn vk_bytes(env: Env) -> Result<Bytes, Error> {
        env.storage()
            .instance()
            .get(&Self::key_vk())
            .ok_or(Error::VkNotSet)
    }

    pub fn verify_proof(env: Env, public_inputs: Bytes, proof_bytes: Bytes) -> Result<(), Error> {
        if proof_bytes.len() as usize != PROOF_BYTES {
            return Err(Error::ProofParseError);
        }
        let vk_bytes: Bytes = env
            .storage()
            .instance()
            .get(&Self::key_vk())
            .ok_or(Error::VkNotSet)?;
        let verifier = UltraHonkVerifier::new(&env, &vk_bytes).map_err(map_vk)?;
        verifier
            .verify(&proof_bytes, &public_inputs)
            .map_err(|_| Error::VerificationFailed)?;
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    #[should_panic]
    fn constructor_rejects_empty_vk() {
        let env = Env::default();
        let empty = Bytes::from_slice(&env, &[]);
        env.register(UltraHonkVerifierContract, (empty,));
    }

    #[test]
    fn verify_hello_proof() {
        let vk_raw: &[u8] = include_bytes!("../../../artifacts/noir/hello/vk");
        let proof_raw: &[u8] = include_bytes!("../../../artifacts/noir/hello/proof");
        let pub_raw: &[u8] = include_bytes!("../../../artifacts/noir/hello/public_inputs");
        let env = Env::default();
        env.cost_estimate().budget().reset_unlimited();
        assert_eq!(proof_raw.len(), ultrahonk_soroban_verifier::PROOF_BYTES);
        let vk = Bytes::from_slice(&env, vk_raw);
        let proof = Bytes::from_slice(&env, proof_raw);
        let public_inputs = Bytes::from_slice(&env, pub_raw);
        let id = env.register(UltraHonkVerifierContract, (vk,));
        let client = UltraHonkVerifierContractClient::new(&env, &id);
        env.cost_estimate().budget().reset_unlimited();
        client.verify_proof(&public_inputs, &proof);
        // Native CPU is not the wasm/testnet figure; measure with `stellar contract invoke --cost`.
        let _cpu = env.cost_estimate().budget().cpu_instruction_cost();
    }
}
