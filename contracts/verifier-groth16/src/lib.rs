#![no_std]
//! BN254 Groth16 verifier.
//!
//! Port of jamesbachini/CircomStellar (MIT) from BLS12-381 to BN254 using
//! CAP-0074 host functions (`env.crypto().bn254()`). Encoding matches CAP-0074:
//! G1 = be(X)||be(Y) (64 bytes), G2 = be(X_c1)||be(X_c0)||be(Y_c1)||be(Y_c0) (128).

use soroban_sdk::{
    contract, contracterror, contractimpl,
    crypto::bn254::{
        Bn254Fr, Bn254G1Affine, Bn254G2Affine, BN254_G1_SERIALIZED_SIZE, BN254_G2_SERIALIZED_SIZE,
    },
    symbol_short, vec, Bytes, Env, Symbol, Vec, U256,
};

const VK_KEY: Symbol = symbol_short!("VK");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VerifierError {
    MalformedVerifyingKey = 1,
    VerificationKeyNotSet = 2,
    MalformedProof = 3,
    MalformedPublicSignals = 4,
}

struct VerificationKey {
    alpha: Bn254G1Affine,
    beta: Bn254G2Affine,
    gamma: Bn254G2Affine,
    delta: Bn254G2Affine,
    ic: Vec<Bn254G1Affine>,
}

struct Proof {
    a: Bn254G1Affine,
    b: Bn254G2Affine,
    c: Bn254G1Affine,
}

fn take<const N: usize>(
    bytes: &Bytes,
    pos: &mut u32,
    err: VerifierError,
) -> Result<[u8; N], VerifierError> {
    let end = pos.checked_add(N as u32).ok_or(err)?;
    if end > bytes.len() {
        return Err(err);
    }
    let mut arr = [0u8; N];
    bytes.slice(*pos..end).copy_into_slice(&mut arr);
    *pos = end;
    Ok(arr)
}

impl VerificationKey {
    fn from_bytes(env: &Env, bytes: &Bytes) -> Result<Self, VerifierError> {
        let mut pos = 0u32;
        let alpha = Bn254G1Affine::from_array(
            env,
            &take::<BN254_G1_SERIALIZED_SIZE>(bytes, &mut pos, VerifierError::MalformedVerifyingKey)?,
        );
        let beta = Bn254G2Affine::from_array(
            env,
            &take::<BN254_G2_SERIALIZED_SIZE>(bytes, &mut pos, VerifierError::MalformedVerifyingKey)?,
        );
        let gamma = Bn254G2Affine::from_array(
            env,
            &take::<BN254_G2_SERIALIZED_SIZE>(bytes, &mut pos, VerifierError::MalformedVerifyingKey)?,
        );
        let delta = Bn254G2Affine::from_array(
            env,
            &take::<BN254_G2_SERIALIZED_SIZE>(bytes, &mut pos, VerifierError::MalformedVerifyingKey)?,
        );
        let ic_len_bytes = take::<4>(bytes, &mut pos, VerifierError::MalformedVerifyingKey)?;
        let ic_len = u32::from_be_bytes(ic_len_bytes);
        let mut ic = Vec::new(env);
        for _ in 0..ic_len {
            let g1 = Bn254G1Affine::from_array(
                env,
                &take::<BN254_G1_SERIALIZED_SIZE>(
                    bytes,
                    &mut pos,
                    VerifierError::MalformedVerifyingKey,
                )?,
            );
            ic.push_back(g1);
        }
        if pos != bytes.len() || ic_len == 0 {
            return Err(VerifierError::MalformedVerifyingKey);
        }
        Ok(Self {
            alpha,
            beta,
            gamma,
            delta,
            ic,
        })
    }
}

impl Proof {
    fn from_bytes(env: &Env, bytes: &Bytes) -> Result<Self, VerifierError> {
        let mut pos = 0u32;
        let a = Bn254G1Affine::from_array(
            env,
            &take::<BN254_G1_SERIALIZED_SIZE>(bytes, &mut pos, VerifierError::MalformedProof)?,
        );
        let b = Bn254G2Affine::from_array(
            env,
            &take::<BN254_G2_SERIALIZED_SIZE>(bytes, &mut pos, VerifierError::MalformedProof)?,
        );
        let c = Bn254G1Affine::from_array(
            env,
            &take::<BN254_G1_SERIALIZED_SIZE>(bytes, &mut pos, VerifierError::MalformedProof)?,
        );
        if pos != bytes.len() {
            return Err(VerifierError::MalformedProof);
        }
        Ok(Self { a, b, c })
    }
}

fn public_signals_from_bytes(env: &Env, bytes: &Bytes) -> Result<Vec<Bn254Fr>, VerifierError> {
    let mut pos = 0u32;
    let len_bytes = take::<4>(bytes, &mut pos, VerifierError::MalformedPublicSignals)?;
    let len = u32::from_be_bytes(len_bytes);
    let mut pub_signals = Vec::new(env);
    for _ in 0..len {
        let arr = take::<32>(bytes, &mut pos, VerifierError::MalformedPublicSignals)?;
        let u256 = U256::from_be_bytes(env, &Bytes::from_array(env, &arr));
        pub_signals.push_back(Bn254Fr::from_u256(u256));
    }
    if pos != bytes.len() {
        return Err(VerifierError::MalformedPublicSignals);
    }
    Ok(pub_signals)
}

fn verify_proof(
    env: &Env,
    vk: VerificationKey,
    proof: Proof,
    pub_signals: Vec<Bn254Fr>,
) -> Result<bool, VerifierError> {
    if pub_signals.len() + 1 != vk.ic.len() {
        return Err(VerifierError::MalformedVerifyingKey);
    }
    let bn = env.crypto().bn254();
    let mut vk_x = vk.ic.get(0).unwrap();
    for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
        let prod = bn.g1_mul(&v, &s);
        vk_x = bn.g1_add(&vk_x, &prod);
    }
    let neg_a = -proof.a;
    let vp1 = vec![env, neg_a, vk.alpha, vk_x, proof.c];
    let vp2 = vec![env, proof.b, vk.beta, vk.gamma, vk.delta];
    Ok(bn.pairing_check(vp1, vp2))
}

#[contract]
pub struct Groth16VerifierContract;

#[contractimpl]
impl Groth16VerifierContract {
    pub fn set_vk(env: Env, vk_bytes: Bytes) -> Result<(), VerifierError> {
        let _vk = VerificationKey::from_bytes(&env, &vk_bytes)?;
        env.storage().instance().set(&VK_KEY, &vk_bytes);
        Ok(())
    }

    pub fn verify(
        env: Env,
        proof_bytes: Bytes,
        pub_signals_bytes: Bytes,
    ) -> Result<bool, VerifierError> {
        let vk_bytes: Bytes = env
            .storage()
            .instance()
            .get(&VK_KEY)
            .ok_or(VerifierError::VerificationKeyNotSet)?;
        let vk = VerificationKey::from_bytes(&env, &vk_bytes)?;
        let proof = Proof::from_bytes(&env, &proof_bytes)?;
        let pub_signals = public_signals_from_bytes(&env, &pub_signals_bytes)?;
        verify_proof(&env, vk, proof, pub_signals)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn rejects_empty_vk() {
        let env = Env::default();
        let contract_id = env.register(Groth16VerifierContract, ());
        let client = Groth16VerifierContractClient::new(&env, &contract_id);
        let empty = Bytes::from_slice(&env, &[]);
        assert_eq!(
            client.try_set_vk(&empty),
            Err(Ok(VerifierError::MalformedVerifyingKey))
        );
    }

    #[test]
    fn verify_without_vk_fails() {
        let env = Env::default();
        let contract_id = env.register(Groth16VerifierContract, ());
        let client = Groth16VerifierContractClient::new(&env, &contract_id);
        let dummy = Bytes::from_slice(&env, &[0u8; 64]);
        assert_eq!(
            client.try_verify(&dummy, &dummy),
            Err(Ok(VerifierError::VerificationKeyNotSet))
        );
    }

    #[test]
    fn verify_hello_proof() {
        let vk_raw: &[u8] = include_bytes!("../../../artifacts/circom/hello/vk.bin");
        let proof_raw: &[u8] = include_bytes!("../../../artifacts/circom/hello/proof.bin");
        let pub_raw: &[u8] = include_bytes!("../../../artifacts/circom/hello/public.bin");
        let env = Env::default();
        env.cost_estimate().budget().reset_unlimited();
        let id = env.register(Groth16VerifierContract, ());
        let client = Groth16VerifierContractClient::new(&env, &id);
        client.set_vk(&Bytes::from_slice(&env, vk_raw));
        env.cost_estimate().budget().reset_unlimited();
        let ok = client.verify(
            &Bytes::from_slice(&env, proof_raw),
            &Bytes::from_slice(&env, pub_raw),
        );
        assert!(ok);
        // Native CPU is not the wasm/testnet figure; measure with `stellar contract invoke --cost`.
        let _cpu = env.cost_estimate().budget().cpu_instruction_cost();
    }
}
