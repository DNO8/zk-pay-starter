#![no_std]
//! Fixed-denomination testnet pool with BN254 Poseidon and an immutable-key Groth16 verification path.

mod poseidon_params;

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    symbol_short, token, Address, Bytes, BytesN, Env, Symbol, Vec, U256,
};

use soroban_sdk::xdr::ToXdr;

use poseidon_params::{D, MDS_BE, RC_BE, ROUNDS_F, ROUNDS_P, T};

const TOKEN: Symbol = symbol_short!("TOKEN");
const DENOM: Symbol = symbol_short!("DENOM");
const VERIF: Symbol = symbol_short!("VERIF");
const VK: Symbol = symbol_short!("VK");
const NEXT: Symbol = symbol_short!("NEXT");
const ROOT: Symbol = symbol_short!("ROOT");
const ADMIN: Symbol = symbol_short!("ADMIN");

/// How many historical Merkle roots the contract remembers.
pub const ROOT_HISTORY: u32 = 32;
pub const TREE_DEPTH: u32 = 8;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    TreeFull = 2,
    UnknownRoot = 3,
    NullifierUsed = 4,
    BadProof = 5,
    WrongAmount = 6,
    NonCanonicalField = 7,
    DuplicateCommitment = 8,
    BadRecipient = 9,
}

#[contracttype]
pub enum DataKey {
    RootHist(u32),
    Node(u32, u32), // level, index
    Nullifier(BytesN<32>),
    Zero(u32),
    Commitment(BytesN<32>),
}

#[contractevent]
pub struct DepositEvent {
    pub from: Address,
    pub index: u32,
    pub commitment: U256,
}

#[contractclient(name = "G16VerifierClient")]
pub trait G16Verifier {
    fn set_vk(vk_bytes: Bytes);
    fn verify(proof_bytes: Bytes, pub_signals_bytes: Bytes) -> bool;
}

// BN254 scalar modulus from packages/shared/poseidon.params.json.
const MODULUS: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91, 0x43, 0xe1, 0xf5, 0x93, 0xf0, 0x00, 0x00, 0x01,
];
fn canonical(env: &Env, value: &U256) -> bool {
    value < &u256_from_be(env, &MODULUS)
}
fn key_bytes(value: &U256) -> BytesN<32> {
    value.to_be_bytes().try_into().unwrap()
}
fn retain(env: &Env, key: &DataKey) {
    let ttl = env.storage().max_ttl();
    env.storage().persistent().extend_ttl(key, ttl / 2, ttl);
}
fn keep_alive(env: &Env) {
    let ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(ttl / 2, ttl);
}
/// Account and contract addresses both end with their 32-byte identifier in XDR.
/// Only account recipients are accepted: the lesson's field mapping does not bind
/// an address-type tag, so accepting both types would permit payout redirection
/// to the contract with the same payload.
fn recipient_field(env: &Env, recipient: &Address) -> Result<U256, Error> {
    let encoded = recipient.clone().to_xdr(env);
    if encoded.len() != 44 {
        return Err(Error::BadRecipient);
    }
    Ok(U256::from_be_bytes(env, &encoded.slice(12..44)).rem_euclid(&u256_from_be(env, &MODULUS)))
}

#[contract]
pub struct Pool;

fn u256_from_be(env: &Env, be: &[u8; 32]) -> U256 {
    U256::from_be_bytes(env, &Bytes::from_array(env, be))
}

fn load_mds(env: &Env) -> Vec<Vec<U256>> {
    let mut mds = Vec::new(env);
    for row in MDS_BE.iter() {
        let mut r = Vec::new(env);
        for cell in row.iter() {
            r.push_back(u256_from_be(env, cell));
        }
        mds.push_back(r);
    }
    mds
}

fn load_rc(env: &Env) -> Vec<Vec<U256>> {
    let mut rc = Vec::new(env);
    for row in RC_BE.iter() {
        let mut r = Vec::new(env);
        for cell in row.iter() {
            r.push_back(u256_from_be(env, cell));
        }
        rc.push_back(r);
    }
    rc
}

/// GIVEN: Poseidon(2) via CAP-0075. Must match packages/shared/poseidon.params.json.
pub fn poseidon_hash2(env: &Env, a: &U256, b: &U256) -> U256 {
    let mut input = Vec::new(env);
    input.push_back(U256::from_u32(env, 0));
    input.push_back(a.clone());
    input.push_back(b.clone());
    let mds = load_mds(env);
    let rc = load_rc(env);
    let field = Symbol::new(env, "BN254");
    let out = env
        .crypto_hazmat()
        .poseidon_permutation(&input, field, T, D, ROUNDS_F, ROUNDS_P, &mds, &rc);
    out.get(0).unwrap()
}

fn zeros_at(env: &Env, level: u32) -> U256 {
    if let Some(z) = env.storage().instance().get(&DataKey::Zero(level)) {
        return z;
    }
    let mut z = U256::from_u32(env, 0);
    env.storage().instance().set(&DataKey::Zero(0), &z);
    for i in 1..=level {
        z = poseidon_hash2(env, &z, &z);
        env.storage().instance().set(&DataKey::Zero(i), &z);
    }
    env.storage().instance().set(&DataKey::Zero(level), &z);
    z
}

#[contractimpl]
impl Pool {
    pub fn __constructor(
        env: Env,
        admin: Address,
        token: Address,
        denomination: i128,
        verifier: Address,
        vk_bytes: Bytes,
    ) {
        assert!(denomination > 0, "denomination must be positive");
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOKEN, &token);
        env.storage().instance().set(&DENOM, &denomination);
        // Validate the four-public-input VK once and pin it with no setter.
        assert!(
            vk_bytes.len() == 772
                && vk_bytes.slice(448..452) == Bytes::from_array(&env, &[0, 0, 0, 5]),
            "expected four-public-input Groth16 VK"
        );
        G16VerifierClient::new(&env, &verifier).set_vk(&vk_bytes);
        env.storage().instance().set(&VK, &vk_bytes);
        env.storage().instance().set(&VERIF, &verifier);
        env.storage().instance().set(&NEXT, &0u32);
        let empty = zeros_at(&env, TREE_DEPTH);
        env.storage().instance().set(&ROOT, &empty);
        env.storage().instance().set(&DataKey::RootHist(0), &empty);
    }

    pub fn denomination(env: Env) -> i128 {
        env.storage().instance().get(&DENOM).unwrap()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&TOKEN).unwrap()
    }

    pub fn next_index(env: Env) -> u32 {
        env.storage().instance().get(&NEXT).unwrap_or(0)
    }

    pub fn current_root(env: Env) -> U256 {
        env.storage()
            .instance()
            .get(&ROOT)
            .unwrap_or_else(|| U256::from_u32(&env, 0))
    }

    /// Return a deposited leaf for off-chain witness reconstruction.
    pub fn commitment_at(env: Env, index: u32) -> Option<U256> {
        env.storage().persistent().get(&DataKey::Node(0, index))
    }

    /// GIVEN helper so hackers can compare on-chain Poseidon against golden vectors.
    pub fn hash2(env: Env, a: U256, b: U256) -> U256 {
        poseidon_hash2(&env, &a, &b)
    }

    /// Deposit exactly the configured denomination, then append a unique leaf.
    pub fn deposit(env: Env, from: Address, commitment: U256) -> Result<u32, Error> {
        from.require_auth();
        if !canonical(&env, &commitment) {
            return Err(Error::NonCanonicalField);
        }
        let index: u32 = env
            .storage()
            .instance()
            .get(&NEXT)
            .ok_or(Error::NotInitialized)?;
        if index >= (1u32 << TREE_DEPTH) {
            return Err(Error::TreeFull);
        }
        let commitment_key = DataKey::Commitment(key_bytes(&commitment));
        if env.storage().persistent().has(&commitment_key) {
            return Err(Error::DuplicateCommitment);
        }
        let token_id: Address = env
            .storage()
            .instance()
            .get(&TOKEN)
            .ok_or(Error::NotInitialized)?;
        let denom: i128 = env
            .storage()
            .instance()
            .get(&DENOM)
            .ok_or(Error::NotInitialized)?;
        token::Client::new(&env, &token_id).transfer(
            &from,
            &env.current_contract_address(),
            &denom,
        );
        env.storage().persistent().set(&commitment_key, &true);
        retain(&env, &commitment_key);
        let mut cur = commitment.clone();
        let mut i = index;
        // Store all nodes so independent deposits can rebuild a witness off-chain.
        for level in 0..TREE_DEPTH {
            let key = DataKey::Node(level, i);
            env.storage().persistent().set(&key, &cur);
            retain(&env, &key);
            let sibling: U256 = env
                .storage()
                .persistent()
                .get(&DataKey::Node(level, i ^ 1))
                .unwrap_or_else(|| zeros_at(&env, level));
            cur = if i % 2 == 0 {
                poseidon_hash2(&env, &cur, &sibling)
            } else {
                poseidon_hash2(&env, &sibling, &cur)
            };
            i >>= 1;
        }
        env.storage().instance().set(&ROOT, &cur);
        env.storage()
            .instance()
            .set(&DataKey::RootHist((index + 1) % ROOT_HISTORY), &cur);
        env.storage().instance().set(&NEXT, &(index + 1));
        keep_alive(&env);
        DepositEvent {
            from,
            index,
            commitment,
        }
        .publish(&env);
        Ok(index)
    }

    /// Verify with the pool-pinned Groth16 verification key before consuming a note.
    /// The relayer fee is a bearer reward: its amount, but not its payee, is public.
    pub fn withdraw(
        env: Env,
        proof: Bytes,
        root: U256,
        nullifier_hash: U256,
        recipient: Address,
        fee: i128,
        relayer: Address,
    ) -> Result<(), Error> {
        if !canonical(&env, &root) || !canonical(&env, &nullifier_hash) {
            return Err(Error::NonCanonicalField);
        }
        let denom: i128 = env
            .storage()
            .instance()
            .get(&DENOM)
            .ok_or(Error::NotInitialized)?;
        if fee < 0 || fee > denom {
            return Err(Error::WrongAmount);
        }
        let recipient_value = recipient_field(&env, &recipient)?;
        // Raw-address modulo r is not injective. Requiring the payout account's
        // authorization prevents a copied proof from burning funds to an alias.
        // Workshop withdrawals are signed by the independently funded recipient.
        recipient.require_auth();
        if recipient == env.current_contract_address()
            || (fee > 0 && relayer == env.current_contract_address())
        {
            return Err(Error::BadRecipient);
        }
        if !Self::is_known_root(env.clone(), root.clone()) {
            return Err(Error::UnknownRoot);
        }
        let key = DataKey::Nullifier(key_bytes(&nullifier_hash));
        if env.storage().persistent().has(&key) {
            return Err(Error::NullifierUsed);
        }
        let mut inputs = Bytes::from_array(&env, &[0, 0, 0, 4]);
        inputs.append(&root.to_be_bytes());
        inputs.append(&nullifier_hash.to_be_bytes());
        inputs.append(&recipient_value.to_be_bytes());
        inputs.append(&U256::from_u128(&env, fee as u128).to_be_bytes());
        let verifier: Address = env
            .storage()
            .instance()
            .get(&VERIF)
            .ok_or(Error::NotInitialized)?;
        let vk: Bytes = env
            .storage()
            .instance()
            .get(&VK)
            .ok_or(Error::NotInitialized)?;
        let verifier_client = G16VerifierClient::new(&env, &verifier);
        // The workshop's protected verifier has a public mutable set_vk. Always
        // restore our pinned key immediately before verification, in the SAME
        // atomic call. No transaction can replace it between these invocations.
        // The trusted verifier has no callbacks. Neither address nor VK is mutable here.
        if !matches!(verifier_client.try_set_vk(&vk), Ok(Ok(()))) {
            return Err(Error::BadProof);
        }
        if !matches!(verifier_client.try_verify(&proof, &inputs), Ok(Ok(true))) {
            return Err(Error::BadProof);
        }
        // Persistent entries are archived, never silently deleted. Restoration
        // preserves this marker. No API can erase it; every use extends its TTL.
        env.storage().persistent().set(&key, &true);
        retain(&env, &key);
        keep_alive(&env);
        let token_id: Address = env
            .storage()
            .instance()
            .get(&TOKEN)
            .ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &token_id);
        let pool = env.current_contract_address();
        if denom > fee {
            client.transfer(&pool, &recipient, &(denom - fee));
        }
        if fee > 0 {
            client.transfer(&pool, &relayer, &fee);
        }
        Ok(())
    }

    pub fn is_known_root(env: Env, root: U256) -> bool {
        if !canonical(&env, &root) {
            return false;
        }
        for slot in 0..ROOT_HISTORY {
            if env
                .storage()
                .instance()
                .get::<_, U256>(&DataKey::RootHist(slot))
                == Some(root.clone())
            {
                return true;
            }
        }
        false
    }

    pub fn is_spent(env: Env, nullifier_hash: U256) -> bool {
        if !canonical(&env, &nullifier_hash) {
            return false;
        }
        let key = DataKey::Nullifier(key_bytes(&nullifier_hash));
        let spent = env.storage().persistent().has(&key);
        if spent {
            retain(&env, &key);
        }
        spent
    }
}

#[cfg(test)]
mod test;
