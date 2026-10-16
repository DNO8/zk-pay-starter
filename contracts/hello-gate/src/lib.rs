#![no_std]
//! Thin "I verified a hello proof" flag. Calls the deployed UltraHonk or Groth16 verifier.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, symbol_short, Address, Bytes, Env, Symbol,
};

const UH: Symbol = symbol_short!("UH");
const G16: Symbol = symbol_short!("G16");
const FLAG: Symbol = symbol_short!("OK");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    VerifierNotSet = 1,
    VerifyFailed = 2,
}

#[contractclient(name = "UhVerifierClient")]
pub trait UhVerifier {
    fn verify_proof(public_inputs: Bytes, proof_bytes: Bytes);
}

#[contractclient(name = "G16VerifierClient")]
pub trait G16Verifier {
    fn verify(proof_bytes: Bytes, pub_signals_bytes: Bytes) -> bool;
}

#[contract]
pub struct HelloGate;

#[contractimpl]
impl HelloGate {
    pub fn __constructor(env: Env, uh_verifier: Address, g16_verifier: Address) {
        env.storage().instance().set(&UH, &uh_verifier);
        env.storage().instance().set(&G16, &g16_verifier);
        env.storage().instance().set(&FLAG, &false);
    }

    pub fn last_ok(env: Env) -> bool {
        env.storage().instance().get(&FLAG).unwrap_or(false)
    }

    pub fn verify_hello_uh(env: Env, public_inputs: Bytes, proof_bytes: Bytes) -> Result<bool, Error> {
        let id: Address = env
            .storage()
            .instance()
            .get(&UH)
            .ok_or(Error::VerifierNotSet)?;
        let client = UhVerifierClient::new(&env, &id);
        client.verify_proof(&public_inputs, &proof_bytes);
        env.storage().instance().set(&FLAG, &true);
        Ok(true)
    }

    pub fn verify_hello_g16(
        env: Env,
        proof_bytes: Bytes,
        pub_signals_bytes: Bytes,
    ) -> Result<bool, Error> {
        let id: Address = env
            .storage()
            .instance()
            .get(&G16)
            .ok_or(Error::VerifierNotSet)?;
        let client = G16VerifierClient::new(&env, &id);
        let ok = client.verify(&proof_bytes, &pub_signals_bytes);
        env.storage().instance().set(&FLAG, &ok);
        if ok {
            Ok(true)
        } else {
            Err(Error::VerifyFailed)
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Bytes, Env};

    #[test]
    fn stores_constructor_addrs() {
        let env = Env::default();
        use soroban_sdk::testutils::Address as _;
        let uh = Address::generate(&env);
        let g16 = Address::generate(&env);
        let id = env.register(HelloGate, (uh, g16));
        let client = HelloGateClient::new(&env, &id);
        assert!(!client.last_ok());
        let _ = Bytes::from_slice(&env, &[1, 2, 3]);
    }
}
