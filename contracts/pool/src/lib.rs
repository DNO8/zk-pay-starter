#![no_std]
//! Privacy-pool skeleton. Deposit transfers a fixed denomination and emits the
//! commitment. Merkle insert, nullifier set, and public-input wiring are GAPS.

mod poseidon_params;

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, token,
    Address, Bytes, BytesN, Env, Symbol, Vec, U256,
};

use poseidon_params::{D, MDS_BE, RC_BE, ROUNDS_F, ROUNDS_P, T};

const TOKEN: Symbol = symbol_short!("TOKEN");
const DENOM: Symbol = symbol_short!("DENOM");
const VERIF: Symbol = symbol_short!("VERIF");
const NEXT: Symbol = symbol_short!("NEXT");
const ROOT: Symbol = symbol_short!("ROOT");
const ADMIN: Symbol = symbol_short!("ADMIN");

/// How many historical Merkle roots the contract remembers (GAP-3).
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
    TodoGap = 7,
}

#[contracttype]
pub enum DataKey {
    RootHist(u32),
    Node(u32, u32), // level, index
    Nullifier(BytesN<32>),
    Zero(u32),
}

#[contractevent]
pub struct DepositEvent {
    pub from: Address,
    pub index: u32,
    pub commitment: U256,
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
    let out = env.crypto_hazmat().poseidon_permutation(
        &input, field, T, D, ROUNDS_F, ROUNDS_P, &mds, &rc,
    );
    out.get(0).unwrap()
}

fn zeros_at(env: &Env, level: u32) -> U256 {
    if let Some(z) = env.storage().instance().get(&DataKey::Zero(level)) {
        return z;
    }
    let mut z = U256::from_u32(env, 0);
    for _ in 0..level {
        z = poseidon_hash2(env, &z, &z);
    }
    env.storage().instance().set(&DataKey::Zero(level), &z);
    z
}

#[contractimpl]
impl Pool {
    pub fn __constructor(env: Env, admin: Address, token: Address, denomination: i128, verifier: Address) {
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOKEN, &token);
        env.storage().instance().set(&DENOM, &denomination);
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

    /// GIVEN helper so hackers can compare on-chain Poseidon against golden vectors.
    pub fn hash2(env: Env, a: U256, b: U256) -> U256 {
        poseidon_hash2(&env, &a, &b)
    }

    /// Deposit `denomination` of `token` from `from` and record `commitment`.
    /// TODO(GAP-3): on-chain Merkle insert (CAP-0075, shared params) + root history
    ///   → docs/lessons/03.md#hints
    pub fn deposit(env: Env, from: Address, commitment: U256) -> Result<u32, Error> {
        from.require_auth();
        let token_id: Address = env.storage().instance().get(&TOKEN).ok_or(Error::NotInitialized)?;
        let denom: i128 = env.storage().instance().get(&DENOM).ok_or(Error::NotInitialized)?;
        let client = token::Client::new(&env, &token_id);
        client.transfer(&from, &env.current_contract_address(), &denom);

        let index: u32 = env.storage().instance().get(&NEXT).unwrap_or(0);
        if index >= (1u32 << TREE_DEPTH) {
            return Err(Error::TreeFull);
        }

        // TODO(GAP-3): insert `commitment` at `index`, recompute the path up to the
        // root with poseidon_hash2, append the new root to the ring buffer of
        // ROOT_HISTORY roots, bump NEXT.
        let _ = commitment;
        DepositEvent {
            from: from.clone(),
            index,
            commitment,
        }
        .publish(&env);
        Ok(index)
    }

    /// TODO(GAP-4): nullifier set + double-spend reject → docs/lessons/05.md#hints
    /// TODO(GAP-5): public-input wiring to the verifier (order, encoding, recipient/fee)
    ///   → docs/lessons/04.md#hints
    pub fn withdraw(
        env: Env,
        proof: Bytes,
        root: U256,
        nullifier_hash: U256,
        recipient: Address,
        fee: i128,
        relayer: Address,
    ) -> Result<(), Error> {
        let _ = (env, proof, root, nullifier_hash, recipient, fee, relayer);
        // Skeleton: always refuse until GAP-4 and GAP-5 are filled in.
        Err(Error::TodoGap)
    }

    pub fn is_known_root(_env: Env, _root: U256) -> bool {
        // TODO(GAP-3): look up root history
        false
    }

    pub fn is_spent(_env: Env, _nullifier_hash: U256) -> bool {
        // TODO(GAP-4)
        false
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    fn setup() -> (Env, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(admin.clone());
        let verifier = Address::generate(&env);
        let pool_id = env.register(
            Pool,
            (admin.clone(), token.address(), 10_0000000i128, verifier.clone()),
        );
        (env, pool_id, token.address(), admin)
    }

    #[test]
    fn hash2_matches_shared_vector() {
        let env = Env::default();
        env.cost_estimate().budget().reset_unlimited();
        let a = U256::from_u32(&env, 1);
        let b = U256::from_u32(&env, 2);
        let got = poseidon_hash2(&env, &a, &b);
        // golden.hash2_1_2
        let expected = U256::from_be_bytes(
            &env,
            &Bytes::from_slice(
                &env,
                &hex_literal("115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a"),
            ),
        );
        assert_eq!(got, expected);
    }

    fn hex_literal(s: &str) -> [u8; 32] {
        let mut out = [0u8; 32];
        for i in 0..32 {
            out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap();
        }
        out
    }

    #[test]
    fn insert_matches_shared_root() {
        let (env, pool_id, token, admin) = setup();
        env.cost_estimate().budget().reset_unlimited();
        let sac = token::StellarAssetClient::new(&env, &token);
        let alice = Address::generate(&env);
        sac.mint(&alice, &10_0000000);
        let client = PoolClient::new(&env, &pool_id);
        let c1 = client.hash2(&U256::from_u32(&env, 1), &U256::from_u32(&env, 2));
        client.deposit(&alice, &c1);
        let expected = U256::from_be_bytes(
            &env,
            &Bytes::from_slice(
                &env,
                &hex_literal("2bc1d1747efc8efb64de5bd56a83aa95bbc06f9a699e6054b8bffed5b336c718"),
            ),
        );
        // golden.merkle.root_after_1 as BE. The test is red until GAP-3 inserts.
        assert_eq!(client.current_root(), expected);
        let _ = admin;
    }

    #[test]
    fn rejects_reused_nullifier() {
        let (env, pool_id, _token, _admin) = setup();
        let client = PoolClient::new(&env, &pool_id);
        let dummy = Bytes::from_slice(&env, &[0u8; 8]);
        let root = client.current_root();
        let nh = U256::from_u32(&env, 1);
        let recipient = Address::generate(&env);
        let first = client.try_withdraw(&dummy, &root, &nh, &recipient, &0, &recipient);
        let second = client.try_withdraw(&dummy, &root, &nh, &recipient, &0, &recipient);
        assert!(first.is_ok(), "first withdraw of a valid note should succeed once GAP-4/5 are done");
        assert_eq!(second, Err(Ok(Error::NullifierUsed)));
    }

    #[test]
    fn rejects_unknown_root() {
        let (env, pool_id, _token, _admin) = setup();
        let client = PoolClient::new(&env, &pool_id);
        let dummy = Bytes::from_slice(&env, &[0u8; 8]);
        let unknown = U256::from_u32(&env, 42);
        let recipient = Address::generate(&env);
        assert_eq!(
            client.try_withdraw(&dummy, &unknown, &U256::from_u32(&env, 1), &recipient, &0, &recipient),
            Err(Ok(Error::UnknownRoot))
        );
    }

    #[test]
    fn withdraw_verifies_vector_proof() {
        let (env, pool_id, _token, _admin) = setup();
        let client = PoolClient::new(&env, &pool_id);
        let dummy = Bytes::from_slice(&env, &[0u8; 8]);
        let recipient = Address::generate(&env);
        let result = client.try_withdraw(
            &dummy,
            &client.current_root(),
            &U256::from_u32(&env, 1),
            &recipient,
            &0,
            &recipient,
        );
        assert!(result.is_ok(), "TODO(GAP-5): withdraw should verify a real vector proof. See docs/lessons/04.md#hints");
    }
}
