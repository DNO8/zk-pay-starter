extern crate std;
use super::*;
use soroban_sdk::xdr;
use soroban_sdk::{
    testutils::Address as _,
    xdr::{AccountId, PublicKey, ScAddress, Uint256},
    TryFromVal,
};
use std::rc::Rc;
use verifier_groth16::Groth16VerifierContract;

const DENOMINATION: i128 = 10_000_000;
const PROOF: &[u8] = include_bytes!("../tests/fixtures/proof");
const PUBLIC: &[u8] = include_bytes!("../tests/fixtures/public_inputs");
const VK: &[u8] = include_bytes!("../tests/fixtures/vk");

fn account(env: &Env, last: u8) -> Address {
    let mut payload = [0u8; 32];
    payload[31] = last;
    Address::try_from_val(
        env,
        &ScAddress::Account(AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(payload)))),
    )
    .unwrap()
}
fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();
    let admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(admin.clone());
    // Account-address recipients need actual classic account/trustline entries.
    for last in [7, 8, 9] {
        let addr = account(&env, last);
        let aid = match ScAddress::from(&addr) {
            ScAddress::Account(a) => a,
            _ => unreachable!(),
        };
        let asset = match token.asset() {
            xdr::Asset::CreditAlphanum4(a) => xdr::TrustLineAsset::CreditAlphanum4(a),
            _ => unreachable!(),
        };
        let key = xdr::LedgerKey::Account(xdr::LedgerKeyAccount {
            account_id: aid.clone(),
        });
        let data = xdr::LedgerEntryData::Account(xdr::AccountEntry {
            account_id: aid.clone(),
            balance: 1_000_000_000,
            flags: 0,
            home_domain: Default::default(),
            inflation_dest: None,
            num_sub_entries: 1,
            seq_num: xdr::SequenceNumber(0),
            thresholds: xdr::Thresholds([1; 4]),
            signers: Default::default(),
            ext: xdr::AccountEntryExt::V0,
        });
        env.host()
            .add_ledger_entry(
                &Rc::new(key),
                &Rc::new(xdr::LedgerEntry {
                    data,
                    last_modified_ledger_seq: 0,
                    ext: xdr::LedgerEntryExt::V0,
                }),
                None,
            )
            .unwrap();
        let key = xdr::LedgerKey::Trustline(xdr::LedgerKeyTrustLine {
            account_id: aid.clone(),
            asset: asset.clone(),
        });
        let data = xdr::LedgerEntryData::Trustline(xdr::TrustLineEntry {
            account_id: aid,
            asset,
            balance: 0,
            limit: i64::MAX,
            flags: xdr::TrustLineFlags::AuthorizedFlag as u32,
            ext: xdr::TrustLineEntryExt::V0,
        });
        env.host()
            .add_ledger_entry(
                &Rc::new(key),
                &Rc::new(xdr::LedgerEntry {
                    data,
                    last_modified_ledger_seq: 0,
                    ext: xdr::LedgerEntryExt::V0,
                }),
                None,
            )
            .unwrap();
    }
    let verifier = env.register(Groth16VerifierContract, ());
    let pool = env.register(
        Pool,
        (
            admin.clone(),
            token.address(),
            DENOMINATION,
            verifier,
            Bytes::from_slice(&env, VK),
        ),
    );
    (env, pool, token.address(), admin)
}
fn fixture_pool() -> (Env, Address, Address, Address) {
    let (env, pool, token, admin) = setup();
    let depositor = account(&env, 9);
    token::StellarAssetClient::new(&env, &token).mint(&depositor, &(2 * DENOMINATION));
    let client = PoolClient::new(&env, &pool);
    for (n, s) in [(1, 2), (3, 4)] {
        let commitment = client.hash2(&U256::from_u32(&env, n), &U256::from_u32(&env, s));
        client.deposit(&depositor, &commitment);
    }
    assert_eq!(client.current_root(), field(&env, 0));
    (env, pool, token, admin)
}
fn field(env: &Env, i: usize) -> U256 {
    U256::from_be_bytes(
        env,
        &Bytes::from_slice(env, &PUBLIC[4 + i * 32..4 + (i + 1) * 32]),
    )
}
fn hex(env: &Env, s: &str) -> U256 {
    let mut bytes = [0; 32];
    for i in 0..32 {
        bytes[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap();
    }
    u256_from_be(env, &bytes)
}
#[test]
fn hash2_matches_shared_vector() {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    assert_eq!(
        poseidon_hash2(&env, &U256::from_u32(&env, 1), &U256::from_u32(&env, 2)),
        hex(
            &env,
            "115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a"
        )
    );
}
#[test]
fn insert_matches_shared_root() {
    let (env, pool, token, _) = setup();
    let alice = account(&env, 9);
    token::StellarAssetClient::new(&env, &token).mint(&alice, &DENOMINATION);
    let client = PoolClient::new(&env, &pool);
    let c = client.hash2(&U256::from_u32(&env, 1), &U256::from_u32(&env, 2));
    assert_eq!(client.deposit(&alice, &c), 0);
    assert_eq!(
        client.current_root(),
        hex(
            &env,
            "2bc1d1747efc8efb64de5bd56a83aa95bbc06f9a699e6054b8bffed5b336c718"
        )
    );
    assert_eq!(client.next_index(), 1);
    assert_eq!(
        token::Client::new(&env, &token).balance(&pool),
        DENOMINATION
    );
    assert_eq!(
        client.try_deposit(&alice, &c),
        Err(Ok(Error::DuplicateCommitment))
    );
}
#[test]
fn withdraw_verifies_vector_proof() {
    let (env, pool, token, _) = fixture_pool();
    let client = PoolClient::new(&env, &pool);
    let recipient = account(&env, 7);
    client.withdraw(
        &Bytes::from_slice(&env, PROOF),
        &field(&env, 0),
        &field(&env, 1),
        &recipient,
        &0,
        &recipient,
    );
    assert!(client.is_spent(&field(&env, 1)));
    assert_eq!(
        token::Client::new(&env, &token).balance(&recipient),
        DENOMINATION
    );
    assert_eq!(
        token::Client::new(&env, &token).balance(&pool),
        DENOMINATION
    );
}
#[test]
fn rejects_reused_nullifier() {
    let (env, pool, token, _) = fixture_pool();
    let client = PoolClient::new(&env, &pool);
    let recipient = account(&env, 7);
    let proof = Bytes::from_slice(&env, PROOF);
    let root = field(&env, 0);
    let nh = field(&env, 1);
    client.withdraw(&proof, &root, &nh, &recipient, &0, &recipient);
    assert_eq!(
        client.try_withdraw(&proof, &root, &nh, &recipient, &0, &recipient),
        Err(Ok(Error::NullifierUsed))
    );
    assert_eq!(
        token::Client::new(&env, &token).balance(&recipient),
        DENOMINATION
    );
}
#[test]
fn rejects_unknown_root() {
    let (env, pool, _, _) = setup();
    let client = PoolClient::new(&env, &pool);
    let recipient = account(&env, 7);
    assert_eq!(
        client.try_withdraw(
            &Bytes::new(&env),
            &U256::from_u32(&env, 42),
            &field(&env, 1),
            &recipient,
            &0,
            &recipient
        ),
        Err(Ok(Error::UnknownRoot))
    );
}
#[test]
fn rejects_tampered_proof_recipient_fee_and_nullifier_without_spending() {
    let (env, pool, token, _) = fixture_pool();
    let client = PoolClient::new(&env, &pool);
    let recipient = account(&env, 7);
    let proof = Bytes::from_slice(&env, PROOF);
    let root = field(&env, 0);
    let nh = field(&env, 1);
    assert_eq!(
        client.try_withdraw(&Bytes::new(&env), &root, &nh, &recipient, &0, &recipient),
        Err(Ok(Error::BadProof))
    );
    let mut changed = proof.clone();
    changed.set(0, changed.get(0).unwrap() ^ 1);
    assert_eq!(
        client.try_withdraw(&changed, &root, &nh, &recipient, &0, &recipient),
        Err(Ok(Error::BadProof))
    );
    assert_eq!(
        client.try_withdraw(&proof, &root, &nh, &account(&env, 8), &0, &recipient),
        Err(Ok(Error::BadProof))
    );
    assert_eq!(
        client.try_withdraw(&proof, &root, &nh, &recipient, &1, &recipient),
        Err(Ok(Error::BadProof))
    );
    assert_eq!(
        client.try_withdraw(
            &proof,
            &root,
            &U256::from_u32(&env, 99),
            &recipient,
            &0,
            &recipient
        ),
        Err(Ok(Error::BadProof))
    );
    for fee in [-1, DENOMINATION + 1] {
        assert_eq!(
            client.try_withdraw(&proof, &root, &nh, &recipient, &fee, &recipient),
            Err(Ok(Error::WrongAmount))
        );
    }
    assert!(!client.is_spent(&nh));
    assert_eq!(
        token::Client::new(&env, &token).balance(&pool),
        2 * DENOMINATION
    );
}
#[test]
fn rejects_noncanonical_fields_and_contract_recipient() {
    let (env, pool, _, _) = setup();
    let client = PoolClient::new(&env, &pool);
    let recipient = account(&env, 7);
    let modulus = u256_from_be(&env, &MODULUS);
    assert_eq!(
        client.try_deposit(&recipient, &modulus),
        Err(Ok(Error::NonCanonicalField))
    );
    assert_eq!(
        client.try_withdraw(
            &Bytes::new(&env),
            &modulus,
            &field(&env, 1),
            &recipient,
            &0,
            &recipient
        ),
        Err(Ok(Error::NonCanonicalField))
    );
    assert_eq!(
        client.try_withdraw(
            &Bytes::new(&env),
            &client.current_root(),
            &modulus,
            &recipient,
            &0,
            &recipient
        ),
        Err(Ok(Error::NonCanonicalField))
    );
    assert_eq!(
        client.try_withdraw(
            &Bytes::new(&env),
            &client.current_root(),
            &field(&env, 1),
            &Address::generate(&env),
            &0,
            &recipient
        ),
        Err(Ok(Error::BadRecipient))
    );
}
#[test]
fn failed_payout_rolls_back_nullifier() {
    let (env, pool, token, _) = fixture_pool();
    let client = PoolClient::new(&env, &pool);
    let recipient = account(&env, 7);
    // Deliberately drain the mock-authorized token balance to force payout failure.
    token::Client::new(&env, &token).transfer(&pool, &account(&env, 9), &(2 * DENOMINATION));
    assert!(client
        .try_withdraw(
            &Bytes::from_slice(&env, PROOF),
            &field(&env, 0),
            &field(&env, 1),
            &recipient,
            &0,
            &recipient
        )
        .is_err());
    assert!(!client.is_spent(&field(&env, 1)));
}
#[test]
fn root_history_is_exactly_32_and_tree_stops_at_256() {
    let (env, pool, token, _) = setup();
    let client = PoolClient::new(&env, &pool);
    let alice = account(&env, 9);
    token::StellarAssetClient::new(&env, &token).mint(&alice, &(257 * DENOMINATION));
    let empty = client.current_root();
    let mut first = empty.clone();
    for i in 0..256 {
        assert_eq!(client.deposit(&alice, &U256::from_u32(&env, i + 1)), i);
        if i == 0 {
            first = client.current_root();
        }
        if i == 30 {
            assert!(client.is_known_root(&empty));
        }
        if i == 31 {
            assert!(!client.is_known_root(&empty));
            assert!(client.is_known_root(&first));
        }
        if i == 32 {
            assert!(!client.is_known_root(&first));
        }
    }
    assert_eq!(
        client.try_deposit(&alice, &U256::from_u32(&env, 257)),
        Err(Ok(Error::TreeFull))
    );
    assert_eq!(
        token::Client::new(&env, &token).balance(&pool),
        256 * DENOMINATION
    );
    assert_eq!(client.next_index(), 256);
}
#[test]
fn unfunded_deposit_does_not_insert() {
    let (env, pool, _, _) = setup();
    let client = PoolClient::new(&env, &pool);
    let empty = client.current_root();
    assert!(client
        .try_deposit(&account(&env, 9), &U256::from_u32(&env, 1))
        .is_err());
    assert_eq!(client.next_index(), 0);
    assert_eq!(client.current_root(), empty);
}

#[test]
fn external_vk_replacement_cannot_change_the_pinned_verification_key() {
    let (env, pool, token, _) = fixture_pool();
    let recipient = account(&env, 7);
    let verifier: Address =
        env.as_contract(&pool, || env.storage().instance().get(&VERIF).unwrap());
    // Swap two valid IC curve points: structurally valid, but a different VK.
    let mut hostile = Bytes::from_slice(&env, VK);
    for i in 0..64 {
        hostile.set(452 + i, VK[516 + i as usize]);
        hostile.set(516 + i, VK[452 + i as usize]);
    }
    G16VerifierClient::new(&env, &verifier).set_vk(&hostile);
    let client = PoolClient::new(&env, &pool);
    client.withdraw(
        &Bytes::from_slice(&env, PROOF),
        &field(&env, 0),
        &field(&env, 1),
        &recipient,
        &0,
        &recipient,
    );
    assert_eq!(
        token::Client::new(&env, &token).balance(&recipient),
        DENOMINATION
    );
    assert!(client.is_spent(&field(&env, 1)));
}

#[test]
fn recipient_must_authorize_even_with_a_valid_proof() {
    let (env, pool, token, _) = fixture_pool();
    let recipient = account(&env, 7);
    env.mock_auths(&[]);
    let client = PoolClient::new(&env, &pool);
    assert!(client
        .try_withdraw(
            &Bytes::from_slice(&env, PROOF),
            &field(&env, 0),
            &field(&env, 1),
            &recipient,
            &0,
            &recipient
        )
        .is_err());
    assert!(!client.is_spent(&field(&env, 1)));
    assert_eq!(
        token::Client::new(&env, &token).balance(&pool),
        2 * DENOMINATION
    );
}

#[test]
fn same_field_alias_cannot_redirect_without_account_authorization() {
    let (env, pool, _, _) = fixture_pool();
    let recipient = account(&env, 7);
    let alias_value = u256_from_be(&env, &MODULUS).add(&U256::from_u32(&env, 7));
    let mut payload = [0u8; 32];
    alias_value.to_be_bytes().copy_into_slice(&mut payload);
    let alias = Address::try_from_val(
        &env,
        &ScAddress::Account(AccountId(PublicKey::PublicKeyTypeEd25519(Uint256(payload)))),
    )
    .unwrap();
    assert_ne!(recipient, alias);
    assert_eq!(
        recipient_field(&env, &recipient),
        recipient_field(&env, &alias)
    );
    env.mock_auths(&[]);
    let client = PoolClient::new(&env, &pool);
    assert!(client
        .try_withdraw(
            &Bytes::from_slice(&env, PROOF),
            &field(&env, 0),
            &field(&env, 1),
            &alias,
            &0,
            &alias
        )
        .is_err());
    assert!(!client.is_spent(&field(&env, 1)));
}
