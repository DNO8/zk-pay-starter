use poseidon_classic::hash2;

global TREE_DEPTH: u32 = 8;
global DOMAIN_NULLIFIER: Field = 1;

// Public order is part of the verifier ABI: root, nullifier hash, recipient, fee.
fn main(
    root: pub Field,
    nullifier_hash: pub Field,
    recipient: pub Field,
    fee: pub Field,
    nullifier: Field,
    secret: Field,
    path_elements: [Field; 8],
    path_indices: [Field; 8],
) {
    let mut current = hash2(nullifier, secret);
    for i in 0..TREE_DEPTH {
        let bit = path_indices[i];
        assert(bit * (bit - 1) == 0);
        let left = current + bit * (path_elements[i] - current);
        let right = path_elements[i] + bit * (current - path_elements[i]);
        current = hash2(left, right);
    }
    assert(current == root);
    assert(hash2(nullifier, DOMAIN_NULLIFIER) == nullifier_hash);
    // Keep payout inputs constrained as well as public in the proof transcript.
    // Fees are unsigned stroops; the pool enforces fee <= denomination.
    assert(recipient != 0);
    assert(fee == (fee as u64) as Field);
}

fn vector_path() -> [Field; 8] {
    [14763215145315200506921711489642608356394854266165572616578112107564877678998,
        14744269619966411208579211824598458697587494354926760081771325075741142829156,
        7423237065226347324353380772367382631490014989348495481811164164159255474657,
        11286972368698509976183087595462810875513684078608517520839298933882497716792,
        3607627140608796879659380071776844901612302623152076817094415224584923813162,
        19712377064642672829441595136074946683621277828620209496774504837737984048981,
        20775607673010627194014556968476266066927294572720319469184847051418138353016,
        3396914609616007258851405644437304192397291162432396347162513310381425243293]
}

#[test]
fn withdraw_proves_vector_1() {
    main(2405083059435650308762806090871725478384356217547841505314567986690485505655, 217234377348884654691879377518794323857294947151490278790710809376325639809, 7, 0, 1, 2, vector_path(), [0; 8]);
}

#[test(should_fail)]
fn withdraw_rejects_wrong_path() {
    main(2405083059435650308762806090871725478384356217547841505314567986690485505655, 217234377348884654691879377518794323857294947151490278790710809376325639809, 7, 0, 1, 2, [1; 8], [0; 8]);
}

#[test(should_fail)]
fn withdraw_rejects_non_boolean_index() {
    main(2405083059435650308762806090871725478384356217547841505314567986690485505655, 217234377348884654691879377518794323857294947151490278790710809376325639809, 7, 0, 1, 2, vector_path(), [2, 0, 0, 0, 0, 0, 0, 0]);
}

#[test(should_fail)]
fn withdraw_rejects_wrong_nullifier() {
    main(2405083059435650308762806090871725478384356217547841505314567986690485505655, 1, 7, 0, 1, 2, vector_path(), [0; 8]);
}
